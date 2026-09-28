"use client";

// 🎨 การ์ดคอนเทนต์ "จัดพอร์ต" 1080×1350 (IG 4:5) — pure presentational รับข้อมูลจาก portfolioCard.ts
// วาดกราฟเองด้วย SVG (แนว PriceSpark: คมทุก resolution กว่า canvas ตอน export)
import type { PortfolioCardData } from "@/lib/portfolioCard";

export interface CardCopy {
  headline: string;
  sub: string;
  bullets: string[];
  caption: string;
  hashtags: string;
}

const baht = (n: number) => Math.round(n).toLocaleString("th-TH");
const mBaht = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)} ล้าน` : baht(n));
const OLD = "#f43f5e";
const NEW = "#10b981";

function fmtPct(v: number | null | undefined, digits = 1, suffix = "%") {
  return v == null || !isFinite(v) ? "-" : `${v >= 0 ? "" : ""}${v.toFixed(digits)}${suffix}`;
}

export default function PortfolioCard({ data, copy, cardRef }: { data: PortfolioCardData; copy: CardCopy; cardRef?: React.Ref<HTMLDivElement> }) {
  // ===== Equity curve (เส้นคู่ DCA) =====
  const CW = 960;
  const CH = 240;
  const curves = [data.oldP.curve, data.newP.curve];
  const maxV = Math.max(...curves.flat().map((c) => c.v), data.oldP.investedThb, data.newP.investedThb);
  const minV = Math.min(...curves.flat().map((c) => c.v), 0);
  const X = (i: number, len: number) => (i / Math.max(1, len - 1)) * CW;
  const Y = (v: number) => CH - ((v - minV) / (maxV - minV || 1)) * (CH - 14) - 7;
  const lineOf = (curve: { v: number }[]) => curve.map((c, i) => `${X(i, curve.length).toFixed(1)},${Y(c.v).toFixed(1)}`).join(" ");
  // เส้น "เงินที่ลงรวม" (เทียบว่า DCA ช่วยได้ไหม)
  const investedLine = data.newP.curve.map((c, i) => {
    const months = Math.round((i / Math.max(1, data.newP.curve.length - 1)) * data.years * 12);
    return `${X(i, data.newP.curve.length).toFixed(1)},${Y(data.initialThb + data.dcaThb * months).toFixed(1)}`;
  }).join(" ");

  // ===== Risk map (x=vol, y=cagr) =====
  const RW = 460;
  const RH = 240;
  interface Pt {
    label: string;
    x: number;
    y: number;
    color: string;
    r: number;
  }
  const pts = (
    [
      ...data.assets.map((a) => ({ label: a.symbol, x: a.volPct as number | null, y: a.cagrPct as number | null, color: a.color, r: 10 })),
      { label: "พอร์ตเดิม", x: data.oldP.volPct as number | null, y: data.oldP.xirrPct as number | null, color: OLD, r: 20 },
      { label: "พอร์ตจัดใหม่", x: data.newP.volPct as number | null, y: data.newP.xirrPct as number | null, color: NEW, r: 20 },
    ] as { label: string; x: number | null; y: number | null; color: string; r: number }[]
  ).filter((p): p is Pt => p.x != null && p.y != null && isFinite(p.x) && isFinite(p.y));
  const xMax = Math.max(...pts.map((p) => p.x)) * 1.15 || 1;
  const yMin = Math.min(0, ...pts.map((p) => p.y));
  const yMax = Math.max(...pts.map((p) => p.y)) * 1.1 || 1;
  const RX = (v: number) => 46 + (v / xMax) * (RW - 60);
  const RY = (v: number) => RH - 34 - ((v - yMin) / (yMax - yMin || 1)) * (RH - 56);

  const rows: [string, string, string][] = [
    ["มูลค่าสุดท้าย", `฿${baht(data.oldP.finalThb)}`, `฿${baht(data.newP.finalThb)}`],
    ["เงินที่ลงรวม", `฿${baht(data.oldP.investedThb)}`, `฿${baht(data.newP.investedThb)}`],
    ["ผลตอบแทนเฉลี่ย/ปี (XIRR)", fmtPct(data.oldP.xirrPct), fmtPct(data.newP.xirrPct)],
    ["ความผันผวน/ปี", fmtPct(data.oldP.volPct), fmtPct(data.newP.volPct)],
    ["จุดต่ำสุด (จากยอดสูงสุด)", fmtPct(data.oldP.mddPct), fmtPct(data.newP.mddPct)],
  ];

  return (
    <div
      ref={cardRef}
      className="w-[1080px] h-[1350px] bg-base-950 text-zinc-100 flex flex-col p-10 font-sans"
      style={{ fontFamily: '"IBM Plex Sans Thai", sans-serif' }}
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center text-zinc-950 font-bold text-2xl">SL</div>
        <div className="flex-1">
          <div className="text-[26px] font-bold text-zinc-50 leading-tight">{copy.headline || "จัดพอร์ตใหม่"}</div>
          <div className="text-[21px] text-zinc-300">{copy.sub || `${data.years} ปีที่ผ่านมา · DCA ทุกเดือน`}</div>
        </div>
        <div className="text-right text-[18px] text-zinc-400 num">
          StockLens
          <br />
          {data.asOfTh}
        </div>
      </div>

      {/* แถวสูตรสินทรัพย์ */}
      <div className="mt-5 rounded-2xl bg-base-900 border border-base-700 p-5">
        <div className="text-[19px] font-bold text-zinc-300 mb-3">สูตรพอร์ตจัดใหม่</div>
        <div className="flex items-center gap-3">
          {data.newP.positions.map((p, i) => (
            <div key={p.symbol} className="flex items-center gap-3">
              {i > 0 && <span className="text-2xl text-zinc-600 font-light">+</span>}
              <div className="flex-1 min-w-[150px] rounded-xl bg-base-850 px-4 py-3 border-l-4" style={{ borderColor: p.color }}>
                <div className="text-[22px] font-bold num" style={{ color: p.color }}>
                  {Math.round(p.weight)}%
                </div>
                <div className="text-[17px] text-zinc-200 font-semibold">{p.symbol}</div>
                <div className="text-[14px] text-zinc-500 truncate max-w-[150px]">{p.name}</div>
              </div>
            </div>
          ))}
          <span className="text-2xl text-zinc-600 font-light">=</span>
          <div className="rounded-xl bg-accent/10 border border-accent/40 px-5 py-4 text-center">
            <div className="text-[22px] font-bold text-accent num">100%</div>
            <div className="text-[15px] text-zinc-300">พอร์ตรวม</div>
          </div>
        </div>
      </div>

      {/* สมมติฐาน */}
      <div className="mt-4 flex gap-3 text-[17px]">
        {[
          ["เงินต้น", `฿${baht(data.initialThb)}`],
          ["DCA ทุกเดือน", `฿${baht(data.dcaThb)}`],
          ["ระยะเวลา", `${data.years} ปี`],
          ["ช่วงข้อมูล", `${data.startTh} – ${data.endTh}`],
        ].map(([k, v]) => (
          <div key={k} className="flex-1 rounded-xl bg-base-900 border border-base-700 px-4 py-2.5">
            <div className="text-[13px] text-zinc-500">{k}</div>
            <div className="font-bold num text-zinc-100">{v}</div>
          </div>
        ))}
      </div>

      {/* Equity curve */}
      <div className="mt-4 rounded-2xl bg-base-900 border border-base-700 p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[19px] font-bold text-zinc-300">ถ้า DCA มาตลอด {data.years} ปี — เงินโตเป็นเท่าไหร่</div>
          <div className="flex gap-4 text-[15px]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-1 rounded" style={{ background: OLD }} /> พอร์ตเดิม
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-1 rounded" style={{ background: NEW }} /> พอร์ตจัดใหม่
            </span>
            <span className="flex items-center gap-1.5 text-zinc-500">
              <span className="inline-block w-6 h-0.5 border-t border-dashed border-zinc-500" /> เงินที่ลงรวม
            </span>
          </div>
        </div>
        <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" height={CH} role="img" aria-label="กราฟมูลค่าพอร์ตย้อนหลัง">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} y1={CH * f} x2={CW} y2={CH * f} stroke="#27272a" strokeWidth={1} />
          ))}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <text key={f} x={6} y={CH * f - 4} fill="#9d9da6" fontSize={14} className="num">
              {mBaht(minV + (maxV - minV) * f)}
            </text>
          ))}
          <polyline points={investedLine} fill="none" stroke="#71717a" strokeWidth={1.5} strokeDasharray="6 5" />
          <polyline points={lineOf(data.oldP.curve)} fill="none" stroke={OLD} strokeWidth={3} strokeLinejoin="round" />
          <polyline points={lineOf(data.newP.curve)} fill="none" stroke={NEW} strokeWidth={4} strokeLinejoin="round" />
        </svg>
        <div className="flex justify-between text-[14px] text-zinc-500 num mt-1">
          <span>{data.startTh}</span>
          <span>+{Math.round(data.years / 2)} ปี</span>
          <span>{data.endTh}</span>
        </div>
      </div>

      {/* Risk map + ตาราง */}
      <div className="mt-4 flex gap-4">
        <div className="w-[46%] rounded-2xl bg-base-900 border border-base-700 p-5">
          <div className="text-[19px] font-bold text-zinc-300 mb-1">แผนที่ความเสี่ยง</div>
          <div className="text-[13px] text-zinc-500 mb-1">ยิ่งอยู่ซ้ายบน = ผลตอบแทนดี ผันผวนต่ำ</div>
          <svg viewBox={`0 0 ${RW} ${RH}`} width="100%" role="img" aria-label="แผนที่ความเสี่ยง">
            <line x1={RX(0)} y1={RY(0)} x2={RW - 10} y2={RY(0)} stroke="#3f3f46" strokeWidth={1} strokeDasharray="4 4" />
            <line x1={RX(0)} y1={16} x2={RX(0)} y2={RH - 34} stroke="#3f3f46" strokeWidth={1} strokeDasharray="4 4" />
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={RX(p.x)} cy={RY(p.y)} r={p.r} fill={p.color} fillOpacity={0.28} stroke={p.color} strokeWidth={2} />
                <text x={RX(p.x)} y={RY(p.y) - p.r - 6} textAnchor="middle" fill={p.color} fontSize={14} fontWeight={700}>
                  {p.label}
                </text>
              </g>
            ))}
            <text x={RW / 2} y={RH - 8} textAnchor="middle" fill="#9d9da6" fontSize={13}>
              ความผันผวน/ปี →
            </text>
            <text x={12} y={26} fill="#9d9da6" fontSize={13}>
              ↑ ผลตอบแทน/ปี
            </text>
          </svg>
        </div>
        <div className="flex-1 rounded-2xl bg-base-900 border border-base-700 p-5">
          <div className="text-[19px] font-bold text-zinc-300 mb-3">เทียบกันชัดๆ</div>
          <table className="w-full text-[16px]">
            <thead>
              <tr className="text-[14px] text-zinc-500">
                <th className="text-left font-medium pb-2">&nbsp;</th>
                <th className="text-right font-medium pb-2" style={{ color: OLD }}>
                  เดิม
                </th>
                <th className="text-right font-medium pb-2" style={{ color: NEW }}>
                  จัดใหม่
                </th>
              </tr>
            </thead>
            <tbody className="num">
              {rows.map(([k, a, b]) => (
                <tr key={k} className="border-t border-base-800">
                  <td className="py-2 text-zinc-400">{k}</td>
                  <td className="py-2 text-right text-zinc-300">{a}</td>
                  <td className="py-2 text-right font-bold text-zinc-50">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
