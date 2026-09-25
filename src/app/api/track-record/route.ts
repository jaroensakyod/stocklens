import { NextResponse } from "next/server";
import { readTrackRecord } from "@/lib/trackRecord";

export const dynamic = "force-dynamic";

// GET /api/track-record — รายการสาธารณะ (อ่านจาก DB ถ้ามี / ไฟล์ถ้า dev)
export async function GET() {
  const entries = await readTrackRecord();
  return NextResponse.json({ entries });
}
