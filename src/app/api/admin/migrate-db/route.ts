import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { adminCode, readMembers, writeMembers } from "@/lib/admin";
import { readTrackRecord, writeTrackRecord } from "@/lib/trackRecord";
import { hasDB } from "@/lib/storage";
import type { Member, TrackRecordEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/admin/migrate-db — ย้ายข้อมูลจากไฟล์ JSON ขึ้น Database (กดครั้งเดียวหลังต่อ Upstash)
// ปลอดภัยต่อข้อมูลเดิม: ทับซ้อนกันจะ "รวม" โดยข้อมูลใน DB ชนะ (คนที่มีแล้วไม่โดนเขียนทับ)
export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-code") !== adminCode()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasDB()) {
    return NextResponse.json(
      { error: "ยังไม่ได้ต่อ Database — ใส่ UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN ใน .env.local (หรือ Vercel env) แล้วรีสตาร์ท แล้วกดย้ายได้ (ดูวิธีใน DEPLOY.md)" },
      { status: 400 }
    );
  }

  const result: { membersAdded: number; trackAdded: number; skipped: number } = { membersAdded: 0, trackAdded: 0, skipped: 0 };

  // อ่านไฟล์เดิม (ถ้าไม่มีก็ข้าม)
  const readFileJson = async <T>(rel: string, key: string): Promise<T[]> => {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), rel), "utf8");
      return ((JSON.parse(raw) as Record<string, unknown>)[key] as T[]) ?? [];
    } catch {
      return [];
    }
  };
  const fileMembers = await readFileJson<Member>("src/data/members.json", "members");
  const fileTrack = await readFileJson<TrackRecordEntry>("src/data/track-record.json", "entries");

  // รวมสมาชิก: DB ชนะไฟล์
  const dbMembers = await readMembers();
  const dbIds = new Set(dbMembers.map((m) => m.id));
  for (const m of fileMembers) {
    if (!dbIds.has(m.id)) {
      dbMembers.push(m);
      result.membersAdded++;
    } else result.skipped++;
  }
  await writeMembers(dbMembers);

  // รวม Track Record
  const dbTrack = await readTrackRecord();
  const dbTrackIds = new Set(dbTrack.map((e) => e.id));
  for (const e of fileTrack) {
    if (!dbTrackIds.has(e.id)) {
      dbTrack.push(e);
      result.trackAdded++;
    }
  }
  await writeTrackRecord(dbTrack);

  return NextResponse.json({ ok: true, ...result, totalMembers: dbMembers.length, totalTrack: dbTrack.length });
}
