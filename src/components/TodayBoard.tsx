"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePortfolio } from "@/lib/store";

interface TodayItem {
  ticker: string;
  headline: string;
  reason: string;
}
interface TodayData {
  asOf: string;
  summary: string;
  watch: TodayItem[];
  pressure: TodayItem[];
  caution: { icon: string; text: string }[];
  opportunity: { icon: string; title: string; text: string; link?: string; stocks?: { ticker: string; direction: "positive" | "negative"; reason: string; changePct: number | null }[] }[];
  portfolio: { ticker: string; flag: "warn" | "good"; text: string }[];
}

// 📋 "วันนี้ควรรู้อะไร" — ตอบ 4 คำถามที่คนเปิดเว็บมาอยากรู้ ในจอเดียว:
// น่าสนใจอะไร · มีแรงกดดันตรงไหน · ระวังอะไร · โอกาสอยู่ที่ไหน (+ พอร์ตตัวเองเป็นไง)
export default function TodayBoard() {
  const { holdings } = usePortfolio();
  const [data, setData] = useState<TodayData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const qs = holdings.length ? `?holdings=${encodeURIComponent(holdings.map((h) => h.ticker).join(","))}` : "";
    fetch(`/api/today${qs}`)
      .then((r) => r.json())
      .then((j) => (j.error ? setFailed(true) : setData(j)))
      .catch(() => setFailed(true));
  }, [holdings]);

  if (failed) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-bold text-zinc-400">📋 วันนี้ควรรู้อะไร</h2>
        {data?.asOf && <span className="text-[11px] text-zinc-600 shrink-0">ข้อมูล {data.asOf} · delay ~15 นาที</span>}
      </div>

      {!data && <div className="card p-10 text-center text-xs text-zinc-500">กำลังประมวลสัญญาณทั้งตลาด (ครั้งแรก ~30 วินาที)…</div>}

      {data && (
        <>
          {/* สรุปบรรณาธิการ 1 บรรทัด */}
          <div className="card p-4 border-accent/25">
            <p className="text-sm text-zinc-200 leading-relaxed">💬 {data.summary}</p>
          </div>

          {/* พอร์ตคุณ (ถ้ามี holdings) */}
          {data.portfolio.length > 0 && (
            <div className={`card p-4 ${data.portfolio.some((p) => p.flag === "warn") ? "border-amber-500/40" : "border-up/30"}`}>
              <h3 className="text-xs font-bold text-zinc-300 mb-2">🫵 พอร์ตคุณวันนี้</h3>
              <div className="space-y-1.5">
                {data.portfolio.map((p) => (
                  <p key={p.ticker} className="text-xs leading-snug">
                    <Link href={`/stock/${p.ticker}`} className={`font-bold ${p.flag === "warn" ? "text-amber-400" : "text-up"} hover:underline`}>
                      {p.flag === "warn" ? "⚠️" : "✅"} {p.ticker}
                    </Link>{" "}
                    <span className="text-zinc-400">{p.text}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {/* 🟢 น่าสนใจ */}
            <div className="card p-4 border-up/25">
              <h3 className="text-xs font-bold text-up mb-2">🟢 น่าสนใจวันนี้ <span className="text-zinc-600 font-normal">— ขยับแรง + งบผ่านเกณฑ์</span></h3>
              <div className="space-y-2.5">
                {data.watch.length === 0 && <p className="text-xs text-zinc-500">วันนี้ไม่มีตัวที่ผ่านเกณฑ์ — วันแบบนี้ไม่ต้องเร่งทำอะไร</p>}
                {data.watch.map((w) => (
                  <Link key={w.ticker} href={`/stock/${w.ticker}`} className="block group">
                    <p className="text-xs font-bold text-zinc-100 group-hover:text-accent-soft">{w.headline}</p>
                    <p className="text-[11px] text-zinc-500 leading-snug">{w.reason}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* 🔴 แรงกดดัน */}
            <div className="card p-4 border-down/25">
              <h3 className="text-xs font-bold text-down mb-2">🔴 มีแรงกดดัน <span className="text-zinc-600 font-normal">— ลงแรง + สัญญาณเทคนิคเอียงลบ</span></h3>
              <div className="space-y-2.5">
                {data.pressure.length === 0 && <p className="text-xs text-zinc-500">ไม่มีหุ้นใหญ่ที่ลงแรงพร้อมสัญญาณยืนยัน — ตลาดยังไม่มีแรงขายรุนแรง</p>}
                {data.pressure.map((p) => (
                  <Link key={p.ticker} href={`/stock/${p.ticker}`} className="block group">
                    <p className="text-xs font-bold text-zinc-100 group-hover:text-accent-soft">{p.headline}</p>
                    <p className="text-[11px] text-zinc-500 leading-snug">{p.reason}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* ⚠️ ระวัง */}
            <div className="card p-4 border-amber-500/25">
              <h3 className="text-xs font-bold text-amber-400 mb-2">⚠️ ต้องระวัง</h3>
              <div className="space-y-2">
                {data.caution.length === 0 && <p className="text-xs text-zinc-500">ไม่มีสัญญาณเตือนเด่นวันนี้</p>}
                {data.caution.map((c, i) => (
                  <p key={i} className="text-xs text-zinc-300 leading-snug">
                    {c.icon} {c.text}
                  </p>
                ))}
              </div>
            </div>

            {/* 💎 โอกาส */}
            <div className="card p-4 border-accent/25">
              <h3 className="text-xs font-bold text-accent-soft mb-2">💎 โอกาสที่จับตา</h3>
              <div className="space-y-2.5">
                {data.opportunity.map((o, i) => (
                  <div key={i}>
                    {o.link ? (
                      <Link href={o.link} className="block group">
                        <p className="text-xs font-bold text-zinc-100 group-hover:text-accent-soft">
                          {o.icon} {o.title} <span className="text-accent-soft font-normal">→</span>
                        </p>
                      </Link>
                    ) : (
                      <p className="text-xs font-bold text-zinc-100">{o.icon} {o.title}</p>
                    )}
                    <p className="text-[11px] text-zinc-500 leading-snug">{o.text}</p>
                    {/* หุ้นในห่วงโซ่ของธีม — พูดธีมต้องบอก "หุ้นตัวไหน" เสมอ */}
                    {o.stocks && o.stocks.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {o.stocks.map((s) => (
                          <Link
                            key={s.ticker}
                            href={`/stock/${s.ticker}`}
                            title={s.reason}
                            className={`chip text-[10px] border ${s.direction === "positive" ? "bg-up/10 text-up border-up/30" : "bg-down/10 text-down border-down/30"} hover:brightness-125`}
                          >
                            {s.direction === "positive" ? "✅" : "❌"} {s.ticker}
                            {s.changePct !== null && <span className="num opacity-80"> {s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(1)}%</span>}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-[10px] text-zinc-600">
            ⚠️ เป็นการรวบรวมสัญญาณจากข้อมูลจริง (ราคา/งบ/สัญญาณเทคนิค/13F) เพื่อการศึกษา — ไม่ใช่คำแนะนำการลงทุน การลงทุนมีความเสี่ยง
          </p>
        </>
      )}
    </section>
  );
}
