import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AUTH_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/auth/me → สมาชิกที่ login อยู่ (หรือ null)
export async function GET(req: NextRequest) {
  const member = verifyToken(req.cookies.get(AUTH_COOKIE)?.value);
  return NextResponse.json({ member });
}
