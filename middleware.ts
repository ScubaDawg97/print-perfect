import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "pp_admin_dev_2025";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Admin routes ───────────────────────────────────────────────────────────
  // Login page is always accessible so admins can authenticate.
  if (pathname === "/admin/login") return NextResponse.next();

  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get("pp_admin")?.value;
    if (token !== ADMIN_SECRET) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // ── Beta gate for protected routes ─────────────────────────────────────────
  // Protected: /history and /history/[id]
  // The gate is enforced via cookie only — if betaKeyEnabled is false in config,
  // the /api/verify-key endpoint will set the cookie automatically when the
  // client auto-verifies on app load (BetaKeyModal handles this transparently).
  if (pathname.startsWith("/history")) {
    const betaCookie = request.cookies.get("pp_beta_unlocked")?.value;
    if (betaCookie !== "1") {
      return NextResponse.redirect(new URL("/?betagate=1", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/history",
    "/history/:path*",
  ],
};
