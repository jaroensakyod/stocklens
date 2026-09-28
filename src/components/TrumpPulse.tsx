"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { prettySym } from "@/lib/prettySymbol";

// 🇺🇸 Trump Pulse — โพสต์/แถลงการณ์ล่าสุด + Jev วิเคราะห์ + หุ้นที่โดน (โชว์หน้าแรก)

interface PulseItem {
  title: string; source: string; time: number;
  direction: string | null; impact: number | null;
  stocks: { t: string; chgPct: number | null }[];
}

const fmtTime = (t: number) => { const h = Math.floor((Date.now() - t) / 3600e3); return h < 1 ? "เมื่อสักครู่" : h < 24 ? `${h} ชม.` : `${Math.floor(h / 24)} วัน`; };
const DIR = (d: string | null) => d === "bullish" ? "🟢" : d === "bearish" ? "🔴" : "⚪";

export default function TrumpPulse() {
  const [items, setItems] = useState<PulseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const load = () =>
      fetch("/api/political?mode=trump")
        .then(r => r.json())
        .then(j => {
          if (j.items?.length) { setItems(j.items); setFetchedAt(Date.now()); }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    load();
    const timer = setInterval(load, 10 * 60_000); // รีเฟรชเองทุก 10 นาที (server cache 10 นาที)
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearInterval(timer); clearInterval(tick); };
  }, []);

  if (loading) return null;
  if (!items.length) return null;

  return (
    <div className="card p-4 border-l-4 border-l-accent/50">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-zinc-100">
          🇺🇸 Trump Pulse — โพสต์/แถลงการณ์ล่าสุด × ผลกระทบหุ้น
        </h2>
        <Link href="/politics" className="text-[10px] text-accent-soft hover:underline shrink-0">ดูทั้งหมด →</Link>
      </div>

      <div className="space-y-2.5">
        {items.slice(0, 4).map((n, i) => (
          <div key={i} className="flex items-start gap-2.5 bg-base-900 rounded-lg px-3 py-2 hover:bg-base-850 transition-colors">
            <span className="text-base shrink-0 mt-0.5">{DIR(n.direction)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-zinc-200 leading-snug">{n.title}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="text-[10px] text-zinc-600">{n.source} · {fmtTime(n.time)}</span>
                {n.impact !== null && n.impact >= 2 && (
                  <span className="chip bg-amber-500/10 text-amber-400 border border-amber-500/25 !text-[9px]">รุนแรง {n.impact.toFixed(0)}/3</span>
                )}
                {n.stocks.slice(0, 3).map(s => (
                  <Link key={s.t} href={`/stock/${encodeURIComponent(s.t)}`} className="chip bg-base-800 text-zinc-300 border border-base-700 !text-[9px] hover:border-accent/40">
                    {prettySym(s.t)}
                    {s.chgPct !== null && <span className={s.chgPct >= 0 ? "text-up ml-0.5" : "text-down ml-0.5"}>{s.chgPct >= 0 ? "+" : ""}{s.chgPct.toFixed(1)}%</span>}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-zinc-600 mt-2 text-center">
        Jev วิเคราะห์อัตโนมัติ · ข่าวสด ≤36 ชม. · รีเฟรชเองทุก 10 นาที{fetchedAt ? ` · อัปเดต ${Math.max(0, Math.round((now - fetchedAt) / 60000))} นาทีที่แล้ว` : ""}
      </p>
    </div>
  );
}
