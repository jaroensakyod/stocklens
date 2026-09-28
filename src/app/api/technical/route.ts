import { NextResponse } from "next/server";
import { getChart } from "@/lib/yahoo";
import { buildFullTechnical } from "@/lib/taFull";

export const dynamic = "force-dynamic";

// GET /api/technical?s=AAPL — แผงทางเทคนิคเต็ม (ออสซิลเลเตอร์ + MA + Pivot + สรุป 5 ระดับ)
export async function GET(req: Request) {
  const s = new URL(req.url).searchParams.get("s")?.trim().toUpperCase();
  if (!s) return NextResponse.json({ error: "กรุณาระบุ ?s=TICKER" }, { status: 400 });
  const candles = await getChart(s, "1Y"); // รายวัน 1 ปี — แคช 3 ชั้นอยู่ใน getChart แล้ว
  const full = buildFullTechnical(s, candles);
  if (!full) return NextResponse.json({ error: "ข้อมูลไม่พอคำนวณสัญญาณ (หุ้นใหม่/แท่งเทียนน้อยเกิน)" }, { status: 404 });
  return NextResponse.json(full);
}
