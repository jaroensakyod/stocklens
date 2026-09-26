"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// 🏆 StockLens Score — league table รายวัน (จาก universe ที่ระบบอุ่นและบันทึกจริงทุกวัน)
interface League { at: number; list: { sym: string; t: number }[] }

export default function ScorePage() {
  const [data, setData] = useState<League | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/score-league")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErr("ยังไม่มีข้อมูล league — ระบบจะสะสมหลังรอบ cron รายวันถัดไป"));
  }, []);

  const list = data?.list ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🏆 StockLens Score — อันดับคะแนนวันนี้</h1>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
          คะแนนรวม 0-100 จาก 6 เสา (Quality · Valuation · Momentum · News AI · Street · Safety) — สูตรเปิดเผย คำนวณจากงบจริง ราคา ข่าว และคอนเซนซัสโบรกเกอร์ ·
          ระบบบันทึกคะแนนจริงทุกวันเพื่อสะสม track record ที่ตรวจสอบได้ (ไม่อ้าง backtest ย้อนหลังที่พิสูจน์ไม่ได้)
        </p>
      </div>

      {err && <div className="card p-6 text-sm text-zinc-400">{err}</div>}

      {list.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-4">
            <h3 className="text-sm font-bold text-up mb-2">📈 คะแนนสูงสุด</h3>
            <ul className="space-y-1">
              {list.slice(0, 10).map((x, i) => (
                <li key={x.sym} className="flex items-center justify-between text-sm bg-base-850 rounded px-3 py-1.5">
                  <span className="flex items-center gap-2">
                    <span className="num text-zinc-600 text-xs">{i + 1}</span>
                    <Link href={`/stock/${encodeURIComponent(x.sym)}`} className="font-bold text-zinc-100 hover:text-accent-soft">{x.sym}</Link>
                  </span>
                  <span className={`num font-bold ${x.t >= 68 ? "text-up" : x.t >= 50 ? "text-accent-soft" : "text-down"}`}>{x.t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-bold text-down mb-2">📉 คะแนนต่ำสุด (เฝ้าระวัง)</h3>
            <ul className="space-y-1">
              {list.slice(-10).reverse().map((x, i) => (
                <li key={x.sym} className="flex items-center justify-between text-sm bg-base-850 rounded px-3 py-1.5">
                  <span className="flex items-center gap-2">
                    <span className="num text-zinc-600 text-xs">{i + 1}</span>
                    <Link href={`/stock/${encodeURIComponent(x.sym)}`} className="font-bold text-zinc-100 hover:text-accent-soft">{x.sym}</Link>
                  </span>
                  <span className={`num font-bold ${x.t >= 68 ? "text-up" : x.t >= 50 ? "text-accent-soft" : "text-down"}`}>{x.t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {data && <p className="text-[11px] text-zinc-600">อัปเดตล่าสุด {new Date(data.at).toLocaleString("th-TH")} · ครอบ {list.length} หุ้น (ทยอยขยาย universe รายวัน) · ดูคะแนนฉบับเต็ม 6 เสาที่หน้าหุ้นแต่ละตัว</p>}
      <p className="text-[11px] text-zinc-600">คะแนนเชิงข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน</p>
    </div>
  );
}
