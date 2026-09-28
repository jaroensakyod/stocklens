"use client";

// 💰 การ์ดคอนเทนต์ "หุ้นจ่ายปันผลต่อเนื่อง" 1080×1350 (IG 4:5) — ข้อมูลจริงจาก dividendCard.ts
// ตอบกระแฟน "หุ้นปันผล 10 ปีต่อเนื่อง" แบบมีตัวเลขยืนยัน + เตือน yield trap ตรงๆ
import type { DividendStreakData, StreakRow } from "@/lib/dividendCard";
import type { CardCopy } from "./PortfolioCard";

const GOLD = "#eab308";

function DetailPanel({ row, isUs }: { row: StreakRow; isUs: boolean }) {
  // กราฟแท่งปันผลรายปี (≤10 ปีล่าสุด)
  const BW = 560;
  const BH = 210;
  const bars = row.yearTotals;
  const maxT = Math.max(...bars.map((b) => b.total), 0.0001);
  const bw = Math.min(46, (BW - 8) / bars.length - 10);
  const X = (i: number) => 8 + (i + 0.5) * ((BW - 16) / bars.length);
  const H = (v: number) => Math.max(3, (v / maxT) * (BH - 56));
  const cur = isUs ? "$" : "฿";
  return (
    <div className="rounded-2xl bg-base-900 border border-base-700 p-5 flex gap-6">
      <div className="w-[38%] flex flex-col">
        <div className="text-[15px] text-zinc-500">ตัวเด่นของรอบนี้</div>
        <div className="text-[26px] font-bold text-zinc-50 leading-tight mt-1">{row.symbol}</div>
        <div className="text-[16px] text-zinc-400 truncate">{row.name}</div>
        <div className="mt-3 inline-flex items-center gap-2 self-start rounded-xl bg-accent/10 border border-accent/40 px-4 py-2">
          <span className="text-[30px] font-bold text-accent num leading-none">{row.streakYears}</span>
          <span className="text-[15px] text-zinc-300 leading-tight">
            ปีติดกัน
            <br />
            ที่จ่ายปันผล
          </span>
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-base-850 px-2 py-2.5">
            <div className="text-[12px] text-zinc-500">yield ล่าสุด{row.specialFlag ? " (มีปันผลพิเศษ ◆)" : ""}</div>
            <div className={`text-[22px] font-bold num ${row.specialFlag ? "text-amber-400" : "text-zinc-50"}`}>{row.yieldPct?.toFixed(2) ?? "-"}%</div>
          </div>
          <div className="rounded-xl bg-base-850 px-2 py-2.5">
            <div className="text-[12px] text-zinc-500">ความถี่</div>
            <div className="text-[22px] font-bold text-zinc-50 num">
              {row.paysPerYear}
              <span className="text-[14px] font-normal text-zinc-400"> ครั้ง/ปี</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1">
        <div className="text-[17px] font-bold text-zinc-300 mb-1">ปันผลที่จ่ายจริงแต่ละปี ({cur}/หุ้น)</div>
        <svg viewBox={`0 0 ${BW} ${BH}`} width="100%" role="img" aria-label="ปันผลรายปี">
          {bars.map((b, i) => {
            const h = H(b.total);
            const isMax = b.total === maxT;
            return (
              <g key={b.year}>
                <rect x={X(i) - bw / 2} y={BH - 30 - h} width={bw} height={h} rx={5} fill={isMax ? GOLD : "#52525b"} />
                <text x={X(i)} y={BH - 30 - h - 8} textAnchor="middle" fill={isMax ? GOLD : "#9d9da6"} fontSize={13} className="num">
                  {b.total.toFixed(2)}
                </text>
                <text x={X(i)} y={BH - 10} textAnchor="middle" fill="#71717a" fontSize={12} className="num">
                  {String(b.year).slice(2)}
                </text>
              </g>
            );
          })}
          <line x1={0} y1={BH - 30} x2={BW} y2={BH - 30} stroke="#3f3f46" strokeWidth={1} />
        </svg>
        <div className="text-[13px] text-zinc-600 mt-1">ปี ค.ศ. (สองหลักท้าย) · แท่งทอง = ปีที่จ่ายสูงสุด</div>
      </div>
    </div>
  );
}

export default function DividendStreakCard({ data, copy, cardRef }: { data: DividendStreakData; copy: CardCopy; cardRef?: React.Ref<HTMLDivElement> }) {
  const isUs = data.market === "US";
  const cur = isUs ? "$" : "฿";
  const top = data.rows[0];
  const marketLabel = data.market === "TH" ? "หุ้นไทย" : data.market === "US" ? "หุ้นอเมริกา" : "รายชื่อที่เลือกเอง";

  return (
    <div ref={cardRef} className="w-[1080px] h-[1350px] bg-base-950 text-zinc-100 flex flex-col p-10 font-sans" style={{ fontFamily: '"IBM Plex Sans Thai", sans-serif' }}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center text-zinc-950 font-bold text-2xl">SL</div>
        <div className="flex-1">
          <div className="text-[26px] font-bold text-zinc-50 leading-tight">{copy.headline || `หุ้นจ่ายปันผลต่อเนื่อง ${data.minYears} ปี`}</div>
          <div className="text-[21px] text-zinc-300">{copy.sub || `คัดจากประวัติจ่ายจริง · ${marketLabel}`}</div>
        </div>
        <div className="text-right text-[18px] text-zinc-400 num">
          StockLens
          <br />
          {data.asOfTh}
        </div>
      </div>

      {/* เกณฑ์การคัด */}
      <div className="mt-5 flex gap-3 text-[17px]">
        {[
          ["ตลาด", marketLabel],
          ["เกณฑ์", `จ่ายติดกัน ≥ ${data.minYears} ปี`],
          ["สแกน", `${data.scanned} ตัว`],
          ["ผ่านเกณฑ์", `${data.rows.length} ตัว`],
        ].map(([k, v]) => (
          <div key={k} className="flex-1 rounded-xl bg-base-900 border border-base-700 px-4 py-2.5">
            <div className="text-[13px] text-zinc-500">{k}</div>
            <div className="font-bold num text-zinc-100">{v}</div>
          </div>
        ))}
      </div>

      {/* ตัวเด่น + กราฟรายปี */}
      <div className="mt-4">
        <DetailPanel row={top} isUs={isUs} />
      </div>

      {/* ตาราง */}
      <div className="mt-4 rounded-2xl bg-base-900 border border-base-700 p-5">
        <div className="text-[19px] font-bold text-zinc-300 mb-2">รายชื่อที่ผ่านเกณฑ์ — ตรวจจากวันขึ้น XD จริง</div>
        <table className="w-full text-[16px]">
          <thead>
            <tr className="text-[13px] text-zinc-500">
              <th className="text-left font-medium pb-1.5">หุ้น</th>
              <th className="text-right font-medium pb-1.5">จ่ายติดกัน</th>
              <th className="text-right font-medium pb-1.5">ความถี่/ปี</th>
              <th className="text-right font-medium pb-1.5">รวม 12 ด.ล่าสุด/หุ้น</th>
              <th className="text-right font-medium pb-1.5">yield</th>
            </tr>
          </thead>
          <tbody className="num">
            {data.rows.map((r) => (
              <tr key={r.symbol} className="border-t border-base-800">
                <td className="py-2">
                  <span className="font-bold text-zinc-50 text-[17px]">{r.symbol}</span>{" "}
                  <span className="text-[13px] text-zinc-500">{r.name}</span>
                </td>
                <td className="py-2 text-right font-bold text-accent">{r.streakYears} ปี</td>
                <td className="py-2 text-right text-zinc-300">{r.paysPerYear} ครั้ง</td>
                <td className="py-2 text-right text-zinc-300">
                  {r.specialFlag && <span className="text-accent mr-1" title="มีปันผลพิเศษใน 12 ด.ล่าสุด">◆</span>}
                  {cur}
                  {r.ttmTotal.toFixed(2)}
                </td>
                <td className={`py-2 text-right font-bold ${r.specialFlag ? "text-amber-400" : "text-zinc-50"}`}>{r.yieldPct?.toFixed(2) ?? "-"}%</td>
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

      {/* Footer */}
      <div className="mt-auto pt-2 border-t border-base-800 text-[12px] text-zinc-600 leading-relaxed">
        {data.note} · สร้างด้วย StockLens 🎨 Content Studio · {data.asOfTh}
      </div>
    </div>
  );
}
