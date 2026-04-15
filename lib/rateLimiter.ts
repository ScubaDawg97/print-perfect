// ─── Server-side rate limiter ─────────────────────────────────────────────────
//
// Enforces daily analysis limits at the server level, keyed by client IP.
// localStorage (client-side) is display-only; this module is the source of truth.
//
// Storage backends (automatic fallback):
//   PRODUCTION — Vercel KV (Upstash Redis): atomic INCR, keys expire after 25h.
//   DEVELOPMENT — In-memory Map: resets on server restart, shared across requests
//                 within the same serverless invocation. Logs a warning on first use.
//
// Key format:    ratelimit:{ip}:{YYYY-MM-DD}  (TTL: 25 hours)
// Unlock key:    unlock:{ip}:{YYYY-MM-DD}      (TTL: end of calendar day)

import { isKvConfigured } from "./config";

const ONE_DAY_SECONDS = 86_400;
const GRACE_SECONDS   = 3_600;  // extra hour so timezone edge-cases don't reset early
const HARD_CEILING    = 20;     // absolute max regardless of unlock status

// ── In-memory fallback (local dev only) ──────────────────────────────────────

const _localCounts  = new Map<string, number>();
const _localUnlocks = new Set<string>();
let _warnedAboutFallback = false;

function warnFallback() {
  if (_warnedAboutFallback) return;
  _warnedAboutFallback = true;
  console.warn(
    "[RateLimiter] KV is not configured — using in-memory fallback. " +
    "Limits reset on server restart. This is only acceptable in local development.",
  );
}

// ── Key helpers ───────────────────────────────────────────────────────────────

function todayDateString(): string {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD UTC
}

function rateLimitKey(ip: string): string {
  return `ratelimit:${ip}:${todayDateString()}`;
}

function unlockKey(ip: string): string {
  return `unlock:${ip}:${todayDateString()}`;
}

function resetTimestamp(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  hardCeiling: boolean;
  remainingToday: number;
  resetAt: string;    // ISO timestamp of midnight UTC tonight
}

// ── IP extraction ─────────────────────────────────────────────────────────────

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

// ── Core rate-limit check ─────────────────────────────────────────────────────

/**
 * Atomically increments the request count for this IP and checks against the limit.
 * Call this BEFORE any AI API work — returns quickly if the request should be blocked.
 *
 * On KV error in production: fails open (allows the request) and logs the error.
 * On no KV configured (dev): uses the in-memory Map fallback.
 */
export async function checkAndIncrementRateLimit(
  ip: string,
  freeLimit: number,
  isUnlocked: boolean,
): Promise<RateLimitResult> {
  const effectiveLimit = isUnlocked ? HARD_CEILING : freeLimit;
  const resetAt = resetTimestamp();

  if (isKvConfigured()) {
    try {
      const { kv } = await import("@vercel/kv");
      const key = rateLimitKey(ip);

      // Atomic increment — prevents race conditions from simultaneous requests
      const newCount = await kv.incr(key) as number;

      // Set expiry on first increment (key didn't exist)
      if (newCount === 1) {
        await kv.expire(key, ONE_DAY_SECONDS + GRACE_SECONDS);
      }

      // Hard ceiling — no exceptions, ever
      if (newCount > HARD_CEILING) {
        await kv.decr(key); // undo the increment
        return {
          allowed: false, count: HARD_CEILING, limit: effectiveLimit,
          hardCeiling: true, remainingToday: 0, resetAt,
        };
      }

      // Soft limit
      if (newCount > effectiveLimit) {
        await kv.decr(key); // undo the increment
        return {
          allowed: false, count: newCount - 1, limit: effectiveLimit,
          hardCeiling: false, remainingToday: 0, resetAt,
        };
      }

      return {
        allowed: true, count: newCount, limit: effectiveLimit,
        hardCeiling: false,
        remainingToday: Math.max(0, effectiveLimit - newCount),
        resetAt,
      };
    } catch (err) {
      // KV blip in production — fail open so the site doesn't break
      console.error("[RateLimiter] KV error, failing open:", err);
      return {
        allowed: true, count: 0, limit: effectiveLimit,
        hardCeiling: false, remainingToday: effectiveLimit, resetAt,
      };
    }
  }

  // ── In-memory fallback (local dev) ────────────────────────────────────────
  warnFallback();
  const key = rateLimitKey(ip);
  const current = _localCounts.get(key) ?? 0;
  const next = current + 1;

  if (next > HARD_CEILING) {
    return {
      allowed: false, count: HARD_CEILING, limit: effectiveLimit,
      hardCeiling: true, remainingToday: 0, resetAt,
    };
  }
  if (next > effectiveLimit) {
    return {
      allowed: false, count: current, limit: effectiveLimit,
      hardCeiling: false, remainingToday: 0, resetAt,
    };
  }

  _localCounts.set(key, next);
  return {
    allowed: true, count: next, limit: effectiveLimit,
    hardCeiling: false,
    remainingToday: Math.max(0, effectiveLimit - next),
    resetAt,
  };
}

// ── Unlock status ─────────────────────────────────────────────────────────────

/**
 * Checks whether this IP has been unlocked today (i.e. they submitted a tip code).
 * Returns false silently on any error.
 */
export async function isIpUnlocked(ip: string): Promise<boolean> {
  if (isKvConfigured()) {
    try {
      const { kv } = await import("@vercel/kv");
      return (await kv.get(unlockKey(ip))) === true;
    } catch {
      return false;
    }
  }
  return _localUnlocks.has(unlockKey(ip));
}

/**
 * Records that this IP has been unlocked for the rest of today.
 * Called by POST /api/unlock when a valid tip code is entered.
 */
export async function recordUnlock(ip: string): Promise<void> {
  if (isKvConfigured()) {
    try {
      const { kv } = await import("@vercel/kv");
      const key = unlockKey(ip);
      await kv.set(key, true, { ex: ONE_DAY_SECONDS + GRACE_SECONDS });
    } catch (err) {
      console.error("[RateLimiter] Failed to record unlock in KV:", err);
    }
    return;
  }
  _localUnlocks.add(unlockKey(ip));
}

/**
 * Returns current usage count for an IP without incrementing.
 * Used for read-only display in the client counter UI.
 */
export async function getCurrentUsage(ip: string): Promise<number> {
  if (isKvConfigured()) {
    try {
      const { kv } = await import("@vercel/kv");
      const count = await kv.get<number>(rateLimitKey(ip));
      return count ?? 0;
    } catch {
      return 0;
    }
  }
  return _localCounts.get(rateLimitKey(ip)) ?? 0;
}
