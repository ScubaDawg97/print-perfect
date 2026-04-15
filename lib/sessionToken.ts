// ─── Cryptographically signed session tokens ───────────────────────────────────
//
// Used to replace the forgeable pp_beta_unlocked=1 cookie with a cookie whose
// value can only be produced by someone who knows SESSION_SECRET. Even if an
// attacker sees the cookie value in DevTools, they cannot forge a new one without
// the secret. Token expiry ensures stale sessions are automatically invalidated.
//
// Implementation uses Web Crypto API (crypto.subtle) so it works in both the
// Next.js Edge runtime (middleware) and the Node.js runtime (API routes).
//
// Token format (before base64url encoding):
//   "{unix-timestamp-ms}.{HMAC-SHA256-hex}"

const SECRET = process.env.SESSION_SECRET;

if (typeof process !== "undefined" && process.env.NODE_ENV === "production" && process.env.VERCEL) {
  if (!SECRET || SECRET.length < 32) {
    throw new Error(
      "SESSION_SECRET environment variable is not set or too short (minimum 32 characters). " +
      "Add it in your Vercel project → Settings → Environment Variables.",
    );
  }
}

const SIGNING_SECRET =
  SECRET && SECRET.length >= 32
    ? SECRET
    : "dev-only-insecure-placeholder-do-not-use-in-production-!!!";

if (!SECRET || SECRET.length < 32) {
  if (typeof console !== "undefined") {
    console.warn(
      "[PrintPerfect] WARNING: SESSION_SECRET is not set or too short. " +
      "Session tokens are using an insecure placeholder. " +
      "This is only acceptable in local development.",
    );
  }
}

// ── Web Crypto helpers ─────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function uint8ToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToUint8(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function base64urlEncode(str: string): string {
  // btoa operates on binary strings; str here is ASCII-safe timestamp + hex
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): string {
  // Restore standard base64 padding before decoding
  const base64 = str
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(str.length + ((4 - (str.length % 4)) % 4), "=");
  return atob(base64);
}

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,          // not extractable
    ["sign", "verify"],
  );
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generates a signed session token for a verified beta user.
 * The token encodes a timestamp and an HMAC-SHA256 signature.
 * It cannot be forged without knowledge of SESSION_SECRET.
 *
 * Format: base64url("{timestamp-ms}.{HMAC-SHA256-hex}")
 */
export async function generateSessionToken(): Promise<string> {
  const timestamp = Date.now().toString();
  const key = await getHmacKey();
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(timestamp));
  const sigHex = uint8ToHex(new Uint8Array(sigBuffer));
  return base64urlEncode(`${timestamp}.${sigHex}`);
}

/**
 * Verifies a session token is authentic and not expired.
 * Web Crypto's verify() is timing-safe by specification.
 * Returns true if valid, false if forged, tampered with, or expired.
 *
 * @param token    - The raw cookie value from pp_session
 * @param maxAgeMs - Maximum token age in ms (default: 8 hours)
 */
export async function verifySessionToken(
  token: string,
  maxAgeMs = 8 * 60 * 60 * 1000,
): Promise<boolean> {
  try {
    const payload = base64urlDecode(token);
    const dotIdx = payload.indexOf(".");
    if (dotIdx === -1) return false;

    const timestamp = payload.slice(0, dotIdx);
    const sigHex = payload.slice(dotIdx + 1);

    // Validate token age
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) return false;
    const tokenAge = Date.now() - ts;
    if (tokenAge > maxAgeMs || tokenAge < 0) return false;

    // Verify signature (timing-safe via Web Crypto spec)
    const key = await getHmacKey();
    const sigBytes = hexToUint8(sigHex);
    return await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(timestamp));
  } catch {
    return false;
  }
}

export const SESSION_COOKIE_NAME = "pp_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours
