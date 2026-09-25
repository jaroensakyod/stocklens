"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAV = [
  { href: "/", label: "หน้าแรก" },
  { href: "/surge", label: "🚀 หุ้นซิ่ง" },
  { href: "/radar", label: "Radar" },
  { href: "/screener", label: "คัดกรอง" },
  { href: "/portfolio", label: "พอร์ต" },
];

// เครื่องมือวิเคราะห์ — รวมเป็น dropdown เพื่อไม่ให้แถบบนแน่น
const TOOLS = [
  { href: "/longterm", label: "💤 ระยะยาว & ปันผล" },
  { href: "/backtest", label: "📊 Backtest กลยุทธ์" },
  { href: "/timemachine", label: "🕰️ ไทม์แมชชีน" },
  { href: "/advisor-test", label: "🧪 ทดสอบ AI ปรับพอร์ต" },
  { href: "/gurus", label: "🐋 พอร์ตกูรู 13F" },
  { href: "/compare", label: "⚖️ เปรียบเทียบหุ้น" },
  { href: "/track-record", label: "📜 Track Record" },
];

const ALL_LINKS = [...NAV, ...TOOLS, { href: "/pricing", label: "VIP" }];

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

        <nav className="hidden lg:flex items-center gap-0.5 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-zinc-50 hover:bg-base-800 whitespace-nowrap">
              {n.label}
            </Link>
          ))}
          {/* -dropdown เครื่องมือวิเคราะห์ */}
          <div className="relative group">
            <button className="px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-zinc-50 hover:bg-base-800 whitespace-nowrap flex items-center gap-1">
              🧰 เครื่องมือ <span className="text-[10px] opacity-60">▾</span>
            </button>
            <div className="hidden group-hover:block absolute left-0 top-full pt-1 z-50">
              <div className="card min-w-52 p-1.5">
                {TOOLS.map((t) => (
                  <Link key={t.href} href={t.href} className="block px-3 py-2 rounded-lg text-sm text-zinc-300 hover:text-zinc-50 hover:bg-base-800 whitespace-nowrap">
                    {t.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <Link href="/pricing" className="ml-1 px-3 py-1.5 rounded-lg bg-accent/15 text-accent-soft font-bold hover:bg-accent/25 whitespace-nowrap">
            👑 VIP
          </Link>
        </nav>

        <div className="flex-1 max-w-sm ml-auto relative">
          <input
            className="input"
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
          {ALL_LINKS.map((n) => (
            <Link key={n.href} href={n.href} className="px-3 py-1.5 rounded-lg text-sm text-zinc-300 hover:bg-base-800" onClick={() => setMenuOpen(false)}>
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
