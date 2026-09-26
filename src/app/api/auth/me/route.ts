import { NextRequest, NextResponse } from "next/server";
import { verifyToken, verifyAdminToken, AUTH_COOKIE, ADMIN_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/auth/me → สมาชิกที่ login อยู่ (หรือ null) + โหมดแอดมิน (admin=true = ไม่แสดงลายน้ำ)
export async function GET(req: NextRequest) {
  const member = verifyToken(req.cookies.get(AUTH_COOKIE)?.value);
  const admin = verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);
  return NextResponse.json({ member, admin });
}
