import { NextRequest, NextResponse } from "next/server";
import { invalidateCache } from "@/lib/equipmentStore";

// ── Admin Authentication ────────────────────────────────────────────────────
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "pp_admin_dev_2025";

function isAuthed(req: NextRequest): boolean {
  return req.cookies.get("pp_admin")?.value === ADMIN_SECRET;
}

function unauthorized(): NextResponse {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

/**
 * POST /api/admin/equipment-cache-bust (admin-authenticated)
 *
 * Manually clear the equipment cache to force refetch from KV on next request.
 * Requires pp_admin cookie (set by /api/admin/login).
 *
 * Response: { success: boolean, message: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Authenticate ──────────────────────────────────────────────────────────
  if (!isAuthed(request)) {
    return unauthorized();
  }

  try {
    // Invalidate the cache
    invalidateCache();

    if (process.env.NODE_ENV === "development") {
      console.log("[equipment-cache-bust] Cache invalidated by admin");
    }

    return NextResponse.json(
      {
        success: true,
        message: "Equipment cache cleared. Data will be refetched on next request.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/admin/equipment-cache-bust] Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to clear cache",
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/admin/equipment-cache-bust
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Allow": "POST, OPTIONS",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
