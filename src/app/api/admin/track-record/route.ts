import { NextRequest, NextResponse } from "next/server";
import { adminCode } from "@/lib/admin";
import { readTrackRecord, writeTrackRecord } from "@/lib/trackRecord";
import type { TrackRecordEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/admin/track-record — บันทึกสมมติฐานใหม่จากหน้าหุ้น (ต้องมีรหัสแอดมิน)
// เก็บใน Redis เมื่อตั้ง DB (Vercel) / ไฟล์เมื่อ dev
export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-code") !== adminCode()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as Partial<TrackRecordEntry>;
  if (!b.thesis || !b.tickers?.length) {
    return NextResponse.json({ error: "ต้องมีสมมติฐานและหุ้นอย่างน้อย 1 ตัว" }, { status: 400 });
  }
  const entry: TrackRecordEntry = {
    id: "TR" + Date.now().toString(36),
    date: b.date || new Date().toISOString().slice(0, 10),
    thesis: b.thesis,
    tickers: b.tickers,
    stance: b.stance ?? "neutral",
    status: "open",
    note: b.note ?? "บันทึกจากหน้าวิเคราะห์หุ้น",
  };
  const entries = [entry, ...(await readTrackRecord())];
  await writeTrackRecord(entries);
  return NextResponse.json({ ok: true, entry });
}
