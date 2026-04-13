# Print Perfect — Setup Guide

## Quick Start

1. Copy `.env.example` to `.env.local`
2. Add your `ANTHROPIC_API_KEY`
3. Run `npm install --legacy-peer-deps` then `npm run dev`

The app works fully without Vercel KV — it uses built-in defaults for all configuration.

---

## Vercel KV Setup (for Dynamic Admin Settings + Beta Key Gate)

To enable the `/admin/settings` page and the beta access key system, connect a Vercel KV database:

### Steps (takes ~2 minutes, free on Vercel Hobby plan):

1. Go to your **Vercel dashboard** → **Storage** tab
2. Click **Create Database** → select **KV (Redis)**
3. Name it `printperfect-kv` and click Create
4. Go to **Settings** → connect it to your Print Perfect project
5. Vercel automatically adds the KV environment variables to your project

### Pull env vars to local:

```bash
vercel env pull .env.local
```

This adds `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, and `KV_REST_API_READ_ONLY_TOKEN` to your local `.env.local`.

### Without KV:

The app gracefully falls back to defaults from `lib/config.ts`:
- Beta key: `PRINTPERFECTROCKS`
- Daily limit: 3 analyses
- All feature flags: enabled

The `/admin/settings` page will show a "KV not configured" error when trying to save, but reads will still work (returning defaults).

---

## Admin Access

### Admin panel login (`/admin/login`):
- Username: set `ADMIN_USER` env var (default: `admin`)
- Password: set `ADMIN_PASS` env var (default: `admin`)

### Admin settings + debug passphrase:
- Default: `PRINTPERFECT_DEV_2025`
- This is set in `lib/config.ts` as `DEFAULT_CONFIG.adminPassphrase`
- **Change this before going to production** (update `DEFAULT_CONFIG.adminPassphrase`)

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Yes | Claude API key |
| `ADMIN_USER` | No | Admin login username (default: `admin`) |
| `ADMIN_PASS` | No | Admin login password (default: `admin`) |
| `ADMIN_SECRET` | No | Cookie signing secret — **change in production** |
| `CLAUDE_MODEL` | No | Override default model (can be set in /admin/settings) |
| `KV_URL` | No | Vercel KV connection URL |
| `KV_REST_API_URL` | No | Vercel KV REST API URL |
| `KV_REST_API_TOKEN` | No | Vercel KV REST API token |
| `KV_REST_API_READ_ONLY_TOKEN` | No | Vercel KV read-only token |
