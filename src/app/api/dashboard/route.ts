import { NextResponse } from "next/server";
import { getNews, getQuotes } from "@/lib/yahoo";
import { getUsdThb } from "@/lib/yahoo";
import universe from "@/data/universe.json";
import calendarJson from "@/data/calendar.json";
import type { Quote } from "@/lib/types";

export const dynamic = "force-dynamic";

const INDICES = [
  { s: "^GSPC", n: "S&P 500" },
  { s: "^IXIC", n: "NASDAQ" },
  { s: "^DJI", n: "DOW" },
  { s: "^VIX", n: "VIX" },
  { s: "^SET.BK", n: "SET" },
  { s: "^N225", n: "NIKKEI" },
];

const POPULAR = ["NVDA", "AAPL", "TSLA", "PLTR", "MSFT", "AMZN", "META", "GOOGL", "AMD", "RKLB", "ASTS", "COIN", "LULU", "MELI", "MU", "ORCL", "CRWV", "NBIS"];

// Top movers ทั้งตลาดจาก TradingView scanner (หุ้น common ใน NYSE/NASDAQ, mcap ≥ $2B)
async function getTvMovers(): Promise<Quote[]> {
  const base = {
    filter: [
      { left: "type", operation: "equal", right: "stock" },
      { left: "subtype", operation: "equal", right: "common" },
      { left: "exchange", operation: "in_range", right: ["NYSE", "NASDAQ"] },
      { left: "market_cap_basic", operation: "in_range", right: [2e9, 1e13] },
    ],
    columns: ["name", "change", "close", "market_cap_basic"],
  };
  const call = async (order: "desc" | "asc") => {
    const res = await fetch("https://scanner.tradingview.com/america/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...base, sort: { sortBy: "change", sortOrder: order }, range: [0, 30] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error("tv " + res.status);
    const j = (await res.json()) as { data?: { s: string; d: (string | number)[] }[] };
    return (j.data ?? []).map((x) => ({
      symbol: x.s.split(":").pop() ?? x.s,
      name: String(x.d[0] ?? x.s),
      price: Number(x.d[2]),
      change: (Number(x.d[2]) * Number(x.d[1])) / (100 + Number(x.d[1])), // ประมาณจาก % ย้อนกลับ
      changePct: Number(x.d[1]),
      currency: "USD",
      exchange: x.s.split(":")[0],
    }));
  };
  const [gainers, losers] = await Promise.all([call("desc"), call("asc")]);
  return { gainers, losers } as unknown as Quote[];
}

// GET /api/dashboard — ข้อมูลหน้าแรกครบชุด (ดัชนี + movers ทั้งตลาด + ข่าว + ปฏิทิน + FX)
export async function GET() {
  const [quotes, popularQ, news, usdThb] = await Promise.all([
    getQuotes(INDICES.map((i) => i.s)),
    getQuotes(POPULAR),
    getNews("stock market", 8, 48 * 3600_000),
    getUsdThb(),
  ]);

  const indices = INDICES.map((i) => ({ ...i, quote: quotes[i.s] })).filter((x) => x.quote && isFinite(x.quote.price));
  const popular = POPULAR.map((p) => popularQ[p]).filter((q) => q && isFinite(q.price));

  // movers ทั้งตลาดจาก TradingView — ถ้าพัง fallback เป็นชุด popular
  let gainers: Quote[] = [];
  let losers: Quote[] = [];
  try {
    const tv = (await getTvMovers()) as unknown as { gainers: Quote[]; losers: Quote[] };
    gainers = tv.gainers.slice(0, 6);
    losers = tv.losers.slice(0, 6);
  } catch {
    const sorted = [...popular].sort((a, b) => b.changePct - a.changePct);
    gainers = sorted.slice(0, 5);
    losers = sorted.slice(-5).reverse();
  }

  const today = new Date().toISOString().slice(0, 10);
  const events = (calendarJson as { events: { date: string; label: string; impact: string; star: number }[] }).events.filter((e) => e.date >= today).slice(0, 4);

  return NextResponse.json({ indices, popular, gainers, losers, news, events, usdThb, universeSize: (universe as { tickers: unknown[] }).tickers.length });
}
