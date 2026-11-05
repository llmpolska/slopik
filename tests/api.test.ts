import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import { jevPayload, parseJev } from "../worker/jev";
import { hasSession, sessionCookie } from "../worker/session";
const upstream = {
  model: "jev-1.14.0",
  answers: {
    kind: { choice: "idea" },
    verdict: { choice: "test" },
    advantage: { choice: "simple" },
    flaw: { choice: "demand" },
    demand: { score: 2.5 },
    feasible: { score: 2.5 },
    distinct: { score: 2.5 },
  },
};
function environment() {
  return {
    JEV_API_KEY: "test-secret-not-real",
    TURNSTILE_SECRET_KEY: "test-turnstile",
    SESSION_SECRET: "test-session-secret-with-more-than-32-characters",
    TURNSTILE_SITE_KEY: "public-site-key",
    ALLOWED_HOSTNAME: "slopik.pl",
    ASSETS: { fetch: vi.fn(), connect: vi.fn() },
    IP_LIMIT: { limit: vi.fn().mockResolvedValue({ success: true }) },
    GLOBAL_LIMIT: { limit: vi.fn().mockResolvedValue({ success: true }) },
  };
}
function request({
  path = "/api/verdict",
  body = { question: "Kebab na abonament" },
  cookie = "",
  origin = "https://slopik.pl",
}: { path?: string; body?: unknown; cookie?: string; origin?: string } = {}) {
  return new Request("https://slopik.pl" + path, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.0.2.1",
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
}
async function authorized(body: unknown = { question: "Kebab na abonament" }) {
  const cookie = (await sessionCookie(environment().SESSION_SECRET)).split(
    ";",
  )[0];
  return request({ body, cookie });
}
const run = (req: Request, env = environment()) => worker.fetch(req, env);
afterEach(() => vi.unstubAllGlobals());
describe("Jev contract", () => {
  it("pins Jev and sends typed questions, never chat messages", () => {
    const body = jevPayload({ question: "Czy to ma sens?" });
    expect(body.model).toBe("jev-1.14.0");
    expect(body.questions.kind.type).toBe("choice");
    expect(body.questions.demand.type).toBe("score");
    expect(body).not.toHaveProperty("messages");
  });
  it("references image assets in state", () => {
    const body = jevPayload({
      question: "Oceń",
      attachment: { format: "jpg", data: "/9j/AA==" },
    });
    expect(body.state.image).toBe(Object.keys(body.assets ?? {})[0]);
  });
  it("produces a bounded idea result and score-consistent verdict", () => {
    expect(parseJev(upstream)).toMatchObject({ kind: "idea", score: 6.3 });
    const low = {
      ...upstream,
      answers: {
        ...upstream.answers,
        verdict: { choice: "yes" },
        demand: { score: 0 },
        feasible: { score: 0 },
        distinct: { score: 0 },
      },
    };
    expect(parseJev(low).verdict).toMatch(/^Nie\./);
  });
  it("rejects invalid provider output", () => {
    expect(() =>
      parseJev({
        ...upstream,
        answers: { ...upstream.answers, verdict: { choice: "<script>" } },
      }),
    ).toThrow();
    expect(() =>
      parseJev({
        ...upstream,
        answers: { ...upstream.answers, demand: { score: 99 } },
      }),
    ).toThrow();
  });
});
describe("Signed verification sessions", () => {
  it("sets an HttpOnly host-only secure cookie", async () => {
    const cookie = await sessionCookie(environment().SESSION_SECRET);
    expect(cookie).toContain("__Host-slopik_session=");
    for (const flag of [
      "Path=/",
      "Secure",
      "HttpOnly",
      "SameSite=Strict",
      "Max-Age=1800",
    ])
      expect(cookie).toContain(flag);
    expect(cookie).not.toContain("Domain=");
  });
  it("rejects modified, expired and future cookies", async () => {
    const secret = environment().SESSION_SECRET;
    const now = Date.now();
    const cookie = (await sessionCookie(secret, now)).split(";")[0];
    expect(await hasSession(request({ cookie }), secret, now)).toBe(true);
    expect(
      await hasSession(
        request({
          cookie: cookie.slice(0, -1) + (cookie.endsWith("0") ? "1" : "0"),
        }),
        secret,
        now,
      ),
    ).toBe(false);
    expect(await hasSession(request({ cookie }), secret, now + 1800_000)).toBe(
      false,
    );
    expect(await hasSession(request({ cookie }), secret, now - 60_000)).toBe(
      false,
    );
    expect(await hasSession(request({ cookie }), "different-secret", now)).toBe(
      false,
    );
  });
  it.each(["", "__Host-slopik_session=forged"])(
    "blocks API without a valid session: %s",
    async (cookie) => {
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      expect((await run(request({ cookie }))).status).toBe(401);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it("config derives verification state from signed cookie", async () => {
    const cookie = (await sessionCookie(environment().SESSION_SECRET)).split(
      ";",
    )[0];
    const response = await run(
      new Request("https://slopik.pl/api/config", {
        headers: { Cookie: cookie },
      }),
    );
    expect(await response.json()).toMatchObject({ verified: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
describe("Initial Turnstile verification", () => {
  it.each([
    { success: false },
    { success: true, hostname: "evil.example", action: "access" },
    { success: true, hostname: "slopik.pl", action: "other" },
  ])("rejects invalid verification %j", async (result) => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(result));
    vi.stubGlobal("fetch", fetcher);
    const response = await run(
      request({ path: "/api/verify", body: { token: "test-token" } }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.has("Set-Cookie")).toBe(false);
  });
  it("validates once and issues a session without revealing secrets", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          success: true,
          hostname: "slopik.pl",
          action: "access",
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const response = await run(
      request({ path: "/api/verify", body: { token: "test-token" } }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(await response.text()).not.toContain("secret");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects oversized verification bodies before Siteverify", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(
      (
        await run(
          request({ path: "/api/verify", body: { token: "x".repeat(5000) } }),
        )
      ).status,
    ).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
describe("API security and failure behavior", () => {
  it("permits the dev proxy only on a loopback Worker", async () => {
    const env = environment();
    env.JEV_API_KEY = "";
    const local = new Request("http://127.0.0.1:8787/api/verdict", {
      method: "POST",
      headers: {
        Origin: "http://localhost:5173",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect((await run(local, env)).status).toBe(503);
    expect(
      (await run(request({ origin: "http://localhost:5173" }))).status,
    ).toBe(403);
  });
  it("blocks foreign origins even with valid cookies", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const cookie = (await sessionCookie(environment().SESSION_SECRET)).split(
      ";",
    )[0];
    expect(
      (await run(request({ origin: "https://evil.example", cookie }))).status,
    ).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("fails closed without secrets", async () => {
    const env = environment();
    env.SESSION_SECRET = "";
    expect((await run(request(), env)).status).toBe(503);
  });
  it("rejects oversized streamed bodies", async () => {
    expect(
      (await run(await authorized({ question: "x".repeat(1_450_001) }))).status,
    ).toBe(413);
  });
  it("rejects invalid input without spending provider tokens", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect((await run(await authorized({ question: " " }))).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("blocks limited clients", async () => {
    const env = environment();
    env.IP_LIMIT.limit.mockResolvedValue({ success: false });
    expect((await run(await authorized(), env)).status).toBe(429);
  });
  it("uses the fixed Jev endpoint after session verification", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(upstream));
    vi.stubGlobal("fetch", fetcher);
    const response = await run(await authorized());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.typesafe.ai/v1/systemone",
    );
    expect(await response.text()).not.toContain("test-secret");
  });
  it("never relays upstream errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("private provider error test-secret", { status: 500 }),
        ),
    );
    const response = await run(await authorized());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("test-secret");
  });
});
