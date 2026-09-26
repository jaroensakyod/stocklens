import { NextRequest, NextResponse } from "next/server";
import { loginByCode, createToken, createAdminToken, cookieOptions, AUTH_COOKIE, ADMIN_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/auth/login { code: "SL-XXXXXX" } → ตรวจรหัสจากทะเบียนสมาชิก → ตั้ง cookie session 30 วัน
// สมาชิกที่ flag isAdmin = true → ตั้ง cookie โหมดแอดมินเพิ่ม (ลายน้ำไม่แสดงทันที)
export async function POST(req: NextRequest) {
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code?.trim()) return NextResponse.json({ error: "กรอกรหัสสมาชิก" }, { status: 400 });
  const member = await loginByCode(code);
  if (!member) return NextResponse.json({ error: "รหัสไม่ถูกต้อง หรือสมาชิกพ้นกำหนดชำระ — ติดต่อแอดมิน" }, { status: 401 });
  const res = NextResponse.json({ member, admin: member.isAdmin === true });
  res.cookies.set(AUTH_COOKIE, createToken(member), cookieOptions());
  if (member.isAdmin) res.cookies.set(ADMIN_COOKIE, createAdminToken(), cookieOptions());
  return res;
}
