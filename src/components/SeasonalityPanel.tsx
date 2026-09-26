"use client";

import { useEffect, useState } from "react";

// 🌦️ Seasonality — ผลตอบแทนรายเดือน/ไตรมาส ย้อนหลัง 5 ปี (แบบ "Seasons Change" ของ StockRadars)
// ตาราง heatmap: แถว=ปี คอลัมน์=เดือน + แถวสรุปเฉลี่ย/อัตราชนะ — คำนวณจากกราฟราคาจริงรายเดือน
const MONTH_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

interface Data {
  symbol: string;
  years: number[];
  monthly: { year: number; months: (number | null)[] }[];
  avg: (number | null)[];
  posRate: (number | null)[];
  qAvg: (number | null)[];
  bestMonth: { m: number; avg: number } | null;
  worstMonth: { m: number; avg: number } | null;
  sampleYears: number;
}

function cell(v: number | null) {
  if (v === null) return { bg: "transparent", text: "text-zinc-700" };
  const abs = Math.min(Math.abs(v), 10) / 10; // สีเข้มสุดที่ ±10%
  const bg = v >= 0 ? `rgba(34,197,94,${0.08 + abs * 0.45})` : `rgba(239,68,68,${0.08 + abs * 0.45})`;
  return { bg, text: v >= 0 ? "text-up" : "text-down" };
}

export default function SeasonalityPanel({ ticker }: { ticker: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "none">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch(`/api/seasonality?s=${encodeURIComponent(ticker)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        if (!alive) return;
        setData(j);
        setState("ok");
      })
      .catch(() => alive && setState("none"));
    return () => {
      alive = false;
    };
  }, [ticker]);

  if (state === "loading") return <div className="card p-5 mt-6 text-xs text-zinc-500">🌦️ กำลังคำนวณฤดูกาลรายเดือน…</div>;
  if (state === "none" || !data) return null;

  return (
    <div className="card p-5 mt-6">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-zinc-100">🌦️ ฤดูกาลรายเดือน (Seasonality)</h3>
        <div className="flex gap-2 flex-wrap">
          {data.bestMonth && (
            <span className="chip bg-up/10 text-up border border-up/30 num">
              ดีสุด {MONTH_TH[data.bestMonth.m]} เฉลี่ย +{data.bestMonth.avg}%
            </span>
          )}
          {data.worstMonth && (
            <span className="chip bg-down/10 text-down border border-down/30 num">
              แย่สุด {MONTH_TH[data.worstMonth.m]} เฉลี่ย {data.worstMonth.avg}%
            </span>
          )}
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 mb-3">
        ผลตอบแทนรายเดือนย้อนหลัง {data.sampleYears} ปี จากราคาจริง — อดีตไม่การันตีอนาคต ใช้ประกอบการวางแผนจังหวะเข้า-ออกเท่านั้น
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] num border-separate border-spacing-0.5 min-w-[640px]">
          <thead>
            <tr>
              <th className="text-left text-zinc-500 font-normal pr-2">ปี</th>
              {MONTH_TH.map((m) => (
                <th key={m} className="text-zinc-500 font-normal">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.monthly.map((row) => (
              <tr key={row.year}>
                <td className="text-zinc-400 pr-2">{row.year}</td>
                {row.months.map((v, i) => {
                  const c = cell(v);
                  return (
                    <td key={i} className="text-center rounded px-1 py-1" style={{ background: c.bg }} title={v === null ? "ไม่มีข้อมูล" : `${MONTH_TH[i]} ${row.year}: ${v > 0 ? "+" : ""}${v}%`}>
                      <span className={c.text}>{v === null ? "—" : v > 0 ? `+${v}` : `${v}`}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="text-zinc-300 pr-2 pt-2 font-semibold">เฉลี่ย</td>
              {data.avg.map((v, i) => {
                const c = cell(v);
                return (
                  <td key={i} className="text-center rounded px-1 py-1 font-semibold" style={{ background: c.bg }} title={v === null ? "—" : `${MONTH_TH[i]} เฉลี่ย ${v}% บวก ${data.posRate[i]}% ของปี`}>
                    <span className={c.text}>{v === null ? "—" : v > 0 ? `+${v}` : `${v}`}</span>
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="text-zinc-500 pr-2">อัตราบวก</td>
              {data.posRate.map((v, i) => (
                <td key={i} className="text-center text-zinc-500" title={`% ของปีที่ ${MONTH_TH[i]} ปิดบวก`}>
                  {v === null ? "—" : `${v}%`}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {data.qAvg.map((v, q) => (
          <span key={q} className={`chip num border ${v === null ? "text-zinc-500 border-base-700" : v >= 0 ? "bg-up/10 text-up border-up/30" : "bg-down/10 text-down border-down/30"}`}>
            Q{q + 1} {v === null ? "—" : v > 0 ? `+${v}%` : `${v}%`}
          </span>
        ))}
      </div>
    </div>
  );
}
