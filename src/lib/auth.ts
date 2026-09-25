// ===== Auth แบบเบา: แอดมินออกรหัสสมาชิก → สมาชิก login ด้วยรหัส → token ลง cookie =====
// โมเดล: ไม่มีรหัสผ่าน ไม่มี DB — รหัสสมาชิก (SL-XXXXXX) เก็บใน members.json
// แอดมินส่งรหัสให้สมาชิกเองหลังตรวจสลิป (ฉันอนุมัติเอง) ตามแบบที่ต้องการ
import { createHmac, randomBytes } from "crypto";
import { readMembers } from "./admin";
import type { Member } from "./types";

export const AUTH_COOKIE = "sl_token";
const SECRET = process.env.ADMIN_CODE || "stocklens-default-secret";
const MAX_AGE = 30 * 24 * 3600; // 30 วัน

export interface SessionMember {
  id: string;
  name: string;
  tier: "starter" | "pro";
  paidUntil: string;
  code: string;
}

/** ออกรหัสสมาชิกใหม่ เช่น SL-7K2M9Q */
export function generateAccessCode(): string {
  return "SL-" + randomBytes(4).toString("base64url").replace(/[-_]/g, "").slice(0, 6).toUpperCase();
}

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function createToken(m: SessionMember): string {
  const payload = Buffer.from(JSON.stringify(m)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): SessionMember | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  try {
    const m = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionMember;
    if (!m.id || !m.tier) return null;
    // หมดอายุแล้ว = session ตาย (ต่ออายุแล้วต้อง login ใหม่)
    if (new Date(m.paidUntil).getTime() < Date.now() - 24 * 3600e3) return null;
    return m;
  } catch {
    return null;
  }
}

export function cookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: MAX_AGE };
}

/** login ด้วยรหัสสมาชิก: ตรวจจาก members.json + ยังไม่หมดอายุ */
export async function loginByCode(code: string): Promise<SessionMember | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized.startsWith("SL-")) return null;
  const members = await readMembers();
  const m: Member | undefined = members.find((x) => (x.accessCode ?? "").toUpperCase() === normalized);
  if (!m) return null;
  if (new Date(m.paidUntil).getTime() < Date.now() - 24 * 3600e3) return null; // หมดอายุ
  return { id: m.id, name: m.name, tier: m.tier, paidUntil: m.paidUntil, code: normalized };
}

// ---------- ตรวจสิทธิ์จาก request (ใช้ใน API routes) ----------
import type { NextRequest } from "next/server";

/** อ่าน tier จาก cookie — "free" = ไม่ได้ login / หมดอายุ */
export function getTierFromRequest(req: NextRequest): "free" | "starter" | "pro" {
  const m = verifyToken(req.cookies.get(AUTH_COOKIE)?.value);
  return m ? m.tier : "free";
}

/** AI ทุกชนิด = ต้องเป็นสมาชิกอย่างน้อย Starter (free ใช้ไม่ได้ทั้งหมด) */
export function requireMember(req: NextRequest): { ok: boolean; tier: "free" | "starter" | "pro" } {
  const tier = getTierFromRequest(req);
  return { ok: tier !== "free", tier };
}
