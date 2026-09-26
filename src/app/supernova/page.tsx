"use client";

import { useEffect, useState } from "react";

// 🛰️ Supernova Monitor — dashboard สัญญาณมหภาค (กรอบสายมหภาค: ยีลด์=เกจความเชื่อมั่น ทอง/ดอลลาร์=ความเชื่อระบบเงิน น้ำมัน/VIX=ภูมิรัฐศาสตร์)
interface Row { id: string; label: string; price: number | null; changePct: number | null; chg5d: number | null }
interface Data {
  updatedAt: number;
  rows: Row[];
  regime: string;
  regimeDetail: string;
  insider: { netBuyers: number; n: number; rows: { symbol: string; netShares: number; buyCount: number; sellCount: number }[] };
  note: string;
}

export default function SupernovaPage() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/supernova")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErr("โหลดสัญญาณไม่สำเร็จ — ลองรีเฟรช"));
  }, []);

  const fmt = (r: Row) => {
    if (r.price === null) return "—";
    if (r.id === "us10y" || r.id === "us02y") return r.price.toFixed(2) + "%";
    return r.price.toLocaleString(undefined, { maximumFractionDigits: r.price > 1000 ? 0 : 2 });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🛰️ Supernova Monitor — สัญญาณมหภาครายวัน</h1>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
          รวมเกจวัดที่นักวิเคราะห์สายมหภาคใช้เป็นแกน: <b className="text-zinc-200">พันธบัตร US 10 ปี</b> (เกจความเชื่อมั่น/ความเสี่ยงสงคราม) ·{" "}
          <b className="text-zinc-200">VIX</b> (ความกลัว) · <b className="text-zinc-200">ทอง vs ดอลลาร์</b> (ความเชื่อในระบบเงินกระดาษ) ·{" "}
          <b className="text-zinc-200">น้ำมัน</b> (ภูมิรัฐศาสตร์) · พร้อมสรุป insider ของหุ้นยักษ์ US
        </p>
      </div>

      {err && <div className="card p-4 text-sm text-down">{err}</div>}
      {!data && !err && <div className="card p-8 text-center text-sm text-zinc-500">กำลังประมวลสัญญาณ… (รอบแรกช้า ~10 วิ)</div>}

      {data && (
        <>
          <div className="card p-5 border border-accent/30">
            <div className="text-xs text-zinc-500 mb-1">สรุปภาพรวม 5 วันล่าสุด</div>
            <div className="text-xl font-bold text-zinc-50">{data.regime}</div>
            <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">{data.regimeDetail}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {data.rows.map((r) => (
              <div key={r.id} className="card p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-zinc-100">{r.label}</div>
                  <div className="num text-lg font-bold text-zinc-50">{fmt(r)}</div>
                </div>
                <div className="text-right">
                  {r.changePct !== null && (
                    <div className={`num text-sm font-semibold ${r.changePct >= 0 ? "text-up" : "text-down"}`}>
                      วันนี้ {r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(2)}%
                    </div>
                  )}
                  {r.chg5d !== null && (
                    <div className={`num text-xs ${r.chg5d >= 0 ? "text-up" : "text-down"}`}>
                      5 วัน {r.chg5d >= 0 ? "+" : ""}{r.chg5d.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-bold text-zinc-100 mb-2">👔 Insider ซื้อ/ขายสุทธิ — หุ้นยักษ์ US ({data.insider.n} ตัว)</h3>
            {data.insider.n > 0 ? (
              <>
                <div className={`num text-2xl font-bold ${data.insider.netBuyers >= data.insider.n / 2 ? "text-up" : "text-down"}`}>
                  {data.insider.netBuyers}/{data.insider.n} <span className="text-xs text-zinc-500 font-normal">ตัวที่ insider ซื้อสุทธิ (6 เดือน)</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {data.insider.rows.map((x) => (
                    <span key={x.symbol} className={`chip num border text-[11px] ${x.netShares >= 0 ? "bg-up/10 text-up border-up/30" : "bg-down/10 text-down border-down/30"}`} title={`ซื้อ ${x.buyCount} ดีล · ขาย ${x.sellCount} ดีล`}>
                      {x.symbol} {x.netShares >= 0 ? "▲" : "▼"} {Math.abs(x.netShares) >= 1e6 ? (Math.abs(x.netShares) / 1e6).toFixed(1) + "M" : (Math.abs(x.netShares) / 1e3).toFixed(0) + "K"}หุ้น
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-500 mt-2">ดีลของผู้บริหารรอบ 6 เดือน — ขายเพื่อกระจายภาษีเป็นเรื่องปกติ ดูแนวโน้มรวมประกอบ</p>
              </>
            ) : (
              <p className="text-xs text-zinc-500">ยังไม่มีข้อมูล insider รอบนี้</p>
            )}
          </div>

          <p className="text-[11px] text-zinc-600">{data.note}</p>
        </>
      )}
    </div>
  );
}
