import { NextResponse } from "next/server";
import { getSurge } from "@/lib/surge";

export const dynamic = "force-dynamic";

// GET /api/surge — เรดาร์หุ้นซิ่ง (logic อยู่ใน lib เพื่อให้ Daily Brief ใช้ร่วมกันได้)
export async function GET() {
  return NextResponse.json(await getSurge());
}
