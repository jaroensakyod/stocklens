"use client";

// 🦈 การ์ด "กูรูถืออะไร" 1080×1350 — จาก 13F จริง (SEC EDGAR) พร้อมข้อควรระวัง
import type { GuruCardData } from "@/lib/contentCards2";
import type { CardCopy } from "./PortfolioCard";

export default function GuruCard({ data, copy, cardRef }: { data: GuruCardData; copy: CardCopy; cardRef?: React.Ref<HTMLDivElement> }) {
  const g = data.guru;
  return (
    <div ref={cardRef} className="w-[1080px] h-[1350px] bg-base-950 text-zinc-100 flex flex-col p-10 font-sans" style={{ fontFamily: '"IBM Plex Sans Thai", sans-serif' }}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-base-800 border border-base-700 flex items-center justify-center text-3xl">{g.emoji}</div>
        <div className="flex-1">
          <div className="text-[26px] font-bold text-zinc-50 leading-tight">{copy.headline || `${g.name} ถืออะไรไว้บ้าง`}</div>
          <div className="text-[21px] text-zinc-300">{copy.sub || `${g.firm} · จากแบบ 13F จริง งวด ${g.asOf}`}</div>
        </div>
        <div className="text-right text-[18px] text-zinc-400 num">
          StockLens
          <br />
          {data.asOfTh}
        </div>
      </div>

      {/* สรุปพอร์ต */}
      <div className="mt-5 flex gap-3 text-[16px]">
        <div className="flex-1 rounded-xl bg-base-900 border border-base-700 px-4 py-2.5">
          <div className="text-[13px] text-zinc-500">พอร์ตหุ้นสหรัฐฯ รวม</div>
          <div className="font-bold num text-zinc-100">~${data.totalValueUsdB.toLocaleString()} พันล้าน</div>
        </div>
        {data.qoq && (
          <>
            <div className="flex-1 rounded-xl bg-base-900 border border-base-700 px-4 py-2.5">
              <div className="text-[13px] text-zinc-500">เพิ่ม / ลด ไตรมาสนี้</div>
              <div className="font-bold num text-zinc-100">
                <span className="text-up">{data.qoq.increased} เพิ่ม</span> · <span className="text-down">{data.qoq.decreased} ลด</span>
              </div>
            </div>
            <div className="flex-1 rounded-xl bg-base-900 border border-base-700 px-4 py-2.5">
              <div className="text-[13px] text-zinc-500">เปิดใหม่</div>
              <div className="font-bold num text-accent">{data.qoq.newCount} ตำแหน่ง</div>
            </div>
          </>
        )}
      </div>

      {/* ตาราง holdings */}
      <div className="mt-4 rounded-2xl bg-base-900 border border-base-700 p-5 flex-1">
        <div className="text-[19px] font-bold text-zinc-300 mb-2">ถือครั้ง (สัดส่วนของพอร์ตหุ้น)</div>
        <table className="w-full text-[16px]">
          <thead>
            <tr className="text-[13px] text-zinc-500">
              <th className="text-left font-medium pb-1.5">#</th>
              <th className="text-left font-medium pb-1.5">หุ้น</th>
              <th className="text-right font-medium pb-1.5">สัดส่วน</th>
              <th className="text-right font-medium pb-1.5">มูลค่า</th>
              <th className="text-right font-medium pb-1.5">ไตรมาสนี้</th>
            </tr>
          </thead>
          <tbody className="num">
            {data.top.map((h, i) => (
              <tr key={h.issuer} className="border-t border-base-800">
                <td className="py-2 text-zinc-600">{i + 1}</td>
                <td className="py-2">
                  <span className="font-bold text-zinc-50">{h.ticker}</span>{" "}
                  <span className="text-[13px] text-zinc-500">{h.issuer.slice(0, 24)}</span>
                </td>
                <td className="py-2 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-[90px] h-1.5 rounded bg-base-800 overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${Math.min(100, h.pct)}%` }} />
                    </div>
                    <span className="font-bold text-zinc-100 w-14 text-right">{h.pct.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="py-2 text-right text-zinc-300">${h.valueUsdB}B</td>
                <td className={`py-2 text-right text-[13px] ${h.change?.startsWith("⬆️") || h.change?.startsWith("🆕") ? "text-up" : h.change?.startsWith("⬇️") ? "text-down" : "text-zinc-500"}`}>{h.change ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* สไตล์ + ข้อควรระวัง */}
      <div className="mt-4 rounded-2xl bg-base-900 border border-base-700 p-5">
        <div className="text-[17px] font-bold text-zinc-300 mb-1">สไตล์การลงทุน</div>
        <p className="text-[15px] text-zinc-400 leading-relaxed">{g.style}</p>
        <div className="text-[17px] font-bold text-amber-400 mt-3 mb-1">⚠️ อ่านก่อนตามซื้อ</div>
        <p className="text-[15px] text-zinc-400 leading-relaxed">{g.caution}</p>
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
