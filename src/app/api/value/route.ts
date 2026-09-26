import { NextRequest, NextResponse } from "next/server";
import { getValueScan, getValueHistory, getValueDay } from "@/lib/valueScan";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 🤿 หุ้นใต้น้ำ vs 🎈 แพงเกินตัว — คำนวณจากกฎ+ข้อมูลจริง ไม่ใช้ AI = เปิดฟรี
// GET          → สแกนสดวันนี้ + รายการวันที่มีบันทึกย้อนหลัง
// GET ?date=   → snapshot ของวันนั้น (บันทึกแรกที่มีคนเปิดหน้าในแต่ละวัน)
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (date) {
    const day = await getValueDay(date);
    if (!day) return NextResponse.json({ error: "ไม่มีบันทึกของวันนี้" }, { status: 404 });
    return NextResponse.json({ ...day, asOf: "ย้อนหลัง", isHistory: true });
  }
  const data = await getValueScan();
  const history = await getValueHistory();
  return NextResponse.json({ ...data, history, isHistory: false });
}
