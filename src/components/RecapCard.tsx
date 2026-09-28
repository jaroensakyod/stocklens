"use client";

// 📊 การ์ด "สรุปตลาดวันนี้" 1080×1350 — ดัชนี + movers + สินทรัพย์ + ข่าวเด่นพร้อมป้าย Jev
import type { RecapData } from "@/lib/contentCards2";
import type { CardCopy } from "./PortfolioCard";

const SENT = (s: string | null) => (s === "bullish" ? { i: "🟢", t: "บวก", c: "text-up" } : s === "bearish" ? { i: "🔴", t: "ลบ", c: "text-down" } : { i: "⚪", t: "กลาง", c: "text-zinc-400" });
const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

export default function RecapCard({ data, copy, cardRef }: { data: RecapData; copy: CardCopy; cardRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={cardRef} className="w-[1080px] h-[1350px] bg-base-950 text-zinc-100 flex flex-col p-10 font-sans" style={{ fontFamily: '"IBM Plex Sans Thai", sans-serif' }}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center text-zinc-950 font-bold text-2xl">SL</div>
        <div className="flex-1">
          <div className="text-[26px] font-bold text-zinc-50 leading-tight">{copy.headline || `สรุปตลาดวันนี้ — ${data.asOfTh}`}</div>
          <div className="text-[21px] text-zinc-300">{copy.sub || "ดัชนี · หุ้นเด่น · สินทรัพย์ · ข่าวเด่นพร้อมป้ายบวก/ลบโดย Jev"}</div>
        </div>
        <div className="text-right text-[18px] text-zinc-400 num">
          StockLens
          <br />
          {data.asOfTh}
        </div>
      </div>

      {/* ดัชนี 6 กล่อง */}
      <div className="mt-5 grid grid-cols-6 gap-2.5">
        {data.indices.map((i) => (
          <div key={i.s} className="rounded-xl bg-base-900 border border-base-700 px-2 py-2.5 text-center">
            <div className="text-[13px] text-zinc-500 truncate">{i.label}</div>
            <div className={`text-[19px] font-bold num ${i.changePct >= 0 ? "text-up" : "text-down"}`}>{pct(i.changePct)}</div>
          </div>
        ))}
      </div>

      {/* สินทรัพย์ + USD/THB */}
      <div className="mt-3 grid grid-cols-4 gap-2.5">
        {[...data.assets, { s: "THB=X", label: "USD/THB", price: data.usdThb, changePct: 0 }].map((a) => (
          <div key={a.s} className="rounded-xl bg-base-900 border border-base-700 px-3 py-2.5 flex items-center justify-between">
            <span className="text-[15px] text-zinc-400">{a.label}</span>
            <span className="text-[16px] font-bold num text-zinc-100">
              {a.s === "THB=X" ? a.price.toFixed(2) : a.price >= 1000 ? a.price.toFixed(0) : a.price.toFixed(1)}
              {a.s !== "THB=X" && <span className={`ml-1.5 text-[13px] ${a.changePct >= 0 ? "text-up" : "text-down"}`}>{pct(a.changePct)}</span>}
            </span>
          </div>
        ))}
      </div>

      {/* Movers คู่ */}
      <div className="mt-4 rounded-2xl bg-base-900 border border-base-700 p-5">
        <div className="text-[19px] font-bold text-zinc-300 mb-3">หุ้นเด่นวันนี้</div>
        <div className="grid grid-cols-2 gap-6">
          {([["🟢 ขึ้นแรงสุด", data.gainers, "text-up"], ["🔴 ลงแรงสุด", data.losers, "text-down"]] as const).map(([label, rows, cls]) => (
            <div key={label}>
              <div className={`text-[15px] font-bold mb-1.5 ${cls}`}>{label}</div>
              {rows.map((r) => (
                <div key={r.symbol} className="flex items-center justify-between border-t border-base-800 py-1.5">
                  <span className="text-[16px] font-semibold text-zinc-100 num">{r.symbol.replace(".BK", "")}</span>
                  <span className="text-[13px] text-zinc-500 truncate max-w-[150px] mx-2">{r.name}</span>
                  <span className={`text-[16px] font-bold num ${cls}`}>{pct(r.changePct)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ข่าวเด่น + Jev */}
      <div className="mt-4 rounded-2xl bg-base-900 border border-base-700 p-5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[19px] font-bold text-zinc-300">ข่าวเด่น — ตีความโดย Jev</div>
          {data.mood && (
            <span className={`chip !text-[12px] ${data.mood.dir === "bullish" ? "bg-up/10 text-up border border-up/30" : data.mood.dir === "bearish" ? "bg-down/10 text-down border border-down/30" : "bg-base-800 text-zinc-400 border border-base-700"}`}>
              ภาพรวม {data.mood.dir === "bullish" ? "เอียงบวก" : data.mood.dir === "bearish" ? "เอียงลบ" : "สมดุล"} · 🧠 Jev
            </span>
          )}
        </div>
        <div className="space-y-2.5">
          {data.news.map((n, i) => {
            const s = SENT(n.sentiment);
            return (
              <div key={i} className="flex items-start gap-3">
                <span className={`chip !text-[11px] !py-0.5 shrink-0 border ${s.c === "text-up" ? "bg-up/10 border-up/30" : s.c === "text-down" ? "bg-down/10 border-down/30" : "bg-base-800 border-base-700 text-zinc-400"}`}>
                  {s.i} {s.t}
                </span>
                <span className="text-[16px] text-zinc-200 leading-snug flex-1 line-clamp-2">{n.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* อ่านตรงนี้ */}
      <div className="mt-4 rounded-2xl bg-accent/5 border border-accent/30 p-5">
        <div className="text-[19px] font-bold text-accent mb-2">อ่านตรงนี้</div>
        <ul className="space-y-2">
          {(copy.bullets.length ? copy.bullets : ["…"]).slice(0, 4).map((b, i) => (
            <li key={i} className="flex gap-3 text-[17px] text-zinc-200 leading-snug">
              <span className="text-accent font-bold shrink-0 num">{i + 1}.</span>
              {b}
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-2 border-t border-base-800 text-[12px] text-zinc-600 leading-relaxed">
        {data.note} · สร้างด้วย StockLens 🎨 Content Studio · {data.asOfTh}
      </div>
    </div>
  );
}
