import { NextRequest, NextResponse } from "next/server";
import { getChart } from "@/lib/yahoo";
import { runBacktest, STRATEGIES, type StrategyId } from "@/lib/backtest";

export const dynamic = "force-dynamic";

// POST /api/backtest { tickers: string[], strategy: "rsi_oversold"|"golden_cross"|"sma200_filter" }
// ทดสอบกลยุทธ์ย้อนหลัง ~5 ปี จากกราฟราคาจริงรายวัน
export async function POST(req: NextRequest) {
  const { tickers, strategy } = (await req.json().catch(() => ({}))) as { tickers?: string[]; strategy?: StrategyId };
  const strat: StrategyId = strategy && STRATEGIES[strategy] ? strategy : "rsi_oversold";
  const list = (tickers ?? []).map((t) => t.toUpperCase()).filter(Boolean).slice(0, 12);
  if (!list.length) return NextResponse.json({ error: "ต้องมีหุ้นอย่างน้อย 1 ตัว" }, { status: 400 });

  const results: NonNullable<ReturnType<typeof runBacktest>>[] = [];
  for (const t of list) {
    const candles = await getChart(t, "5YD");
    const r = runBacktest(t, candles, strat);
    if (r) {
      // ย่อ equity curve ให้กราฟเบา (สุ่ม ~130 จุด)
      const step = Math.max(1, Math.floor(r.equityCurve.length / 130));
      results.push({
        ...r,
        equityCurve: r.equityCurve.filter((_, i) => i % step === 0).map((v) => Math.round(v * 1000) / 1000),
        buyHoldCurve: r.buyHoldCurve.filter((_, i) => i % step === 0).map((v) => Math.round(v * 1000) / 1000),
      });
    }
  }

  if (!results.length) {
    return NextResponse.json({ error: "หุ้นที่เลือกไม่มีข้อมูลย้อนหลังเพียงพอ (ต้องการอย่างน้อย ~220 วันทำการ)" }, { status: 400 });
  }

  const avg = (f: (r: (typeof results)[number]) => number) => results.reduce((a, r) => a + f(r), 0) / results.length;
  return NextResponse.json({
    strategy: strat,
    strategyName: STRATEGIES[strat].name,
    strategyDesc: STRATEGIES[strat].desc,
    results,
    summary: {
      n: results.length,
      avgWinRate: Math.round(avg((r) => r.winRate)),
      avgStrategyReturn: Math.round(avg((r) => r.strategyReturn) * 10) / 10,
      avgBuyHold: Math.round(avg((r) => r.buyHoldReturn) * 10) / 10,
      avgOutperformance: Math.round(avg((r) => r.outperformance) * 10) / 10,
      beatBuyHold: results.filter((r) => r.outperformance > 0).length,
    },
  });
}
