"use client";

import { useEffect, useState } from "react";

// 🎯 คอนเซนซัสนักวิเคราะห์ — "โบรกเกอร์ 19 สำนักเฉลี่ย ฿42 เทียบราคา 38 = +10%" (ไทย+US)
interface Data {
  available: boolean;
  strongBuy: number; buy: number; hold: number; sell: number; strongSell: number;
  targetMean: number | null; targetHigh: number | null; targetLow: number | null;
  nAnalysts: number; nextEarnings: string | null;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
};

export default function AnalystPanel({ ticker, price }: { ticker: string; price: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "none">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch(`/api/analyst?s=${encodeURIComponent(ticker)}`)
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

  if (state !== "ok" || !data?.available || !data.nAnalysts) return null;
  const isThai = ticker.endsWith(".BK");
  const unit = isThai ? "฿" : "$";
  const total = data.strongBuy + data.buy + data.hold + data.sell + data.strongSell || 1;
  const pct = (n: number) => Math.round((n / total) * 100);
  const upside = data.targetMean && price > 0 ? ((data.targetMean / price - 1) * 100) : null;

  return (
    <div className="card p-5 mt-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-zinc-100">🎯 คอนเซนซัสนักวิเคราะห์ ({isThai ? "โบรกเกอร์ไทย" : "นักวิเคราะห์"} {data.nAnalysts} สำนัก)</h3>
        {upside !== null && (
          <span className={`chip num border ${upside >= 0 ? "bg-up/10 text-up border-up/30" : "bg-down/10 text-down border-down/30"}`}>
            เป้าเฉลี่ย {unit}{data.targetMean?.toFixed(2)} ({upside >= 0 ? "+" : ""}{upside.toFixed(1)}% จากราคาตอนนี้)
          </span>
        )}
      </div>

      {/* แท่งกระจายความเห็น */}
      <div className="flex h-7 rounded-lg overflow-hidden text-[10px] font-bold num">
        {[
          ["ซื้อมาก", data.strongBuy, "bg-up"],
          ["ซื้อ", data.buy, "bg-up/70"],
          ["ถือ", data.hold, "bg-base-600"],
          ["ขาย", data.sell, "bg-down/70"],
          ["ขายมาก", data.strongSell, "bg-down"],
        ].map(([label, n, bg]) => {
          const v = n as number;
          if (!v) return null;
          return (
            <div key={label as string} className={`${bg} flex items-center justify-center text-zinc-950`} style={{ width: pct(v) + "%" }} title={`${label}: ${v} สำนัก`}>
              {pct(v) >= 8 ? `${v}` : ""}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
        <span>ซื้อ {data.strongBuy + data.buy} สำนัก</span>
        <span>ถือ {data.hold} สำนัก</span>
        <span>ขาย {data.sell + data.strongSell} สำนัก</span>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {data.targetLow !== null && data.targetHigh !== null && (
          <span className="chip bg-base-800 text-zinc-400 border border-base-700 num">ช่วงเป้า {unit}{data.targetLow.toFixed(2)}–{unit}{data.targetHigh.toFixed(2)}</span>
        )}
        {data.nextEarnings && (
          <span className="chip bg-accent/10 text-accent-soft border border-accent/30 num">📅 งบถัดไป ~{fmtDate(data.nextEarnings)}</span>
        )}
      </div>
      <p className="text-[10px] text-zinc-600 mt-2">คอนเซนซัสจากข้อมูลสาธารณะ (Yahoo Finance) — ค่าเฉลี่ยของฉันทามติโบรกเกอร์ ไม่ใช่คำแนะนำของ StockLens</p>
    </div>
  );
}
