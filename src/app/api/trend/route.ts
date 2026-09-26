import { NextResponse } from "next/server";
import { getTrend } from "@/lib/trend";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/trend — แนวโน้มวันนี้ (มหภาค + ธีม + ใต้น้ำ/แพงเกินตัว + คะแนนเด่น) ประกอบจากเครื่องยนต์เดิม
export async function GET() {
  const data = await getTrend().catch(() => null);
  if (!data) return NextResponse.json({ error: "ยังประกอบข้อมูลไม่ได้ — ลองอีกครั้ง" }, { status: 502 });
  return NextResponse.json(data);
}
