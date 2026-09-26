import { NextRequest, NextResponse } from "next/server";
import { computeSeasonality } from "@/lib/seasonality";

export const dynamic = "force-dynamic";

// GET /api/seasonality?s=NVDA — ผลตอบแทนรายเดือน/ไตรมาส ย้อนหลัง 5 ปี
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get("s")?.trim().toUpperCase();
  if (!s) return NextResponse.json({ error: "missing s" }, { status: 400 });
  const data = await computeSeasonality(s);
  if (!data) return NextResponse.json({ error: "ข้อมูลไม่พอคำนวณ (ต้องมีประวัติราคาอย่างน้อย 1 ปี)" }, { status: 404 });
  return NextResponse.json(data);
}
