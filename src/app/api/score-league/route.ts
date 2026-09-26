import { NextResponse } from "next/server";
import { kvGet } from "@/lib/storage";

export const dynamic = "force-dynamic";

// GET /api/score-league — อันดับ StockLens Score ล่าสุด (จากที่ cron บันทึกรายวัน)
export async function GET() {
  const data = await kvGet<{ at: number; list: { sym: string; t: number }[] }>("score:latest").catch(() => null);
  if (!data) return NextResponse.json({ list: [] });
  return NextResponse.json(data);
}
