import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { adminCode } from "@/lib/admin";
import type { TrackRecordEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "src/data/track-record.json");

// POST /api/admin/track-record — บันทึกสมมติฐานใหม่จากหน้าหุ้น (ต้องมีรหัสแอดมิน)
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
  const raw = await fs.readFile(FILE, "utf8");
  const json = JSON.parse(raw) as { entries: TrackRecordEntry[] };
  json.entries = [entry, ...json.entries];
  await fs.writeFile(FILE, JSON.stringify(json, null, 2));
  return NextResponse.json({ ok: true, entry });
}
