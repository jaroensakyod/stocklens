import { NextRequest, NextResponse } from "next/server";
import { dataStats } from "@/lib/turso";

export const dynamic = "force-dynamic";

// GET /api/admin/data-status (header x-admin-code) — คลังข้อมูลของเรามีอะไรแล้ว
export async function GET(req: NextRequest) {
  if (process.env.ADMIN_CODE && req.headers.get("x-admin-code") !== process.env.ADMIN_CODE) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const stats = await dataStats();
  if (!stats) return NextResponse.json({ configured: false, note: "ยังไม่ได้ตั้ง TURSO_DATABASE_URL/TURSO_AUTH_TOKEN" });
  return NextResponse.json({ configured: true, ...stats });
}
