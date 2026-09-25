"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useWatchlist } from "@/lib/store";
import type { Quote } from "@/lib/types";

// แถบหุ้นที่ติดดาวไว้ — แสดงบนหน้าแรกให้เห็นทันทีที่เข้าเว็บ (เหตุผลให้กลับมาทุกวัน)
export default function WatchlistStrip() {
  const { list } = useWatchlist();
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});

  const load = useCallback(async () => {
    if (!list.length) return;
    try {
      const res = await fetch("/api/quote?s=" + list.join(","));
      const json = await res.json();
      const map: Record<string, Quote> = {};
      for (const q of json.quotes ?? []) if (isFinite(q.price)) map[q.symbol] = q;
      setQuotes(map);
    } catch {}
  }, [list]);

  useEffect(() => {
    load();
    const id = setInterval(load, 90_000);
    return () => clearInterval(id);
  }, [load]);

  if (!list.length) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-zinc-400">⭐ Watchlist ของคุณ</h2>
        <Link href="/portfolio" className="text-xs text-zinc-500 hover:text-zinc-300">จัดการ →</Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {list.map((t) => {
          const q = quotes[t];
          const up = (q?.changePct ?? 0) >= 0;
          return (
            <Link key={t} href={`/stock/${t}`} className="card card-hover px-3 py-2 flex items-center justify-between">
              <span className="font-bold text-sm text-zinc-100">{t}</span>
              {q ? (
                <span className="text-right">
                  <span className="num text-xs text-zinc-300 block">{q.price < 10 ? q.price.toFixed(2) : q.price.toFixed(1)}</span>
                  <span className={`num text-[10px] font-semibold ${up ? "text-up" : "text-down"}`}>
                    {up ? "+" : ""}{q.changePct.toFixed(2)}%
                  </span>
                </span>
              ) : (
                <span className="text-xs text-zinc-600">…</span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
