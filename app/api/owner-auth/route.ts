import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { generateOwnerToken } from "@/lib/ownerToken";
import { OWNER_COOKIE_NAME, OWNER_INDICATOR_COOKIE_NAME, OWNER_MAX_AGE_SECONDS } from "@/lib/sessionToken";
import { getClientIp } from "@/lib/rateLimiter";
import { maskIp } from "@/lib/abuseMonitor";

// Use the same admin credentials as /api/admin/login
const ADMIN_PASS = process.env.ADMIN_PASS ?? "admin";

// ── Owner authentication rate limiter ──────────────────────────────────────────
// Maximum 5 attempts per IP per hour. Stored in memory since this is not critical
// data — failed attempts are not persisted, but a single instance will rate limit
// an attacker across multiple requests.

const ownerAuthAttempts = new Map<string, { count: number; resetAt: number }>();

function getOrCreateAttemptBucket(ip: string): { count: number; resetAt: number } {
  const now = Date.now();
  const existing = ownerAuthAttempts.get(ip);

  if (existing && now < existing.resetAt) {
    return existing;
  }

  // Reset bucket: new hour started
  const newBucket = { count: 0, resetAt: now + 60 * 60 * 1000 };
  ownerAuthAttempts.set(ip, newBucket);
  return newBucket;
}

/**
 * POST /api/owner-auth
 *
 * Authenticates the site owner and issues a 7-day bypass token.
 * This endpoint is public (no session required) because it IS the
 * authentication mechanism — but it is rate limited to prevent brute force.
 *
 * Security: The passphrase is compared using timingSafeEqual to prevent
 * timing attacks that could reveal the correct passphrase character by character.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const clientIp = getClientIp(request) || "unknown";
    const bucket = getOrCreateAttemptBucket(clientIp);

    // Check rate limit: 5 attempts per hour per IP
    if (bucket.count >= 5) {
      return NextResponse.json(
        {
          error: "too_many_attempts",
          message: "Too many attempts. Try again later.",
        },
        { status: 429 }
      );
    }

    // Parse request body
    let body: { passphrase?: string };
    try {
      body = await request.json();
    } catch {
      bucket.count += 1;
      return NextResponse.json(
        {
          error: "auth_failed",
          message: "Authentication failed.",
        },
        { status: 401 }
      );
    }

    const { passphrase } = body;
    if (typeof passphrase !== "string") {
      bucket.count += 1;
      console.log("[owner-auth] No passphrase provided");
      return NextResponse.json(
        {
          error: "auth_failed",
          message: "Authentication failed.",
        },
        { status: 401 }
      );
    }

    console.log("[owner-auth] ADMIN_PASS env var:", ADMIN_PASS);
    console.log("[owner-auth] User entered:", passphrase);
    console.log("[owner-auth] Lengths match:", passphrase.length === ADMIN_PASS.length);

    // Use the same admin passphrase as /api/admin/login
    // This is read from ADMIN_PASS environment variable (default: "admin")

    // Use timing-safe comparison to prevent timing attacks
    const userBuf = Buffer.from(passphrase);
    const correctBuf = Buffer.from(ADMIN_PASS);

    // If buffers are different lengths, comparison will fail safely
    const isMatch =
      userBuf.length === correctBuf.length &&
      timingSafeEqual(userBuf, correctBuf);

    console.log("[owner-auth] isMatch result:", isMatch);

    if (!isMatch) {
      bucket.count += 1;
      console.log("[owner-auth] Authentication failed - passphrase mismatch");
      return NextResponse.json(
        {
          error: "auth_failed",
          message: "Authentication failed.",
        },
        { status: 401 }
      );
    }

    console.log("[owner-auth] Authentication successful");

    // Authentication successful — issue owner token
    const ownerToken = generateOwnerToken();

    const response = NextResponse.json(
      {
        success: true,
        expiresIn: "7 days",
      },
      { status: 200 }
    );

    // Set both the httpOnly token cookie and the indicator cookie
    response.cookies.set(OWNER_COOKIE_NAME, ownerToken, {
      httpOnly: true, // JavaScript cannot read this
      secure: true, // HTTPS only
      sameSite: "strict", // Not sent on cross-site requests
      path: "/",
      maxAge: OWNER_MAX_AGE_SECONDS,
    });

    // Non-httpOnly indicator cookie for client-side visual indicator
    response.cookies.set(OWNER_INDICATOR_COOKIE_NAME, "1", {
      httpOnly: false, // JavaScript can read this to show indicator
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: OWNER_MAX_AGE_SECONDS,
    });

    return response;
  } catch (err) {
    console.error("[owner-auth] Unexpected error:", err);
    return NextResponse.json(
      {
        error: "server_error",
        message: "Authentication failed.",
      },
      { status: 500 }
    );
  }
}
