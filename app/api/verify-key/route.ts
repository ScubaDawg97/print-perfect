// ─── POST /api/verify-key ─────────────────────────────────────────────────────
// Validates a beta access key. On success, sets the pp_beta_unlocked session
// cookie so the middleware and client can confirm access.
//
// Returns:
//   { valid: true }                       — key matched
//   { valid: true, reason: "key_disabled" } — gate is off, all keys accepted
//   { valid: false }                      — key did not match

import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const key  = typeof body.key === "string" ? body.key : "";

    const config = await getConfig();

    // Gate is disabled — everyone gets in, still set the cookie
    if (!config.betaKeyEnabled) {
      return successResponse({ reason: "key_disabled" });
    }

    // Case-insensitive comparison — never expose the actual key in responses
    if (key.trim().toUpperCase() === config.betaKey.toUpperCase()) {
      return successResponse({});
    }

    return NextResponse.json({ valid: false }, { status: 200 });
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

function successResponse(extra: Record<string, unknown>): NextResponse {
  const res = NextResponse.json({ valid: true, ...extra });
  // Session cookie — clears when browser closes (no MaxAge / Expires)
  res.cookies.set("pp_beta_unlocked", "1", {
    httpOnly: false,   // readable by client JS and middleware
    sameSite: "lax",
    path: "/",
    // No maxAge → session cookie
  });
  return res;
}
