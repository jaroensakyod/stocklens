import { NextRequest, NextResponse } from "next/server";
import { getSqueezeDashboard, analyzeSqueeze } from "@/lib/squeeze";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/squeeze — radar ทั้งตลาด (เสี่ยง squeeze + shorts ถอย + โหมดไทย)
export async function GET() {
  const data = await getSqueezeDashboard();
  if (!data) return NextResponse.json({ error: "ดึงข้อมูล FINRA ไม่สำเร็จ (ลองใหม่อีกครั้ง)" }, { status: 502 });
  return NextResponse.json(data);
}

// POST /api/squeeze { symbol } — วิเคราะห์ short interest รายตัว
export async function POST(req: NextRequest) {
  const { symbol } = (await req.json().catch(() => ({}))) as { symbol?: string };
  if (!symbol || symbol.trim().length < 1) return NextResponse.json({ error: "ต้องใส่ symbol เช่น GME" }, { status: 400 });
  const result = await analyzeSqueeze(symbol);
  return NextResponse.json(result);
}
