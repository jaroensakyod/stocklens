"use client";

import { useEffect, useState } from "react";
import type { Quote } from "@/lib/types";

const TAPE_SYMBOLS = ["^GSPC", "^IXIC", "^DJI", "^VIX", "^SET.BK", "CL=F", "GC=F", "HG=F", "CC=F", "BTC-USD", "NVDA", "AAPL", "TSLA", "PLTR", "AMD", "RKLB"];

const NAME: Record<string, string> = {
  "^GSPC": "S&P 500", "^IXIC": "NASDAQ", "^DJI": "DOW", "^VIX": "VIX", "^SET.BK": "SET",
  "CL=F": "น้ำมัน WTI", "GC=F": "ทองคำ", "HG=F": "ทองแดง", "CC=F": "โกโก้", "BTC-USD": "BTC",
};

export default function TickerTape() {
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/quote?s=" + TAPE_SYMBOLS.join(","));
        const json = await res.json();
        if (alive && json.quotes) setQuotes(json.quotes.filter((q: Quote) => isFinite(q.price)));
      } catch {}
    };
    load();
    const id = setInterval(load, 90_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!quotes.length) return null;
  const items = quotes.map((q) => {
    const up = q.changePct >= 0;
    return (
      <span key={q.symbol} className="tape-item">
        <span className="text-zinc-400">{NAME[q.symbol] ?? q.symbol}</span>
        <span className="num text-zinc-100">{q.price < 10 ? q.price.toFixed(2) : q.price.toFixed(1)}</span>
        <span className={`num ${up ? "text-up" : "text-down"}`}>
          {up ? "▲" : "▼"} {Math.abs(q.changePct).toFixed(2)}%
        </span>
      </span>
    );
  });

  return (
    <div className="tape border-b border-base-700/60 bg-base-900 py-1.5">
      <div className="tape-inner">
        {items}
        {items}
      </div>
    </div>
  );
}
