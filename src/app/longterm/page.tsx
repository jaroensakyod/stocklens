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
  dime: string | null;
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
      {r.dime && <p className="text-[10px] text-zinc-600 mt-1">🪙 {r.dime}</p>}
    </Link>
  );
}
