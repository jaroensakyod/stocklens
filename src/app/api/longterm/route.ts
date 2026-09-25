import { NextResponse } from "next/server";
import { getLongterm } from "@/lib/longterm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 💤 หุ้นระยะยาว & ปันผล — logic อยู่ที่ src/lib/longterm.ts (แชท AI ใช้ร่วมกับหน้านี้)
export async function GET() {
  const data = await getLongterm();
  return NextResponse.json(data);
}
