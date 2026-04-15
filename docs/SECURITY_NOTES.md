# Print Perfect — Security Notes

> **Last security review:** 2026-04-14  
> **Reviewed by:** Print Perfect development team

---

## Security Architecture Overview

Security was implemented across three focused sessions:

### Session 1 — Authentication & Rate Limiting
- **Signed HMAC session tokens** — replaced the forgeable `pp_beta_unlocked=1` cookie with a
  cryptographically signed HMAC-SHA256 token (`pp_session`). The token is HttpOnly and cannot
  be read or forged from JavaScript without `SESSION_SECRET`.
- **Server-side rate limiting** — moved from client-side localStorage (trivially bypassed) to
  Vercel KV with atomic `kv.incr()` increments. In-memory fallback for local dev.
- **Prompt stripping** — removed `_debugPrompt` from the API response. The full prompt is never
  sent over the network; a client-side `(prompt redacted)` placeholder appears in the debug view.

### Session 2 — API Hardening
- **Middleware session auth** — Next.js middleware intercepts `/api/recommend` and `/api/unlock`,
  returning 401 JSON (not an HTML redirect) for requests without a valid `pp_session` cookie.
- **Prompt injection defense** — `lib/sanitize.ts` strips 15 known injection patterns from all
  user-supplied strings before prompt construction. User content is also wrapped in
  `<user_data field="…">` XML delimiters so Claude sees it as DATA, not instructions.
- **Zod schema validation** — `/api/recommend` validates the full request body against a strict
  Zod schema before it reaches the rule engine or prompt builder. Malformed/adversarial bodies
  are rejected with a 400 before any expensive work is done.
- **CORS policy** — explicit `ALLOWED_ORIGINS` list in middleware; OPTIONS preflight returns 204;
  `Access-Control-Allow-Credentials: true` with specific origin (not `*`).
- **Security event logging** — injection attempts are written to KV under
  `security:suspicious:{timestamp}` with a 7-day TTL and surfaced in the admin debug panel.

### Session 3 — Hygiene & Monitoring
- **Comprehensive security headers** — CSP, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, HSTS, X-DNS-Prefetch-Control, X-XSS-Protection
  applied to all routes via `next.config.js`.
- **API abuse monitoring** — `lib/abuseMonitor.ts` logs every API call (allowed and blocked)
  to KV with partial IPs (privacy-preserving). Admin debug panel shows stats + recent calls.
- **Dependency auditing** — `npm audit` integrated into CI (blocks on HIGH/CRITICAL).
- **GitHub Actions** — `security.yml` (audit + tsc + lint on push/PR/weekly schedule) and
  `deploy-check.yml` (production build verification on every push to main).

---

## Known Limitations & Intentional Tradeoffs

| Area | Limitation | Mitigation |
|---|---|---|
| Ko-fi unlock | Honor-system — any 4–12 char code unlocks the "tip received" gate | Server-side IP tracking is the real rate-limit protection |
| Rate limiter | In-memory fallback in local dev resets on restart | Not a concern in production (Vercel KV is always used) |
| CSP `'unsafe-inline'` (scripts) | Required by Next.js for inline hydration scripts (`__NEXT_DATA__`, chunk bootstrapper) | A nonce-based CSP would remove this requirement — see Future Improvements |
| CSP `'unsafe-eval'` | Included in development builds for Next.js HMR | Conditionally omitted in production via `isDev` check in `next.config.js` |
| Zod dependency | Resolved as a transitive dep (via eslint-config-next) | Works in practice; consider adding as a direct dep for explicitness |
| Session expiry | 8-hour HMAC tokens | Acceptable for a beta access tool; extend if needed |
| HSTS preload | Not yet submitted to the preload list | Submit once `www.printperfect.app` SSL is confirmed stable |

---

## npm Audit Status

**Last run:** 2026-04-14  
**Result: 0 vulnerabilities found** ✅

```
found 0 vulnerabilities
```

No HIGH or CRITICAL issues. The audit runs automatically every Monday via
`.github/workflows/security.yml` and blocks any PR that introduces HIGH+ vulnerabilities.

---

## Content-Security-Policy Notes

The CSP is configured in `next.config.js` and tuned for the following external resources:

| Directive | Allowed origins | Reason |
|---|---|---|
| `script-src` | `self`, `storage.ko-fi.com` | Ko-fi donation widget loader |
| `style-src` | `self`, `'unsafe-inline'` | Required by Next.js style injection |
| `img-src` | `self`, `data:`, `blob:`, `https:` | Canvas share cards, 3D model previews |
| `connect-src` | `self`, open-meteo.com, nominatim.openstreetmap.org, openfilamentdatabase.org/github.io, api.anthropic.com | Weather, filament DB, AI API |
| `frame-src` | `ko-fi.com` | Ko-fi donation widget iframe |

**After deployment**, validate at: https://securityheaders.com/?q=https://printperfect.app  
Target: **Grade A or A+**

If CSP violations appear in the browser console, add the specific domain to the correct directive
in `next.config.js`. Do NOT use `'unsafe-inline'` for scripts as a shortcut.

---

## Environment Variables Required in Production

| Variable | Purpose | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API calls | Required |
| `SESSION_SECRET` | HMAC-SHA256 session signing | Min 32 chars. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_SECRET` | Admin panel cookie auth | Change from default in prod |
| `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel KV | Required for rate limiting, session events, monitoring |

---

## Security Contact

For responsible disclosure of vulnerabilities: **info@printperfect.app**

Please include a description of the issue, steps to reproduce, and any suggested remediation.
We aim to respond within 48 hours and will credit researchers who report valid findings.

---

## Model Selection Fix (Post-Session 3)

**Root Cause Found & Fixed**: There were two competing model selectors (/admin and /admin/settings) writing to different storage locations. The /admin page updated an in-memory variable that was lost on restart, while /admin/settings correctly persisted to KV. The /api/recommend endpoint would fall back to the in-memory value, creating inconsistent behavior.

**Resolution**: 
- Removed the model selector from `/admin` page (now read-only, links to `/admin/settings`)
- Updated `/api/recommend` to read exclusively from KV config via `getConfigValue("claudeModel")`
- Changed DEFAULT_CONFIG default from Sonnet to Haiku for cost efficiency
- The KV-backed config system in `/admin/settings` is now the single source of truth
- The deprecated `/api/admin/settings` endpoint now reads from KV for consistency

---

## Future Improvements

- [ ] Submit to HSTS preload list once `www.printperfect.app` SSL is confirmed stable
- [ ] Add `zod` as a direct dependency (currently transitive via eslint-config-next)
- [ ] Implement CSP nonce-based approach to replace `'unsafe-inline'` in `script-src` — requires custom Next.js server middleware to inject a fresh nonce into every response header and every `<script>` tag
- [ ] Add `@vercel/analytics` and update CSP `connect-src` to include `vitals.vercel-insights.com`
- [ ] Rate limit the `/api/verify-key` endpoint to prevent beta key brute-forcing
- [ ] Remove the deprecated `/api/admin/settings` endpoint entirely (currently maintained for backward compatibility)
