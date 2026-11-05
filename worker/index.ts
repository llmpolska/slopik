import { z } from "zod";
import { RequestSchema } from "../src/domain";
import { jevPayload, parseJev } from "./jev";
import { hasSession, sessionCookie } from "./session";
type WorkerEnv = Cloudflare.Env & {
  JEV_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  SESSION_SECRET?: string;
};
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const fail = (message: string, status: number) =>
  json({ error: message }, status);
const ChallengeSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
});
async function limitedBody(request: Request, maximum = 1_450_000) {
  if (!request.body) throw new Error("empty");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) {
        await reader.cancel();
        throw new Error("large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/config")
      return json({
        siteKey: env.TURNSTILE_SITE_KEY,
        ready: Boolean(
          env.JEV_API_KEY &&
          env.TURNSTILE_SECRET_KEY &&
          env.TURNSTILE_SITE_KEY &&
          env.SESSION_SECRET,
        ),
        verified: await hasSession(request, env.SESSION_SECRET),
        model: "jev-1.14.0",
      });
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!["/api/verdict", "/api/verify"].includes(url.pathname))
      return fail("Nie ma takiej wyroczni.", 404);
    if (request.method !== "POST") return fail("Użyj formularza.", 405);
    const origin = request.headers.get("Origin");
    const localNextProxy =
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      ["http://localhost:5173", "http://127.0.0.1:5173"].includes(origin ?? "");
    if (origin !== url.origin && !localNextProxy)
      return fail("Zapytaj na stronie Slopika.", 403);
    if (
      !env.JEV_API_KEY ||
      !env.TURNSTILE_SECRET_KEY ||
      !env.TURNSTILE_SITE_KEY ||
      !env.SESSION_SECRET
    )
      return fail(
        "Wyrocznia jest chwilowo niedostępna. Spróbuj ponownie za moment.",
        503,
      );
    if (!request.headers.get("Content-Type")?.startsWith("application/json"))
      return fail("Nieprawidłowy format pytania.", 415);
    try {
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      if (!(await env.IP_LIMIT.limit({ key: ip })).success)
        return fail("Nosacz łapie oddech. Spróbuj za minutę.", 429);
      if (url.pathname === "/api/verify") {
        let input: unknown;
        try {
          input = await limitedBody(request, 4096);
        } catch {
          return fail("Nieprawidłowa weryfikacja.", 400);
        }
        const parsed = z
          .object({ token: z.string().min(1).max(2048) })
          .safeParse(input);
        if (!parsed.success) return fail("Nieprawidłowa weryfikacja.", 400);
        const challenge = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret: env.TURNSTILE_SECRET_KEY,
              response: parsed.data.token,
              remoteip: ip,
            }),
            signal: AbortSignal.timeout(8000),
          },
        );
        const checked = ChallengeSchema.parse(await challenge.json());
        if (
          !challenge.ok ||
          !checked.success ||
          checked.hostname !== env.ALLOWED_HOSTNAME ||
          checked.action !== "access"
        )
          return fail("Weryfikacja nie powiodła się. Spróbuj ponownie.", 403);
        const response = json({ verified: true });
        response.headers.set(
          "Set-Cookie",
          await sessionCookie(env.SESSION_SECRET),
        );
        return response;
      }
      if (!(await hasSession(request, env.SESSION_SECRET)))
        return fail("Potwierdź, że jesteś człowiekiem.", 401);
      let raw: unknown;
      try {
        raw = await limitedBody(request);
      } catch {
        return fail("Pytanie lub załącznik jest za duży albo uszkodzony.", 413);
      }
      const parsed = RequestSchema.safeParse(raw);
      if (!parsed.success)
        return fail(
          "Sprawdź pytanie i załącznik. Maksymalnie 1500 znaków i jeden obraz.",
          400,
        );
      if (!(await env.GLOBAL_LIMIT.limit({ key: "all" })).success)
        return fail("Kolejka do nosacza jest pełna. Spróbuj za minutę.", 429);
      const upstream = await fetch("https://api.typesafe.ai/v1/systemone", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.JEV_API_KEY}`,
          "Content-Type": "application/json",
          ...(parsed.data.attachment
            ? { "TypeSafe-Danger-Zone-Images": "true" }
            : {}),
        },
        body: JSON.stringify(jevPayload(parsed.data)),
        signal: AbortSignal.timeout(25000),
      });
      if (!upstream.ok)
        return fail(
          "Jev ma chwilową przerwę. Spróbuj ponownie za moment.",
          502,
        );
      return json({
        verdict: parseJev(await upstream.json()),
        model: "jev-1.14.0",
      });
    } catch {
      return fail("Kosmiczne zakłócenia. Nosacz prosi o kolejną próbę.", 502);
    }
  },
};
