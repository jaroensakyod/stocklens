"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import LockGate from "@/components/LockGate";
import type { Quote } from "@/lib/types";

interface SurgeRow {
  ticker: string;
  name: string;
  sector: string;
  market: string;
  price: number;
  currency: string;
  changePct: number;
  volRatio: number | null;
  pctFrom52wHigh: number | null;
  premarketPct: number | null;
  marketCapB: number;
  flags: string[];
  surgeScore: number;
  dime: string | null;
}

// 🚀 เรดาร์หุ้นซิ่ง — ขยับแรง + วอลุ่มพุ่ง + ใกล้/ทะลุจุดสูงสุด 52 สัปดาห์ (ทั้งหมดจากข้อมูลจริง)
// หุ้นซิ่ง = ความเสี่ยงสูง หน้านี้เป็น "สื่อแสดงข้อมูล" ไม่ใช่คำแนะนำให้ซื้อตาม
export default function SurgePage() {
  const { tier } = useAuth();
  const [rows, setRows] = useState<SurgeRow[] | null>(null);
  const [asOf, setAsOf] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/surge")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setErr(j.error);
        else {
          setRows(j.rows ?? []);
          setAsOf(j.asOf ?? "");
        }
      })
      .catch(() => setErr("โหลดไม่สำเร็จ — ลองใหม่"));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🚀 เรดาร์หุ้นซิ่ง</h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-3xl leading-relaxed">
          หุ้นที่ขยับแรงวันนี้ (≥3%) พร้อมหลักฐาน 3 ชั้นจากข้อมูลจริง: <span className="text-zinc-200">วอลุ่มวันนี้มากกว่าเฉลี่ย 20 วันก่อนกี่เท่า</span> (มีเงินจริงเข้าหรือเด้งเฉยๆ) ·{" "}
          <span className="text-zinc-200">ระยะจากจุดสูงสุด 52 สัปดาห์</span> (ทะลุ = breakout) · พรีมาร์เก็ต — ทั้งสหรัฐฯและไทย อัปเดตทุก 10 นาที {asOf && <span className="text-zinc-600">(ข้อมูลล่าสุด {asOf})</span>}
        </p>
      </div>

      {err && <div className="card p-6 text-sm text-down">{err}</div>}
      {!rows && !err && (
        <div className="card p-12 text-center text-sm text-zinc-500">กำลังสแกนตลาดสหรัฐฯ+ไทย หาหุ้นที่ขยับพร้อมวอลุ่มจริง… (~20-40 วินาทีครั้งแรก)</div>
      )}

      {rows && rows.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-3xl mb-2">😴</p>
          <p className="text-zinc-300 font-semibold">วันนี้ยังไม่มีหุ้นที่ผ่านเกณฑ์ "ซิ่งแบบมีหลักฐาน"</p>
          <p className="text-xs text-zinc-500 mt-1">ต้องขยับ ≥3% พร้อมวอลุ่ม/ตำแหน่งกราฟที่ยืนยันได้ — ลองกลับมาดูใหม่ภายหลัง หรือดู Daily Picks หุ้นงบแข็งแรงแทน</p>
          <Link href="/" className="btn-ghost text-xs mt-3 inline-block">🎯 ไปดู Daily Picks</Link>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {(tier === "free" ? rows.slice(0, 3) : rows).map((r, i) => (
            <Link key={r.ticker} href={`/stock/${r.ticker}`} className="card p-4 hover:border-accent/40 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-zinc-50">
                    {r.market} {r.ticker} <span className="text-xs text-zinc-500 font-normal">· {r.sector}</span>
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate">{r.name}</p>
                </div>
                <span className="chip bg-down/10 text-down shrink-0">#{i + 1} คะแนน {r.surgeScore}</span>
              </div>

              <div className="flex items-baseline gap-2 mt-2">
                <span className="num text-lg font-bold text-zinc-50">{r.price.toFixed(2)}</span>
                <span className="text-[10px] text-zinc-600">{r.currency}</span>
                <span className="num text-sm font-bold text-up">+{r.changePct.toFixed(1)}%</span>
                {r.premarketPct !== null && r.premarketPct >= 3 && <span className="text-[10px] text-zinc-500">🌅 พรี +{r.premarketPct.toFixed(1)}%</span>}
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {r.volRatio && <span className={`chip text-[10px] ${r.volRatio >= 3 ? "bg-up/15 text-up" : "bg-zinc-500/15 text-zinc-300"}`}>💨 วอลุ่ม x{r.volRatio}</span>}
                {r.pctFrom52wHigh !== null && (
                  <span className={`chip text-[10px] ${r.pctFrom52wHigh >= -5 ? "bg-accent/15 text-accent-soft" : "bg-zinc-500/15 text-zinc-400"}`}>
                    {r.pctFrom52wHigh >= 0 ? "🏆 ทะลุ 52w" : `จากยอด 52w: ${r.pctFrom52wHigh.toFixed(1)}%`}
                  </span>
                )}
                <span className="chip bg-zinc-500/15 text-zinc-400 text-[10px]">mcap {r.marketCapB}B</span>
              </div>

              {r.flags.length > 0 && <p className="text-[11px] text-zinc-400 mt-1.5">{r.flags.join(" · ")}</p>}
              {r.dime && <p className="text-[10px] text-zinc-600 mt-1">🪙 {r.dime}</p>}
            </Link>
          ))}
        </div>
      )}
      {tier === "free" && rows && rows.length > 3 && (
        <LockGate need="starter" title={`ยังมีอีก ${rows.length - 3} ตัวที่ผ่านเกณฑ์ซิ่งพร้อมหลักฐาน`} desc="ดูครบทั้งหมด + คะแนนซิ่ง + วอลุ่ม vs เฉลี่ย 20 วัน — สิทธิ์สมาชิก Starter/Pro" />
      )}

      <div className="card p-4 border-amber-500/30">
        <h2 className="text-sm font-bold text-amber-400 mb-1">⚠️ อ่านก่อนใช้ — หุ้นซิ่งเสี่ยงที่สุดในตลาด</h2>
        <ul className="text-xs text-zinc-400 space-y-1 list-disc ml-4 leading-relaxed">
          <li>หน้านี้แสดง <span className="text-zinc-200">สัญญาณจากข้อมูลราคา/วอลุ่มจริง</span> เท่านั้น — ไม่ได้ดูข่าว ไม่ได้ดูงบ และไม่ใช่คำแนะนำให้ซื้อตาม</li>
          <li>หุ้นที่ขยับแรงพร้อมวอลุ่มพุ่ง อาจเป็นทั้ง "จุดเริ่ม trend" หรือ "ปั๊มแล้วทิ้ง" — ใช้ Trust panel และบทวิเคราะห์ AI ในหน้าหุ้นประกอบก่อนเสมอ</li>
          <li>กติกาบริหารความเสี่ยงที่โลกใช้กัน: ไม่ใช้เงินที่เสียแล้วเดือดร้อน และกำหนดจุดตัดขาดทุนก่อนเข้าเสมอ</li>
          <li>ราคา delay ~15 นาที วอลุ่มของวันที่ยังไม่ปิดตลาดคือวอลุ่มสะสมถึงขณะนั้น (ยิ่งใกล้ปิด ยิ่งแม่น)</li>
        </ul>
      </div>
    </div>
  );
}
