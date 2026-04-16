import { NextResponse } from "next/server";
import { OWNER_COOKIE_NAME, OWNER_INDICATOR_COOKIE_NAME, OWNER_MAX_AGE_SECONDS } from "@/lib/sessionToken";

/**
 * POST /api/owner-logout
 *
 * Clears the owner bypass token and indicator cookie, deactivating owner mode.
 * No authentication required — clearing your own cookies is always allowed.
 *
 * Returns { success: true } on completion.
 */
export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json(
    { success: true },
    { status: 200 }
  );

  // Clear both cookies by setting Max-Age=0
  response.cookies.set(OWNER_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set(OWNER_INDICATOR_COOKIE_NAME, "", {
    httpOnly: false,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  return response;
}
