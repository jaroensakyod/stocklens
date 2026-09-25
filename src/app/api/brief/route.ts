import { NextRequest, NextResponse } from "next/server";
import { buildBrief } from "@/lib/brief";
import { adminCode } from "@/lib/admin";

export const dynamic = "force-dynamic";

// GET /api/brief — ข้อมูล Daily Brief + โพสต์ FB พร้อมโพสต์ (แยก tier)
export async function GET() {
  const brief = await buildBrief();
  return NextResponse.json({ ...brief, adminHint: !adminCode() });
}
