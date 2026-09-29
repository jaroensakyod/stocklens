"use client";

import { useCallback, useEffect, useState } from "react";
import TickerPicker from "@/components/TickerPicker";
import InvestWarn from "@/components/InvestWarn";
import OptionPlayCard from "@/components/OptionPlayCard";
import PaperPortfolio from "@/components/PaperPortfolio";

interface Expiry { date: string; daysToExpiry: number }
interface ChainIndex { symbol: string; underlyingPrice: number; expiries: Expiry[] }
interface Contract {
  strike: number; bid: number; ask: number; mid: number; last: number;
  volume: number; openInterest: number; iv: number; delta: number; gamma: number;
  thetaDay: number; vega1pct: number; breakEven: number; itm: boolean;
}
interface Chain {
  symbol: string; underlyingPrice: number; expiry: string; daysToExpiry: number;
  calls: Contract[]; puts: Contract[];
  atmIv: number | null; hv20: number | null; ivPremiumPct: number | null;
  source: string;
}

export default function OptionsPage() {
  const [symbol, setSymbol] = useState("NVDA");
  const [idx, setIdx] = useState<ChainIndex | null>(null);
  const [expiry, setExpiry] = useState("");
  const [chain, setChain] = useState<Chain | null>(null);
  const [err, setErr] = useState("");
  const [loadingIdx, setLoadingIdx] = useState(false);
  const [loadingChain, setLoadingChain] = useState(false);

  const loadIdx = useCallback(async (sym: string) => {
    setLoadingIdx(true);
    setErr("");
    setIdx(null);
    setChain(null);
    setExpiry("");
    try {
      const r = await fetch(`/api/options/chain?s=${encodeURIComponent(sym)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "ไม่พบ options");
      setIdx(j);
      // เลือก expiry อัตโนมัติ: ใกล้ 2-4 สัปดาห์ (น้ำหนักพอ ไม่เล่น theta ตาย)
      const best = j.expiries.find((e: Expiry) => e.daysToExpiry >= 14) ?? j.expiries[0];
      if (best) setExpiry(best.date);
    } catch (e) {
      setErr((e as Error).message);
    }
    setLoadingIdx(false);
  }, []);

  useEffect(() => {
    const s = new URLSearchParams(location.search).get("s");
    if (s) setSymbol(s.toUpperCase());
  }, []);

  useEffect(() => {
    if (symbol) loadIdx(symbol);
  }, [symbol, loadIdx]);

  useEffect(() => {
    if (!symbol || !expiry) return;
    setLoadingChain(true);
    setErr("");
    fetch(`/api/options/chain?s=${encodeURIComponent(symbol)}&expiry=${expiry}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        return j;
      })
      .then(setChain)
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoadingChain(false));
  }, [symbol, expiry]);

  const fmt = (v: number, d = 2) => (isFinite(v) && v !== 0 ? v.toFixed(d) : "—");
  const ivPct = (v: number) => (v > 0 ? (v * 100).toFixed(1) + "%" : "—");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🎯 Options Lab</h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-3xl leading-relaxed">
          Options chain จริงจาก Yahoo Finance พร้อม Greeks (Black-Scholes) — ดูราคา bid/ask · delta · theta · IV เทียบความผันผวนจริง
          เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน
        </p>
        <div className="mt-2"><InvestWarn /></div>
      </div>

      {/* เลือกหุ้น + expiry */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-48">
          <label className="text-xs text-zinc-500 block mb-1">หุ้น (สหรัฐฯ เท่านั้น)</label>
          <TickerPicker onSelect={(s) => setSymbol(s.toUpperCase())} placeholder="เช่น NVDA / AAPL / TSLA" />
        </div>
        {idx?.expiries?.length ? (
          <div className="min-w-56">
            <label className="text-xs text-zinc-500 block mb-1">วันหมดอายุ</label>
            <select className="input" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
              {idx.expiries.map((e) => (
                <option key={e.date} value={e.date}>
                  {new Date(e.date + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })} ({e.daysToExpiry} วัน)
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {idx && (
          <div className="text-right ml-auto">
            <div className="text-[10px] text-zinc-500">{symbol} ราคาปัจจุบัน</div>
            <div className="num text-lg font-bold text-zinc-50">{idx.underlyingPrice.toFixed(2)}</div>
          </div>
        )}
      </div>

      {loadingIdx && <div className="card p-6 text-center text-xs text-zinc-500">กำลังโหลด options chain จาก Yahoo…</div>}
      {err && <div className="card p-6 text-center text-sm text-down">{err}</div>}

      {/* AI Option Play */}
      {symbol && !loadingIdx && !err && <OptionPlayCard symbol={symbol} />}

      {/* IV context */}
      {chain && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["ATM IV", chain.atmIv !== null ? ivPct(chain.atmIv) : "—"],
            ["HV 20 วัน (จริง)", chain.hv20 !== null ? ivPct(chain.hv20) : "—"],
            ["IV Premium", chain.ivPremiumPct !== null ? `${chain.ivPremiumPct > 0 ? "+" : ""}${chain.ivPremiumPct.toFixed(1)}%` : "—"],
            ["เหลือเวลา", `${chain.daysToExpiry} วัน`],
          ].map(([k, v]) => (
            <div key={k as string} className="card p-3">
              <div className="text-[10px] text-zinc-500">{k}</div>
              <div className="num text-lg font-bold text-zinc-50">{v}</div>
            </div>
          ))}
          {chain.ivPremiumPct !== null && chain.ivPremiumPct > 15 && (
            <div className="col-span-2 md:col-span-4 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              ⚠️ IV แพงกว่าความผันผวนจริง {chain.ivPremiumPct.toFixed(0)}% — ซื้อ option ตอนนี้จ่ายค่าความคาดหวังแพง (คิดเป็นเวลาแพงเพราะเหตุการณ์ใกล้)
            </div>
          )}
        </div>
      )}

      {/* Paper Portfolio */}
      <PaperPortfolio />

      {/* Chain table */}
      {loadingChain && <div className="card p-6 text-center text-xs text-zinc-500">กำลังโหลด chain {expiry}…</div>}
      {chain && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 text-xs text-zinc-500 border-b border-base-700/60 flex justify-between flex-wrap gap-2">
            <span>{chain.symbol} · หมดอายุ {chain.expiry} · {chain.calls.length} strikes</span>
            <span>📊 Delta 0.5 ≈ ATM · สีเขียว = ITM</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[760px]">
              <thead>
                <tr className="text-zinc-500 border-b border-base-700/60 text-[10px]">
                  <th colSpan={5} className="text-center py-1.5 text-up font-bold">CALLS 📈</th>
                  <th className="text-center py-1.5 font-bold text-zinc-300">STRIKE</th>
                  <th colSpan={5} className="text-center py-1.5 text-down font-bold">PUTS 📉</th>
                </tr>
                <tr className="text-zinc-500 border-b border-base-700/60 text-[10px]">
                  <th className="text-right px-2 py-1.5">Bid</th>
                  <th className="text-right px-2 py-1.5">Ask</th>
                  <th className="text-right px-2 py-1.5">Vol</th>
                  <th className="text-right px-2 py-1.5">OI</th>
                  <th className="text-right px-2 py-1.5">Delta</th>
                  <th className="text-center px-3 py-1.5 font-bold text-zinc-300">$</th>
                  <th className="text-right px-2 py-1.5">Delta</th>
                  <th className="text-right px-2 py-1.5">OI</th>
                  <th className="text-right px-2 py-1.5">Vol</th>
                  <th className="text-right px-2 py-1.5">Ask</th>
                  <th className="text-right px-2 py-1.5">Bid</th>
                </tr>
              </thead>
              <tbody>
                {chain.calls.map((c) => {
                  const p = chain.puts.find((x) => Math.abs(x.strike - c.strike) < 0.01);
                  if (!p) return null;
                  const step = chain.calls.length > 1 ? chain.calls[1].strike - chain.calls[0].strike : 5;
                  const atm = Math.abs(c.strike - chain.underlyingPrice) < step / 2 + 0.01;
                  return (
                    <tr key={c.strike} className={`border-b border-base-700/30 ${atm ? "bg-accent/10 font-bold" : ""}`}>
                      {/* Calls */}
                      <td className={`text-right px-2 py-1.5 num ${c.itm ? "text-up" : "text-zinc-300"}`}>{fmt(c.bid)}</td>
                      <td className={`text-right px-2 py-1.5 num ${c.itm ? "text-up" : "text-zinc-300"}`}>{fmt(c.ask)}</td>
                      <td className="text-right px-2 py-1.5 num text-zinc-500">{c.volume || "—"}</td>
                      <td className="text-right px-2 py-1.5 num text-zinc-500">{c.openInterest || "—"}</td>
                      <td className="text-right px-2 py-1.5 num text-zinc-400">{fmt(c.delta, 2)}</td>
                      {/* Strike */}
                      <td className={`text-center px-3 py-1.5 num border-x border-base-700/40 ${atm ? "text-accent-soft" : "text-zinc-100"}`}>{c.strike}</td>
                      {/* Puts */}
                      <td className="text-right px-2 py-1.5 num text-zinc-400">{fmt(p.delta, 2)}</td>
                      <td className="text-right px-2 py-1.5 num text-zinc-500">{p.openInterest || "—"}</td>
                      <td className="text-right px-2 py-1.5 num text-zinc-500">{p.volume || "—"}</td>
                      <td className={`text-right px-2 py-1.5 num ${p.itm ? "text-down" : "text-zinc-300"}`}>{fmt(p.ask)}</td>
                      <td className={`text-right px-2 py-1.5 num ${p.itm ? "text-down" : "text-zinc-300"}`}>{fmt(p.bid)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-[10px] text-zinc-600">
            ข้อมูลจาก Yahoo Finance (delay) · Greeks คำนวณด้วย Black-Scholes (r=4.5%) · ITM = สีเขียว/แดง · แถบทอง = ATM (ใกล้ราคาหุ้นปัจจุบัน)
          </p>
        </div>
      )}

      {/* Theta reference */}
      {chain && (
        <div className="card p-4">
          <h3 className="text-sm font-bold text-zinc-100 mb-2">⏰ Theta decay (เงินสูญเสียต่อวัน ถ้าหุ้นไม่ขยับ)</h3>
          <p className="text-xs text-zinc-500 mb-3">ไม้ที่มี theta หนักสุด = แพงสุดถ้าหุ้นนิ่ง — ไม้ ATM สั้นมัก theta แรงสุดเมื่อใกล้หมดอายุ</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[...chain.calls].sort((a, b) => Math.abs(b.thetaDay) - Math.abs(a.thetaDay)).slice(0, 4).map((c) => (
              <div key={c.strike} className="rounded-lg border border-base-700 p-2.5">
                <div className="text-[10px] text-zinc-500">C {c.strike} (delta {c.delta.toFixed(2)})</div>
                <div className="num text-sm text-down font-bold">−${Math.abs(c.thetaDay).toFixed(0)}/วัน</div>
                <div className="text-[9px] text-zinc-600 num">premium ${c.mid.toFixed(2)} → สูญ ~{(Math.abs(c.thetaDay / (c.mid * 100)) * 100).toFixed(1)}%/วัน</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
