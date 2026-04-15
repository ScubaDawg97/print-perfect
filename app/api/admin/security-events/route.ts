// ─── GET /api/admin/security-events ──────────────────────────────────────────
// Returns the most recent suspicious input log entries from Vercel KV.
// Protected by admin cookie auth — same as all other /api/admin/* routes.
//
// Each entry was written by lib/sanitize.ts logSuspiciousInput() when a
// prompt injection pattern was detected in a user-supplied field.
//
// Returns at most 20 entries, sorted newest-first.

import { NextRequest, NextResponse } from "next/server";
import { isKvConfigured } from "@/lib/config";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "pp_admin_dev_2025";
const MAX_EVENTS = 20;

export interface SecurityEvent {
  key: string;
  field: string;
  input: string;
  timestamp: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Admin auth check
  if (req.cookies.get("pp_admin")?.value !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isKvConfigured()) {
    return NextResponse.json(
      { events: [], note: "KV not configured — security events are only stored in production." },
    );
  }

  try {
    const { kv } = await import("@vercel/kv");

    // Scan for all security event keys
    // SCAN is O(N) but our keyspace is small and these are admin-only reads
    const [, keys] = await kv.scan(0, {
      match: "security:suspicious:*",
      count: MAX_EVENTS + 10,  // slightly over in case of deleted keys
    }) as unknown as [number, string[]];

    if (!keys.length) {
      return NextResponse.json({ events: [] });
    }

    // Sort by timestamp embedded in key (unix ms), newest first
    keys.sort((a, b) => {
      const tsA = parseInt(a.split(":")[2] ?? "0", 10);
      const tsB = parseInt(b.split(":")[2] ?? "0", 10);
      return tsB - tsA;
    });

    const recentKeys = keys.slice(0, MAX_EVENTS);

    // Batch fetch all values
    const values = await Promise.all(
      recentKeys.map((k) => kv.get<{ field: string; input: string; timestamp: string }>(k)),
    );

    const events: SecurityEvent[] = recentKeys
      .map((key, i) => {
        const val = values[i];
        if (!val) return null;
        return { key, field: val.field, input: val.input, timestamp: val.timestamp };
      })
      .filter((e): e is SecurityEvent => e !== null);

    return NextResponse.json({ events });
  } catch (err) {
    console.error("[security-events] KV error:", err);
    return NextResponse.json({ error: "Failed to fetch security events." }, { status: 500 });
  }
}
