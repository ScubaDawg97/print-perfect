// ─── POST /api/unlock ─────────────────────────────────────────────────────────
// Records that a user has entered a valid-format tip code, unlocking additional
// analyses for the rest of today. Enforced server-side via KV (or in-memory
// fallback in local dev). The unlock is keyed to the client IP so it applies
// regardless of which browser tab, incognito window, or device they use next.
//
// This is an honour-system unlock — no receipt verification is performed.
// The code format check (4-12 alphanumeric chars) guards against trivial abuse.
//
// Returns:
//   { success: true }   — unlock recorded
//   { success: false, error: string } — invalid code format or rate limit hit

import { NextRequest, NextResponse } from "next/server";
import { getClientIp, recordUnlock, isIpUnlocked } from "@/lib/rateLimiter";

const CODE_REGEX = /^[a-zA-Z0-9]{4,12}$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!CODE_REGEX.test(code)) {
      return NextResponse.json(
        { success: false, error: "Invalid code format. Must be 4–12 alphanumeric characters." },
        { status: 400 },
      );
    }

    const ip = getClientIp(req);

    // Idempotent — if already unlocked today, return success without re-writing
    const alreadyUnlocked = await isIpUnlocked(ip);
    if (!alreadyUnlocked) {
      await recordUnlock(ip);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Server error. Please try again." },
      { status: 500 },
    );
  }
}
