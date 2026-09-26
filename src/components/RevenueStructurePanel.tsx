"use client";

import { useEffect, useState } from "react";

// 🏢 โครงสร้างรายได้ (Revenue Structure) — แยกตามธุรกิจ + ภูมิภาค จาก 10-K จริงผ่าน EDGAR (US)
interface SegTable {
  years: string[];
  rows: { name: string; values: (number | null)[]; isTotal?: boolean }[];
}
interface Data {
  available: boolean;
  filedAt: string;
  byBusiness?: SegTable;
  byRegion?: SegTable;
}

const fmtB = (v: number) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + "B$" : v.toFixed(0) + "M$");

function Bars({ t }: { t: SegTable }) {
  const yearIdx = 0; // ปีล่าสุด
  const total = t.rows.find((r) => r.isTotal)?.values[yearIdx] ?? null;
  const items = t.rows.filter((r) => !r.isTotal && r.values[yearIdx] !== null);
  const sum = total ?? items.reduce((a, r) => a + Math.abs(r.values[yearIdx] ?? 0), 0);
  return (
    <div className="space-y-1.5">
      {items.map((r) => {
        const v = r.values[yearIdx] ?? 0;
        const pct = sum ? Math.round((Math.abs(v) / sum) * 100) : 0;
        const w = sum ? Math.max(2, Math.min(100, (Math.abs(v) / sum) * 100)) : 0;
        return (
          <div key={r.name}>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="text-zinc-300 truncate mr-2">{r.name}</span>
              <span className="num text-zinc-400 shrink-0">
                {fmtB(v)} · {pct}%
              </span>
            </div>
            <div className="h-2 bg-base-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${v >= 0 ? "bg-accent" : "bg-down"}`} style={{ width: w + "%" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RevenueStructurePanel({ ticker }: { ticker: string }) {
  const isUS = /^[A-Z]{1,5}$/.test(ticker);
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "none">("loading");

  useEffect(() => {
    if (!isUS) return;
    let alive = true;
    setState("loading");
    fetch(`/api/revenue-structure?s=${encodeURIComponent(ticker)}`)
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
  }, [ticker, isUS]);

  if (!isUS || state === "loading") return null;
  if (state === "none" || !data?.available) return null;
  const t = data.byBusiness ?? data.byRegion;

  return (
    <div className="card p-5 mt-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-zinc-100">🏢 โครงสร้างรายได้ (Revenue Structure)</h3>
        <span className="chip bg-up/10 text-up border border-up/30 num">✓ ยืนยันด้วย SEC 10-K{data.filedAt ? ` (${data.filedAt.slice(0, 4)}/${Number(data.filedAt.slice(5, 7)) + ")"}` : ""}</span>
      </div>
      {t && <p className="text-[11px] text-zinc-500 mb-3">งวดบัญชีล่าสุด {t.years[0]} · หน่วย: ล้านดอลลาร์ · จากตาราง segment ใน 10-K จริง</p>}
      <div className="grid md:grid-cols-2 gap-6">
        {data.byBusiness && (
          <div>
            <div className="text-[11px] text-zinc-500 mb-2">แยกตามธุรกิจ/ผลิตภัณฑ์</div>
            <Bars t={data.byBusiness} />
          </div>
        )}
        {data.byRegion && (
          <div>
            <div className="text-[11px] text-zinc-500 mb-2">แยกตามภูมิภาค</div>
            <Bars t={data.byRegion} />
          </div>
        )}
      </div>
      <p className="text-[10px] text-zinc-600 mt-3">
        หุ้นไทย: ข้อมูลแยกธุรกิจอยู่ในแบบ 56-1 One Report ของแต่ละบริษัท — StockLens กำลังเพิ่มคลังฉบับภาษาไทยของหุ้น SET หลักทีละตัว
      </p>
    </div>
  );
}
