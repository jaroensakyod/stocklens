import { NextRequest, NextResponse } from "next/server";
import { runAdvisorBacktest } from "@/lib/advisorBacktest";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// พอร์ตทดสอบ 2 แบบ — ตัวอย่างคนถือ 10 ตัว
const PRESETS: Record<string, { name: string; desc: string; tickers: string[] }> = {
  normal: {
    name: "💼 พอร์ตปกติ (mega-cap ผสม)",
    desc: "หุ้นใหญ่คุณภาพดีที่คนทั่วไปถือ ผสมหลายอุตสาหกรรม",
    tickers: ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM", "XOM", "UNH"],
  },
  surge: {
    name: "🚀 พอร์ตซิ่ง (โมเมนตัม/ผันผวนสูง)",
    desc: "หุ้นเติบโตเร็ว-ผันผวนแรง แบบที่สายซิ่งชอบถือ",
    tickers: ["PLTR", "COIN", "MARA", "SMCI", "MU", "AMD", "SOFI", "NU", "HOOD", "RBLX"],
  },
};

// POST /api/advisor-backtest { tickers?: string[], preset?: "normal"|"surge" }
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { tickers?: string[]; preset?: string; endDate?: string };
  let tickers = body.tickers;
  if (!tickers && body.preset && PRESETS[body.preset]) tickers = PRESETS[body.preset].tickers;
  if (!tickers?.length) return NextResponse.json({ error: "ต้องมี tickers หรือ preset" }, { status: 400 });
  try {
    const result = await runAdvisorBacktest(tickers, body.endDate ? { endDate: body.endDate } : undefined);
    return NextResponse.json({ preset: body.preset ? PRESETS[body.preset]?.name : null, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 400 });
  }
}
