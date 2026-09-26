import { NextRequest, NextResponse } from "next/server";
import { getHolders } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

// GET /api/holders?s=NVDA — ใครถือหุ้นนี้ (สถาบัน + insider) — มีเฉพาะตลาด US
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get("s")?.trim().toUpperCase();
  if (!s) return NextResponse.json({ error: "missing s" }, { status: 400 });
  const data = await getHolders(s);
  if (!data) return NextResponse.json({ available: false }, { status: 404 });
  return NextResponse.json({ available: true, ...data });
}
