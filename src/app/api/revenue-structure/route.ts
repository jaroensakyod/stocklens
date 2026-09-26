import { NextRequest, NextResponse } from "next/server";
import { revenueSegments } from "@/lib/edgar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/revenue-structure?s=NVDA — โครงสร้างรายได้แยกตามธุรกิจ/ภูมิภาค จาก 10-K จริง (EDGAR)
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get("s")?.trim().toUpperCase();
  if (!s) return NextResponse.json({ error: "missing s" }, { status: 400 });
  const data = await revenueSegments(s);
  if (!data) return NextResponse.json({ available: false }, { status: 404 });
  return NextResponse.json({ available: true, ...data });
}
