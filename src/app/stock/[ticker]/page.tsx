"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import PriceChart from "@/components/PriceChart";
import ScorePanel from "@/components/ScorePanel";
import FinancialsPanel from "@/components/FinancialsPanel";
import AIAnalysis from "@/components/AIAnalysis";
import BrokerBadge from "@/components/BrokerBadge";
import BudgetCalc from "@/components/BudgetCalc";
import StarButton from "@/components/StarButton";
import FavButton from "@/components/FavButton";
import QuickAlert from "@/components/QuickAlert";
import TrustPanel from "@/components/TrustPanel";
import ThesisLogger from "@/components/ThesisLogger";
import SeasonalityPanel from "@/components/SeasonalityPanel";
import HoldersPanel from "@/components/HoldersPanel";
import RevenueStructurePanel from "@/components/RevenueStructurePanel";
import AnalystPanel from "@/components/AnalystPanel";
import TechnicalPanel from "@/components/TechnicalPanel";
import ScenarioPanel from "@/components/ScenarioPanel";
import PeerPanel from "@/components/PeerPanel";
import GuruHoldersPanel from "@/components/GuruHoldersPanel";
import PerfStrip from "@/components/PerfStrip";
import type { Scenarios } from "@/lib/scenarios";
import { formatBig } from "@/lib/factors";
import type { StockAnalysis } from "@/lib/types";

const fmtAgo = (t: number) => {
  const h = Math.floor((Date.now() - t) / 3600e3);
  if (h < 1) return "เมื่อสักครู่";
  if (h < 24) return h + " ชม.ก่อน";
  const d = Math.floor(h / 24);
  return d === 1 ? "เมื่อวาน" : d + " วันก่อน";
};
const isOld = (t: number) => Date.now() - t > 3 * 86400e3;

export default function StockPage() {
  const routeParams = useParams<{ ticker: string }>();
  // useParams คืนค่ายัง encode (BML%2FPL) — decode ให้ก่อนใช้ทั้งแสดงผลและค้นหา
  const ticker = decodeURIComponent(Array.isArray(routeParams.ticker) ? routeParams.ticker[0] : routeParams.ticker ?? "");
  const [a, setA] = useState<(StockAnalysis & { usdThb?: number; confidence?: { score: number; coveredCount: number; totalCount: number; missing: string[]; hasTechnicals: boolean; hasNews: boolean; priceSource: string; fundamentalsSource: string }; scenarios?: Scenarios }) | null>(null);
  const [err, setErr] = useState("");
  const [suggestions, setSuggestions] = useState<{ symbol: string; name: string; exchange: string }[]>([]);
  const [sectorInfo, setSectorInfo] = useState<{ sector: string | null; industry?: string | null } | null>(null);

  useEffect(() => {
    setA(null);
    setErr("");
    setSuggestions([]);
    fetch(`/api/sector?s=${encodeURIComponent(ticker)}`).then((r) => r.json()).then(setSectorInfo).catch(() => {});
    fetch(`/api/analysis?s=${encodeURIComponent(ticker)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!j.quote || typeof j.quote.price !== "number" || !isFinite(j.quote.price)) throw new Error(j.error || "ไม่พบสัญลักษณ์นี้");
        setA(j);
      })
      .catch((e) => {
        setErr(e.message);
        // ไม่พบ → เสนอตัวใกล้เคียง: ลอง 2 แบบ — สลับ / เป็น - (Yahoo ใช้ขีด เช่น BML-PL หุ้น preference) + แบบที่พิมพ์
        const queries = [...new Set([ticker.replace(/\//g, "-"), ticker.replace(/[\/=]/g, " ").trim()].filter((q) => q.length >= 2))];
        Promise.all(queries.map((q) => fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) => r.json()).catch(() => ({ results: [] }))))
          .then((all) => {
            const seen = new Set<string>();
            const merged = all.flatMap((j: { results?: { symbol: string; name: string; exchange: string; type?: string }[] }) => j.results ?? []).filter((x) => {
              if (!/equity|stock/i.test(x.type ?? "") || seen.has(x.symbol)) return false;
              seen.add(x.symbol);
              return true;
            });
            setSuggestions(merged.slice(0, 6));
          })
          .catch(() => {});
      });
  }, [ticker]);

  if (err) {
    return (
      <div className="card p-10 text-center">
        <p className="text-2xl mb-2">🤔</p>
        <p className="text-zinc-300">ไม่พบข้อมูลสำหรับ <span className="font-bold text-zinc-100">{ticker}</span></p>
        <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{err}</p>
        {suggestions.length > 0 ? (
          <div className="mt-5">
            <p className="text-xs text-zinc-500 mb-2">🔍 ตัวที่ใกล้เคียงกับที่พิมพ์มา — กดเข้าไปดูได้เลย:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((sg) => (
                <a key={sg.symbol} href={`/stock/${encodeURIComponent(sg.symbol)}`} className="chip bg-base-800 text-zinc-300 border border-base-700 hover:text-zinc-50 hover:border-accent/40">
                  <b>{sg.symbol}</b> <span className="text-zinc-500">{sg.name.slice(0, 22)}</span>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-600 mt-4">ตรวจสอบสัญลักษณ์ เช่น AAPL (สหรัฐฯ), PTT.BK (ไทย), 0700.HK (ฮ่องกง) — หรือค้นหาจากชื่อบริษัทที่ช่องค้นหาด้านบน</p>
        )}
      </div>
    );
  }
  if (!a) return <div className="py-32 text-center text-zinc-500 text-sm">กำลังโหลดข้อมูล {ticker}…</div>;

  const q = a.quote;
  const p = a.profile;
  const f = a.factors;
  const t = a.technicals;
  const up = q.changePct >= 0;
  const isUsd = q.currency === "USD";
  const thb = isUsd && a.usdThb ? a.usdThb : null;

  const signalLabel = t?.signal === "bullish" ? { text: "เอียงบวก", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" }
    : t?.signal === "bearish" ? { text: "เอียงลบ", cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" }
    : { text: "เป็นกลาง", cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-zinc-50">{q.symbol}</h1>
            <StarButton ticker={q.symbol} className="text-2xl leading-none" />
            <FavButton ticker={q.symbol} className="text-2xl leading-none" />
            <BrokerBadge ticker={q.symbol} />
            {t && <span className={`chip border ${signalLabel.cls}`}>สัญญาณเทคนิค: {signalLabel.text}</span>}
            <a
              href={`/report/print?type=deepdive&t=${q.symbol}&tier=pro`}
              target="_blank"
              rel="noopener noreferrer"
              className="chip border border-base-600 bg-base-800 text-zinc-300 hover:text-zinc-50"
              title="เปิดรายงานฉบับเต็มพร้อมพิมพ์เป็น PDF (สำหรับสมาชิก VIP)"
            >
              📄 รายงาน PDF
            </a>
          </div>
          <p className="text-sm text-zinc-400 mt-0.5">{q.name}{q.exchange ? ` · ${q.exchange}` : ""}</p>
          {sectorInfo?.sector && (
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              <span className="chip bg-base-800 text-zinc-300 border border-base-700">{sectorInfo.sector}</span>
              {sectorInfo.industry && <span className="chip bg-base-800 text-zinc-500 border border-base-700">{sectorInfo.industry}</span>}
            </div>
          )}
          {/* ลิงก์ข้อมูลเชิงลึกจากต้นทาง — เราเป็นชั้นวิเคราะห์ อยากลึกกว่านี้ให้ไปต่อที่ต้นฉบับ */}
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {q.symbol.endsWith(".BK") ? (
              <>
                <a className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-accent-soft" href={`https://www.set.or.th/th/market/product/stock/quotes/${q.symbol.replace(".BK", "")}/financial-analysis`} target="_blank" rel="noopener noreferrer">📊 งบการเงิน (SET)</a>
                <a className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-accent-soft" href={`https://www.set.or.th/th/market/product/stock/quotes/${q.symbol.replace(".BK", "")}/company-highlight`} target="_blank" rel="noopener noreferrer">📄 ข้อมูลบริษัท / 56-1 (SET)</a>
              </>
            ) : (
              <>
                <a className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-accent-soft" href={`https://finance.yahoo.com/quote/${encodeURIComponent(q.symbol)}/financials/`} target="_blank" rel="noopener noreferrer">📊 งบการเงิน (Yahoo)</a>
                <a className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-accent-soft" href={`https://finance.yahoo.com/quote/${encodeURIComponent(q.symbol)}/analysis/`} target="_blank" rel="noopener noreferrer">🎯 คอนเซนเซินัสวิเคราะห์ (Yahoo)</a>
              </>
            )}
            <a className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-accent-soft" href={`https://finance.yahoo.com/quote/${encodeURIComponent(q.symbol)}/news/`} target="_blank" rel="noopener noreferrer">📰 ข่าวล่าสุด</a>
            <a className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-accent-soft" href={`/compare?t=${encodeURIComponent(q.symbol)}`}>⚖️ เทียบหุ้น</a>
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="num text-3xl font-bold text-zinc-50">{q.price.toFixed(2)} <span className="text-sm text-zinc-500">{q.currency}</span></div>
          <div className={`num text-sm font-semibold ${up ? "text-up" : "text-down"}`}>
            {up ? "▲" : "▼"} {Math.abs(q.change).toFixed(2)} ({Math.abs(q.changePct).toFixed(2)}%)
          </div>
          {thb && <div className="num text-xs text-zinc-500">≈ {(q.price * thb).toLocaleString("th-TH", { maximumFractionDigits: 0 })} ฿</div>}
        </div>
      </div>

      {/* Grid หลัก */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <PriceChart symbol={q.symbol} />

          {/* วิเคราะห์ทางเทคนิคเต็มรูปแบบ — ตารางสัญญาณ + MA + Pivot + สรุป 5 ระดับ (สไตล์ investing.com) */}
          <TechnicalPanel ticker={q.symbol} price={q.price} />

          {/* เทียบกับอุตสาหกรรมเดียวกัน (median/percentile + เกรด) — ในตลาดนี้/ทั่วโลก */}
          <PeerPanel ticker={q.symbol} />

          {/* StockLens Score — แทนการ์ดปัจจัย 5 มิติเดิม (5 มิติรวมอยู่ในเสา Quality/Valuation/Momentum) */}
          <ScorePanel ticker={q.symbol} />

          {/* งบการเงิน 4 ปี (คลัง kb — TTM ละเอียด + ประวัติรายปี + EDGAR) */}
          <FinancialsPanel ticker={q.symbol} />

          {/* AI */}
          <AIAnalysis ticker={q.symbol} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6 min-w-0">
          <div className="card p-5">
            <h3 className="text-sm font-bold text-zinc-100 mb-3">📋 ข้อมูลหลัก</h3>
            <dl className="text-sm divide-y divide-base-700/50">
              {[
                ["มูลค่าตลาด", p?.marketCap ? formatBig(p.marketCap) + " USD" : "—"],
                ["P/E (trailing)", p?.trailingPE?.toFixed(1) ?? "—"],
                ["P/E (forward)", p?.forwardPE?.toFixed(1) ?? "—"],
                ["P/B", p?.priceToBook?.toFixed(1) ?? "—"],
                ["EV/EBITDA", p?.evToEbitda?.toFixed(1) ?? "—"],
                ["EPS", p?.eps?.toFixed(2) ?? "—"],
                ["เงินปันผล", p?.dividendYield ? (p.dividendYield * 100).toFixed(2) + "%" : "—"],
                ["ช่วง 52 สัปดาห์", p?.fiftyTwoLow && p?.fiftyTwoHigh ? `${p.fiftyTwoLow.toFixed(1)} – ${p.fiftyTwoHigh.toFixed(1)}` : "—"],
                ["Beta", p?.beta?.toFixed(2) ?? "—"],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between py-1.5">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="num text-zinc-200">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {isUsd && a.usdThb && <BudgetCalc priceUsd={q.price} usdThb={a.usdThb} currency={q.currency} />}

          <PerfStrip ticker={q.symbol} />

          {/* Trust: ขอบเขตของข้อมูล */}
          {a.confidence && <TrustPanel confidence={a.confidence} />}

          <QuickAlert ticker={q.symbol} price={q.price} />

          {a.scenarios && <ScenarioPanel scenarios={a.scenarios} price={q.price} currency={q.currency} />}

          <ThesisLogger ticker={q.symbol} prefilled={`${q.symbol} — ${t ? (t.signal === "bullish" ? "สัญญาณเทคนิคเอียงบวก" : t.signal === "bearish" ? "สัญญาณเทคนิคเอียงลบ" : "สัญญาณเป็นกลาง") : "ยังไม่มีสัญญาณ"}${f ? ` · คะแนนรวม ${f.overall}/100` : ""} — `} />
        </div>
      </div>

      {/* ข่าวของหุ้น — เต็มกว้างใต้ grid */}
      {a.news.length > 0 && (
        <div className="card p-5 mt-6">
          <h3 className="text-sm font-bold text-zinc-100 mb-3">📰 ข่าวล่าสุดของ {q.symbol}</h3>
          <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {a.news.slice(0, 10).map((n, i) => (
              <li key={i} className={`border-l-2 pl-3 ${n.score?.sentiment === "bullish" ? "border-up/60" : n.score?.sentiment === "bearish" ? "border-down/60" : "border-base-700"}`}>
                <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-300 hover:text-accent-soft leading-snug">
                  {n.score ? (n.score.sentiment === "bullish" ? "🟢" : n.score.sentiment === "bearish" ? "🔴" : "⚪") : "📰"} {n.title}
                </a>
                <span className="text-[10px] text-zinc-600 block flex flex-wrap gap-x-2">
                  {n.time && <span className={isOld(n.time) ? "text-zinc-500" : "text-accent-soft font-semibold"}>🕐 {fmtAgo(n.time)}</span>}
                  <span>{n.publisher}</span>
                  {n.score && n.score.impact >= 1.2 ? " · ⚡ ข่าวตัวจักร" : ""}
                  {n.cred?.label === "danger" && <span className="text-down"> · 🚫 {n.cred.text}</span>}
                  {n.cred?.label === "warn" && <span className="text-yellow-500"> · ⚠️ {n.cred.text}</span>}
                  {n.cred?.label === "ok" && <span className="text-up"> · ✅ {n.cred.text}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ฤดูกาลรายเดือน (Seasonality) */}
      <SeasonalityPanel ticker={q.symbol} />

      {/* ใครถือหุ้นนี้ (Top Shareholders) */}
      <HoldersPanel ticker={q.symbol} market={q.exchange} />

      {/* เซียน/กูรูที่ถือหุ้นนี้ (reverse 13F LIVE จาก SEC) */}
      <GuruHoldersPanel ticker={q.symbol} />

      {/* โครงสร้างรายได้ (Revenue Structure — US auto จาก EDGAR) */}
      <RevenueStructurePanel ticker={q.symbol} />

      {/* คอนเซนซัสนักวิเคราะห์ + วันออกงบ */}
      <AnalystPanel ticker={q.symbol} price={q.price} />
    </div>
  );
}
