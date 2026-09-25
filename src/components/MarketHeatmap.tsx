"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface HeatCell { symbol: string; yahoo: string; name: string; sector: string; price: number; changePct: number; mcap: number; premarketPct: number | null }
interface SectorRow { sector: string; avgPct: number; up: number; down: number; total: number; mcap: number }
interface Data { region: string; heatmap: HeatCell[]; sectors: SectorRow[]; breadth: { up: number; down: number; total: number; ratio: number } }

const REGIONS = [
  { id: "america", label: "🇺🇸 สหรัฐฯ" }, { id: "thailand", label: "🇹🇭 ไทย" }, { id: "hongkong", label: "🇭🇰 ฮ่องกง" },
  { id: "japan", label: "🇯🇵 ญี่ปุ่น" }, { id: "korea", label: "🇰🇷 เกาหลี" }, { id: "taiwan", label: "🇹🇼 ไต้หวัน" },
];

// สี heatmap: -3% แดงสุด → 0% เทา → +3% เขียวสุด
function heatColor(pct: number): string {
  const t = Math.max(-1, Math.min(1, pct / 3)); // -1..1
  if (t > 0) {
    const g = Math.round(180 - t * 60); // เขียวสด → เขียวเข้ม
    return `rgba(16,${g + 40},90,${0.35 + t * 0.45})`;
  }
  if (t < 0) {
    const r = Math.round(200 - Math.abs(t) * 60);
    return `rgba(${r + 30},50,70,${0.35 + Math.abs(t) * 0.45})`;
  }
  return "rgba(60,60,65,0.4)";
}

function fmtMcap(v: number): string {
  if (v >= 1e12) return (v / 1e12).toFixed(1) + "T";
  if (v >= 1e9) return (v / 1e9).toFixed(0) + "B";
  return (v / 1e6).toFixed(0) + "M";
}

// Market Heatmap + Sector Strength — ภาพรวมทั้งตลาดในหน้าจอเดียว
export default function MarketHeatmap() {
  const [region, setRegion] = useState("america");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async (r: string) => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/heatmap?region=" + r);
      const j = await res.json();
      if (!res.ok) setErr(j.error || "โหลดไม่สำเร็จ");
      else setData(j);
    } catch { setErr("โหลดไม่สำเร็จ"); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(region);
    const id = setInterval(() => load(region), 120_000);
    return () => clearInterval(id);
  }, [region, load]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-bold text-zinc-400">🗺️ Heatmap + Sector Strength — ตลาดวันนี้ในหน้าเดียว</h2>
        <div className="flex gap-1 flex-wrap">
          {REGIONS.map((r) => (
            <button key={r.id} onClick={() => setRegion(r.id)} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${region === r.id ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 hover:bg-base-700"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {err && <div className="card p-4 text-sm text-down">{err}</div>}
      {loading && !data && <div className="card p-10 text-center text-zinc-500 text-sm">กำลังโหลด… (ตลาดใหม่โหลดครั้งแรก ~10 วิ)</div>}

      {data && (
        <div className="space-y-4">
          {/* Market breadth bar */}
          <div className="card px-4 py-3">
            <div className="flex items-center gap-3 text-xs mb-2">
              <span className="text-zinc-400">Market Breadth:</span>
              <span className="text-up font-bold">{data.breadth.up} ตัวขึ้น</span>
              <span className="text-zinc-600">/</span>
              <span className="text-down font-bold">{data.breadth.down} ตัวลง</span>
              <span className="text-zinc-600">/ ทั้งหมด {data.breadth.total}</span>
            </div>
            <div className="h-2 bg-base-800 rounded-full overflow-hidden flex">
              <div className="bg-up h-full transition-all" style={{ width: `${data.breadth.ratio}%` }} />
              <div className="bg-down h-full transition-all" style={{ width: `${100 - data.breadth.ratio}%` }} />
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">{data.breadth.ratio}% ของตลาดขึ้น — {data.breadth.ratio > 60 ? "🟢 ตลาดแข็งแรง" : data.breadth.ratio > 40 ? "🟡 ผสม" : "🔴 ตลาดอ่อนแรง"}</p>
          </div>

          {/* Sector strength bars */}
          <div className="card p-4">
            <h3 className="text-xs font-bold text-zinc-400 mb-3">📊 Sector Strength — หมวดไหนวันนี้แรง/อ่อน</h3>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {data.sectors.map((s) => {
                const w = Math.min(100, Math.abs(s.avgPct) * 25); // scale bar
                const isUp = s.avgPct >= 0;
                return (
                  <div key={s.sector} className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-400 w-36 sm:w-48 truncate" title={s.sector}>{s.sector}</span>
                    <div className="flex-1 flex items-center gap-1 relative">
                      <div className="flex-1 h-4 bg-base-800 rounded relative overflow-hidden">
                        <div
                          className={`absolute top-0 h-full rounded ${isUp ? "bg-up/50" : "bg-down/50"}`}
                          style={{ width: `${w}%`, left: isUp ? "50%" : undefined, right: isUp ? undefined : "50%" }}
                        />
                        <div className="absolute left-1/2 top-0 w-px h-full bg-zinc-600" />
                      </div>
                      <span className={`num font-semibold w-12 text-right ${isUp ? "text-up" : "text-down"}`}>
                        {isUp ? "+" : ""}{s.avgPct.toFixed(1)}%
                      </span>
                      <span className="text-zinc-600 w-16 text-right hidden sm:inline">
                        {s.up}↑{s.down}↓
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Heatmap grid */}
          <div className="card p-4">
            <h3 className="text-xs font-bold text-zinc-400 mb-1">🗺️ Heatmap — ยิ่งเขียว=ยิ่งขึ้น · ยิ่งแดง=ยิ่งลง · ขนาด=มูลค่าตลาด</h3>
            <p className="text-[10px] text-zinc-600 mb-3">80 หุ้นใหญ่สุดของตลาดนี้ (hover ดูรายละเอียด · คลิกเข้าหน้าวิเคราะห์)</p>
            <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(58px, 1fr))" }}>
              {data.heatmap.map((c) => (
                <Link
                  key={c.symbol}
                  href={`/stock/${encodeURIComponent(c.yahoo)}`}
                  title={`${c.name} · ${c.sector} · $${c.price.toFixed(2)} · ${c.changePct >= 0 ? "+" : ""}${c.changePct}%${c.premarketPct !== null && Math.abs(c.premarketPct) > 0.5 ? ` · พรีมาร์เก็ต ${c.premarketPct}%` : ""}`}
                  className="rounded px-1.5 py-2 text-center transition-transform hover:scale-110 hover:z-10 relative"
                  style={{ background: heatColor(c.changePct) }}
                >
                  <div className="font-bold text-[10px] text-zinc-100 leading-tight">{c.symbol}</div>
                  <div className={`num text-[9px] font-semibold ${c.changePct >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                    {c.changePct >= 0 ? "+" : ""}{c.changePct.toFixed(1)}%
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
