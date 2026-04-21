import { kv } from "@vercel/kv";
import { isKvConfigured } from "@/lib/config";
import { DEFAULT_FILAMENTS } from "@/lib/defaultFilaments";
import { invalidateCache } from "@/lib/filamentStore";

/**
 * ─── Emergency Filament Recovery Endpoint ────────────────────────────────────
 * POST /api/admin/filament-restore
 *
 * Restores all default filaments to KV, replacing any corrupted data.
 * Use ONLY if filament data becomes corrupted or lost.
 * Protected by pp_admin cookie via middleware.
 */
export async function POST(request: Request) {
  try {
    if (!isKvConfigured()) {
      return Response.json(
        { error: "KV storage not configured" },
        { status: 503 }
      );
    }

    // Restore all defaults
    await kv.set("filament:types", DEFAULT_FILAMENTS);
    await kv.set("filament:suggestions", []); // Clear suggestions too

    // Clear cache
    invalidateCache();

    return Response.json(
      {
        success: true,
        message: `Restored ${DEFAULT_FILAMENTS.length} default filaments`,
        filaments: DEFAULT_FILAMENTS,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/admin/filament-restore] Error:", error);
    return Response.json(
      { error: "Failed to restore filaments" },
      { status: 500 }
    );
  }
}
