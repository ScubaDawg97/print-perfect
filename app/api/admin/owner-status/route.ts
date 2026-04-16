import { NextRequest, NextResponse } from "next/server";
import { OWNER_COOKIE_NAME } from "@/lib/sessionToken";
import { verifyOwnerToken } from "@/lib/ownerToken";

/**
 * GET /api/admin/owner-status (admin-authenticated)
 *
 * Returns the current owner token status for the admin debug panel:
 * - Whether owner access is currently active
 * - Token expiry time if active
 * - Number of owner bypass calls in the last 7 days (from API log)
 *
 * Admin authentication is handled by middleware.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Check the pp_owner cookie server-side
    const ownerCookie = request.cookies.get(OWNER_COOKIE_NAME);
    const isActive = ownerCookie?.value ? verifyOwnerToken(ownerCookie.value) : false;

    let expiresAt: string | null = null;

    if (isActive && ownerCookie?.value) {
      try {
        // Extract the timestamp from the token to calculate expiry
        const decoded = Buffer.from(ownerCookie.value, "base64url").toString();
        const parts = decoded.split(".");
        if (parts.length >= 2) {
          const timestamp = parseInt(parts[1], 10);
          if (!isNaN(timestamp)) {
            const expiryMs = timestamp + 7 * 24 * 60 * 60 * 1000;
            expiresAt = new Date(expiryMs).toISOString();
          }
        }
      } catch {
        // If we can't parse the token, that's OK — it's verified above
      }
    }

    // TODO: Query API log for owner calls in the last 7 days
    // For now, return 0 — this would be populated by counting isOwner=true entries
    // in the KV API log from the last 7 days
    const callCount = 0;

    return NextResponse.json(
      {
        isActive,
        expiresAt,
        callCount,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[owner-status] Unexpected error:", err);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
