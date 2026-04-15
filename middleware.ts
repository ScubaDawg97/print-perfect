import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "./lib/sessionToken";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "pp_admin_dev_2025";

// ── Allowed CORS origins ──────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://printperfect.app",
  "https://www.printperfect.app",
  "http://localhost:3000",
  "http://localhost:3001",
];

// ── Public routes — never require beta session ────────────────────────────────
// Must include the auth endpoint itself and any route called before authentication.
const PUBLIC_API_PREFIXES = [
  "/api/verify-key",
  "/api/config-public",
];

// ── Session-gated API routes — return 401 JSON on failure ────────────────────
const PROTECTED_API_PREFIXES = [
  "/api/recommend",
  "/api/unlock",
];

function isCorsOriginAllowed(origin: string | null): boolean {
  if (!origin) return true;  // same-origin or server-to-server requests have no Origin header
  return ALLOWED_ORIGINS.includes(origin);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0]; // default to production domain
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");

  // ── Handle CORS preflight (OPTIONS) for API routes ─────────────────────────
  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  // ── Block cross-origin requests to protected API routes ───────────────────
  if (pathname.startsWith("/api/") && !isCorsOriginAllowed(origin)) {
    return NextResponse.json(
      { error: "forbidden", message: "Cross-origin request not allowed." },
      { status: 403, headers: corsHeaders(origin) },
    );
  }

  // ── Admin routes ───────────────────────────────────────────────────────────
  if (pathname === "/admin/login") return NextResponse.next();

  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get("pp_admin")?.value;
    if (token !== ADMIN_SECRET) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // Admin API routes are self-protecting via pp_admin cookie check in each handler.
  // We do NOT add session requirements on top — they use a separate auth mechanism.
  if (pathname.startsWith("/api/admin/")) {
    return NextResponse.next();
  }

  // ── Public API routes — pass through with CORS headers ────────────────────
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    const res = NextResponse.next();
    const headers = corsHeaders(origin);
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  }

  // ── Session verification (shared by page routes and API routes) ───────────
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const isValidSession =
    !!sessionCookie?.value && (await verifySessionToken(sessionCookie.value));

  // ── Protected API routes — return 401 JSON on auth failure ────────────────
  if (PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!isValidSession) {
      return NextResponse.json(
        {
          error: "unauthorized",
          message:
            "Valid session required. Please authenticate via the beta key gate.",
        },
        { status: 401, headers: corsHeaders(origin) },
      );
    }
    const res = NextResponse.next();
    const headers = corsHeaders(origin);
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  }

  // ── Protected page routes — redirect to gate on auth failure ──────────────
  if (pathname.startsWith("/history")) {
    if (!isValidSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("betagate", "1");
      const redirect = NextResponse.redirect(url);
      if (request.cookies.get("pp_beta_unlocked")) {
        redirect.cookies.set("pp_beta_unlocked", "", { path: "/", maxAge: 0 });
      }
      return redirect;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/history",
    "/history/:path*",
    "/api/recommend",
    "/api/unlock",
    "/api/admin/:path*",
    "/api/config-public",
    "/api/verify-key",
  ],
};
