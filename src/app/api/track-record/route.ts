import { NextResponse } from "next/server";
import { readTrackRecord } from "@/lib/trackRecord";
import { valueTrackMeta } from "@/lib/trackRecordAuto";

export const dynamic = "force-dynamic";

// GET /api/track-record — รายการสาธารณะ (อ่านจาก DB ถ้ามี / ไฟล์ถ้า dev) + สถานะสัญญาณที่รอประเมินผล
export async function GET() {
  const [entries, meta] = await Promise.all([readTrackRecord(), valueTrackMeta().catch(() => ({ watchingSignals: 0, watchingDays: 0 }))]);
  return NextResponse.json({ entries, meta });
}
