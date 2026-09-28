"use client";

// 😱 การ์ด "เหตุการณ์นี้ใครได้-ใครเสียประโยชน์" 1080×1350 — ห่วงโซ่ Global Radar + ราคาสด
import type { MacroCardData } from "@/lib/contentCards2";
import type { CardCopy } from "./PortfolioCard";

export default function MacroChainCard({ data, copy, cardRef }: { data: MacroCardData; copy: CardCopy; cardRef?: React.Ref<HTMLDivElement> }) {
  const main = data.chains[0];
  const others = data.chains.slice(1, 4);
  const pos = main?.stocks.filter((s) => s.direction === "positive") ?? [];
  const neg = main?.stocks.filter((s) => s.direction === "negative") ?? [];

  const StockList = ({ rows, up }: { rows: { ticker: string; reason: string; chgPct: number | null }[]; up: boolean }) => (
    <div>
      <div className={`text-[16px] font-bold mb-1.5 ${up ? "text-up" : "text-down"}`}>{up ? "✅ ได้ประโยชน์" : "❌ เสียประโยชน์"}</div>
      {rows.slice(0, 4).map((s) => (
        <div key={s.ticker} className="border-t border-base-800 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[17px] font-bold text-zinc-100 num">{s.ticker}</span>
            {s.chgPct != null && (
              <span className={`text-[14px] num ${s.chgPct >= 0 ? "text-up" : "text-down"}`}>
                {s.chgPct >= 0 ? "+" : ""}
                {s.chgPct.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-zinc-500 leading-snug">{s.reason}</p>
        </div>
      ))}
      {!rows.length && <p className="text-[14px] text-zinc-600">—</p>}
    </div>
  );

  return (
    <div ref={cardRef} className="w-[1080px] h-[1350px] bg-base-950 text-zinc-100 flex flex-col p-10 font-sans" style={{ fontFamily: '"IBM Plex Sans Thai", sans-serif' }}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center text-zinc-950 font-bold text-2xl">SL</div>
        <div className="flex-1">
          <div className="text-[26px] font-bold text-zinc-50 leading-tight">{copy.headline || `«${data.input}» ทำให้ใครได้/เสียประโยชน์`}</div>
          <div className="text-[21px] text-zinc-300">{copy.sub || "ห่วงโซ่ผลกระทบจาก Global Radar — เชิงตรรกะ ไม่ใช่คำทำนาย"}</div>
        </div>
        <div className="text-right text-[18px] text-zinc-400 num">
          StockLens
          <br />
          {data.asOfTh}
        </div>
      </div>

      {/* เหตุการณ์ */}
      <div className="mt-5 rounded-2xl bg-base-900 border-l-4 border-l-accent p-5">
        <div className="text-[14px] text-zinc-500 mb-1">เหตุการณ์</div>
        <div className="text-[24px] font-bold text-zinc-50 leading-snug">&quot;{data.input}&quot;</div>
        <p className="text-[15px] text-zinc-400 mt-2 leading-relaxed">{main?.reason ?? data.headline}</p>
      </div>

      {/* ใครได้ ใครเสีย */}
      <div className="mt-4 rounded-2xl bg-base-900 border border-base-700 p-5">
        <div className="text-[19px] font-bold text-zinc-300 mb-2">ห่วงโซ่หลัก: {main?.name}</div>
        <div className="grid grid-cols-2 gap-6">
          <StockList rows={pos} up />
          <StockList rows={neg} up={false} />
        </div>
      </div>

      {/* ห่วงโซ่รอง */}
      {others.length > 0 && (
        <div className="mt-4 rounded-2xl bg-base-900 border border-base-700 p-5">
          <div className="text-[19px] font-bold text-zinc-300 mb-2">ห่วงโซ่รองที่เกี่ยวข้อง</div>
          {others.map((c) => (
            <div key={c.name} className="border-t border-base-800 py-2">
              <div className="text-[16px] font-bold text-zinc-100">{c.name}</div>
              <p className="text-[13px] text-zinc-500 leading-snug">{c.reason}</p>
              <div className="flex gap-1.5 flex-wrap mt-1.5">
                {c.stocks.slice(0, 5).map((s) => (
                  <span key={s.ticker} className={`chip !text-[11px] !py-0.5 border ${s.direction === "positive" ? "bg-up/10 text-up border-up/30" : "bg-down/10 text-down border-down/30"}`}>
                    {s.direction === "positive" ? "▲" : "▼"} {s.ticker}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

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
