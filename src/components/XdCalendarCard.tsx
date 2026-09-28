"use client";

// 🗓️ การ์ด "ปฏิทินหุ้นขึ้น XD เดือนหน้า" 1080×1350 — คาดการณ์จากรอบจ่ายจริงของปีก่อน
import type { XdCalData } from "@/lib/contentCards2";
import type { CardCopy } from "./PortfolioCard";

export default function XdCalendarCard({ data, copy, cardRef }: { data: XdCalData; copy: CardCopy; cardRef?: React.Ref<HTMLDivElement> }) {
  const [head, ...rest] = data.rows;
  return (
    <div ref={cardRef} className="w-[1080px] h-[1350px] bg-base-950 text-zinc-100 flex flex-col p-10 font-sans" style={{ fontFamily: '"IBM Plex Sans Thai", sans-serif' }}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center text-zinc-950 font-bold text-2xl">SL</div>
        <div className="flex-1">
          <div className="text-[26px] font-bold text-zinc-50 leading-tight">{copy.headline || `หุ้นขึ้น XD ${data.monthTh} — ปฏิทินรับปันผล`}</div>
          <div className="text-[21px] text-zinc-300">{copy.sub || "คาดการณ์จากรอบการจ่ายจริงของปีก่อน · เช็คประกาศบริษัทก่อนตัดสินใจเสมอ"}</div>
        </div>
        <div className="text-right text-[18px] text-zinc-400 num">
          StockLens
          <br />
          {data.asOfTh}
        </div>
      </div>

      {/* ตัวเด่น */}
      {head && (
        <div className="mt-5 rounded-2xl bg-base-900 border border-base-700 p-5 flex items-center gap-6">
          <div className="text-center shrink-0">
            <div className="text-[15px] text-zinc-500">XD คาดการณ์</div>
            <div className="text-[30px] font-bold text-accent num">{head.dateTh}</div>
          </div>
          <div className="flex-1">
            <div className="text-[24px] font-bold text-zinc-50 num">
              {head.symbol} <span className="text-[17px] font-normal text-zinc-400">{head.name}</span>
            </div>
            <div className="text-[17px] text-zinc-300 mt-1">
              ปันผล ~<b className="num">{head.amount.toFixed(2)} {head.currency === "THB" ? "บาท" : "$"}</b>/หุ้น · {head.freq}
              {head.yieldPct != null && <> · yield ~<b className="num">{head.yieldPct.toFixed(2)}%</b></>}
            </div>
          </div>
        </div>
      )}

      {/* ตาราง */}
      <div className="mt-4 rounded-2xl bg-base-900 border border-base-700 p-5">
        <div className="text-[19px] font-bold text-zinc-300 mb-2">รายชื่อทั้งหมด ({data.rows.length} ตัว)</div>
        <table className="w-full text-[16px]">
          <thead>
            <tr className="text-[13px] text-zinc-500">
              <th className="text-left font-medium pb-1.5">วัน XD (คาด)</th>
              <th className="text-left font-medium pb-1.5">หุ้น</th>
              <th className="text-right font-medium pb-1.5">ปันผล/หุ้น</th>
              <th className="text-right font-medium pb-1.5">ความถี่</th>
              <th className="text-right font-medium pb-1.5">yield</th>
            </tr>
          </thead>
          <tbody className="num">
            {data.rows.map((r) => (
              <tr key={r.symbol + r.dateIso} className="border-t border-base-800">
                <td className="py-2 font-bold text-accent">{r.dateTh}</td>
                <td className="py-2">
                  <span className="font-bold text-zinc-50">{r.symbol.replace(".BK", "")}</span>{" "}
                  <span className="text-[13px] text-zinc-500">{r.name}</span>
                </td>
                <td className="py-2 text-right text-zinc-200">
                  {r.amount.toFixed(2)} {r.currency === "THB" ? "฿" : "$"}
                </td>
                <td className="py-2 text-right text-[13px] text-zinc-400">{r.freq}</td>
                <td className="py-2 text-right font-bold text-zinc-100">{r.yieldPct != null ? `${r.yieldPct.toFixed(2)}%` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

      {/* กล่องเตือนซื้อก่อน XD */}
      <div className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4 text-[15px] text-zinc-300 leading-relaxed">
        ⚠️ <b>เตือนความเข้าใจผิดเรื่อง XD:</b> ซื้อหุ้นก่อนวัน XD แล้ว "รับปันผลฟรี" ไม่มีจริง — ราคาอ้างอิงวัน XD จะถูกปรับลงตามจำนวนปันผล และถ้าถือไม่ครบ 3 เดือนก่อน XD
        ส่วนใหญ่โดนภาษีหัก ณ ที่จ่าย 10% · เล่นกับดัก XD = เสียเปรียบ
      </div>

      {/* Footer */}
      <div className="mt-auto pt-2 border-t border-base-800 text-[12px] text-zinc-600 leading-relaxed">
        {data.note} · สร้างด้วย StockLens 🎨 Content Studio · {data.asOfTh}
      </div>
    </div>
  );
}
