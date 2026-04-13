import { NextRequest, NextResponse } from "next/server";

const ADMIN_USER   = process.env.ADMIN_USER   ?? "admin";
const ADMIN_PASS   = process.env.ADMIN_PASS   ?? "admin";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "pp_admin_dev_2025";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const res = NextResponse.json({ success: true });
    res.cookies.set("pp_admin", ADMIN_SECRET, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });
    return res;
  }

  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}
