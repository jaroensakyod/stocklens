"use client";

import { useEffect, useState } from "react";

// 📈 ผลตอบแทนย้อนหลังหลายช่วงเวลา + ตำแหน่งเทียบยอด/ก้น 52 สัปดาห์ (จาก TV universe)
interface Row {
  perfW?: number | null; perf1M?: number | null; perf3M?: number | null; perf6M?: number | null;
  perfY?: number | null; perfYTD?: number | null; perf3Y?: number | null; perf5Y?: number | null;
  high52w?: number | null; low52w?: number | null; price: number; relVol?: number | null; volatilityD?: number | null;
}

export default function PerfStrip({ ticker }: { ticker: string }) {
  const [row, setRow] = useState<Row | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/tvrow?s=${encodeURIComponent(ticker)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setRow(j.row))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ticker]);

  if (!row) return null;
  const items: [string, number | null | undefined][] = [
    ["1 สัปดาห์", row.perfW], ["1 เดือน", row.perf1M], ["3 เดือน", row.perf3M], ["6 เดือน", row.perf6M],
    ["YTD", row.perfYTD], ["1 ปี", row.perfY], ["3 ปี", row.perf3Y], ["5 ปี", row.perf5Y],
  ];
  const valid = items.filter(([, v]) => typeof v === "number" && Number.isFinite(v));
  if (!valid.length) return null;

  // ตำแหน่งในกระบอก 52W
  let pos52: number | null = null;
  if (row.high52w && row.low52w && row.high52w > row.low52w && row.price > 0) {
    pos52 = ((row.price - row.low52w) / (row.high52w - row.low52w)) * 100;
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-zinc-100 mb-3">📈 ผลตอบแทนย้อนหลัง</h3>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {items.map(([label, v]) => (
          <div key={label} className="text-center">
            <div className="text-[10px] text-zinc-500">{label}</div>
            <div className={`num text-xs font-semibold ${typeof v === "number" && v >= 0 ? "text-up" : "text-down"}`}>
              {typeof v === "number" ? `${v >= 0 ? "+" : ""}${v.toFixed(0)}%` : "—"}
            </div>
          </div>
        ))}
      </div>
      {pos52 !== null && (
        <div>
          <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
            <span>ก้น 52W</span>
            <span className="num">{pos52.toFixed(0)}% ของช่วง</span>
            <span>ยอด 52W</span>
          </div>
          <div className="h-1.5 rounded-full bg-base-700 relative overflow-hidden">
            <div
              className={`h-full rounded-full ${pos52 >= 70 ? "bg-up" : pos52 >= 30 ? "bg-accent" : "bg-down"}`}
              style={{ width: `${Math.min(100, Math.max(2, pos52))}%` }}
            />
          </div>
        </div>
      )}
      {(row.relVol || row.volatilityD) && (
        <div className="text-[10px] text-zinc-600 mt-2 num">
          {row.relVol ? `วอลุ่มเทียบเฉลี่ย ${row.relVol.toFixed(2)}x` : ""}
          {row.relVol && row.volatilityD ? " · " : ""}
          {row.volatilityD ? `ความผันผวนรายวัน ${row.volatilityD.toFixed(1)}%` : ""}
        </div>
      )}
    </div>
  );
}
