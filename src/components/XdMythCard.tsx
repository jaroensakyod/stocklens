"use client";

// 📅 การ์ดคอนเทนต์ "ตำนาน XD" 1080×1350 (IG 4:5) — ไขตำนาน "ซื้อก่อน XD รับปันผลฟรี" ด้วยราคาจริงรอบวัน XD
import type { XdMythData } from "@/lib/dividendCard";
import type { CardCopy } from "./PortfolioCard";

const GOLD = "#eab308";
const ROSE = "#f43f5e";
const GREEN = "#10b981";

const thDate = (t: number) => new Date(t * 1000).toLocaleDateString("th-TH", { year: "2-digit", month: "short", day: "numeric" });

export default function XdMythCard({ data, copy, cardRef }: { data: XdMythData; copy: CardCopy; cardRef?: React.Ref<HTMLDivElement> }) {
  // ===== กราฟราคารายวันรอบ XD =====
  const CW = 960;
  const CH = 300;
  const cs = data.chart;
  const maxP = Math.max(...cs.map((c) => c.c), data.refPrice) * 1.01;
  const minP = Math.min(...cs.map((c) => c.c), data.refPrice) * 0.99;
  const X = (i: number) => (i / Math.max(1, cs.length - 1)) * (CW - 90) + 20; // เว้นขวาไว้ใส่ label
  const Y = (v: number) => CH - 34 - ((v - minP) / (maxP - minP || 1)) * (CH - 60);
  const line = cs.map((c, i) => `${X(i).toFixed(1)},${Y(c.c).toFixed(1)}`).join(" ");
  const xdX = X(data.xdIdx);
  const refY = Y(data.refPrice);
  const prevY = Y(data.prevClose);
  const gapOpen = data.prevClose - data.xdOpen;

  const stats: [string, string, string][] = [
    ["ปิดวันก่อน XD", `฿${data.prevClose.toFixed(2)}`, "#e4e4e7"],
    ["ปันผลต่อหุ้น", `฿${data.divPerShare.toFixed(2)}`, GOLD],
    ["ราคาอ้างอิงวัน XD", `฿${data.refPrice.toFixed(2)}`, ROSE],
  ];
  const afters: [string, string, string][] = [
    [
      "เปิดจริงวัน XD",
      `฿${data.xdOpen.toFixed(2)}`,
      data.xdOpen <= data.refPrice ? ROSE : GOLD,
    ],
    [
      `ปิดวัน XD (${(data.xdClose <= data.prevClose ? "" : "+") + (data.xdClose - data.prevClose).toFixed(2)})`,
      `฿${data.xdClose.toFixed(2)}`,
      data.xdClose <= data.prevClose ? ROSE : GREEN,
    ],
    [
      data.close5d != null ? `ปิด ~5 วันหลัง XD (${(data.close5d - data.prevClose >= 0 ? "+" : "") + (data.close5d - data.prevClose).toFixed(2)})` : "ปิด ~5 วันหลัง XD",
      data.close5d != null ? `฿${data.close5d.toFixed(2)}` : "-",
      data.close5d != null && data.close5d - data.prevClose >= 0 ? GREEN : ROSE,
    ],
  ];

  return (
    <div ref={cardRef} className="w-[1080px] h-[1350px] bg-base-950 text-zinc-100 flex flex-col p-10 font-sans" style={{ fontFamily: '"IBM Plex Sans Thai", sans-serif' }}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center text-zinc-950 font-bold text-2xl">SL</div>
        <div className="flex-1">
          <div className="text-[26px] font-bold text-zinc-50 leading-tight">{copy.headline || "ซื้อก่อน XD แล้วรับปันผลฟรี — จริงไหม?"}</div>
          <div className="text-[21px] text-zinc-300">{copy.sub || `เปิดราคาจริงของ ${data.symbol} รอบวัน XD`}</div>
        </div>
        <div className="text-right text-[18px] text-zinc-400 num">
          StockLens
          <br />
          {data.asOfTh}
        </div>
      </div>

      {/* 3 กล่องตั้งต้น */}
      <div className="mt-5 flex gap-3 text-[17px]">
        {stats.map(([k, v, c]) => (
          <div key={k} className="flex-1 rounded-xl bg-base-900 border border-base-700 px-4 py-3">
            <div className="text-[13px] text-zinc-500">{k}</div>
            <div className="text-[24px] font-bold num" style={{ color: c }}>
              {v}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-center text-[16px] text-zinc-400 num">
        ราคาอ้างอิงวัน XD = ปิดวันก่อน − ปันผล → ฿{data.prevClose.toFixed(2)} − ฿{data.divPerShare.toFixed(2)} = ฿{data.refPrice.toFixed(2)}{" "}
        <span className="text-zinc-600">(ตลาด SET ปรับให้อัตโนมัติ ไม่ใช่เรื่องบังเอิญ)</span>
      </div>

      {/* กราฟราคารอบ XD */}
      <div className="mt-4 rounded-2xl bg-base-900 border border-base-700 p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[19px] font-bold text-zinc-300">
            {data.symbol} · ราคารอบวัน XD <span className="text-zinc-500 text-[15px]">({data.name})</span>
          </div>
          <div className="flex gap-4 text-[15px]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-1 rounded bg-zinc-200" /> ราคาหุ้น
            </span>
            <span className="flex items-center gap-1.5" style={{ color: ROSE }}>
              <span className="inline-block w-6 h-0.5 border-t border-dashed" style={{ borderColor: ROSE }} /> ราคาอ้างอิงหลังหักปันผล
            </span>
          </div>
        </div>
        <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" role="img" aria-label="ราคารอบวัน XD">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} y1={CH * f} x2={CW} y2={CH * f} stroke="#27272a" strokeWidth={1} />
          ))}
          {/* แถบเงาระหว่างระดับปิดเดิมกับราคาอ้างอิง = "ปันผลที่ถูกหักออก" */}
          <rect x={xdX} y={refY} width={CW - 90 - xdX + 40} height={Math.max(0, prevY - refY)} fill={ROSE} fillOpacity={0.12} />
          <line x1={xdX} y1={16} x2={xdX} y2={CH - 34} stroke={GOLD} strokeWidth={2} strokeDasharray="7 5" />
          <line x1={xdX} y1={refY} x2={CW - 50} y2={refY} stroke={ROSE} strokeWidth={2} strokeDasharray="6 5" />
          <line x1={20} y1={prevY} x2={xdX} y2={prevY} stroke="#71717a" strokeWidth={1.5} strokeDasharray="4 4" />
          {/* จุดราคาวันก่อน XD / เปิดวัน XD */}
          <circle cx={X(Math.max(0, data.xdIdx - 1))} cy={prevY} r={6} fill="#e4e4e7" />
          <circle cx={xdX} cy={Y(data.xdOpen)} r={7} fill={data.xdOpen <= data.refPrice ? ROSE : GOLD} stroke="#09090b" strokeWidth={2} />
          <polyline points={line} fill="none" stroke="#e4e4e7" strokeWidth={3} strokeLinejoin="round" />
          {/* label */}
          <text x={Math.min(X(Math.max(0, data.xdIdx - 1)), xdX - 10)} y={prevY - 10} textAnchor="end" fill="#d4d4d8" fontSize={15} className="num">
            ปิดก่อน XD ฿{data.prevClose.toFixed(2)}
          </text>
          <text x={CW - 50} y={refY - 10} textAnchor="end" fill={ROSE} fontSize={15} className="num">
            อ้างอิง XD ฿{data.refPrice.toFixed(2)}
          </text>
          <text x={xdX + 8} y={30} fill={GOLD} fontSize={15} fontWeight={700}>
            วัน XD {data.xdTh}
          </text>
          <text x={20} y={CH - 12} fill="#71717a" fontSize={13} className="num">
            {thDate(cs[0]?.t ?? 0)}
          </text>
          <text x={CW / 2} y={CH - 12} textAnchor="middle" fill="#71717a" fontSize={13} className="num">
            {cs.length} วันทำการ
          </text>
          <text x={CW - 50} y={CH - 12} textAnchor="end" fill="#71717a" fontSize={13} className="num">
            {thDate(cs[cs.length - 1]?.t ?? 0)}
          </text>
        </svg>
      </div>

      {/* ผลจริงวันนั้น */}
      <div className="mt-4 flex gap-3 text-[17px]">
        {afters.map(([k, v, c]) => (
          <div key={k} className="flex-1 rounded-xl bg-base-900 border border-base-700 px-4 py-3">
            <div className="text-[13px] text-zinc-500">{k}</div>
            <div className="text-[24px] font-bold num" style={{ color: c }}>
              {v}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-center text-[15px] text-zinc-500 num">
        ส่วนต่างราคาเปิดวัน XD เทียบปิดก่อนหน้า = ฿{gapOpen.toFixed(2)} (บวก = เปิดต่ำลง) · ปันผลที่ผู้ถือก่อน XD ได้รับ = ฿{data.divPerShare.toFixed(2)}
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
