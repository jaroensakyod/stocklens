"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { usePortfolio, useWatchlist } from "@/lib/store";

const PRESETS: Record<string, { label: string; tickers: string[] }> = {
  megacap: { label: "หุ้นใหญ่เทค 6 ตัว", tickers: ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN"] },
  value: { label: "หุ้น Value 6 ตัว", tickers: ["LULU", "NKE", "PYPL", "SBUX", "MDLZ", "UNH"] },
  cyclical: { label: "วัฏจักร/พลังงาน 6 ตัว", tickers: ["XOM", "CVX", "CAT", "DAL", "NUE", "FCX"] },
};

interface Row {
  ticker: string; trades: number; winRate: number; avgReturnPerTrade: number;
  strategyReturn: number; buyHoldReturn: number; outperformance: number; maxDrawdown: number;
  equityCurve: number[]; buyHoldCurve: number[]; from: string; to: string;
}
interface Result {
  strategyName: string; strategyDesc: string; results: Row[];
  summary: { n: number; avgWinRate: number; avgStrategyReturn: number; avgBuyHold: number; avgOutperformance: number; beatBuyHold: number };
}

export default function BacktestPage() {
  const [strategy, setStrategy] = useState("rsi_oversold");
  const [tickers, setTickers] = useState<string[]>(PRESETS.megacap.tickers);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { holdings } = usePortfolio();
  const { list: watchlist } = useWatchlist();

  const run = async (list = tickers, strat = strategy) => {
    if (!list.length) return;
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: list, strategy: strat }),
      });
      const j = await res.json();
      if (!res.ok) setErr(j.error || "ผิดพลาด");
      else setResult(j);
    } catch {
      setErr("รันไม่สำเร็จ ลองใหม่");
    }
    setBusy(false);
  };

  const chart = result
    ? result.results[0].equityCurve.map((v, i) => ({
        i,
        strategy: v,
        buyhold: result.results[0].buyHoldCurve[i],
      }))
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🧪 Backtest — พิสูจน์กลยุทธ์ด้วยข้อมูลจริง ~5 ปีย้อนหลัง</h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-3xl leading-relaxed">
          เครื่องมือที่เปลี่ยน &ldquo;คำพูด&rdquo; ให้เป็น &ldquo;สถิติ&rdquo; — เลือกกลยุทธ์ + หุ้น แล้วดูว่าย้อนหลังมันชนะ/แพ้ Buy&Hold กี่ % (สมมติฐาน保守: เข้า-ออกที่ราคาปิดวันสัญญาณ ไม่รวมปันผล/ค่าธรรมเนียม)
        </p>
      </div>

      {/* ตัวเลือก */}
      <div className="card p-4 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500">กลยุทธ์</label>
            <select className="input mt-1" value={strategy} onChange={(e) => { setStrategy(e.target.value); run(tickers, e.target.value); }}>
              <option value="rsi_oversold">RSI Oversold (เข้า RSI&lt;30 ออก RSI&gt;55)</option>
              <option value="golden_cross">Golden/Death Cross (SMA50×SMA200)</option>
              <option value="sma200_filter">Trend Filter (ถือเมื่อราคา&gt;SMA200)</option>
            </select>
          </div>
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-40">
              <label className="text-xs text-zinc-500">เพิ่มหุ้น (Enter)</label>
              <input className="input mt-1" placeholder="เช่น PTT.BK" value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter" && input && tickers.length < 12) { setTickers([...tickers, input]); setInput(""); } }} />
            </div>
            <button className="btn-primary" onClick={() => run()} disabled={busy}>
              {busy ? "กำลังรัน…" : "▶ รัน Backtest"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-zinc-600">ชุดสำเร็จ:</span>
          {Object.entries(PRESETS).map(([k, p]) => (
            <button key={k} className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-zinc-100" onClick={() => { setTickers(p.tickers); run(p.tickers, strategy); }}>
              {p.label}
            </button>
          ))}
          {holdings.length > 0 && (
            <button className="chip bg-base-800 text-emerald-400 border border-base-700" onClick={() => { const t = holdings.map((h) => h.ticker); setTickers(t); run(t, strategy); }}>
              💼 พอร์ตของฉัน ({holdings.length})
            </button>
          )}
          {watchlist.length > 0 && (
            <button className="chip bg-base-800 text-accent-soft border border-base-700" onClick={() => { setTickers(watchlist.slice(0, 12)); run(watchlist.slice(0, 12), strategy); }}>
              ⭐ Watchlist ({watchlist.length})
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tickers.map((t) => (
            <span key={t} className="chip bg-base-800 text-zinc-100 border border-base-700">
              {t}
              <button className="text-zinc-500 hover:text-down ml-1" onClick={() => setTickers(tickers.filter((x) => x !== t))}>✕</button>
            </span>
          ))}
        </div>
      </div>

      {err && <div className="card p-4 text-sm text-down">{err}</div>}

      {result && (
        <div className="space-y-5 animate-fadeUp">
          {/* สรุปรวม */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat k="หุ้นที่ทดสอบ" v={String(result.summary.n)} />
            <Stat k="Win rate เฉลี่ย" v={result.summary.avgWinRate + "%"} />
            <Stat k="กลยุทธ์ เฉลี่ย" v={fmt(result.summary.avgStrategyReturn) + "%"} tone={result.summary.avgStrategyReturn >= 0 ? "up" : "down"} />
            <Stat k="Buy&Hold เฉลี่ย" v={fmt(result.summary.avgBuyHold) + "%"} />
            <Stat k={`ชนะ B&H`} v={`${result.summary.beatBuyHold}/${result.summary.n} ตัว`} tone={result.summary.avgOutperformance >= 0 ? "up" : "down"} />
          </div>

          <div className="card p-4">
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">{result.strategyName} — {result.strategyDesc}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500 border-b border-base-700/60">
                    <th className="text-left px-3 py-2">หุ้น</th>
                    <th className="text-right px-3 py-2">รอบที่เทรด</th>
                    <th className="text-right px-3 py-2">Win rate</th>
                    <th className="text-right px-3 py-2">เฉลี่ย/รอบ</th>
                    <th className="text-right px-3 py-2">กลยุทธ์</th>
                    <th className="text-right px-3 py-2">Buy&Hold</th>
                    <th className="text-right px-3 py-2">± vs B&H</th>
                    <th className="text-right px-3 py-2">Drawdown สูงสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r) => (
                    <tr key={r.ticker} className="border-b border-base-700/30">
                      <td className="px-3 py-2">
                        <Link href={`/stock/${r.ticker}`} className="font-bold text-zinc-100 hover:text-accent-soft">{r.ticker}</Link>
                      </td>
                      <td className="px-3 py-2 text-right num text-zinc-300">{r.trades}</td>
                      <td className="px-3 py-2 text-right num text-zinc-300">{r.winRate}%</td>
                      <td className="px-3 py-2 text-right num text-zinc-300">{fmt(r.avgReturnPerTrade)}%</td>
                      <td className={`px-3 py-2 text-right num font-semibold ${r.strategyReturn >= 0 ? "text-up" : "text-down"}`}>{fmt(r.strategyReturn)}%</td>
                      <td className={`px-3 py-2 text-right num ${r.buyHoldReturn >= 0 ? "text-up" : "text-down"}`}>{fmt(r.buyHoldReturn)}%</td>
                      <td className={`px-3 py-2 text-right num font-bold ${r.outperformance >= 0 ? "text-up" : "text-down"}`}>{r.outperformance >= 0 ? "+" : ""}{fmt(r.outperformance)}%</td>
                      <td className="px-3 py-2 text-right num text-zinc-400">{r.maxDrawdown.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* กราฟ equity ตัวแรก */}
          <div className="card p-4">
            <h3 className="text-sm font-bold text-zinc-100 mb-1">
              เส้นทางพอร์ต: {result.results[0].ticker} ({result.results[0].from} → {result.results[0].to})
            </h3>
            <p className="text-[11px] text-zinc-500 mb-2">เหลือง = กลยุทธ์ · เทา = Buy&Hold (ฐาน 1.0)</p>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={chart}>
                  <XAxis dataKey="i" hide />
                  <YAxis domain={["auto", "auto"]} tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "#16161a", border: "1px solid #3a3a44", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => (v * 100 - 100).toFixed(0) + "%"} labelFormatter={() => ""} />
                  <ReferenceLine y={1} stroke="#3a3a44" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="strategy" stroke="#eab308" strokeWidth={2} dot={false} name="กลยุทธ์" />
                  <Line type="monotone" dataKey="buyhold" stroke="#71717a" strokeWidth={1.5} dot={false} name="Buy&Hold" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <p className="text-[11px] text-zinc-600 leading-relaxed">
            ⚠️ ผลย้อนหลัง (backtest) ไม่การันตีอนาคต — สมมติฐาน: เข้า/ออกที่ราคาปิดของวันที่เกิดสัญญาณ ไม่รวมเงินปันผล ค่าธรรมเนียม ภาษี และ slippage · ข้อมูลราคาจาก Yahoo Finance ·
            ใช้เป็นกรอบวิเคราะห์ประกอบการศึกษา ไม่ใช่คำแนะนำการลงทุน
          </p>
        </div>
      )}
    </div>
  );
}

function fmt(v: number) {
  return (v >= 0 ? "" : "") + v.toFixed(1);
}
function Stat({ k, v, tone }: { k: string; v: string; tone?: "up" | "down" }) {
  return (
    <div className="card p-4">
      <div className={`num text-xl font-bold ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-zinc-50"}`}>{v}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{k}</div>
    </div>
  );
}
