// ===== Admin: จัดการทะเบียนสมาชิก (เก็บใน src/data/members.json) =====
import { promises as fs } from "fs";
import path from "path";
import type { Member } from "./types";

const FILE = path.join(process.cwd(), "src/data/members.json");

export function adminCode(): string {
  return process.env.ADMIN_CODE || "stocklens-admin";
}

export async function readMembers(): Promise<Member[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const j = JSON.parse(raw) as { members: Member[] };
    return j.members ?? [];
  } catch {
    return [];
  }
}

export async function writeMembers(members: Member[]) {
  try {
    await fs.writeFile(FILE, JSON.stringify({ _note: "ทะเบียนสมาชิก VIP (ใช้ในหน้า /admin)", members }, null, 2));
  } catch {
    // serverless (เช่น Vercel) เขียนไฟล์ไม่ได้ — คืน error ให้ route จัดการเป็นมิตรกับผู้ใช้
    throw new Error("WRITE_FS_FAILED: สภาพแวดล้อมนี้เขียนไฟล์ถาวรไม่ได้ (serverless) — ใช้ /admin บนเครื่องตัวเอง หรือต่อ DB ตามคู่มือ DEPLOY.md");
  }
}

export function daysLeft(paidUntil: string): number {
  return Math.ceil((new Date(paidUntil).getTime() - Date.now()) / 864e5);
}
