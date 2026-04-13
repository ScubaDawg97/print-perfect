import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "pp_admin_dev_2025";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow the login page through without auth check
  if (pathname === "/admin/login") return NextResponse.next();

  // Protect all other /admin routes
  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get("pp_admin")?.value;
    if (token !== ADMIN_SECRET) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
