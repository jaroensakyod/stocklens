"use client";

import Link from "next/link";
import { useState } from "react";
import data from "@/data/ai-opportunities.json";

// 🪜 โอกาสบันได AI — หุ้นจริงรายขั้น (ANI→AGI→ASI→Consciousness/Singularity)
// + บริษัทก่อนเข้าตลาด (ผลิตภัณฑ์/สัญญารัฐ-เอกชน/ดีล/มูลค่าล่าสุด/คาดหวัง) จากรายงานสาธารณะ ~ก.ย. 2026

interface Stock { t: string; n: string; why: string }
interface Theme { name: string; why: string; stocks: Stock[] }
interface Rung { id: string; title: string; desc: string; themes: Theme[] }
interface Ipo { name: string; ticker: string; country: string; what: string; ipo: string; now: string; note: string }
interface Watch { name: string; country: string; cat: string; product: string; gov: string; deals: string; valuation: string; expect: string; flag: string }

const D = data as unknown as { asOf: string; rungs: Rung[]; recentIpo: Ipo[]; watchlist: Watch[] };

export default function AiOppPage() {
  const [rung, setRung] = useState(0);
  const [tab, setTab] = useState<"ipo" | "watch">("watch");
  const active = D.rungs[rung];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🪜 โอกาสบันได AI — ANI → AGI → ASI → Singularity</h1>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
          ยิ่งไต่บันไดสูง ความชัดของโอกาสยิ่งลดลง: <b className="text-zinc-200">ANI = จับได้วันนี้</b> (หุ้นมีรายได้จริง) ·
          <b className="text-zinc-200"> AGI = รู้ก่อนว่าใครได้ใครเสีย</b> · <b className="text-zinc-200"> ASI = ซื้อสิ่งที่ทุกคนต้องใช้</b> ·
          <b className="text-zinc-200"> Singularity = ไม่มีหุ้นเล่นตรง เหลือจัดพอร์ตให้รอด</b> — พร้อมกลุ่มบริษัทก่อนเข้าตลาดที่จับตาได้ก่อน IPO
        </p>
        <p className="text-[11px] text-zinc-600 mt-1">ข้อมูลมูลค่าบริษัทเอกชนมาจากรายงานสื่อ/รอบระดมทุน (ไม่ใช่ราคาตลาด) · ตรวจล่าสุด {D.asOf} · ไม่ใช่คำแนะนำการลงทุน</p>
      </div>

      {/* แถบเลือกขั้นบันได */}
      <div className="flex flex-wrap gap-1.5">
        {D.rungs.map((r, i) => (
          <button key={r.id} className={`chip border !text-xs ${i === rung ? "bg-accent/20 text-accent-soft border-accent/40" : "bg-base-800 text-zinc-400 border-base-700 hover:border-base-500"}`} onClick={() => setRung(i)}>
            {i + 1}. {r.id === "consing" ? "Consciousness/Singularity" : r.id.toUpperCase()}
          </button>
        ))}
      </div>

      {/* โอกาสรายขั้น (หุ้นจริง) */}
      <div className="card p-5">
        <h2 className="text-lg font-bold text-zinc-50">{active.title}</h2>
        <p className="text-sm text-zinc-400 mt-1 mb-4 leading-relaxed">{active.desc}</p>
        <div className="grid md:grid-cols-2 gap-4">
          {active.themes.map((th) => (
            <div key={th.name} className="rounded-xl border border-base-700/60 bg-base-900 p-4">
              <div className="text-sm font-bold text-zinc-100">{th.name}</div>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{th.why}</p>
              <div className="mt-3 space-y-2">
                {th.stocks.map((s) => (
                  <div key={s.t} className="flex items-start gap-2.5 bg-base-850 rounded-lg px-2.5 py-2">
                    <Link href={`/stock/${encodeURIComponent(s.t)}`} className="chip bg-accent/15 text-accent-soft border border-accent/30 !text-[11px] shrink-0 hover:bg-accent/25">{s.t}</Link>
                    <div className="min-w-0">
                      <span className="text-[12px] font-semibold text-zinc-200">{s.n}</span>
                      <span className="block text-[11px] text-zinc-500 leading-snug">{s.why}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* กลุ่มก่อนเข้าตลาด */}
      <div className="card overflow-hidden">
        <div className="flex gap-1.5 px-4 pt-3 pb-1">
          <button className={`chip border !text-xs ${tab === "watch" ? "bg-accent/20 text-accent-soft border-accent/40" : "bg-base-800 text-zinc-400 border-base-700"}`} onClick={() => setTab("watch")}>
            👀 ยังไม่เข้าตลาด — จับตาก่อน IPO ({D.watchlist.length})
          </button>
          <button className={`chip border !text-xs ${tab === "ipo" ? "bg-accent/20 text-accent-soft border-accent/40" : "bg-base-800 text-zinc-400 border-base-700"}`} onClick={() => setTab("ipo")}>
            🎉 เพิ่ง/กำลัง IPO ({D.recentIpo.length})
          </button>
        </div>

        {tab === "watch" && (
          <div className="p-4 grid lg:grid-cols-2 gap-3">
            {D.watchlist.map((w) => (
              <div key={w.name} className="rounded-xl border border-base-700/60 bg-base-900 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-lg">{w.flag}</span>
                  <span className="text-sm font-bold text-zinc-50">{w.name}</span>
                  <span className="text-xs">{w.country}</span>
                  <span className="chip bg-base-800 text-zinc-400 border border-base-700 !text-[10px] ml-auto shrink-0">{w.cat}</span>
                </div>
                <Field label="ผลิตภัณฑ์" v={w.product} />
                <Field label="สัญญาภาครัฐ" v={w.gov} />
                <Field label="ดีล/ผู้ลงทุน" v={w.deals} />
                <Field label="💰 มูลค่าล่าสุด" v={w.valuation} hot />
                <Field label="🎯 คาดหวัง" v={w.expect} />
              </div>
            ))}
          </div>
        )}

        {tab === "ipo" && (
          <div className="p-4 grid lg:grid-cols-3 gap-3">
            {D.recentIpo.map((c) => (
              <div key={c.name} className="rounded-xl border border-up/25 bg-up/5 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-bold text-zinc-50">{c.country} {c.name}</span>
                  <span className="chip bg-up/15 text-up border border-up/30 !text-[10px] ml-auto">{c.ticker}</span>
                </div>
                <Field label="ธุรกิจ" v={c.what} />
                <Field label="IPO" v={c.ipo} hot />
                <Field label="สถานะ" v={c.now} />
                <Field label="หมายเหตุ" v={c.note} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* วิธีตรวจว่าโลกไต่บันไดถึงไหน */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100 mb-3">🧪 วิธีตรวจว่าโลกไต่บันไดไปถึงไหน (ปรับพอร์ตตามหลักฐาน ไม่ใช่ตามข่าว)</h2>
        <div className="grid md:grid-cols-2 gap-2 text-xs">
          {[
            ["① งานที่ agent ทำ 'จบทั้งงาน' และลูกค้าจ่ายจริง", "ไม่ใช่ช่วยทำ — ดูรายได้รายย่อยของบริษัท AI ที่เป็น usage-based"],
            ["② หุ่นยนต์ทำงานในโรงงานจริงกี่ชั่วโมง/วัน", "สัญญาณ AGI ลงกายภาพ — BMW×Figure 03 คือจุดเริ่มที่ต้องตามต่อ"],
            ["③ ต้นทุนต่อหน่วยงานลดเร็วแค่ไหน", "token/inference cost ลดเร็ว = โอกาสฝั่ง 'ผู้ใช้ AI' โตตาม"],
            ["④ ค่าจ้าง/การจ้างงานงานทำซ้ำเริ่มหดจริงหรือยัง", "ตัวชี้วัดขั้น AGI ที่วัดได้จากข้อมูลแรงงาน ไม่ใช่ press release"],
          ].map(([q, a]) => (
            <div key={q} className="bg-base-900 border border-base-700/60 rounded-lg px-3 py-2">
              <div className="text-zinc-200 font-semibold">{q}</div>
              <div className="text-zinc-500 mt-0.5">{a}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-zinc-600 mt-3 leading-relaxed">
          บริบทเต็มของบันได (ANI/AGI/ASI/RSI/จิตสำนึก/Singularity) อยู่ที่ 🕵️ <Link href="/atlas" className="link">Atlas — การ์ด 🪜 บันได AI</Link> · เตือนทุกขั้น: ประโยคเหล่านี้เป็นของขายที่ทรงพลังที่สุดในประวัติศาสตร์การตลาด — ตรวจด้วยเลขก่อนเชื่อเสมอ
        </p>
      </div>
    </div>
  );
}

function Field({ label, v, hot }: { label: string; v: string; hot?: boolean }) {
  if (!v || v === "—") return null;
  return (
    <div className="flex gap-2 mt-1.5">
      <span className={`text-[10px] shrink-0 w-20 pt-0.5 ${hot ? "text-up font-bold" : "text-zinc-600"}`}>{label}</span>
      <span className={`text-[11px] leading-relaxed ${hot ? "text-zinc-200 font-semibold" : "text-zinc-400"}`}>{v}</span>
    </div>
  );
}
