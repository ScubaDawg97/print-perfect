// ─── POST /api/verify-key ─────────────────────────────────────────────────────
// Validates a beta access key. On success, issues a cryptographically signed
// session token via an HttpOnly cookie that cannot be forged in DevTools.
//
// Returns:
//   { valid: true }                         — key matched, token set
//   { valid: true, reason: "key_disabled" } — gate is off, token set
//   { valid: false }                        — key did not match

import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import {
  generateSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/sessionToken";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const key  = typeof body.key === "string" ? body.key : "";

    const config = await getConfig();

    // Gate is disabled — everyone gets in, still issue a signed token
    if (!config.betaKeyEnabled) {
      return await successResponse({ reason: "key_disabled" });
    }

    // Case-insensitive comparison — never expose the actual key in responses
    if (key.trim().toUpperCase() === config.betaKey.toUpperCase()) {
      return await successResponse({});
    }

    return NextResponse.json({ valid: false }, { status: 200 });
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

async function successResponse(extra: Record<string, unknown>): Promise<NextResponse> {
  const token = await generateSessionToken();

  const res = NextResponse.json({ valid: true, ...extra });

  // Signed session token — HttpOnly means JavaScript cannot read or modify it.
  // The signature makes it unforgeable even if the attacker can see its value.
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,       // not accessible via document.cookie or DevTools JS console
    secure: process.env.NODE_ENV === "production",  // HTTPS only in production
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,  // 8 hours
  });

  // Companion flag cookie — readable by client JS for UX purposes only.
  // This tells the client "don't show the beta modal" without exposing any secret.
  // It contains no signature and provides NO security — all real enforcement is
  // done server-side by verifying pp_session in middleware.ts.
  res.cookies.set("pp_session_active", "1", {
    httpOnly: false,      // must be readable by client JS (document.cookie)
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,  // stays in sync with the signed token
  });

  // Purge the old insecure cookie from any existing browser sessions
  res.cookies.set("pp_beta_unlocked", "", {
    httpOnly: false,
    path: "/",
    maxAge: 0,            // immediate expiry = deletion
  });

  return res;
}
