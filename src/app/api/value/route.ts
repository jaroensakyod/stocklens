import { NextResponse } from "next/server";
import { getValueScan } from "@/lib/valueScan";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 🤿 หุ้นใต้น้ำ vs 🎈 หุ้นแพงเกินตัว — คำนวณจากกฎ+ข้อมูลจริง ไม่ใช้ AI = เปิดฟรี
export async function GET() {
  const data = await getValueScan();
  return NextResponse.json(data);
}
