const cookieName = "__Host-slopik_session";
const duration = 30 * 60;
const encoder = new TextEncoder();
async function signingKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
export async function sessionCookie(secret: string, now = Date.now()) {
  const payload = `${Math.floor(now / 1000)}.${crypto.randomUUID()}`;
  const signature = toHex(
    await crypto.subtle.sign(
      "HMAC",
      await signingKey(secret),
      encoder.encode(payload),
    ),
  );
  return `${cookieName}=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${duration}`;
}
export async function hasSession(
  request: Request,
  secret: string | undefined,
  now = Date.now(),
) {
  if (!secret) return false;
  const value = request.headers
    .get("Cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!value || !/^\d{10}\.[0-9a-f-]{36}\.[0-9a-f]{64}$/.test(value))
    return false;
  const [issued, nonce, signature] = value.split(".");
  const age = Math.floor(now / 1000) - Number(issued);
  if (age < 0 || age >= duration) return false;
  const bytes = Uint8Array.from(signature.match(/../g) ?? [], (pair) =>
    parseInt(pair, 16),
  );
  return crypto.subtle.verify(
    "HMAC",
    await signingKey(secret),
    bytes,
    encoder.encode(`${issued}.${nonce}`),
  );
}
