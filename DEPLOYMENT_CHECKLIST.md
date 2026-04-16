# Pre-Production Deployment Checklist

**Before deploying to production, work through each section below.**

---

## Security Review

- [ ] **Admin Credentials Changed**
  - [ ] `ADMIN_USER` changed from "admin"
  - [ ] `ADMIN_PASS` changed from "admin"
  - [ ] Both are strong (12+ chars, mix of upper/lower/numbers/symbols)
  
- [ ] **Secrets Rotated**
  - [ ] `ADMIN_SECRET` is a long random string (32+ chars)
  - [ ] `SESSION_SECRET` is a long random string (32+ chars)
  - [ ] Generated with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

- [ ] **API Key Security**
  - [ ] `ANTHROPIC_API_KEY` is set in Vercel environment (not in code)
  - [ ] No API keys hardcoded or committed to git

- [ ] **KV Database Configured**
  - [ ] Vercel KV database created and connected
  - [ ] `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` set in Vercel
  - [ ] Can read/write test data successfully

- [ ] **Admin Authentication Working**
  - [ ] Visit `yourdomain.com/admin/login`
  - [ ] Log in with new credentials
  - [ ] Can access Equipment Lists section
  - [ ] Clicking "Add Printer" opens the form

- [ ] **Equipment Management Endpoints Protected**
  - [ ] Try accessing `/api/admin/equipment-manage?type=printers` in browser
  - [ ] Returns "Unauthorized" (requires admin session)
  - [ ] Same for cache-bust endpoint: `/api/admin/equipment-cache-bust`

---

## Configuration Review

- [ ] **Environment Variables Complete**
  - [ ] `ANTHROPIC_API_KEY` ✓
  - [ ] `ADMIN_USER`, `ADMIN_PASS` ✓
  - [ ] `ADMIN_SECRET`, `SESSION_SECRET` ✓
  - [ ] `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` ✓
  
- [ ] **Optional But Recommended**
  - [ ] `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` configured for email notifications
  - [ ] `ADMIN_EMAIL` set to your admin email

- [ ] **No Secrets in Code**
  - [ ] Run: `git log --all -p | grep -i "password\|secret\|api_key" | head -20`
  - [ ] Verify no sensitive data in recent commits

---

## Functionality Testing

- [ ] **Core Features**
  - [ ] Upload STL file → Get Claude recommendations
  - [ ] Recommendations show correct equipment names (not UUIDs)
  - [ ] All recommendation settings working

- [ ] **Equipment Management**
  - [ ] Add a new printer → appears immediately in main form dropdown
  - [ ] Search for new printer in dropdown → found
  - [ ] Select new printer → form loads without errors
  - [ ] Delete printer → gone from list and dropdown
  - [ ] Add surface, nozzle → same workflow works

- [ ] **Equipment Suggestions**
  - [ ] Go to main form, select "Other / Custom Printer"
  - [ ] Fill out suggestion form
  - [ ] Hit "Share Suggestion" → success message
  - [ ] Go to admin panel → see suggestion in Equipment Suggestions
  - [ ] Upvote/downvote works
  - [ ] Reject removes it

- [ ] **Email Notifications (if configured)**
  - [ ] Submit equipment suggestion
  - [ ] Check `ADMIN_EMAIL` inbox
  - [ ] Email received with suggestion details within 30 seconds

- [ ] **Admin Panel**
  - [ ] Equipment Lists tabs switch smoothly
  - [ ] Refresh button (⟳) works without clearing browser history
  - [ ] Add/delete equipment responsive and quick

---

## Performance & Caching

- [ ] **Cache Working**
  - [ ] Add equipment item
  - [ ] Click refresh button
  - [ ] Equipment appears immediately
  - [ ] No need to clear browser history

- [ ] **Fallback Behavior**
  - [ ] Temporarily disable KV in Vercel (for testing only)
  - [ ] Site still loads with hardcoded default equipment
  - [ ] Admin panel shows notice that KV is unavailable
  - [ ] Re-enable KV after testing

---

## Monitoring & Logging

- [ ] **Error Logging Configured**
  - [ ] Visit Vercel Dashboard → your project → Logs
  - [ ] No JavaScript errors in console
  - [ ] No 500 errors in API logs

- [ ] **Analytics (Optional)**
  - [ ] Set up Vercel Web Analytics (if desired)
  - [ ] Verify tracking is working post-launch

---

## Documentation

- [ ] **README Updated** (if needed)
  - [ ] Mention equipment management feature
  - [ ] Link to SETUP.md

- [ ] **Setup Guide Complete**
  - [ ] SETUP.md exists and is accurate
  - [ ] All environment variables documented
  - [ ] KV setup instructions clear

- [ ] **Admin Guide Complete**
  - [ ] ADMIN_GUIDE.md exists
  - [ ] Equipment management workflow documented
  - [ ] Troubleshooting section helpful

---

## Final Checks

- [ ] **Staging/Production Parity**
  - [ ] All environment variables match between staging and production
  - [ ] Same KV database (or separate for staging)

- [ ] **Browser Testing**
  - [ ] Chrome: Main form works, admin panel functional
  - [ ] Firefox: Main form works, admin panel functional
  - [ ] Safari: Main form works, admin panel functional
  - [ ] Mobile (iPhone): Main form responsive, recommendations readable

- [ ] **DNS & SSL**
  - [ ] Domain points to Vercel
  - [ ] SSL certificate valid (no browser warnings)
  - [ ] HTTPS enforced (not HTTP)

- [ ] **Last Minute Review**
  - [ ] No console errors on homepage
  - [ ] Admin login page loads
  - [ ] Equipment Lists tab visible after login
  - [ ] Can add a test printer successfully

---

## Post-Deployment (First 24 Hours)

- [ ] Monitor Vercel logs for errors
- [ ] Check Vercel Analytics for traffic spikes
- [ ] Wait 30 min, test admin panel again (cache warm-up)
- [ ] Have a few users test and report feedback
- [ ] Keep admin credentials secure (don't share with unauthorized users)
- [ ] Set calendar reminder: **Rotate `ADMIN_SECRET` every 90 days**

---

## Sign-Off

**Deployer Name**: ___________________  
**Date**: ___________________  
**Environment**: ☐ Staging  ☐ Production  

**All items checked and verified?** ☐ Yes

---

## Quick Rollback Procedure

If something goes wrong after deployment:

1. **Disable traffic**: Vercel Dashboard → Settings → Production Deployment → Pause
2. **Identify issue**: Check logs and contact support
3. **Revert**: Push previous working commit to main branch
4. **Verify**: Test key features before re-enabling

---

See [SETUP.md](./SETUP.md) for setup instructions and [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) for feature documentation.
