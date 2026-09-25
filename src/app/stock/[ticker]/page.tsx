"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import PriceChart from "@/components/PriceChart";
import FactorRadar from "@/components/FactorRadar";
import AIAnalysis from "@/components/AIAnalysis";
import BrokerBadge from "@/components/BrokerBadge";
import BudgetCalc from "@/components/BudgetCalc";
import StarButton from "@/components/StarButton";
import QuickAlert from "@/components/QuickAlert";
import LockGate from "@/components/LockGate";
import { useCan } from "@/lib/authContext";
import TrustPanel from "@/components/TrustPanel";
import ThesisLogger from "@/components/ThesisLogger";
import ScenarioPanel from "@/components/ScenarioPanel";
import type { Scenarios } from "@/lib/scenarios";
import { formatBig } from "@/lib/factors";
import type { StockAnalysis } from "@/lib/types";

export default function StockPage() {
  const routeParams = useParams<{ ticker: string }>();
  const ticker = Array.isArray(routeParams.ticker) ? routeParams.ticker[0] : routeParams.ticker;
  const can = useCan();
  const [a, setA] = useState<(StockAnalysis & { usdThb?: number; confidence?: { score: number; coveredCount: number; totalCount: number; missing: string[]; hasTechnicals: boolean; hasNews: boolean; priceSource: string; fundamentalsSource: string }; scenarios?: Scenarios }) | null>(null);
  const [err, setErr] = useState("");
  const [sectorInfo, setSectorInfo] = useState<{ sector: string | null; industry?: string | null } | null>(null);

  useEffect(() => {
    setA(null);
    setErr("");
    fetch(`/api/sector?s=${encodeURIComponent(ticker)}`).then((r) => r.json()).then(setSectorInfo).catch(() => {});
    fetch(`/api/analysis?s=${encodeURIComponent(ticker)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!j.quote || !isFinite(j.quote.price)) throw new Error("ไม่พบสัญลักษณ์นี้");
        setA(j);
      })
      .catch((e) => setErr(e.message));
  }, [ticker]);

  if (err) {
    return (
      <div className="card p-10 text-center">
        <p className="text-2xl mb-2">🤔</p>
        <p className="text-zinc-300">ไม่พบข้อมูลสำหรับ <span className="font-bold text-zinc-100">{ticker}</span></p>
        <p className="text-xs text-zinc-500 mt-2">ตรวจสอบสัญลักษณ์ เช่น AAPL (สหรัฐฯ), PTT.BK (ไทย), 0700.HK (ฮ่องกง)</p>
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
        <div className="lg:col-span-2 space-y-6">
          <PriceChart symbol={q.symbol} />

          {/* ปัจจัย 5 มิติ */}
          {f && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-zinc-50">คะแนนปัจจัย 5 มิติ</h2>
                <span className="chip bg-accent/15 text-accent-soft border border-accent/30 num">รวม {f.overall}/100</span>
              </div>
              <div className="grid md:grid-cols-2 gap-4 items-center">
                <FactorRadar factors={f} />
                <div className="space-y-2">
                  {[
                    { k: "valuation", label: "Valuation (ความคุ้มค่า)" },
                    { k: "growth", label: "Growth (การเติบโต)" },
                    { k: "profitability", label: "Profitability (ความมีกำไร)" },
                    { k: "momentum", label: "Momentum (โมเมนตัม)" },
                    { k: "health", label: "Financial Health (ความแข็งแรง)" },
                  ].map((d) => {
                    const v = f[d.k as keyof typeof f] as number;
                    return (
                      <div key={d.k}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-zinc-400">{d.label}</span>
                          <span className="num text-zinc-200 font-semibold">{v}</span>
                        </div>
                        <div className="h-1.5 bg-base-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${v >= 66 ? "bg-up" : v >= 40 ? "bg-accent" : "bg-down"}`} style={{ width: `${v}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {f.gaps.length > 0 && (
                    <p className="text-[11px] text-zinc-600 pt-1">⚠️ ข้อมูลขาด: {f.gaps.join(", ")} — ตลาดนี้ Yahoo ให้ข้อมูลจำกัด คะแนนคำนวณจากเฉพาะข้อมูลที่มี</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* เทคนิค */}
          {t && (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-zinc-100 mb-3">📐 สัญญาณเทคนิค</h3>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                {t.rsi14 !== undefined && <Stat k="RSI (14)" v={t.rsi14.toFixed(1)} />}
                {t.sma20 !== undefined && <Stat k="SMA 20" v={t.sma20.toFixed(1)} />}
                {t.sma50 !== undefined && <Stat k="SMA 50" v={t.sma50.toFixed(1)} />}
                {t.sma200 !== undefined && <Stat k="SMA 200" v={t.sma200.toFixed(1)} />}
                {t.macd && <Stat k="MACD hist" v={t.macd.hist.toFixed(2)} />}
                {t.bollinger && <Stat k="%B (Bollinger)" v={(t.bollinger.pctB * 100).toFixed(0) + "%"} />}
              </div>

              {/* 🧩 เทคนิคขั้นสูง: Fibonacci · Elliott Wave · Divergence · ATR */}
              {(t.fib || t.elliott || t.divergence || t.atrStop) && (can.pro ? (
                <div className="border border-base-700 rounded-xl p-3.5 bg-base-850 mb-3 space-y-3">
                  <h4 className="text-xs font-bold text-accent-soft">🧩 เทคนิคขั้นสูง</h4>

                  {t.fib && (
                    <div>
                      <p className="text-[11px] text-zinc-300 font-semibold">
                        📐 Fibonacci — ขา{t.fib.direction === "up" ? "ขึ้น" : "ลง"} {t.fib.from.toFixed(1)} → {t.fib.to.toFixed(1)} ({t.fib.legPct.toFixed(0)}%)
                        {t.fib.retracedPct !== null && <> · ตอนนี้{t.fib.retracedPct < 0 ? `ทะลุปลายขาไปแล้ว ${Math.abs(t.fib.retracedPct).toFixed(0)}%` : t.fib.retracedPct > 100 ? `ย่อเกินต้นขา ${t.fib.retracedPct.toFixed(0)}%` : `ย่อ ${t.fib.retracedPct.toFixed(0)}% ของขา`}</>}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {t.fib.levels.map((l) => (
                          <span key={l.ratio} className="chip text-[10px] bg-base-800 text-zinc-400 border border-base-700 num">
                            {(l.ratio * 100).toFixed(1)}% → {l.price.toFixed(1)}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {t.fib.nearestSupport && <>แนวรับย่อถัดไป: <span className="text-up num">{t.fib.nearestSupport.price.toFixed(1)}</span> ({(t.fib.nearestSupport.ratio * 100).toFixed(1)}%) · </>}
                        {t.fib.nearestResistance && <>แนวต้าน: <span className="text-down num">{t.fib.nearestResistance.price.toFixed(1)}</span> · </>}
                        เป้าส่วนขยาย: {t.fib.extensions.map((e) => `${(e.ratio * 100).toFixed(1)}%→${e.price.toFixed(1)}`).join(" / ")}
                      </p>
                    </div>
                  )}

                  {t.elliott && (
                    <div>
                      <p className="text-[11px] text-zinc-300 font-semibold">
                        🌊 Elliott Wave — {t.elliott.structure} · ความเชื่อมั่น {t.elliott.confidence}%
                      </p>
                      <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">{t.elliott.waveLabel}</p>
                      <p className="text-[10px] text-zinc-500 leading-snug">{t.elliott.expectation}</p>
                      {t.elliott.invalidation !== null && (
                        <p className="text-[10px] text-amber-500/90 mt-0.5 num">จุดยกเลิกนับเวฟ: ทะลุ {t.elliott.invalidation.toFixed(2)}</p>
                      )}
                    </div>
                  )}

                  {t.divergence && (
                    <p className={`text-[11px] font-semibold ${t.divergence.type === "bullish" ? "text-up" : "text-down"}`}>
                      {t.divergence.type === "bullish" ? "🔀 Divergence บวก" : "🔀 Divergence ลบ"} — <span className="text-zinc-400 font-normal">{t.divergence.detail}</span>
                    </p>
                  )}

                  {t.atr14 !== undefined && t.atrStop && (
                    <p className="text-[10px] text-zinc-500 num">
                      📏 ATR14 {t.atr14.toFixed(2)} ({((t.atr14 / q.price) * 100).toFixed(1)}% ของราคา) — จุดตัดขาดทุนอ้างอิง 2×ATR: กลับตัวลง {t.atrStop.long.toFixed(2)} / เบรกชั่วคราว {t.atrStop.short.toFixed(2)}
                    </p>
                  )}
                </div>
              ) : (
                <LockGate need="pro" title="เทคนิคขั้นสูง: Fibonacci · Elliott Wave · Divergence · ATR" desc="ระดับราคา Fib / นับเวฟ / สัญญาณกลับตัว / จุดตัดขาดทุน — สิทธิ์สมาชิก🥇 Pro" />
              ))}

              <ul className="space-y-1.5">
                {t.reasons.map((r, i) => (
                  <li key={i} className="text-xs text-zinc-400 flex gap-1.5"><span className="text-zinc-600">•</span>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* AI */}
          <AIAnalysis ticker={q.symbol} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
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

          {/* งบการเงิน */}
          {a.financials && Object.values(a.financials).some((v) => v !== undefined) && (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-zinc-100 mb-3">💼 งบการเงิน (ล่าสุด)</h3>
              <dl className="text-sm divide-y divide-base-700/50">
                {[
                  ["รายได้โต YoY", a.financials.revenueGrowth !== undefined ? (a.financials.revenueGrowth * 100).toFixed(1) + "%" : "—"],
                  ["กำไรโต YoY", a.financials.earningsGrowth !== undefined ? (a.financials.earningsGrowth * 100).toFixed(1) + "%" : "—"],
                  ["มาร์จิ้นสุทธิ", a.financials.profitMargins !== undefined ? (a.financials.profitMargins * 100).toFixed(1) + "%" : "—"],
                  ["ROE", a.financials.returnOnEquity !== undefined ? (a.financials.returnOnEquity * 100).toFixed(1) + "%" : "—"],
                  ["หนี้/ทุน", a.financials.debtToEquity !== undefined ? a.financials.debtToEquity.toFixed(0) + "%" : "—"],
                  ["Current Ratio", a.financials.currentRatio !== undefined ? a.financials.currentRatio.toFixed(2) : "—"],
                  ["FCF", a.financials.freeCashflow !== undefined ? formatBig(a.financials.freeCashflow) : "—"],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between py-1.5">
                    <dt className="text-zinc-500">{k}</dt>
                    <dd className="num text-zinc-200">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {isUsd && a.usdThb && <BudgetCalc priceUsd={q.price} usdThb={a.usdThb} currency={q.currency} />}

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
            {a.news.slice(0, 6).map((n, i) => (
              <li key={i} className="border-l-2 border-base-700 pl-3">
                <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-300 hover:text-accent-soft leading-snug">
                  {n.title}
                </a>
                <span className="text-[10px] text-zinc-600 block">{n.publisher}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-base-850 rounded-lg px-2.5 py-1.5">
      <div className="text-zinc-500 text-[10px]">{k}</div>
      <div className="num text-zinc-200 font-semibold">{v}</div>
    </div>
  );
}
