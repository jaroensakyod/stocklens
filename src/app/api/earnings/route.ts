import { NextResponse } from "next/server";
import { getEarningsCalendar } from "@/lib/earningsCalendar";

export const dynamic = "force-dynamic";

// GET /api/earnings?days=35 — ปฏิทินแถลงงบรายไตรมาสหุ้นสหรัฐฯ ยอดนิยม + คอนเซนซัส
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const days = Math.min(Math.max(Number(sp.get("days") ?? 35) || 35, 7), 90);
  const rows = await getEarningsCalendar(days);
  return NextResponse.json({ rows, days, count: rows.length });
}
