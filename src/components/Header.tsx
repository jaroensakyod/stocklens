"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAV = [
  { href: "/", label: "หน้าแรก" },
  { href: "/radar", label: "Global Radar" },
  { href: "/screener", label: "คัดกรองหุ้น" },
  { href: "/portfolio", label: "พอร์ตของฉัน" },
  { href: "/backtest", label: "Backtest" },
  { href: "/timemachine", label: "🕰️ ไทม์แมชชีน" },
  { href: "/gurus", label: "พอร์ตกูรู" },
  { href: "/compare", label: "เปรียบเทียบ" },
  { href: "/pricing", label: "VIP" },
  { href: "/track-record", label: "Track Record" },
];

export default function Header() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ symbol: string; name: string; exchange: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setResults(json.results ?? []);
        setOpen(true);
      } catch {}
    }, 300);
  }, [q]);

  return (
    <header className="sticky top-0 z-40 bg-base-950/95 backdrop-blur border-b border-base-700/60">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl">🔬</span>
          <span className="font-bold text-lg text-zinc-50">
            Stock<span className="text-accent">Lens</span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-zinc-50 hover:bg-base-800">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1 max-w-sm ml-auto relative">
          <input
            className="input pl-8"
            placeholder="ค้นหาหุ้น เช่น AAPL, PTT.BK, 0700.HK"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) {
                const first = results[0]?.symbol;
                router.push(`/stock/${encodeURIComponent(q.trim().toUpperCase())}`);
                if (first) router.push(`/stock/${first}`);
                setOpen(false);
              }
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <span className="absolute left-2.5 top-2.5 text-zinc-500 text-sm">🔍</span>
          {open && results.length > 0 && (
            <div className="absolute top-full mt-1 w-full card overflow-hidden z-50" onMouseLeave={() => setOpen(false)}>
              {results.map((r) => (
                <button
                  key={r.symbol}
                  className="w-full text-left px-3 py-2 hover:bg-base-800 text-sm flex justify-between gap-2"
                  onClick={() => {
                    router.push(`/stock/${r.symbol}`);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <span className="font-semibold text-zinc-100">{r.symbol}</span>
                  <span className="text-zinc-400 truncate">{r.name}</span>
                  <span className="text-zinc-500 text-xs shrink-0">{r.exchange}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="lg:hidden btn-ghost !px-3 !py-1.5" onClick={() => setMenuOpen((v) => !v)} aria-label="เมนู">
          ☰
        </button>
      </div>
      {menuOpen && (
        <nav className="lg:hidden border-t border-base-700/60 px-4 py-2 flex flex-wrap gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="px-3 py-1.5 rounded-lg text-sm text-zinc-300 hover:bg-base-800" onClick={() => setMenuOpen(false)}>
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
