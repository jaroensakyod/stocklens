"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ValueRow } from "@/lib/valueScan";

// 🤿 หุ้นใต้น้ำ (พื้นฐานดี ราคายังต่ำ เริ่มกลับตัว) vs 🎈 หุ้นแพงเกินตัว (ตรงข้าม) — สแกนรายวันจากข้อมูลจริง

interface ApiData {
  asOf: string;
  undervalued: ValueRow[];
  overpriced: ValueRow[];
  scannedCount: number;
  note: string;
}

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

function Row({ r, side }: { r: ValueRow; side: "under" | "over" }) {
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/stock/${r.symbol}`} className={`font-bold hover:underline ${side === "under" ? "text-sky-300" : "text-orange-300"}`}>
          {r.symbol}
        </Link>
        <span className="text-zinc-500 text-xs truncate">{r.name}</span>
        <span className="chip bg-base-800 text-zinc-500 text-[10px]">{r.sector}</span>
        <span className="chip bg-base-800 text-zinc-500 text-[10px]">{r.market === "TH" ? "🇹🇭" : "🇺🇸"}</span>
        <span className={`num text-xs ml-auto ${r.changePct >= 0 ? "text-up" : "text-down"}`}>
          {r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(1)}%
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs num">
        <span className="text-zinc-300">฿{baht(r.priceThb)}</span>
        {r.from52wHighPct !== null && (
          <span className={side === "under" ? "text-sky-400" : "text-orange-400"}>
            จากยอด52w {r.from52wHighPct >= 0 ? "+" : ""}{r.from52wHighPct}%
          </span>
        )}
        {r.rsi !== null && <span className="text-zinc-400">RSI {r.rsi}</span>}
        <span className="text-zinc-400">ปัจจัย {r.overall}/100</span>
        <span className="text-zinc-400">ความแพง {r.valuation}/100</span>
        <span className="text-zinc-400">เทคนิค{r.signal}</span>
      </div>
      <ul className="mt-2 space-y-1">
        {r.reasons.map((x) => (
          <li key={x} className="text-[11px] text-zinc-400 leading-relaxed flex gap-1.5">
            <span className={side === "under" ? "text-sky-400" : "text-orange-400"}>{side === "under" ? "▾" : "▴"}</span>
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ValuePage() {
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    fetch("/api/value")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <section className="text-center pt-4">
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-50">
          🤿 หุ้นใต้น้ำ <span className="text-zinc-500">vs</span> <span className="text-orange-300">🎈 หุ้นแพงเกินตัว</span>
        </h1>
        <p className="text-zinc-400 mt-3 text-sm leading-relaxed max-w-2xl mx-auto">
          สแกนรายวันจากข้อมูลจริง — <b className="text-sky-300">ฝั่งใต้น้ำ</b>: พื้นฐานแข็ง (คะแนนจากงบจริง) ราคาตกจากยอดมาแล้ว แต่สัญญาณเทคนิคเริ่มกลับตัว ·{" "}
          <b className="text-orange-300">ฝั่งแพง</b>: ตรงกันข้าม — ราคาวิ่งแรงจนแพงเทียบงบ และร้อนเกินตัว ระวังไว้ก่อน
        </p>
        {data && (
          <p className="text-[11px] text-zinc-500 mt-2">
            คำนวณล่าสุด {data.asOf} · สแกนแล้ว {data.scannedCount} ตัว · เรียงใหม่ทุก 30 นาที
          </p>
        )}
      </section>

      {!data && (
        <div className="card p-10 text-center text-zinc-500 text-sm animate-pulse">กำลังสแกนหุ้นใต้น้ำ/แพงเกินตัวจากข้อมูลจริง… (รอบแรก ~1 นาที)</div>
      )}

      {data && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* 🤿 ใต้น้ำ */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-bold text-sky-300">🤿 ใต้น้ำ — พื้นฐานดี ราคายังต่ำ เริ่มพร้อมขึ้น</h2>
              <span className="chip bg-sky-500/10 text-sky-400 text-[10px]">{data.undervalued.length} ตัว</span>
            </div>
            <div className="space-y-3">
              {data.undervalued.length ? (
                data.undervalued.map((r) => <Row key={r.symbol} r={r} side="under" />)
              ) : (
                <div className="card p-6 text-center text-xs text-zinc-500">วันนี้ไม่มีตัวไหนผ่านเกณฑ์ครบทั้ง 4 ข้อ (ตกลึก+งบดี+ยังถูก+สัญญาณกลับตัว) — ตลาดขาขึ้นแรงก็เป็นได้ กลับมาดูใหม่รอบหน้า</div>
              )}
            </div>
          </section>

          {/* 🎈 แพงเกินตัว */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-bold text-orange-300">🎈 แพงเกินตัว — วิ่งแรง แพงเทียบงบ ร้อนเกิน</h2>
              <span className="chip bg-orange-500/10 text-orange-400 text-[10px]">{data.overpriced.length} ตัว</span>
            </div>
            <div className="space-y-3">
              {data.overpriced.length ? (
                data.overpriced.map((r) => <Row key={r.symbol} r={r} side="over" />)
              ) : (
                <div className="card p-6 text-center text-xs text-zinc-500">วันนี้ไม่มีตัวไหน "แพง+ร้อน" พร้อมกัน — ดีๆ นี่ แต่ระวังว่าเกณฑ์เข้ม: ต้องแพงตามงบ AND ร้อนตามเทคนิคพร้อมกัน</div>
              )}
            </div>
          </section>
        </div>
      )}

      {data && (
        <div className="card p-4">
          <h3 className="text-xs font-bold text-zinc-400 mb-2">📏 เกณฑ์ที่ใช้ (โปร่งใส ตรวจสอบได้)</h3>
          <p className="text-[11px] text-zinc-500 leading-relaxed">{data.note}</p>
          <p className="text-[11px] text-zinc-500 leading-relaxed mt-2">
            💡 ใช้คู่กับ <Link href="/surge" className="text-accent-soft underline">เรดาร์หุ้นซิ่ง</Link> (ดูแรงซื้อ) และ <Link href="/screener" className="text-accent-soft underline">ตัวคัดกรอง</Link> · สงสัยตัวไหนถามผู้ช่วย AI (💬) ได้เลย เช่น &ldquo;NVDA ตอนนี้แพงไปไหม&rdquo;
          </p>
        </div>
      )}

      <p className="text-[11px] text-zinc-500 leading-relaxed border-t border-base-700/60 pt-4">
        ⚠️ เชิงข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน — &ldquo;ใต้น้ำ&rdquo; ไม่ได้แปลว่าจะขึ้นเสมอ (อาจจมต่อ ถ้าปัจจัยพลิก) และ &ldquo;แพง&rdquo; ไม่ได้แปลว่าจะลง (ของดีแพงได้นาน) — ใช้เป็นจุดเริ่มวิเคราะห์ กดดูข้อมูลเต็มของแต่ละตัวก่อนเสมอ
      </p>
    </div>
  );
}
