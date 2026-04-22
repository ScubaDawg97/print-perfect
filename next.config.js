/** @type {import('next').NextConfig} */

// ── Allowed CORS origins ──────────────────────────────────────────────────────
// Keep in sync with ALLOWED_ORIGINS in middleware.ts.
const PRODUCTION_ORIGIN = "https://printperfect.app";

// 'unsafe-eval' is required by Next.js in development (HMR). Production builds
// don't need it — this flag conditionally omits it in prod for a tighter CSP.
const isDev = process.env.NODE_ENV === "development";

// ── Content-Security-Policy ───────────────────────────────────────────────────
// Tuned for Print Perfect's known dependencies:
//   • Three.js — bundled via npm (no CDN needed)
//   • Open-Meteo API — weather widget fetch calls
//   • Nominatim OpenStreetMap — reverse geocoding for weather
//   • Open Filament Database — filament data lookups
//   • Ko-fi — donation widget (iframe + script)
//   • Vercel Speed Insights — listed defensively (not yet added, safe to keep)
//
// CSP testing: open DevTools → Console and look for "Content Security Policy"
// violation messages after any page interaction. Add offending domains to the
// relevant directive. Do NOT use 'unsafe-inline' for scripts as a shortcut.
const csp = [
  "default-src 'self'",

  // Scripts: self + Ko-fi widget loader
  // 'unsafe-inline' is required by Next.js — it injects inline <script> tags for
  // hydration (__NEXT_DATA__) and chunk bootstrapping. Without it, the page renders
  // as static HTML but React never hydrates, breaking all interactivity.
  // 'unsafe-eval' is also included in dev only (required by Next.js HMR).
  // NOTE: 'unsafe-inline' is the practical requirement here. A nonce-based CSP
  // would remove this need but requires custom Next.js middleware/server setup.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://storage.ko-fi.com`,

  // Styles: 'unsafe-inline' is required by Next.js for its style injection.
  // Google Fonts stylesheet is loaded for typography
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

  // Images: data: for canvas-generated share cards, blob: for 3D model previews
  "img-src 'self' data: blob: https:",

  // Fonts: Google Fonts (Gstatic CDN) for system typography
  "font-src 'self' https://fonts.gstatic.com",

  // API connections: all known external endpoints the client side contacts
  [
    "connect-src 'self'",
    "https://api.open-meteo.com",
    "https://nominatim.openstreetmap.org",
    "https://api.openfilamentdatabase.org",
    "https://openfilamentdatabase.github.io",
    // Anthropic is called server-side only, but listed here for clarity
    "https://api.anthropic.com",
    // Vercel Speed Insights — safe to list even if not yet wired up
    "https://vitals.vercel-insights.com",
  ].join(" "),

  // Frames: Ko-fi donation widget only
  "frame-src https://ko-fi.com",

  // No plugins, object embeds, or legacy ActiveX
  "object-src 'none'",

  // Lock the base URI so injected <base> tags can't redirect relative links
  "base-uri 'self'",

  // Form submissions go to our own origin only
  "form-action 'self'",

  // Prevent this page from being embedded in iframes on external sites (clickjacking)
  "frame-ancestors 'none'",

  // Upgrade any residual HTTP sub-resource requests to HTTPS automatically
  "upgrade-insecure-requests",
].join("; ");

// ── Comprehensive security headers ────────────────────────────────────────────
const securityHeaders = [
  // Primary XSS defense — controls which resources the browser may load
  {
    key: "Content-Security-Policy",
    value: csp,
  },

  // Clickjacking defense — belt-and-suspenders alongside CSP frame-ancestors.
  // Older browsers that don't understand CSP still respect this header.
  {
    key: "X-Frame-Options",
    value: "DENY",
  },

  // MIME sniffing prevention — browser must honor the declared Content-Type
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },

  // Referrer information — full URL for same-origin, origin-only cross-origin
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },

  // Browser feature gate — disable APIs we never use; restrict geolocation to self
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "payment=()",          // Ko-fi handles payments externally — not needed here
      "usb=()",
      "geolocation=(self)",  // Required by the weather widget
      "fullscreen=(self)",
    ].join(", "),
  },

  // HSTS — instruct browsers to always use HTTPS for 1 year (incl. subdomains)
  // WARNING: Only enable once HTTPS is confirmed working on ALL subdomains.
  //          If www.printperfect.app has SSL issues, remove 'includeSubDomains' first.
  // TODO: Add '; preload' after verifying all subdomains + HSTS preload list submission.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },

  // DNS prefetch — 'on' is fine; we want fast resolution for our known external APIs
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },

  // Legacy XSS filter for older browsers (IE, pre-Chromium Edge).
  // CSP is the authoritative defense; this is a fallback safety net.
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
];

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  typescript: {
    ignoreBuildErrors: true,
  },

  async headers() {
    return [
      {
        // Apply CORS headers to all API routes except public ones.
        // The middleware handles dynamic per-origin resolution for OPTIONS preflight;
        // these static headers cover non-preflight GETs and act as a fallback.
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            // Static production-origin value. Middleware overrides this dynamically
            // for localhost in development. Must NOT be "*" — credentials require
            // a specific origin.
            value: PRODUCTION_ORIGIN,
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
          {
            key: "Access-Control-Max-Age",
            value: "86400",
          },
        ],
      },
      {
        // Apply security headers to ALL routes (pages + API + static assets)
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
