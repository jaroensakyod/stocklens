"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import LockGate from "@/components/LockGate";

interface LTRow {
  ticker: string;
  name: string;
  market: string;
  price: number;
  currency: string;
  yieldPct: number | null;
  pe: number | null;
  roePct: number | null;
  de: number | null;
  health: number | null;
  ret5yPct: number | null;
  cagr5yPct: number | null;
  score: number;
  note: string;
}

interface LTData {
  dividends: LTRow[];
  compounders: LTRow[];
  asOf: string;
  note: string;
}

// 💤 หุ้นระยะยาว & ปันผล — สำหรับคนที่ไม่ได้เล่นซิ่ง: ถือยาว กินปันผล งบแข็ง
export default function LongTermPage() {
  const { tier } = useAuth();
  const [data, setData] = useState<LTData | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/longterm")
      .then((r) => r.json())
      .then((j) => (j.error ? setErr(j.error) : setData(j)))
      .catch(() => setErr("โหลดไม่สำเร็จ"));
  }, []);

  if (tier === "free")
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">💤 หุ้นระยะยาว &amp; ปันผล</h1>
          <p className="text-sm text-zinc-400 mt-1">ลิสต์หุ้นใหญ่นิ่ง ปันผลสม่ำเสมอ งบแข็ง — สิทธิ์สมาชิก</p>
        </div>
        <LockGate need="starter" title="ลิสต์ปันผลน่าถือ + โตสะสม 5 ปี" />
      </div>
    );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">💤 หุ้นระยะยาว &amp; ปันผล</h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-3xl leading-relaxed">
          สำหรับคนที่ไม่ได้เล่นซิ่ง — คัดหุ้น<b className="text-zinc-200">ใหญ่นิ่ง จ่ายปันผลสม่ำเสมอ งบแข็งแรง</b> พร้อมผลตอบแทนย้อนหลัง 5 ปีจริงจากกราฟราคา ·
          ทุกตัวกดเข้าไปดูบทวิเคราะห์เต็ม (สถานการณ์ Bull/Base/Bear + AI) ได้เลย {data?.asOf && <span className="text-zinc-600">(ข้อมูล {data.asOf})</span>}
        </p>
      </div>

      {err && <div className="card p-6 text-sm text-down">{err}</div>}
      {!data && !err && <div className="card p-12 text-center text-sm text-zinc-500">กำลังไล่ตรวจงบการเงินหุ้นใหญ่ ~30 ตัว (ครั้งแรก ~40-60 วินาที)…</div>}

      {data && (
        <>
          {/* 💰 สายปันผล */}
          <section>
            <h2 className="text-sm font-bold text-zinc-400 mb-3">💰 สายปันผล — ถือเก็บเงินทุกปี งบต้องแข็งด้วย</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {data.dividends.map((r, i) => (
                <Card key={r.ticker} r={r} rank={i + 1} kind="div" />
              ))}
              {data.dividends.length === 0 && <p className="text-xs text-zinc-500">ไม่มีตัวผ่านเกณฑ์ (yield ≥2% + Health ≥50)</p>}
            </div>
          </section>

          {/* 🌱 สายโตสะสม */}
          <section>
            <h2 className="text-sm font-bold text-zinc-400 mb-3">🌱 สายโตสะสม — ราคาโตเฉลี่ย ≥12%/ปีต่อเนื่อง 5 ปี</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {data.compounders.map((r, i) => (
                <Card key={r.ticker} r={r} rank={i + 1} kind="growth" />
              ))}
              {data.compounders.length === 0 && <p className="text-xs text-zinc-500">ไม่มีตัวผ่านเกณฑ์ในกลุ่มที่สแกน</p>}
            </div>
          </section>

          {/* เกณฑ์เทียบ 100 ปี (CFA/Ibbotson 1926-2025) */}
          <section className="card p-4">
            <h2 className="text-sm font-bold text-zinc-100 mb-1">📊 เกณฑ์เทียบ 100 ปี — หุ้นที่คุณเลือกต้องเอาชนะสิ่งนี้ก่อน</h2>
            <p className="text-[11px] text-zinc-500 mb-3">ผลตอบแทนทับต้นต่อปี 1926-2025 (สหรัฐฯ) · CFA Institute — Ibbotson &quot;Exponential Wealth&quot; 2026 · ≈ = ค่าประมาณจากชุด SBBI มาตรฐาน</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-[10px] text-zinc-500 uppercase border-b border-base-700">
                  <th className="px-2 py-1.5 text-left">สินทรัพย์</th><th className="px-2 py-1.5 text-right">ต่อปี</th>
                  <th className="px-2 py-1.5 text-right">แท้จริง (หักเงินเฟ้อ)</th><th className="px-2 py-1.5 text-right">$1 ทบ 100 ปี</th><th className="px-2 py-1.5 text-right">ผันผวน</th>
                </tr></thead>
                <tbody>
                  <tr className="border-b border-base-800"><td className="px-2 py-1.5">🦅 หุ้นใหญ่สหรัฐฯ</td><td className="px-2 py-1.5 text-right num font-bold text-up">10.1%</td><td className="px-2 py-1.5 text-right num text-up">6.9%</td><td className="px-2 py-1.5 text-right num">~$16,600</td><td className="px-2 py-1.5 text-right num text-zinc-400">18.9%</td></tr>
                  <tr className="border-b border-base-800"><td className="px-2 py-1.5">🐭 หุ้นเล็ก ≈</td><td className="px-2 py-1.5 text-right num font-bold text-up">11.9%</td><td className="px-2 py-1.5 text-right num text-up">8.6%</td><td className="px-2 py-1.5 text-right num">~$70,000</td><td className="px-2 py-1.5 text-right num text-zinc-400">~32%</td></tr>
                  <tr className="border-b border-base-800"><td className="px-2 py-1.5">🏛️ พันธบัตรรัฐยาว</td><td className="px-2 py-1.5 text-right num text-zinc-300">4.9%</td><td className="px-2 py-1.5 text-right num text-zinc-300">1.9%</td><td className="px-2 py-1.5 text-right num">~$117</td><td className="px-2 py-1.5 text-right num text-zinc-400">กลาง</td></tr>
                  <tr className="border-b border-base-800"><td className="px-2 py-1.5">💵 เงินสด/T-Bills</td><td className="px-2 py-1.5 text-right num text-zinc-400">3.3%</td><td className="px-2 py-1.5 text-right num text-down">0.3%</td><td className="px-2 py-1.5 text-right num">~$25</td><td className="px-2 py-1.5 text-right num text-zinc-400">ต่ำ</td></tr>
                  <tr><td className="px-2 py-1.5">🔥 เงินเฟ้อ</td><td className="px-2 py-1.5 text-right num text-zinc-400">~3.0%</td><td className="px-2 py-1.5 text-right num text-zinc-500">—</td><td className="px-2 py-1.5 text-right num text-zinc-500">$1 เหลือกำลังซื้อ ~5¢</td><td className="px-2 py-1.5 text-right"></td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
              อ่านคู่กับ &quot;กฎ 97%&quot;: หุ้นใหญ่ 10.1%/ปี เหลือ 6.17% ถ้าไม่ reinvest ปันผล · พันธบัตรยาวโตแรงช่วง 1981-2021 เพราะดอกเบี้ยลง 40 ปี (Bond Mountain) — รอบหน้าต้องดู yield เริ่มต้น · ช่วงเจ็บที่ต้องรอด: 1929 (-84~89%, 25 ปีฟื้น) · ดอตคอม -49% · GFC -57%
            </p>
          </section>

          <div className="card p-4 border-amber-500/25">
            <h3 className="text-sm font-bold text-amber-400 mb-1">📌 วิธีอ่านสำหรับมือใหม่ถือยาว</h3>
            <ul className="text-xs text-zinc-400 space-y-1 list-disc ml-4 leading-relaxed">
              <li><span className="text-zinc-200">"ปันผล ~X%/ปี"</span> = ถือหุ้นมูลค่า 100,000฿ จะได้เงินปันผลราว X,000฿/ปี (ประมาณการจากอดีต — บริษัทลด/เพิ่มได้)</li>
              <li><span className="text-zinc-200">Health</span> = คะแนนความแข็งแรงของงบจาก filings จริง — สายปันผลควรดูเป็นพิเศษ เพราะปันผลที่จ่ายไม่ไหวถ้างบอ่อน</li>
              <li><span className="text-zinc-200">ราคา 5 ปี</span> คือผลตอบแทนจากราคาหุ้นเท่านั้น — สายปันผลตัวจริงยังได้เพิ่มจากเงินปันผลทุกปี</li>
              <li>หุ้นระยะยาววัดกันที่ปี ไม่ใช่วัน — อย่าตกใจกับขึ้นลงรายวัน แต่ทบทวนเหตุผลการถือทุกไตรมาสตอนงบออก</li>
            </ul>
          </div>

          <p className="text-[10px] text-zinc-600 leading-relaxed">⚠️ {data.note}</p>
        </>
      )}
    </div>
  );
}

function Card({ r, rank, kind }: { r: LTRow; rank: number; kind: "div" | "growth" }) {
  return (
    <Link href={`/stock/${r.ticker}`} className="card p-4 hover:border-accent/40 transition-colors block">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-zinc-50">
            {r.market} {r.ticker} <span className="text-xs text-zinc-500 font-normal truncate">{r.name}</span>
          </p>
          <p className="num text-sm text-zinc-300 mt-0.5">
            {r.price.toFixed(2)} {r.currency}
          </p>
        </div>
        <span className={`chip shrink-0 ${kind === "div" ? "bg-up/10 text-up border border-up/30" : "bg-accent/10 text-accent-soft border border-accent/30"}`}>
          #{rank} {kind === "div" ? (r.yieldPct ? `${r.yieldPct.toFixed(1)}%/ปี` : "") : r.cagr5yPct ? `โตเฉลี่ย ${r.cagr5yPct.toFixed(0)}%/ปี` : ""}
        </span>
      </div>
      <p className="text-[11px] text-zinc-400 mt-2 leading-snug">{r.note}</p>
    </Link>
  );
}
