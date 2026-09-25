import { NextResponse } from "next/server";
import { tvUniverse, toYahooSymbol } from "@/lib/tvscanner";
import { buildAnalysis } from "@/lib/analysis";
import { getChart, getUsdThb } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 💤 หุ้นระยะยาว & ปันผล — ตอบคนถือยาว: ปันผลเท่าไหร่ งบแข็งไหม ย้อน 5 ปีได้เท่าไหร่
// คัด 3 ชั้น: (1) หุ้นใหญ่นิ่ง mcap สูง + ปันผลจาก TradingView (2) ยืนยันคุณภาพงบด้วย buildAnalysis
// (Health/ROE/หนี้/FCF) (3) ผลตอบแทน 5 ปีจริงจากกราฟราคารายวัน (ราคาล้วน ไม่รวมปันผล — ระบุชัด)

interface LTRow {
  ticker: string;
  name: string;
  market: string;
  price: number;
  currency: string;
  yieldPct: number | null;
  pe: number | null;
  roePct: number | null;
  de: number | null;
  health: number | null;
  ret5yPct: number | null; // ราคาล้วน ไม่รวมปันผล
  cagr5yPct: number | null;
  score: number;
  note: string;
  dime: string | null;
}

let cached: { at: number; data: { dividends: LTRow[]; compounders: LTRow[]; asOf: string; note: string } } | null = null;
const TTL = 60 * 60_000;

async function rowFor(ticker: string, name: string, market: string, tvYield: number | null, usdThb: number): Promise<LTRow | null> {
  try {
    const a = await buildAnalysis(ticker);
    if (!isFinite(a.quote.price)) return null;
    let ret5y: number | null = null;
    let cagr5y: number | null = null;
    try {
      const c = await getChart(ticker, "5YD");
      if (c.length > 100) {
        const first = c[0].close;
        const last = c[c.length - 1].close;
        ret5y = ((last / first - 1) * 100);
        cagr5y = ((last / first) ** (1 / 5) - 1) * 100;
      }
    } catch {}

    const f = a.financials;
    const p = a.profile;
    const yieldPct = tvYield; // % ต่อปี จาก TradingView
    const roe = f?.returnOnEquity !== undefined ? f.returnOnEquity * 100 : null;
    const de = f?.debtToEquity ?? null;
    const health = a.factors?.health ?? null;
    const prof = a.factors?.profitability ?? null;
    const fcfOk = f?.freeCashflow === undefined || f.freeCashflow > 0;
    const deOk = de === null || de < 2.5;

    // คะแนนระยะยาว: คุณภาพงบหนักสุด + ปันผล + ผลตอบแทน 5 ปี + valuations ไม่แพงเกิน
    const score = Math.round(
      (health ?? 50) * 0.3 +
        (prof ?? 50) * 0.2 +
        Math.min(yieldPct ?? 0, 6) * 4 +
        Math.min(Math.max(cagr5y ?? 0, -10), 30) * 1.2 +
        (p?.trailingPE && p.trailingPE < 25 ? 6 : 0) -
        (fcfOk ? 0 : 20) -
        (deOk ? 0 : 15)
    );

    const parts = [
      yieldPct ? `ปันผล ~${yieldPct.toFixed(1)}%/ปี` : "ไม่จ่าย/จ่ายน้อย",
      roe !== null ? `ROE ${roe.toFixed(0)}%` : null,
      p?.trailingPE ? `P/E ${p.trailingPE.toFixed(1)}` : null,
      de !== null ? `หนี้/ทุน ${de.toFixed(1)}` : null,
      health !== null ? `ความแข็งแรงงบ ${health}/100` : null,
      ret5y !== null ? `ราคา 5 ปี ${ret5y >= 0 ? "+" : ""}${ret5y.toFixed(0)}% (ไม่รวมปันผล)` : null,
    ].filter(Boolean);

    return {
      ticker,
      name,
      market,
      price: a.quote.price,
      currency: a.quote.currency,
      yieldPct,
      pe: p?.trailingPE ?? null,
      roePct: roe,
      de,
      health,
      ret5yPct: ret5y !== null ? Math.round(ret5y * 10) / 10 : null,
      cagr5yPct: cagr5y !== null ? Math.round(cagr5y * 10) / 10 : null,
      score,
      note: parts.join(" · "),
      dime: a.quote.currency === "USD" ? `ซื้อได้ใน Dime ≈ ${(a.quote.price * usdThb).toFixed(0)}฿` : null,
    };
  } catch {
    return null;
  }
}

async function build() {
  const usdThb = await getUsdThb().catch(() => 33);
  const [us, th] = await Promise.all([tvUniverse("america", 600), tvUniverse("thailand", 400)]);

  // ผู้สมัคร: สายปันผล (ใหญ่ + yield ไม่ต่ำกว่าเกณฑ์) + สาย mega-cap (หุ้นชั้นนำไม่ว่าจะจ่ายปันผลไหม)
  const divCands = [
    ...us.filter((r) => r.mcap >= 20e9 && r.symbol.length <= 4 && r.dividendYield && r.dividendYield >= 2).sort((a, b) => (b.dividendYield ?? 0) - (a.dividendYield ?? 0)).slice(0, 14),
    ...th.filter((r) => r.mcap >= 1e9 && r.dividendYield && r.dividendYield >= 3).sort((a, b) => (b.dividendYield ?? 0) - (a.dividendYield ?? 0)).slice(0, 6),
  ];
  const megaCands = us.filter((r) => r.mcap >= 200e9 && r.symbol.length <= 4).slice(0, 12);

  const seen = new Set<string>();
  const jobs: { yahoo: string; name: string; market: string; y: number | null }[] = [];
  for (const r of [...divCands, ...megaCands]) {
    const yahoo = toYahooSymbol(r.country === "Thailand" ? "thailand" : "america", r.symbol);
    if (seen.has(yahoo)) continue;
    seen.add(yahoo);
    jobs.push({ yahoo, name: r.name.includes("_") ? r.name.split("_").pop()! : r.name, market: r.country === "Thailand" ? "🇹🇭" : "🇺🇸", y: r.dividendYield });
  }

  const rows = (await Promise.all(jobs.map((j) => rowFor(j.yahoo, j.name, j.market, j.y, usdThb)))).filter((r): r is LTRow => !!r);

  const dividends = rows
    // ต้องมีงบจริงให้ตรวจ (PE + Health ไม่ null) — ตัด ETF/ตราสารที่ TV จัดเป็น stock หลุดมา เช่น SOJD/SOJE
    .filter((r) => (r.yieldPct ?? 0) >= 2 && r.pe !== null && r.health !== null && r.health >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const compounders = rows
    .filter((r) => (r.cagr5yPct ?? 0) >= 12)
    .sort((a, b) => (b.cagr5yPct ?? 0) - (a.cagr5yPct ?? 0))
    .slice(0, 10);

  return {
    dividends,
    compounders,
    asOf: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.",
    note: "คัดจากหุ้นใหญ่ (mcap ≥ $20B สหรัฐฯ / ≥ ฿1B ไทย) · ปันผลจาก TradingView (ย้อนหลังล่าสุด) · งบ/ROE/หนี้จาก filings จริง · ผลตอบแทน 5 ปีเป็น 'ราคาล้วน' ยังไม่รวมเงินปันผลที่ได้รับ · เกณฑ์ความแข็งแรง = คะแนน Health จากงบ · ผลอดีตไม่รับประกันอนาคต ไม่ใช่คำแนะนำการลงทุน",
  };
}

export async function GET() {
  if (cached && Date.now() - cached.at < TTL) return NextResponse.json(cached.data);
  const data = await build();
  cached = { at: Date.now(), data };
  return NextResponse.json(data);
}
