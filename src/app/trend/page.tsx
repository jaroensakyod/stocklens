"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TrendResult } from "@/lib/trend";

// 📈 แนวโน้มวันนี้ — หน้าเดียวเห็นครบ: ภาพใหญ่มหภาค → ธีมข่าวร้อน → หุ้นใต้น้ำ/แพงเกินตัว → คะแนนเด่น
// ทุกก้อนลิงก์ไปหน้าเต็มของเครื่องยนต์นั้นๆ (สำหรับคนที่เข้ามา "ดูวิเคราะห์แนวโน้ม" แล้วไปต่อได้ทันที)

const pct = (v: number | null | undefined) =>
  v === null || v === undefined || !isFinite(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

export default function TrendPage() {
  const [data, setData] = useState<TrendResult | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/trend")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErr("กำลังประกอบสัญญาณจากเครื่องยนต์ทั้งเว็บ… ลองรีเฟรชอีกครั้งถ้านานเกินไป"));
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-50">
          📈 แนวโน้มวันนี้ <span className="text-accent">เห็นครบในหน้าเดียว</span>
        </h1>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-3xl">
          ภาพใหญ่มหภาค + ธีมข่าวที่ตลาดพูดถึง + หุ้นที่สัญญาณกำลังกลับตัว + คะแนนเด่นของวัน —
          ประกอบจากเครื่องยนต์จริงทุกตัวของ StockLens กดดูเต็มได้ทุกก้อน
          {data && <span className="text-zinc-600"> · {data.dateTh} · คำนวณล่าสุด {data.asOf}</span>}
        </p>
      </div>

      {err && <div className="card p-6 text-sm text-zinc-400 animate-pulse">{err}</div>}

      {data && (
        <>
          {/* ภาพใหญ่ — regime มหภาค */}
          <section className="card p-5 border-accent/30">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-[240px]">
                <div className="text-[11px] text-zinc-500 mb-1">ภาพใหญ่วันนี้ (อ่านจากตลาดพันธบัตร ทอง น้ำมัน VIX ดอลลาร์)</div>
                <div className="text-xl md:text-2xl font-bold text-zinc-50">{data.macro.regime}</div>
                <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed max-w-2xl">{data.macro.regimeDetail}</p>
              </div>
              <Link href="/supernova" className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-zinc-100">🛰️ ดู Supernova เต็ม →</Link>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {data.macro.rows.map((r) => (
                <div key={r.id} className="chip bg-base-850 border border-base-700 !py-1.5">
                  <span className="text-zinc-400 text-[11px]">{r.label}</span>
                  <span className={`num ml-2 text-[11px] font-bold ${(r.chg5d ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                    5 วัน {pct(r.chg5d)}
                  </span>
                  <span className={`num ml-1.5 text-[11px] ${(r.changePct ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                    (วันนี้ {pct(r.changePct)})
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ธีมข่าวร้อน */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-zinc-400">🔥 ธีมที่ตลาดกำลังพูดถึง (ความร้อน = ข่าวจริง 60% + ราคา 5 วัน 40%)</h2>
              <Link href="/radar" className="text-[11px] text-accent-soft hover:underline">เรดาร์เต็ม 25 ธีม →</Link>
            </div>
            {data.themes.length === 0 ? (
              <div className="card p-4 text-sm text-zinc-500">ยังไม่มีข้อมูลธีมช่วงนี้</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.themes.map((t) => (
                  <Link key={t.name} href="/radar" className="card card-hover p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-zinc-100">{t.emoji} {t.name}</span>
                      <span className={`num text-sm font-bold ${t.heat >= 60 ? "text-down" : t.heat >= 35 ? "text-accent" : "text-zinc-500"}`}>{t.heat}</span>
                    </div>
                    <div className={`num text-[11px] mt-1.5 ${t.avgChange >= 0 ? "text-up" : "text-down"}`}>
                      ตัวชี้วัดธีม 5 วัน {pct(t.avgChange)}
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">ข่าวเข้าธีมนี้ 24 ชม. {t.newsCount} ชิ้น</div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* สองฝั่ง: ใต้น้ำ vs แพงเกินตัว */}
          <section className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-sky-400">🤿 ใต้น้ำ + สัญญาณกลับตัว</h2>
                <Link href="/value" className="text-[11px] text-accent-soft hover:underline">ดูทั้งหมด →</Link>
              </div>
              <div className="space-y-2">
                {data.undervalued.length === 0 && <div className="card p-4 text-sm text-zinc-500">วันนี้ยังไม่มีตัวไหนผ่านเกณฑ์ (ปกติ — สแกนใหม่ทุก 30 นาที)</div>}
                {data.undervalued.map((r) => (
                  <Link key={r.symbol} href={`/stock/${encodeURIComponent(r.symbol)}`} className="card card-hover p-3.5 block">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-zinc-100">
                        {r.symbol} <span className="text-zinc-500 text-xs font-normal">{r.name}</span>
                      </span>
                      <span className="num text-xs text-sky-400">ต่ำกว่ายอด 52w {Math.abs(r.from52wHighPct ?? 0).toFixed(0)}%</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1 leading-snug">{r.reasons[0]}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="chip bg-base-800 text-zinc-500 text-[10px] num">ปัจจัย {r.overall}/100</span>
                      <span className="chip bg-base-800 text-zinc-500 text-[10px]">{r.signal}</span>
                      {r.market === "TH" && <span className="chip bg-base-800 text-zinc-500 text-[10px]">🇹🇭</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-orange-400">🎈 แพงเกินตัว — เฝ้าระวัง</h2>
                <Link href="/value" className="text-[11px] text-accent-soft hover:underline">ดูทั้งหมด →</Link>
              </div>
              <div className="space-y-2">
                {data.overpriced.length === 0 && <div className="card p-4 text-sm text-zinc-500">วันนี้ไม่มีตัวไหนเข้าเกณฑ์ร้อนเกิน</div>}
                {data.overpriced.map((r) => (
                  <Link key={r.symbol} href={`/stock/${encodeURIComponent(r.symbol)}`} className="card card-hover p-3.5 block">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-zinc-100">
                        {r.symbol} <span className="text-zinc-500 text-xs font-normal">{r.name}</span>
                      </span>
                      <span className={`num text-xs ${r.changePct >= 0 ? "text-up" : "text-down"}`}>วันนี้ {pct(r.changePct)}</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1 leading-snug">{r.reasons[0]}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="chip bg-base-800 text-zinc-500 text-[10px] num">ความแพง {r.valuation}/100</span>
                      {r.rsi !== null && <span className="chip bg-base-800 text-zinc-500 text-[10px] num">RSI {r.rsi}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* คะแนนเด่นวันนี้ */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-zinc-400">🏆 คะแนน StockLens เด่นวันนี้ (สูงสุด / เฝ้าระวัง)</h2>
              <Link href="/score" className="text-[11px] text-accent-soft hover:underline">อันดับเต็ม →</Link>
            </div>
            {data.scores ? (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="card p-4">
                  <div className="text-xs font-bold text-up mb-2">📈 คะแนนสูงสุด</div>
                  <div className="flex flex-wrap gap-2">
                    {data.scores.top.map((s) => (
                      <Link key={s.sym} href={`/stock/${encodeURIComponent(s.sym)}`} className="chip bg-up/10 text-up border border-up/30 num hover:border-up">
                        {s.sym} {s.t}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="card p-4">
                  <div className="text-xs font-bold text-down mb-2">📉 เฝ้าระวัง (คะแนนต่ำสุด)</div>
                  <div className="flex flex-wrap gap-2">
                    {data.scores.bottom.map((s) => (
                      <Link key={s.sym} href={`/stock/${encodeURIComponent(s.sym)}`} className="chip bg-down/10 text-down border border-down/30 num hover:border-down">
                        {s.sym} {s.t}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card p-4 text-sm text-zinc-500">คลังคะแนนกำลังสะสมรายวัน (cron 01:30) — ข้อมูล league จะเข้ามาเร็วๆ นี้</div>
            )}
          </section>

          {/* ไปต่อสำหรับมือใหม่ */}
          <Link href="/starter" className="card card-hover p-4 flex flex-wrap items-center gap-3 border-accent/30">
            <span className="text-2xl">🧑‍🎓</span>
            <div className="flex-1 min-w-[240px]">
              <div className="text-sm font-bold text-zinc-100">มือใหม่ อ่านแล้วยังไม่รู้จะเริ่มยังไง?</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">เลือกงบ + สไตล์ ได้พอร์ตตัวอย่างพร้อมเหตุผลทุกตัว — ตอบ 3 ข้อก็จัดให้</div>
            </div>
            <span className="text-accent text-sm font-bold">ไปหน้าพอร์ตมือใหม่ →</span>
          </Link>

          <p className="text-[11px] text-zinc-500 leading-relaxed border-t border-base-700/60 pt-4">
            ⚠️ {data.note} · สัญญาณ &ldquo;ใต้น้ำ/แพงเกินตัว&rdquo; ทุกตัวถูกจดบันทึกเพื่อวัดผลจริงใน{" "}
            <Link href="/track-record" className="text-accent-soft underline">Track Record สาธารณะ</Link>
          </p>
        </>
      )}
    </div>
  );
}
