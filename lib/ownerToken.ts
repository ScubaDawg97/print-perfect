// ─────────────────────────────────────────────────────────────────────────────
// OWNER BYPASS TOKEN — Node.js runtime only (not Edge Runtime)
// Owner tokens have longer expiry (7 days) and grant elevated access.
// They are signed with SESSION_SECRET but use a different prefix to prevent
// a regular session token from being used as an owner token.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac, timingSafeEqual } from "crypto";
import { OWNER_COOKIE_NAME } from "@/lib/sessionToken";

const SECRET = process.env.SESSION_SECRET;
const SIGNING_SECRET =
  SECRET && SECRET.length >= 32
    ? SECRET
    : "dev-only-insecure-placeholder-do-not-use-in-production-!!!";

const OWNER_TOKEN_PREFIX = "owner_v1";
const OWNER_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generates a signed owner bypass token valid for 7 days.
 *
 * The token format differs from regular session tokens by including the
 * OWNER_TOKEN_PREFIX in the signed payload. This ensures a regular session
 * token cannot be promoted to owner access even if the signature is valid.
 *
 * @returns Base64url-encoded signed owner token
 */
export function generateOwnerToken(): string {
  const timestamp = Date.now().toString();
  const payload = `${OWNER_TOKEN_PREFIX}.${timestamp}`;
  const signature = createHmac("sha256", SIGNING_SECRET)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

/**
 * Verifies an owner bypass token is authentic and within the 7-day window.
 *
 * Performs four checks:
 * 1. Token can be decoded and has the correct structure
 * 2. Token begins with OWNER_TOKEN_PREFIX (prevents regular token elevation)
 * 3. Cryptographic signature matches (prevents forgery)
 * 4. Token age is within 7 days (prevents replay of old tokens)
 *
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param token - The token value from the pp_owner cookie
 * @returns true if valid owner token, false for any invalid condition
 */
export function verifyOwnerToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(".");

    // Must have exactly 3 parts: prefix, timestamp, signature
    if (parts.length !== 3) return false;

    const [prefix, timestamp, signature] = parts;

    // Must start with owner prefix — prevents regular session token promotion
    if (prefix !== OWNER_TOKEN_PREFIX) return false;

    // Check token age — 7 day window
    const tokenTimestamp = parseInt(timestamp, 10);
    if (isNaN(tokenTimestamp)) return false;
    const tokenAge = Date.now() - tokenTimestamp;
    if (tokenAge > OWNER_TOKEN_EXPIRY_MS || tokenAge < 0) return false;

    // Verify signature using timing-safe comparison
    const expectedSig = createHmac("sha256", SIGNING_SECRET)
      .update(`${prefix}.${timestamp}`)
      .digest("hex");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);

    // Buffers must be same length for timing-safe comparison
    if (sigBuf.length !== expBuf.length) return false;

    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Checks if a NextRequest has a valid owner bypass token.
 * Called before rate limit checks in API routes.
 * Returns true only if the httpOnly pp_owner cookie is present AND
 * passes full cryptographic verification.
 *
 * @param request - NextRequest object with cookies
 * @returns true if valid owner token, false otherwise
 */
export function hasValidOwnerToken(request: any): boolean {
  const ownerCookie = request.cookies?.get?.(OWNER_COOKIE_NAME);
  if (!ownerCookie?.value) return false;
  return verifyOwnerToken(ownerCookie.value);
}
