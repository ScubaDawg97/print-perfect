// ─── GET /api/admin/api-monitor ───────────────────────────────────────────────
// Returns API usage statistics and recent log entries for the admin debug panel.
// Protected by admin cookie auth — same as all other /api/admin/* routes.
//
// Response shape:
//   { stats, logs }           — KV is configured (production)
//   { stats: null, logs: [], note } — KV not configured (local dev)

import { NextRequest, NextResponse } from "next/server";
import { isKvConfigured } from "@/lib/config";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "pp_admin_dev_2025";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Admin auth check
  if (req.cookies.get("pp_admin")?.value !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isKvConfigured()) {
    return NextResponse.json({
      stats: null,
      logs: [],
      note: "KV not configured — API monitoring only available in production.",
    });
  }

  try {
    const { getApiStats, getRecentApiLogs } = await import("@/lib/abuseMonitor");

    const [stats, logs] = await Promise.all([
      getApiStats(),
      getRecentApiLogs(50),
    ]);

    return NextResponse.json({ stats, logs });
  } catch (err) {
    console.error("[api-monitor] Error fetching monitor data:", err);
    return NextResponse.json(
      { error: "Failed to fetch monitor data." },
      { status: 500 },
    );
  }
}
