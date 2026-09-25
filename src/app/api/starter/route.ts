import { NextResponse } from "next/server";
import { getStarterPortfolios } from "@/lib/starterPortfolio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// พอร์ตตัวอย่างรายวันสำหรับมือใหม่ — คำนวณจากกฎ ไม่ใช้ AI = เปิดฟรีทุกคน
export async function GET() {
  const data = await getStarterPortfolios();
  return NextResponse.json(data);
}
