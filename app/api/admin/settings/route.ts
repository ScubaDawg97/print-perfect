import { NextRequest, NextResponse } from "next/server";
import { AVAILABLE_MODELS } from "@/lib/serverConfig";
import { getConfigValue } from "@/lib/config";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "pp_admin_dev_2025";

function isAuthed(req: NextRequest): boolean {
  return req.cookies.get("pp_admin")?.value === ADMIN_SECRET;
}

// DEPRECATED: This endpoint is maintained for backward compatibility.
// Use /api/admin/config for new code. This now reads from the same
// KV-backed config system to ensure consistency.

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const model = await getConfigValue("claudeModel");
    return NextResponse.json({ model, available: AVAILABLE_MODELS });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch model config", available: AVAILABLE_MODELS },
      { status: 500 },
    );
  }
}
