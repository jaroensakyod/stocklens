// ===== Track Record storage — Redis (Vercel) / ไฟล์ (dev) ใช้ร่วมกันทั้งระบบ =====
import { promises as fs } from "fs";
import path from "path";
import { kvGet, kvSet, hasDB } from "./storage";
import trackFallback from "@/data/track-record.json";
import type { TrackRecordEntry } from "./types";

const FILE = path.join(process.cwd(), "src/data/track-record.json");
const DB_KEY = "track-record";

/** อ่านทั้งหมด: Redis → ไฟล์ → ข้อมูลตัวอย่างที่ bundle ไว้ (สำรองสุดท้าย) */
export async function readTrackRecord(): Promise<TrackRecordEntry[]> {
  if (hasDB()) {
    const fromDb = await kvGet<TrackRecordEntry[]>(DB_KEY);
    if (fromDb) return fromDb;
  }
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return (JSON.parse(raw) as { entries: TrackRecordEntry[] }).entries ?? [];
  } catch {
    return (trackFallback as { entries: TrackRecordEntry[] }).entries ?? [];
  }
}

export async function writeTrackRecord(entries: TrackRecordEntry[]) {
  if (hasDB()) {
    await kvSet(DB_KEY, entries);
    return;
  }
  await fs.writeFile(FILE, JSON.stringify({ entries }, null, 2));
}
