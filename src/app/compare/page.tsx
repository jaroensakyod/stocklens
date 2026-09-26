"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface CmpRow {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  currency: string;
  marketCap?: number;
  trailingPE?: number;
  dividendYield?: number;
  revenueGrowth?: number;
  profitMargins?: number;
  returnOnEquity?: number;
  factors?: { overall: number; valuation: number; growth: number; profitability: number; momentum: number; health: number };
  signal?: string;
  signalLabel?: string;
}

export default function ComparePage() {
  const [tickers, setTickers] = useState<string[]>(["NVDA", "LULU", "XOM"]);
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<CmpRow[]>([]);
  const [loading, setLoading] = useState(false);

  // รับ ?t=SYMBOL[,SYMBOL] — ลิงก์ "เทียบหุ้น" จากหน้าหุ้นคลิกเดียวมาถึงเลย
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("t");
    if (t) {
      const list = t.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 4);
      if (list.length) setTickers(list);
    }
  }, []);

  const load = async (list: string[]) => {
    if (!list.length) { setRows([]); return; }
    setLoading(true);
    const results: CmpRow[] = [];
    for (const t of list.slice(0, 4)) {
      try {
        const r = await fetch(`/api/analysis?s=${encodeURIComponent(t)}`);
        const a = await r.json();
        if (!isFinite(a.quote?.price)) continue;
        results.push({
          symbol: a.quote.symbol,
          name: a.quote.name,
          price: a.quote.price,
          changePct: a.quote.changePct,
          currency: a.quote.currency,
          marketCap: a.profile?.marketCap,
          trailingPE: a.profile?.trailingPE,
          dividendYield: a.profile?.dividendYield,
          revenueGrowth: a.financials?.revenueGrowth,
          profitMargins: a.financials?.profitMargins,
          returnOnEquity: a.financials?.returnOnEquity,
          factors: a.factors ? { overall: a.factors.overall, valuation: a.factors.valuation, growth: a.factors.growth, profitability: a.factors.profitability, momentum: a.factors.momentum, health: a.factors.health } : undefined,
          signal: a.technicals?.signal,
        });
      } catch {}
    }
    setRows(results);
    setLoading(false);
  };

  useEffect(() => {
    load(tickers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers.join(",")]);

  const add = () => {
    const t = input.trim().toUpperCase();
    if (t && !tickers.includes(t) && tickers.length < 4) setTickers([...tickers, t]);
    setInput("");
  };

  const metric = (label: string, fmt: (r: CmpRow) => string | undefined) => (
    <tr key={label} className="border-b border-base-700/30">
      <td className="px-3 py-2 text-xs text-zinc-500 whitespace-nowrap">{label}</td>
      {rows.map((r) => (
        <td key={r.symbol} className="px-3 py-2 num text-sm text-zinc-200">{fmt(r) ?? "—"}</td>
      ))}
    </tr>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">⚔️ เปรียบเทียบหุ้น (ข้ามตลาดได้)</h1>
        <p className="text-sm text-zinc-400 mt-1">เลือก 2–4 ตัว เช่น Value vs AI momentum แบบพอร์ต Burry แล้วดูคะแนนปัจจัย/งบเทียบกันทีเดียว</p>
      </div>

      <div className="card p-4 flex flex-wrap gap-2 items-center">
        {tickers.map((t) => (
          <span key={t} className="chip bg-base-800 text-zinc-100 border border-base-700">
            {t}
            <button className="text-zinc-500 hover:text-down ml-1" onClick={() => setTickers(tickers.filter((x) => x !== t))}>✕</button>
          </span>
        ))}
        {tickers.length < 4 && (
          <>
            <input
              className="input !w-44"
              placeholder="เพิ่ม เช่น PTT.BK"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <button className="btn-ghost !py-1.5" onClick={add}>+ เพิ่ม</button>
          </>
        )}
        {loading && <span className="text-xs text-zinc-500">กำลังโหลด…</span>}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-base-700/60">
              <th className="px-3 py-3 text-left text-xs text-zinc-500">ตัวชี้วัด</th>
              {rows.map((r) => (
                <th key={r.symbol} className="px-3 py-3 text-left">
                  <Link href={`/stock/${r.symbol}`} className="font-bold text-zinc-50 hover:text-accent-soft">{r.symbol}</Link>
                  <div className="text-[10px] text-zinc-500 font-normal max-w-40 truncate">{r.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metric("ราคา", (r) => `${r.price.toFixed(2)} ${r.currency}`)}
            {metric("% วันนี้", (r) => `${r.changePct >= 0 ? "+" : ""}${r.changePct.toFixed(2)}%`)}
            {metric("มูลค่าตลาด", (r) => r.marketCap ? (r.marketCap / 1e9).toFixed(0) + " พันล้าน" : undefined)}
            {metric("P/E", (r) => r.trailingPE?.toFixed(1))}
            {metric("เงินปันผล", (r) => r.dividendYield ? (r.dividendYield * 100).toFixed(1) + "%" : "—")}
            {metric("รายได้โต YoY", (r) => r.revenueGrowth !== undefined ? (r.revenueGrowth * 100).toFixed(1) + "%" : undefined)}
            {metric("มาร์จิ้นสุทธิ", (r) => r.profitMargins !== undefined ? (r.profitMargins * 100).toFixed(1) + "%" : undefined)}
            {metric("ROE", (r) => r.returnOnEquity !== undefined ? (r.returnOnEquity * 100).toFixed(1) + "%" : undefined)}
            {metric("คะแนนรวม", (r) => r.factors ? r.factors.overall + "/100" : undefined)}
            {metric("Valuation", (r) => r.factors?.valuation?.toString())}
            {metric("Growth", (r) => r.factors?.growth?.toString())}
            {metric("Profitability", (r) => r.factors?.profitability?.toString())}
            {metric("Momentum", (r) => r.factors?.momentum?.toString())}
            {metric("Health", (r) => r.factors?.health?.toString())}
            {metric("สัญญาณเทคนิค", (r) => r.signal === "bullish" ? "📈 เอียงบวก" : r.signal === "bearish" ? "📉 เอียงลบ" : r.signal ? "⚖️ กลาง" : undefined)}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && !loading && <p className="text-center text-zinc-500 text-sm py-8">เพิ่มหุ้นอย่างน้อย 1 ตัวเพื่อเริ่มเปรียบเทียบ</p>}
    </div>
  );
}
