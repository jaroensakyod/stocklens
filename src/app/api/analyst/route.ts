import { NextRequest, NextResponse } from "next/server";
import { getAnalystConsensus } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

// GET /api/analyst?s=PTT.BK — คอนเซนซัสโบรกเกอร์ + เป้าหมายราคา + วันออกงบถัดไป (ไทย+US)
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get("s")?.trim().toUpperCase();
  if (!s) return NextResponse.json({ error: "missing s" }, { status: 400 });
  const data = await getAnalystConsensus(s);
  if (!data) return NextResponse.json({ available: false }, { status: 404 });
  return NextResponse.json({ available: true, ...data });
}
