// ===== Admin: ทะเบียนสมาชิก — เก็บใน Upstash Redis (Vercel) หรือไฟล์ JSON (dev) =====
import { promises as fs } from "fs";
import path from "path";
import type { Member } from "./types";
import { kvGet, kvSet, hasDB } from "./storage";

const FILE = path.join(process.cwd(), "src/data/members.json");
const DB_KEY = "members";

export function adminCode(): string {
  return process.env.ADMIN_CODE || "stocklens-admin";
}

export async function readMembers(): Promise<Member[]> {
  // ชั้น 1: Redis (ถ้าตั้ง DB ไว้ — ใช้บน Vercel)
  if (hasDB()) {
    const fromDb = await kvGet<Member[]>(DB_KEY);
    if (fromDb) return fromDb;
    return []; // DB พร้อมแต่ยังไม่มีข้อมูล — เริ่มชุดใหม่
  }
  // ชั้น 2: ไฟล์ (dev ที่เครื่อง)
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const j = JSON.parse(raw) as { members: Member[] };
    return j.members ?? [];
  } catch {
    return [];
  }
}

export async function writeMembers(members: Member[]) {
  if (hasDB()) {
    await kvSet(DB_KEY, members);
    return;
  }
  try {
    await fs.writeFile(FILE, JSON.stringify({ _note: "ทะเบียนสมาชิก VIP (ใช้ในหน้า /admin) — บน Vercel ข้อมูลอยู่ใน Upstash Redis", members }, null, 2));
  } catch {
    // ไม่ควรเกิดในโหมดไฟล์ — โยนให้ route แจ้งเตือนเป็นมิตร
    throw new Error("WRITE_FS_FAILED: สภาพแวดล้อมนี้เขียนไฟล์ถาวรไม่ได้ (serverless) — ตั้ง UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN ใน .env.local หรือ Vercel env แล้วระบบจะเก็บลง DB อัตโนมัติ");
  }
}

export function daysLeft(paidUntil: string): number {
  return Math.ceil((new Date(paidUntil).getTime() - Date.now()) / 864e5);
}
