import { NextResponse } from "next/server";
import { getEconCalendar } from "@/lib/econCalendar";

export const dynamic = "force-dynamic";

// GET /api/calendar?days=14 — ปฏิทินเศรษฐกิจ (สดจาก ForexFactory + curated สำรอง) เวลาไทย
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const days = Math.min(Math.max(Number(sp.get("days") ?? 14) || 14, 1), 60);
  const res = await getEconCalendar(days);
  return NextResponse.json({ ...res, days });
}
