"use client";

import { useEffect, useState } from "react";
import { useCan } from "@/lib/authContext";
import LockGate from "@/components/LockGate";

// 🏆 StockLens Score — คะแนนรวม 6 เสา สูตรเปิดเผย (free: คะแนนรวม+confidence · Starter+: เสา+เหตุผล+ประวัติ)
interface Pillars { quality: number | null; valuation: number | null; momentum: number | null; news: number | null; street: number | null; safety: number | null }
interface Data {
  available: boolean; symbol: string; total: number; grade: string; confidence: number; updatedAt: number;
  pillars?: Pillars; reasons?: string[]; risks?: string[]; history?: { d: string; t: number }[]; locked?: boolean;
}

const PILLARS: { k: keyof Pillars; label: string; icon: string }[] = [
  { k: "quality", label: "Quality — คุณภาพธุรกิจ", icon: "🏗️" },
  { k: "valuation", label: "Valuation — ราคาคุ้มค่า", icon: "💰" },
  { k: "momentum", label: "Momentum — โมเมนตัม", icon: "🚀" },
  { k: "news", label: "News AI — ข่าว (Jev)", icon: "📰" },
  { k: "street", label: "Street — คอนเซนซัสโบรกฯ", icon: "🎯" },
  { k: "safety", label: "Safety — ความเสี่ยงต่ำ", icon: "🛡️" },
];

export default function ScorePanel({ ticker }: { ticker: string }) {
  const can = useCan();
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "none">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch(`/api/score?s=${encodeURIComponent(ticker)}`)
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

  if (state === "loading") return <div className="card p-5"><div className="text-sm text-zinc-500">🏆 กำลังคำนวณ StockLens Score…</div></div>;
  if (state === "none" || !data?.available) return null;

  const color = data.total >= 68 ? "text-up" : data.total >= 50 ? "text-accent-soft" : "text-down";
  const ring = data.total >= 68 ? "#22c55e" : data.total >= 50 ? "#eab308" : "#ef4444";
  const circ = 2 * Math.PI * 44;
  const locked = data.locked === true;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-lg font-bold text-zinc-50">🏆 StockLens Score</h2>
        <span className="text-[10px] text-zinc-600">สูตรเปิดเผย 6 เสา · อัปเดต {new Date(data.updatedAt).toLocaleDateString("th-TH")}</span>
      </div>

      <div className="grid md:grid-cols-[auto_1fr] gap-6 items-center">
        {/* เกจวงกลม */}
        <div className="flex flex-col items-center">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="44" fill="none" stroke="#27272a" strokeWidth="10" />
            <circle
              cx="60" cy="60" r="44" fill="none" stroke={ring} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${(data.total / 100) * circ} ${circ}`} transform="rotate(-90 60 60)"
            />
            <text x="60" y="58" textAnchor="middle" className="num" fontSize="30" fontWeight="bold" fill="#fafafa">{data.total}</text>
            <text x="60" y="76" textAnchor="middle" fontSize="10" fill="#a1a1aa">/100</text>
          </svg>
          <div className={`text-sm font-bold ${color}`}>{data.grade}</div>
          <div className="text-[10px] text-zinc-500 mt-1 num">ความมั่นใจข้อมูล {data.confidence}%</div>
        </div>

        {/* 6 เสา / ล็อก */}
        {locked || !data.pillars ? (
          <div>
            <div className="space-y-2 opacity-40 blur-[3px] select-none" aria-hidden>
              {PILLARS.map((p) => (
                <div key={p.k}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-zinc-400">{p.icon} {p.label}</span><span className="num text-zinc-200">--</span></div>
                  <div className="h-1.5 bg-base-800 rounded-full"><div className="h-full rounded-full bg-accent" style={{ width: "55%" }} /></div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <LockGate need="starter" title="🔓 เปิดดู 6 เสา + เหตุผล + ประวัติคะแนน" desc="สมาชิก Starter ขึ้นไปเห็นองค์ประกอบคะแนนทั้งหมด พร้อมเหตุผลและความเสี่ยงที่ระบบตรวจพบ" />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {PILLARS.map((p) => {
              const v = data.pillars![p.k];
              return (
                <div key={p.k}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">{p.icon} {p.label}</span>
                    <span className="num text-zinc-200 font-semibold">{v === null ? "ไม่มีข้อมูล" : v}</span>
                  </div>
                  <div className="h-1.5 bg-base-800 rounded-full overflow-hidden">
                    {v !== null && (
                      <div className={`h-full rounded-full ${v >= 66 ? "bg-up" : v >= 40 ? "bg-accent" : "bg-down"}`} style={{ width: `${v}%` }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!locked && data.reasons && data.reasons.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {data.reasons.map((r) => <span key={r} className="chip bg-up/10 text-up border border-up/30 text-[11px]">✓ {r}</span>)}
        </div>
      )}
      {!locked && data.risks && data.risks.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.risks.map((r) => <span key={r} className="chip bg-down/10 text-down border border-down/30 text-[11px]">⚠️ {r}</span>)}
        </div>
      )}

      <p className="text-[10px] text-zinc-600 mt-3">
        คะแนนเชิงข้อมูลจากงบจริง (SEC/56-1) + ราคา + ข่าว + คอนเซนซัส — สูตรถ่วงน้ำหนักเปิดเผย ไม่ใช่คำแนะนำซื้อขาย · เสาที่ไม่มีข้อมูลใช้ค่ากลาง 50 และหัก Confidence
      </p>
    </div>
  );
}
