// ─── /api/admin/config ────────────────────────────────────────────────────────
// GET  — read full config (admin only)
// PUT  — write config update (admin only)
//
// Authentication: pp_admin cookie (set by /api/admin/login).
// Same auth mechanism used by all other admin API routes.

import { NextRequest, NextResponse } from "next/server";
import { getConfig, updateConfig, getStorageTier, DEFAULT_CONFIG } from "@/lib/config";

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
    return NextResponse.json({ ...config, storage: getStorageTier() });
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

    const { storage } = await updateConfig(safe);
    const updated = await getConfig();
    return NextResponse.json({ ...updated, storage });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
