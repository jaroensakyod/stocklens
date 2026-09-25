import { NextRequest, NextResponse } from "next/server";
import { getModelPortfolio, runWeeklyAdjust, liveNav, nextMonday } from "@/lib/modelPortfolio";
import { hasAI } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 💼 พอร์ตจำลอง StockLens (AI ปรับรายสัปดาห์) — เปิดดูฟรี เพราะเป็น Track Record สาธารณะ
export async function GET() {
  const state = await getModelPortfolio();
  const live = await liveNav(state);
  const latest = state.snapshots[state.snapshots.length - 1] ?? null;
  return NextResponse.json({
    startedAt: state.startedAt,
    initialThb: state.initialThb,
    latest,
    live,
    history: [...state.snapshots].reverse(),
    weeksCount: state.snapshots.length,
    nextRebalanceTh: nextMonday().toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "short", day: "numeric" }),
    aiAvailable: hasAI(),
  });
}

// ปรับพอร์ตทันที (แอดมิน) — กันคนยิงเปลือง AI
export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-code") !== (process.env.ADMIN_CODE || "stocklens-admin")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const state = await runWeeklyAdjust(true);
  const latest = state.snapshots[state.snapshots.length - 1];
  return NextResponse.json({ ok: true, latest });
}
