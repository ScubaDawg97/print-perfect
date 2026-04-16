# PrintPerfect Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Vercel account (for KV/Redis database)
- Anthropic API key
- (Optional) SMTP credentials for email notifications

---

## Local Development Setup

### 1. Clone Repository & Install Dependencies

```bash
git clone <repo-url>
cd PrintPerfect
npm install
```

### 2. Create `.env.local`

Copy the template:
```bash
cp .env.example .env.local
```

### 3. Add Required Environment Variables

**Anthropic API Key** (required):
```env
ANTHROPIC_API_KEY=sk-ant-...
```
Get your key at [console.anthropic.com](https://console.anthropic.com)

**Admin Panel Credentials** (change before production!):
```env
ADMIN_USER=admin
ADMIN_PASS=admin
ADMIN_SECRET=<generate-a-random-32-char-string>
SESSION_SECRET=<generate-another-32-char-string>
```

Generate random strings with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. (Optional) Set Up Vercel KV for Equipment Management

Without KV, the app works fine using hardcoded defaults. Equipment management features (add/edit/delete printers, surfaces, nozzles) and user suggestions **require KV**.

#### To Add KV:

1. Create a [Vercel account](https://vercel.com) and connect your project
2. In Vercel dashboard → **Storage** → **Create Database** → **KV**
3. Copy the connection details to `.env.local`:

```env
KV_URL=https://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=eyJ...
KV_REST_API_READ_ONLY_TOKEN=eyJ...
```

4. Restart dev server: `npm run dev`

### 5. (Optional) Email Notifications

To send admin emails when users submit equipment suggestions:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
ADMIN_EMAIL=admin@yoursite.com
```

**Common Providers:**
- **Gmail**: Use app-specific password from [Google Account settings](https://myaccount.google.com/apppasswords)
- **Brevo** (free): `SMTP_HOST=smtp-relay.brevo.com`
- **SendGrid**: `SMTP_HOST=smtp.sendgrid.net`, `SMTP_USER=apikey`

If SMTP is not configured, user suggestions still save but emails won't be sent.

### 6. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Production Deployment

### 1. Prepare Environment Variables

Ensure Vercel environment contains:
- ✅ `ANTHROPIC_API_KEY`
- ✅ `ADMIN_USER` and `ADMIN_PASS` (changed from defaults!)
- ✅ `ADMIN_SECRET` and `SESSION_SECRET` (long random strings)
- ✅ `KV_*` variables (Vercel KV connected)
- ⚠️ `SMTP_*` variables (optional)

### 2. Deploy to Vercel

Push to main branch (auto-deploy enabled):
```bash
git push origin main
```

Or manually:
```bash
npm install -g vercel
vercel
```

### 3. Create KV Database

In Vercel dashboard:
1. Select project
2. **Storage** → **Create Database** → **KV**
3. Connection details auto-added to environment

### 4. Verify After Deploy

- [ ] Site loads and equipment lists work
- [ ] Admin panel accessible: `yourdomain.com/admin/login`
- [ ] Equipment management functional
- [ ] Sample STL upload + recommendations work

---

## Troubleshooting

### "Missing required environment variables KV_REST_API_URL..."
Equipment management requires KV. Set up Vercel KV following Step 4 above.

### "Admin endpoints return 401 Unauthorized"
Clear browser cookies and log in again at `/admin/login`.

### Equipment changes don't show immediately
Click the refresh icon in Admin Settings → Equipment Lists, or hard refresh browser (Ctrl+F5).

### Emails not sending
Check `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` are set. Restart server after changes.

### Equipment suggestions not persisting
Verify KV is connected in Vercel Storage dashboard.

---

## Admin User Guide

See [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) for equipment management instructions.
