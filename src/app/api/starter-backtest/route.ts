import { NextRequest, NextResponse } from "next/server";
import { runStarterBacktest, type StarterBtPosition } from "@/lib/starterBacktest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/starter-backtest { positions: [{symbol, weight}] } — ฟรี (ข้อมูลราคาย้อนหลังล้วน ไม่มี AI)
// จำลอง "ถ้าถือพอร์ตชุดนี้เมื่อ 1/3/5/10 ปีก่อน" จากกราฟจริง เทียบ S&P500
export async function POST(req: NextRequest) {
  const { positions } = (await req.json().catch(() => ({}))) as { positions?: StarterBtPosition[] };
  if (!positions?.length || positions.length > 12) {
    return NextResponse.json({ error: "ต้องส่ง positions 1-12 ตำแหน่ง" }, { status: 400 });
  }
  try {
    const r = await runStarterBacktest(positions);
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ error: "ดึงข้อมูลย้อนหลังไม่สำเร็จ — ลองอีกครั้ง" }, { status: 502 });
  }
}
