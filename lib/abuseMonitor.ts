/**
 * @file lib/abuseMonitor.ts
 * @description Records and retrieves API usage events for admin monitoring.
 *
 * Every call to /api/recommend is logged (allowed and blocked) with enough
 * context to identify abuse patterns without storing personal data.
 *
 * PRIVACY NOTE:
 * We store partial IPs only (first 3 octets of IPv4, e.g. "192.168.1.*")
 * to provide abuse detection while reducing PII exposure. Full IPs are
 * never written to the abuse log.
 *
 * KV KEY SCHEMA:
 *   "apilog:{unix-ms}"     — individual event, 7-day TTL
 *   "apilog:index"         — list of up to 200 keys, newest-first (lpush/ltrim)
 *   "security:suspicious:{unix-ms}" — written by lib/sanitize.ts, read here
 */

export interface ApiLogEntry {
  /** ISO-8601 timestamp of the request */
  timestamp: string;
  /** First 3 octets of the client IP e.g. "192.168.1.*" */
  partialIp: string;
  /** Whether the request was served or rejected */
  allowed: boolean;
  /** Only set when allowed === false */
  blockedReason?: "rate_limit" | "hard_ceiling" | "unauthorized" | "validation_failed";
  /** Filament material from the request (allowed requests only) */
  filamentType?: string;
  /** Print quality tier — maps to inputs.printPriority (allowed requests only) */
  qualityTier?: string;
  /** Wall-clock time the request took to complete in ms (allowed requests only) */
  durationMs?: number;
}

// ── IP masking ────────────────────────────────────────────────────────────────

/**
 * Masks an IP address to the first 3 octets for privacy-preserving logging.
 *
 * Examples:
 *   "192.168.1.100"  → "192.168.1.*"
 *   "2001:db8::1"    → "2001:db8:0:0:*"
 *   "unknown"        → "unknown"
 */
export function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";

  if (ip.includes(":")) {
    // IPv6 — keep the first 4 groups
    return ip.split(":").slice(0, 4).join(":") + ":*";
  }

  // IPv4 — mask the last octet
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
  return ip;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Records an API call event to Vercel KV.
 *
 * Designed as fire-and-forget — the caller should use `void logApiCall(...)`.
 * Never throws; logging failure must not disrupt the user request.
 */
export async function logApiCall(entry: ApiLogEntry): Promise<void> {
  try {
    const { kv } = await import("@vercel/kv");
    const key = `apilog:${Date.now()}`;

    // Store the event with a 7-day TTL
    await kv.set(key, entry, { ex: 7 * 86_400 });

    // Prepend to the index and cap it at 200 entries
    await kv.lpush("apilog:index", key);
    await kv.ltrim("apilog:index", 0, 199);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[abuseMonitor] Log write failed:", err);
    }
    // Silently swallow in production — monitoring must never break the API
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Retrieves the most recent API log entries for admin display.
 *
 * @param limit - Maximum number of entries to return (default 50)
 * @returns Array of log entries, most recent first. Empty array on any error.
 */
export async function getRecentApiLogs(limit = 50): Promise<ApiLogEntry[]> {
  try {
    const { kv } = await import("@vercel/kv");

    const keys = await kv.lrange("apilog:index", 0, limit - 1);
    if (!keys || keys.length === 0) return [];

    const entries = await Promise.all(
      (keys as string[]).map((k) => kv.get<ApiLogEntry>(k)),
    );
    return entries.filter((e): e is ApiLogEntry => e !== null);
  } catch {
    return [];
  }
}

/**
 * Computes summary statistics from the last 200 log entries.
 * All counts are scoped to today (UTC date).
 */
export async function getApiStats(): Promise<{
  totalToday: number;
  allowedToday: number;
  blockedToday: number;
  suspiciousToday: number;
  topFilamentTypes: Array<{ type: string; count: number }>;
}> {
  const EMPTY = {
    totalToday: 0,
    allowedToday: 0,
    blockedToday: 0,
    suspiciousToday: 0,
    topFilamentTypes: [] as Array<{ type: string; count: number }>,
  };

  try {
    const logs = await getRecentApiLogs(200);
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const todayLogs = logs.filter((l) => l.timestamp.startsWith(today));

    // Tally filament types across allowed requests today
    const filamentCounts: Record<string, number> = {};
    for (const l of todayLogs) {
      if (l.allowed && l.filamentType) {
        filamentCounts[l.filamentType] = (filamentCounts[l.filamentType] ?? 0) + 1;
      }
    }
    const topFilamentTypes = Object.entries(filamentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    // Count today's security events from KV (written by lib/sanitize.ts)
    let suspiciousToday = 0;
    try {
      const { kv } = await import("@vercel/kv");
      const [, secKeys] = await kv.scan(0, {
        match: "security:suspicious:*",
        count: 500,
      }) as unknown as [number, string[]];

      suspiciousToday = (secKeys ?? []).filter((k) => {
        const tsMs = parseInt(k.split(":")[2] ?? "0", 10);
        return tsMs > 0 && new Date(tsMs).toISOString().startsWith(today);
      }).length;
    } catch {
      // Security event count is best-effort
    }

    return {
      totalToday: todayLogs.length,
      allowedToday: todayLogs.filter((l) => l.allowed).length,
      blockedToday: todayLogs.filter((l) => !l.allowed).length,
      suspiciousToday,
      topFilamentTypes,
    };
  } catch {
    return EMPTY;
  }
}
