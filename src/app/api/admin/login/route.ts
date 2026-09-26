// ===== โหมดแอดมิน (ลายน้ำไม่แสดง) — ใช้รหัสเดียวกับหน้า /admin =====
// POST { code }  → ตรวจรหัส → ตั้ง cookie sl_admin (signed, httpOnly, 30 วัน)
// DELETE         → ออกจากโหมดแอดมิน
import { NextRequest, NextResponse } from "next/server";
import { adminCode, readMembers } from "@/lib/admin";
import { createAdminToken, ADMIN_COOKIE, cookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code || code !== adminCode()) {
    return NextResponse.json({ error: "รหัสแอดมินไม่ถูกต้อง" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, admin: true });
  res.cookies.set(ADMIN_COOKIE, createAdminToken(), cookieOptions());
  return res;
}

// DELETE — ออกจากโหมดแอดมิน (ลายน้ำกลับมาแสดงตามปกติ)
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

// ตรวจว่ามีสมาชิกอยู่ไหม (ใช้แนะนำตอนยังไม่มีใคร login เลย)
export async function GET() {
  const members = await readMembers().catch(() => []);
  return NextResponse.json({ ok: true, members: members.length });
}
