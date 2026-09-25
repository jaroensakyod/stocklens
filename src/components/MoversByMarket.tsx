"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BrokerBadge from "@/components/BrokerBadge";

interface Mover {
  symbol: string; yahoo: string; name: string; sector: string;
  price: number; changePct: number; premarketPct: number | null;
}
const TABS = [
  { id: "america", label: "🇺🇸 สหรัฐฯ" },
  { id: "thailand", label: "🇹🇭 ไทย" },
  { id: "hongkong", label: "🇭🇰 ฮ่องกง" },
  { id: "japan", label: "🇯🇵 ญี่ปุ่น" },
  { id: "korea", label: "🇰🇷 เกาหลี" },
  { id: "taiwan", label: "🇹🇼 ไต้หวัน" },
];

// Top Movers แยกตามตลาด — บนหน้าแรก
export default function MoversByMarket() {
  const [region, setRegion] = useState("america");
  const [data, setData] = useState<{ gainers: Mover[]; losers: Mover[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (r: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/movers?region=" + r);
      const j = await res.json();
      if (res.ok) setData({ gainers: j.gainers ?? [], losers: j.losers ?? [] });
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load(region);
    const id = setInterval(() => load(region), 120_000);
    return () => clearInterval(id);
  }, [region, load]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-bold text-zinc-400">📊 Top Movers ตามตลาด</h2>
        <div className="flex gap-1 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setRegion(t.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${region === t.id ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 hover:bg-base-700"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {loading && !data ? (
        <p className="text-xs text-zinc-600">กำลังโหลด… (ตลาดที่ยังไม่เคยโหลดจะช้าสักครู่)</p>
      ) : data ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {(["gainers", "losers"] as const).map((side) => (
            <div key={side} className="card divide-y divide-base-700/40">
              <div className={`px-4 py-2 text-xs font-bold ${side === "gainers" ? "text-up" : "text-down"}`}>
                {side === "gainers" ? "🚀 ขึ้นแรง" : "💀 ลงแรง"}
              </div>
              {data[side].map((m) => (
                <Link key={m.symbol} href={`/stock/${encodeURIComponent(m.yahoo)}`} className="flex items-center justify-between px-4 py-2 hover:bg-base-800 text-sm">
                  <div className="min-w-0">
                    <span className="font-bold text-zinc-100">{m.symbol}</span>
                    <span className="text-zinc-500 text-xs ml-2 truncate">{m.name}</span>
                    <span className="text-zinc-600 text-[10px] ml-2 hidden sm:inline">{m.sector}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="num text-zinc-200 text-xs">{m.price < 10 ? m.price.toFixed(2) : m.price.toFixed(1)}</div>
                    <div className={`num text-xs font-bold ${m.changePct >= 0 ? "text-up" : "text-down"}`}>
                      {m.changePct >= 0 ? "+" : ""}{m.changePct.toFixed(2)}%
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
