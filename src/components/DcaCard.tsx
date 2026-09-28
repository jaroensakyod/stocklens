"use client";

// ⏪ การ์ด "ถ้าลงเดือนละ X฿ เมื่อ N ปีก่อน วันนี้มีเท่าไหร่" 1080×1350 — ฟอร์แมตไวรัลจากตัวเลขจริง
import type { DcaData } from "@/lib/contentCards2";
import type { CardCopy } from "./PortfolioCard";

const baht = (n: number) => Math.round(n).toLocaleString("th-TH");
const mBaht = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)} ล้าน` : baht(n));

export default function DcaCard({ data, copy, cardRef }: { data: DcaData; copy: CardCopy; cardRef?: React.Ref<HTMLDivElement> }) {
  // กราฟมูลค่า vs เงินที่ลง
  const CW = 960;
  const CH = 300;
  const maxV = Math.max(...data.curve.map((c) => c.v), data.investedThb);
  const minV = 0;
  const X = (i: number, len: number) => (i / Math.max(1, len - 1)) * CW;
  const Y = (v: number) => CH - 30 - ((v - minV) / (maxV - minV || 1)) * (CH - 56);
  const line = data.curve.map((c, i) => `${X(i, data.curve.length).toFixed(1)},${Y(c.v).toFixed(1)}`).join(" ");
  const invLine = data.investedCurve.map((c, i) => `${X(i, data.investedCurve.length).toFixed(1)},${Y(c.m).toFixed(1)}`).join(" ");
  const up = data.finalThb >= data.investedThb;

  return (
    <div ref={cardRef} className="w-[1080px] h-[1350px] bg-base-950 text-zinc-100 flex flex-col p-10 font-sans" style={{ fontFamily: '"IBM Plex Sans Thai", sans-serif' }}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center text-zinc-950 font-bold text-2xl">SL</div>
        <div className="flex-1">
          <div className="text-[26px] font-bold text-zinc-50 leading-tight">{copy.headline || `ถ้าลงเดือนละ ฿${baht(data.monthlyThb)} ใน ${data.symbol} ต่อเนื่อง ${data.years} ปี`}</div>
          <div className="text-[21px] text-zinc-300">{copy.sub || `วันนี้จะมีเท่าไหร่ — คำนวณจากราคาจริง ${data.startTh} → ${data.endTh}`}</div>
        </div>
        <div className="text-right text-[18px] text-zinc-400 num">
          StockLens
          <br />
          {data.asOfTh}
        </div>
      </div>

      {/* ตัวเลขใหญ่ 3 กล่อง */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-base-900 border border-base-700 p-4 text-center">
          <div className="text-[15px] text-zinc-500">เงินที่ลงรวม</div>
          <div className="text-[34px] font-bold num text-zinc-100 mt-1">฿{mBaht(data.investedThb)}</div>
          <div className="text-[13px] text-zinc-600 num">{data.years} ปี · เดือนละ ฿{baht(data.monthlyThb)}</div>
        </div>
        <div className="rounded-2xl bg-base-900 border border-base-700 p-4 text-center">
          <div className="text-[15px] text-zinc-500">มูลค่าวันนี้</div>
          <div className={`text-[34px] font-bold num mt-1 ${up ? "text-up" : "text-down"}`}>฿{mBaht(data.finalThb)}</div>
          <div className="text-[13px] text-zinc-600 num">{data.symbol} · {data.name}</div>
        </div>
        <div className={`rounded-2xl p-4 text-center border ${up ? "bg-up/5 border-up/30" : "bg-down/5 border-down/30"}`}>
          <div className="text-[15px] text-zinc-500">ผลต่าง</div>
          <div className={`text-[34px] font-bold num mt-1 ${up ? "text-up" : "text-down"}`}>
            {up ? "+" : ""}฿{mBaht(data.finalThb - data.investedThb)}
          </div>
          <div className={`text-[13px] num ${up ? "text-up" : "text-down"}`}>โตเพิ่ม {data.growthPct >= 0 ? "+" : ""}{data.growthPct.toFixed(1)}%</div>
        </div>
      </div>

      {/* กราฟ */}
      <div className="mt-4 rounded-2xl bg-base-900 border border-base-700 p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[19px] font-bold text-zinc-300">มูลค่าพอร์ตย้อนหลัง {data.years} ปี</div>
          <div className="flex gap-4 text-[15px]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-1 rounded" style={{ background: up ? "#10b981" : "#f43f5e" }} /> มูลค่าพอร์ต
            </span>
            <span className="flex items-center gap-1.5 text-zinc-500">
              <span className="inline-block w-6 h-0.5 border-t border-dashed border-zinc-500" /> เงินที่ลงสะสม
            </span>
          </div>
        </div>
        <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" role="img" aria-label="กราฟมูลค่า DCA">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} y1={CH * f} x2={CW} y2={CH * f} stroke="#27272a" strokeWidth={1} />
          ))}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <text key={f} x={6} y={CH * f - 4} fill="#9d9da6" fontSize={14} className="num">
              {mBaht(minV + (maxV - minV) * f)}
            </text>
          ))}
          <polyline points={invLine} fill="none" stroke="#71717a" strokeWidth={2} strokeDasharray="6 5" />
          <polyline points={line} fill="none" stroke={up ? "#10b981" : "#f43f5e"} strokeWidth={4} strokeLinejoin="round" />
        </svg>
        <div className="flex justify-between text-[14px] text-zinc-500 num mt-1">
          <span>{data.startTh}</span>
          <span>ผลตอบแทนเฉลี่ย {data.xirrPct != null ? `${data.xirrPct.toFixed(1)}%/ปี` : "-"} (XIRR)</span>
          <span>{data.endTh}</span>
        </div>
      </div>

      {/* สมมติฐาน */}
      <div className="mt-4 flex gap-3 text-[16px]">
        {[
          ["ลงเดือนละ", `฿${baht(data.monthlyThb)}`],
          ["ระยะเวลา", `${data.years} ปี`],
          ["ราคาปัจจุบัน", `฿${data.priceThbNow.toLocaleString("th-TH")}`],
          ["ช่วงข้อมูล", `${data.startTh} – ${data.endTh}`],
        ].map(([k, v]) => (
          <div key={k} className="flex-1 rounded-xl bg-base-900 border border-base-700 px-4 py-2.5">
            <div className="text-[13px] text-zinc-500">{k}</div>
            <div className="font-bold num text-zinc-100">{v}</div>
          </div>
        ))}
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
