import { NextResponse } from "next/server";
import { getMonthlyDividends } from "@/lib/monthlyDividends";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// หุ้น/ETF จ่ายปันผลรายเดือน + ตัวเลขสด — เปิดฟรี (เป็นฐานข้อมูล/การศึกษา ไม่ใช่ AI)
export async function GET() {
  const data = await getMonthlyDividends();
  return NextResponse.json(data);
}
