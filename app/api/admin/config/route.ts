// ─── /api/admin/config ────────────────────────────────────────────────────────
// GET  — read full config (admin only)
// PUT  — write config update (admin only)
//
// Authentication: pp_admin cookie (set by /api/admin/login).
// Same auth mechanism used by all other admin API routes.

import { NextRequest, NextResponse } from "next/server";
import { getConfig, updateConfig, getStorageTier, isKvConfigured, DEFAULT_CONFIG } from "@/lib/config";

/** True when running inside a Vercel deployment (not local dev). */
function isVercel(): boolean {
  return !!(process.env.VERCEL);
}

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "pp_admin_dev_2025";

function isAuthed(req: NextRequest): boolean {
  return req.cookies.get("pp_admin")?.value === ADMIN_SECRET;
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// ── GET — return full config ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return unauthorized();

  try {
    const config = await getConfig();
    return NextResponse.json({
      ...config,
      storage:    getStorageTier(),
      kvRequired: isVercel() && !isKvConfigured(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── PUT — write config update ─────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  if (!isAuthed(req)) return unauthorized();

  try {
    const body    = (await req.json()) as Partial<typeof DEFAULT_CONFIG>;
    const safe: Partial<typeof DEFAULT_CONFIG> = {};

    // Validate and sanitize each field (never trust client input)
    if (typeof body.betaKeyEnabled       === "boolean") safe.betaKeyEnabled       = body.betaKeyEnabled;
    if (typeof body.betaKey              === "string")  safe.betaKey              = body.betaKey.trim();
    if (typeof body.betaContactEmail     === "string")  safe.betaContactEmail     = body.betaContactEmail.trim();
    if (typeof body.dailyFreeAnalyses    === "number")  safe.dailyFreeAnalyses    = Math.max(1, Math.min(20, Math.round(body.dailyFreeAnalyses)));
    if (typeof body.claudeModel          === "string")  safe.claudeModel          = body.claudeModel.trim();
    if (typeof body.siteTagline          === "string")  safe.siteTagline          = body.siteTagline.trim().slice(0, 80);
    if (typeof body.maintenanceMode      === "boolean") safe.maintenanceMode      = body.maintenanceMode;
    if (typeof body.maintenanceMessage   === "string")  safe.maintenanceMessage   = body.maintenanceMessage.trim();
    if (typeof body.kofiUrl              === "string")  safe.kofiUrl              = body.kofiUrl.trim();
    if (typeof body.makerWorldUrl        === "string")  safe.makerWorldUrl        = body.makerWorldUrl.trim();
    if (typeof body.weatherWidgetEnabled === "boolean") safe.weatherWidgetEnabled = body.weatherWidgetEnabled;
    if (typeof body.filamentDbEnabled    === "boolean") safe.filamentDbEnabled    = body.filamentDbEnabled;
    if (typeof body.historyEnabled       === "boolean") safe.historyEnabled       = body.historyEnabled;
    if (typeof body.shareCardEnabled     === "boolean") safe.shareCardEnabled     = body.shareCardEnabled;
    if (typeof body.maxFileSizeMb        === "number")  safe.maxFileSizeMb        = Math.max(1, Math.min(200, Math.round(body.maxFileSizeMb)));

    // Alert configuration
    if (typeof body.alertEmail                === "string")  safe.alertEmail                = body.alertEmail.trim();
    if (typeof body.dailyCostThreshold        === "number")  safe.dailyCostThreshold        = Math.max(0.01, Math.min(1000, Math.round(body.dailyCostThreshold * 100) / 100));
    if (typeof body.errorRateThreshold        === "number")  safe.errorRateThreshold        = Math.max(0, Math.min(100, Math.round(body.errorRateThreshold * 10) / 10));
    if (typeof body.hourlyErrorCountThreshold === "number")  safe.hourlyErrorCountThreshold = Math.max(1, Math.min(1000, Math.round(body.hourlyErrorCountThreshold)));
    if (typeof body.alertOnCostSpike          === "boolean") safe.alertOnCostSpike          = body.alertOnCostSpike;
    if (typeof body.alertOnErrorSpike         === "boolean") safe.alertOnErrorSpike         = body.alertOnErrorSpike;

    const { storage } = await updateConfig(safe);
    const updated = await getConfig();
    return NextResponse.json({ ...updated, storage });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
