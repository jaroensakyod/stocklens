"use client";

import { useEffect, useRef, useState } from "react";

interface SearchRow {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

// 🔎 TickerPicker — ช่อง "ค้นหาแล้วกดเลือก" แทนการพิมพ์ ticker เอง
// เหตุผล: ผู้ใช้พิมพ์ผิด/พิมพ์ชื่อบริษัทแทน symbol ทำให้ดึงข้อมูลไม่ได้ (เช่น "DEL" ที่ไม่มีใน Yahoo)
// กติกา: parent จะได้ ticker จาก onSelect() เมื่อ "กดเลือกจากรายการ" เท่านั้น — พิมพ์เองไม่นับ
export default function TickerPicker({
  onSelect,
  placeholder = "ค้นหาหุ้น เช่น NVDA / PTT.BK / Apple",
  autoFocus = false,
}: {
  onSelect: (symbol: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchRow[]>([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<SearchRow | null>(null);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 1 || picked) {
      setResults([]);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        // เอาเฉพาะหุ้น/ETF ที่ซื้อถือได้จริง (ตัด INDEX และตลาด OTC ไร้สภาพคล่อง เช่น PNK/OOB)
        const rows: SearchRow[] = (json.results ?? []).filter(
          (r: SearchRow) => !/INDEX|ดัชนี/.test(r.type) && !/PNK|OOB|OTC|Pink/i.test(r.exchange)
        );
        setResults(rows.slice(0, 8));
        setOpen(true);
      } catch {}
      setSearching(false);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, picked]);

  // คลิกนอกกล่อง = ปิด dropdown
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = (r: SearchRow) => {
    setPicked(r);
    setQ(r.symbol);
    setOpen(false);
    onSelect(r.symbol);
  };

  const clear = () => {
    setPicked(null);
    setQ("");
    setResults([]);
    onSelect("");
  };

  return (
    <div ref={box} className="relative">
      <div className="relative">
        <input
          className="input pl-8"
          placeholder={placeholder}
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            if (picked) {
              setPicked(null);
              onSelect("");
            }
          }}
          onFocus={() => results.length && setOpen(true)}
        />
        <span className={`absolute left-2.5 top-2.5 text-sm ${picked ? "text-up" : "text-zinc-500"}`}>{picked ? "✓" : "🔍"}</span>
        {picked && (
          <button className="absolute right-2 top-1.5 text-zinc-500 hover:text-down text-xs px-1.5 py-0.5" onClick={clear} aria-label="ล้าง">
            ✕
          </button>
        )}
      </div>

      {picked ? (
        <p className="text-[10px] text-up mt-1 truncate">✓ {picked.symbol} — {picked.name} {picked.exchange && `(${picked.exchange})`}</p>
      ) : q.trim() ? (
        <p className="text-[10px] text-zinc-600 mt-1">พิมพ์เพื่อค้นหา แล้ว<span className="text-accent-soft">กดเลือกจากรายการ</span>เท่านั้น (พิมพ์เองตรงๆ ระบบจะยังไม่รับ)</p>
      ) : null}

      {open && results.length > 0 && !picked && (
        <div className="absolute top-full mt-1 w-full card overflow-hidden z-50 max-h-72 overflow-y-auto">
          {results.map((r) => (
            <button key={r.symbol} className="w-full text-left px-3 py-2 hover:bg-base-800 text-sm flex justify-between gap-2 items-baseline" onClick={() => pick(r)}>
              <span className="font-semibold text-zinc-100 shrink-0">{r.symbol}</span>
              <span className="text-zinc-400 truncate text-xs flex-1">{r.name}</span>
              <span className="text-zinc-600 text-[10px] shrink-0">{r.exchange}</span>
            </button>
          ))}
        </div>
      )}

      {open && !picked && !searching && q.trim().length >= 1 && results.length === 0 && (
        <div className="absolute top-full mt-1 w-full card p-3 z-50 text-xs text-zinc-500">ไม่พบหุ้นที่ตรงกับ &ldquo;{q}&rdquo; — ลองพิมพ์ชื่อบริษัทเป็นอังกฤษ หรือรหัสพร้อมตลาด เช่น PTT.BK</div>
      )}
    </div>
  );
}
