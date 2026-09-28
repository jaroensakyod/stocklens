"use client";

import { useEffect, useState } from "react";
import LockGate from "@/components/LockGate";
import { useCan } from "@/lib/authContext";
import type { FullTechnical, TaSignal } from "@/lib/taFull";

const LEVEL: Record<string, { text: string; cls: string }> = {
  strong_buy: { text: "ซื้อมาก", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" },
  buy: { text: "เอียงไปทางซื้อ", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  neutral: { text: "เป็นกลาง", cls: "bg-zinc-500/15 text-zinc-400 border-zinc-600" },
  sell: { text: "เอียงไปทางขาย", cls: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
  strong_sell: { text: "ขายมาก", cls: "bg-rose-500/20 text-rose-300 border-rose-500/50" },
};

const sigCls = (s: TaSignal) => (s === "buy" ? "text-up" : s === "sell" ? "text-down" : "text-zinc-400");
const sigText = (s: TaSignal) => (s === "buy" ? "ซื้อ" : s === "sell" ? "ขาย" : "เป็นกลาง");

function VoteBar({ buy, sell, neutral }: { buy: number; sell: number; neutral: number }) {
  const total = Math.max(1, buy + sell + neutral);
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-base-800 mb-2" title={`ซื้อ ${buy} · เป็นกลาง ${neutral} · ขาย ${sell}`}>
      <div className="bg-up" style={{ width: `${(buy / total) * 100}%` }} />
      <div className="bg-zinc-600" style={{ width: `${(neutral / total) * 100}%` }} />
      <div className="bg-down" style={{ width: `${(sell / total) * 100}%` }} />
    </div>
  );
}

export default function TechnicalPanel({ ticker, price }: { ticker: string; price: number }) {
  const can = useCan();
  const [t, setT] = useState<FullTechnical | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setT(null);
    setErr("");
    fetch(`/api/technical?s=${encodeURIComponent(ticker)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "โหลดไม่สำเร็จ");
        setT(j);
      })
      .catch((e) => setErr(e.message));
  }, [ticker]);

  const lvl = t ? LEVEL[t.summary] : null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h3 className="text-sm font-bold text-zinc-100">📐 วิเคราะห์ทางเทคนิค (รายวัน)</h3>
        {lvl && (
          <span className={`chip border font-bold ${lvl.cls}`}>
            สรุป: {lvl.text}
          </span>
        )}
      </div>

      {!t && !err && <p className="text-xs text-zinc-500 py-6 text-center animate-pulse">กำลังคำนวณสัญญาณ…</p>}
      {err && <p className="text-xs text-zinc-500 py-4 text-center">{err}</p>}

      {t && (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            {/* ออสซิลเลเตอร์ */}
            <div className="rounded-xl border border-base-700 bg-base-850 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-zinc-200">ตัวชี้วัดแกว่ง (Oscillators)</span>
                <span className={`text-[11px] font-bold ${sigCls(t.oscillators.buy >= t.oscillators.sell ? "buy" : "sell")}`}>
                  {t.oscillators.buy > t.oscillators.sell ? "ซื้อ" : t.oscillators.buy < t.oscillators.sell ? "ขาย" : "เท่ากัน"} {t.oscillators.buy}/{t.oscillators.sell}
                </span>
              </div>
              <VoteBar buy={t.oscillators.buy} sell={t.oscillators.sell} neutral={t.oscillators.neutral} />
              <table className="w-full text-[11px]">
                <tbody className="divide-y divide-base-700/50">
                  {t.oscillators.rows.map((r) => (
                    <tr key={r.name}>
                      <td className="py-1.5 text-zinc-400">{r.name}</td>
                      <td className="py-1.5 text-right num text-zinc-200">{r.value}</td>
                      <td className={`py-1.5 pl-2 text-right font-semibold w-14 ${sigCls(r.signal)}`}>{sigText(r.signal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ค่าเฉลี่ยเคลื่อนที่ */}
            <div className="rounded-xl border border-base-700 bg-base-850 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-zinc-200">ค่าเฉลี่ยเคลื่อนที่ (MA/EMA)</span>
                <span className={`text-[11px] font-bold ${sigCls(t.movingAverages.buy >= t.movingAverages.sell ? "buy" : "sell")}`}>
                  {t.movingAverages.buy > t.movingAverages.sell ? "ซื้อ" : "ขาย"} {t.movingAverages.buy}/{t.movingAverages.sell}
                </span>
              </div>
              <VoteBar buy={t.movingAverages.buy} sell={t.movingAverages.sell} neutral={t.movingAverages.neutral} />
              <table className="w-full text-[11px]">
                <tbody className="divide-y divide-base-700/50">
                  {t.movingAverages.rows.map((r) => (
                    <tr key={r.name}>
                      <td className="py-1.5 text-zinc-400">{r.name}</td>
                      <td className="py-1.5 text-right num text-zinc-200">{r.value.toFixed(2)}</td>
                      <td className={`py-1.5 pl-2 text-right font-semibold w-14 ${sigCls(r.signal)}`}>{sigText(r.signal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* จุดหมุน (Pivot) */}
            <div className="rounded-xl border border-base-700 bg-base-850 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-zinc-200">จุดหมุนวันนี้ (Pivot)</span>
                {t.pivots && (
                  <span className={`text-[11px] font-bold ${sigCls(t.pivots.signal)}`}>
                    ราคา{t.pivots.signal === "buy" ? "เหนือ" : "ต่ำกว่า"} PP
                  </span>
                )}
              </div>
              {t.pivots ? (
                (() => {
                  const piv = t.pivots!;
                  return (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-zinc-500">
                      <th className="text-left font-normal pb-1">ระดับ</th>
                      <th className="text-right font-normal pb-1">Classic</th>
                      <th className="text-right font-normal pb-1">Fibonacci</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-700/50">
                    {(["R3", "R2", "R1", "PP", "S1", "S2", "S3"] as const).map((label) => {
                      const key = label.toLowerCase() as "pp" | "s1" | "s2" | "s3" | "r1" | "r2" | "r3";
                      const cls = label === "PP" ? "text-zinc-200" : label.startsWith("R") ? "text-down" : "text-up";
                      return (
                      <tr key={label}>
                        <td className={`py-1.5 font-semibold ${cls === "text-zinc-200" ? "text-zinc-300" : cls}`}>{label}</td>
                        <td className={`py-1.5 text-right num ${cls} ${t.price > piv.classic[key] ? "font-bold" : "opacity-80"}`}>{piv.classic[key].toFixed(2)}</td>
                        <td className={`py-1.5 text-right num ${cls} ${t.price > piv.fib[key] ? "font-bold" : "opacity-80"}`}>{piv.fib[key].toFixed(2)}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                  );
                })()
              ) : (
                <p className="text-[11px] text-zinc-500 py-3 text-center">—</p>
              )}
              <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">
                คำนวณจาก High/Low/Close ของเมื่อวาน · ราคาปัจจุบัน <span className="num text-zinc-400">{price.toFixed(2)}</span> — เหนือ PP = แนวโน้มในวันเอียงบวก
              </p>
            </div>
          </div>

          {/* 🧩 เทคนิคขั้นสูง: Fibonacci · Elliott Wave · Divergence · ATR */}
          {(() => {
            const c = t.classic;
            if (!c.fib && !c.elliott && !c.divergence && !c.atrStop) return null;
            if (!can.pro) return (
              <LockGate need="pro" title="เทคนิคขั้นสูง: Fibonacci · Elliott Wave · Divergence · ATR" desc="ระดับราคา Fib / นับเวฟ / สัญญาณกลับตัว / จุดตัดขาดทุน — สิทธิ์สมาชิก🥇 Pro" />
            );
            return (
              <div className="border border-base-700 rounded-xl p-3.5 bg-base-850 mt-4 space-y-3">
                <h4 className="text-xs font-bold text-accent-soft">🧩 เทคนิคขั้นสูง</h4>
                {c.fib && (
                  <div>
                    <p className="text-[11px] text-zinc-300 font-semibold">
                      📐 Fibonacci — ขา{c.fib.direction === "up" ? "ขึ้น" : "ลง"} {c.fib.from.toFixed(1)} → {c.fib.to.toFixed(1)} ({c.fib.legPct.toFixed(0)}%)
                      {c.fib.retracedPct !== null && <> · ตอนนี้{c.fib.retracedPct < 0 ? `ทะลุปลายขาไปแล้ว ${Math.abs(c.fib.retracedPct).toFixed(0)}%` : c.fib.retracedPct > 100 ? `ย่อเกินต้นขา ${c.fib.retracedPct.toFixed(0)}%` : `ย่อ ${c.fib.retracedPct.toFixed(0)}% ของขา`}</>}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.fib.levels.map((l) => (
                        <span key={l.ratio} className="chip text-[10px] bg-base-800 text-zinc-400 border border-base-700 num">
                          {(l.ratio * 100).toFixed(1)}% → {l.price.toFixed(1)}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {c.fib.nearestSupport && <>แนวรับย่อถัดไป: <span className="text-up num">{c.fib.nearestSupport.price.toFixed(1)}</span> ({(c.fib.nearestSupport.ratio * 100).toFixed(1)}%) · </>}
                      {c.fib.nearestResistance && <>แนวต้าน: <span className="text-down num">{c.fib.nearestResistance.price.toFixed(1)}</span> · </>}
                      เป้าส่วนขยาย: {c.fib.extensions.map((e) => `${(e.ratio * 100).toFixed(1)}%→${e.price.toFixed(1)}`).join(" / ")}
                    </p>
                  </div>
                )}
                {c.elliott && (
                  <div>
                    <p className="text-[11px] text-zinc-300 font-semibold">
                      🌊 Elliott Wave — {c.elliott.structure} · ความเชื่อมั่น {c.elliott.confidence}%
                    </p>
                    <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">{c.elliott.waveLabel}</p>
                    <p className="text-[10px] text-zinc-500 leading-snug">{c.elliott.expectation}</p>
                    {c.elliott.invalidation !== null && (
                      <p className="text-[10px] text-amber-500/90 mt-0.5 num">จุดยกเลิกนับเวฟ: ทะลุ {c.elliott.invalidation.toFixed(2)}</p>
                    )}
                  </div>
                )}
                {c.divergence && (
                  <p className={`text-[11px] font-semibold ${c.divergence.type === "bullish" ? "text-up" : "text-down"}`}>
                    {c.divergence.type === "bullish" ? "🔀 Divergence บวก" : "🔀 Divergence ลบ"} — <span className="text-zinc-400 font-normal">{c.divergence.detail}</span>
                  </p>
                )}
                {c.atr14 !== undefined && c.atrStop && (
                  <p className="text-[10px] text-zinc-500 num">
                    📏 ATR14 {c.atr14.toFixed(2)} ({((c.atr14 / t.price) * 100).toFixed(1)}% ของราคา) — จุดตัดขาดทุนอ้างอิง 2×ATR: กลับตัวลง {c.atrStop.long.toFixed(2)} / เบรกชั่วคราว {c.atrStop.short.toFixed(2)}
                  </p>
                )}
              </div>
            );
          })()}

          {/* อ่านสรุปเป็นภาษาคน */}
          <ul className="space-y-1.5 mt-4">
            {t.classic.reasons.map((r, i) => (
              <li key={i} className="text-xs text-zinc-400 flex gap-1.5"><span className="text-zinc-600">•</span>{r}</li>
            ))}
          </ul>

          <p className="text-[10px] text-zinc-600 mt-3 leading-relaxed">
            * คำนวณจากแท่งเทียนรายวันย้อนหลัง 1 ปี (Yahoo Finance) · สัญญาณเทคนิคเป็นการอ่านข้อมูลราคา ไม่ใช่คำแนะนำซื้อขาย
          </p>
        </>
      )}
    </div>
  );
}
