// ─── GET /api/config-public ───────────────────────────────────────────────────
// Returns only the non-sensitive config values safe for the browser.
// Never returns: betaKey, adminPassphrase, claudeModel (server-only).
//
// Called by the client on app load; response is cached in memory for the
// browser session via lib/publicConfig.ts.

import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

export async function GET() {
  try {
    const cfg = await getConfig();
    return NextResponse.json({
      betaKeyEnabled:      cfg.betaKeyEnabled,
      betaContactEmail:    cfg.betaContactEmail,
      siteTagline:         cfg.siteTagline,
      maintenanceMode:     cfg.maintenanceMode,
      maintenanceMessage:  cfg.maintenanceMessage,
      weatherWidgetEnabled: cfg.weatherWidgetEnabled,
      filamentDbEnabled:   cfg.filamentDbEnabled,
      historyEnabled:      cfg.historyEnabled,
      shareCardEnabled:    cfg.shareCardEnabled,
      kofiUrl:             cfg.kofiUrl,
      makerWorldUrl:       cfg.makerWorldUrl,
      dailyFreeAnalyses:   cfg.dailyFreeAnalyses,
    });
  } catch {
    // Return defaults on any failure — app must never break because of config
    return NextResponse.json({
      betaKeyEnabled:      true,
      betaContactEmail:    "hello@printperfect.app",
      siteTagline:         "Get perfect 3D print settings in minutes",
      maintenanceMode:     false,
      maintenanceMessage:  "Print Perfect is undergoing maintenance. Check back soon!",
      weatherWidgetEnabled: true,
      filamentDbEnabled:   true,
      historyEnabled:      true,
      shareCardEnabled:    true,
      kofiUrl:             "https://ko-fi.com/printygoodstuff",
      makerWorldUrl:       "https://makerworld.com/printperfect-placeholder",
      dailyFreeAnalyses:   3,
    });
  }
}
