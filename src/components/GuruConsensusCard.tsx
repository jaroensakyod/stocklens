"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// 🐋 หุ้นที่เซียนถือร่วมกัน (หน้าแรก) — การ์ด consensus จาก 13F LIVE สดของ SEC (เทียบ section เดียวกันของคู่แข่ง แต่เรา LIVE ไม่ใช่ snapshot)
interface Row {
  ticker: string; issuer: string; count: number; totalValueUsd: number; avgPct: number;
  increasing: number; decreasing: number;
  investors: { id: string; name: string; emoji: string; pct: number; changeType?: string }[];
}

export default function GuruConsensusCard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/gurus/consensus")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setRows((j.rows ?? []).slice(0, 4));
      })
      .catch((e) => setErr(e.message));
  }, []);

  if (err || rows.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-bold text-zinc-400">🐋 หุ้นที่เซียนถือร่วมกัน <span className="text-zinc-600 font-normal">(13F สดจาก SEC)</span></h2>
        <Link href="/gurus/consensus" className="text-xs text-accent-soft hover:underline">ดูทั้งหมด →</Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {rows.map((r) => (
          <Link key={r.ticker} href={`/stock/${r.ticker}`} className="card p-4 hover:border-accent/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-zinc-50">{r.ticker}</span>
              <span className="chip bg-accent/15 text-accent-soft border border-accent/30 !text-[10px] num">{r.count} เซียน</span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{r.issuer}</p>
            <p className="text-xs text-zinc-400 mt-2 num">มูลค่ารวม ${(r.totalValueUsd / 1e9).toFixed(1)}B$ · เฉลี่ย {r.avgPct.toFixed(1)}% ของพอร์ต</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {r.investors.slice(0, 5).map((i) => (
                <span key={i.id} className={`chip !text-[9px] !py-0.5 border ${i.changeType === "increased" || i.changeType === "new" ? "bg-up/10 text-up border-up/30" : i.changeType === "decreased" ? "bg-down/10 text-down border-down/30" : "bg-base-800 text-zinc-400 border-base-700"}`}>
                  {i.emoji}{i.name.split(" ").slice(-1)[0]}
                </span>
              ))}
              {r.investors.length > 5 && <span className="text-[9px] text-zinc-600 self-center num">+{r.investors.length - 5}</span>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
