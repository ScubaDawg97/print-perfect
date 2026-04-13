import { NextRequest, NextResponse } from "next/server";
import { getModel, setModel, AVAILABLE_MODELS } from "@/lib/serverConfig";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "pp_admin_dev_2025";

function isAuthed(req: NextRequest): boolean {
  return req.cookies.get("pp_admin")?.value === ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ model: getModel(), available: AVAILABLE_MODELS });
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { model } = await req.json();
  try {
    setModel(model);
    return NextResponse.json({ model: getModel() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
