"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/authContext";

// ===== โครงแถบเมนู: 5 จุดหลัก — หน้าแรก / ค้นหาหุ้น / ภาพตลาด / พอร์ต / เครื่องมือ =====
// ทุก dropdown มีคำอธิบายสั้นๆ กำกับ เพื่อให้ผู้ใช้ใหม่เข้าใจใน 3 วินาที
type MenuLink = { href: string; label: string; desc: string };
type MenuGroup = { id: string; title: string; emoji: string; items: MenuLink[] };

const GROUPS: MenuGroup[] = [
  {
    id: "find",
    title: "ค้นหาหุ้น",
    emoji: "🔎",
    items: [
      { href: "/screener", label: "📡 Radars Builder", desc: "สร้างเรดาร์คัดกรองหุ้นตามเงื่อนไขของคุณ — 30 ตลาด, บันทึก/แชร์ได้" },
      { href: "/surge", label: "🚀 หุ้นซิ่งวันนี้", desc: "สแกนหุ้นขยับแรงพร้อมสัญญาณ (ทะลุสูงสุด/วอลุ่มพุ่ง) หลายตลาด" },
      { href: "/dr", label: "🪙 DR ไทย", desc: "หุ้นต้นทางของ DR ยอดนิยม + วิเคราะห์ภาษาไทยเต็มรูปแบบ" },
      { href: "/compare", label: "⚖️ เทียบหุ้น", desc: "เทียบสถิติ 2-4 ตัวแบบคลิกเดียว — factors/งบ/สัญญาณ" },
    ],
  },
  {
    id: "market",
    title: "ภาพตลาด",
    emoji: "🌍",
    items: [
      { href: "/trend", label: "📈 แนวโน้มวันนี้", desc: "มหภาค + ธีมร้อน + ใต้น้ำ/แพงเกินตัว + คะแนน — ครบในหน้าเดียว" },
      { href: "/radar", label: "🌐 Radar เหตุการณ์", desc: "25 ธีมข่าวโลก (สงคราม/ดอกเบี้ย/AI...) → ห่วงโซ่หุ้นที่ได้-เสียประโยชน์" },
      { href: "/supernova", label: "🛰️ มหภาค (Supernova)", desc: "ยีลด์ US10Y · VIX · ทอง · น้ำมัน · insider — รวมเป็นสัญญาณเดียว" },
      { href: "/score", label: "🏆 อันดับ Score", desc: "คะแนน StockLens รวม 6 เสา — อันดับสูงสุด/ต่ำสุดของวัน" },
    ],
  },
  {
    id: "tools",
    title: "เครื่องมือ",
    emoji: "🧰",
    items: [
      { href: "/starter", label: "🧑‍🎓 พอร์ตมือใหม่รายวัน", desc: "ไอเดียพอร์ตเริ่มต้นสำหรับมือใหม่ ปรับทุกวัน" },
      { href: "/model-portfolio", label: "💼 พอร์ตจำลอง AI", desc: "AI ปรับสมดุลพอร์ตจริงรายสัปดาห์ พร้อม NAV สะสม" },
      { href: "/value", label: "🤿 ใต้น้ำ vs 🎈 แพงเกินตัว", desc: "หุ้นตกลึกเกินพื้นฐาน vs วิ่งเกินตัว — มุมมอง contrarian" },
      { href: "/dividend", label: "📅 ปันผลรายเดือน", desc: "ปฏิทินรับปันผล + วางแผนกระแสเงินสด" },
      { href: "/longterm", label: "💤 ระยะยาว & ปันผล", desc: "คัดหุ้นคุณภาพถือยาวสายปันผล" },
      { href: "/backtest", label: "📊 Backtest กลยุทธ์", desc: "ทดสอบกลยุทธ์ย้อนหลัง เทียบ Buy & Hold" },
      { href: "/timemachine", label: "🕰️ ไทม์แมชชีน", desc: "ถ้าซื้อเมื่อ N ปีก่อน วันนี้จะมีเท่าไหร่" },
      { href: "/gurus", label: "🐋 พอร์ตกูรู 13F", desc: "หุ้นที่เหล่าฉลาม (Buffett ฯลฯ) ถือจริงตามฟิลิ่ง SEC" },
      { href: "/advisor-test", label: "🧪 ทดสอบ AI ปรับพอร์ต", desc: "ลองยิง AI advisor ด้วยพอร์ตตัวอย่าง" },
      { href: "/track-record", label: "📜 Track Record", desc: "สถิติคำแนะนำของระบบ เปิดให้ตรวจสอบทุกตัวเลข" },
    ],
  },
];

const PORTFOLIO = { href: "/portfolio", label: "พอร์ตของฉัน", desc: "พอร์ต + 🩻 X-ray + 🤖 AI ปรับพอร์ต + แจ้งเตือน" };

const ALL_LINKS = [
  { href: "/", label: "หน้าแรก" },
  ...GROUPS.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label }))),
  { href: PORTFOLIO.href, label: "💼 " + PORTFOLIO.label },
  { href: "/pricing", label: "👑 VIP" },
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

  const Dropdown = ({ g }: { g: MenuGroup }) => (
    <div className="relative group">
      <button className="px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-zinc-50 hover:bg-base-800 whitespace-nowrap flex items-center gap-1">
        {g.emoji} {g.title} <span className="text-[10px] opacity-60">▾</span>
      </button>
      <div className="hidden group-hover:block absolute left-0 top-full pt-1 z-50">
        <div className="card min-w-80 p-1.5 shadow-xl shadow-black/40">
          {g.items.map((t) => (
            <Link key={t.href} href={t.href} className="block px-3 py-2 rounded-lg hover:bg-base-800">
              <div className="text-sm text-zinc-200 whitespace-nowrap">{t.label}</div>
              <div className="text-[10px] text-zinc-500 whitespace-nowrap">{t.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );

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
          <Link href="/" className="px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-zinc-50 hover:bg-base-800 whitespace-nowrap">
            หน้าแรก
          </Link>
          <Dropdown g={GROUPS[0]} />
          <Dropdown g={GROUPS[1]} />
          <Link
            href={PORTFOLIO.href}
            title={PORTFOLIO.desc}
            className="px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-zinc-50 hover:bg-base-800 whitespace-nowrap"
          >
            💼 พอร์ตของฉัน
          </Link>
          <Dropdown g={GROUPS[2]} />
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

        <MemberChip />
        <button className="lg:hidden btn-ghost !px-3 !py-1.5" onClick={() => setMenuOpen((v) => !v)} aria-label="เมนู">
          ☰
        </button>
      </div>
      {menuOpen && (
        <nav className="lg:hidden border-t border-base-700/60 px-4 py-3 space-y-2 max-h-[70vh] overflow-y-auto">
          <Link href="/" className="block px-3 py-1.5 rounded-lg text-sm text-zinc-200" onClick={() => setMenuOpen(false)}>
            🏠 หน้าแรก
          </Link>
          {GROUPS.map((g) => (
            <div key={g.id}>
              <div className="text-[10px] text-zinc-600 uppercase tracking-wide px-3 pt-1">{g.emoji} {g.title}</div>
              {g.items.map((t) => (
                <Link key={t.href} href={t.href} className="block px-3 py-1.5 rounded-lg text-sm text-zinc-300 hover:bg-base-800" onClick={() => setMenuOpen(false)}>
                  {t.label}
                  <span className="block text-[10px] text-zinc-600">{t.desc}</span>
                </Link>
              ))}
            </div>
          ))}
          <Link href={PORTFOLIO.href} className="block px-3 py-1.5 rounded-lg text-sm text-zinc-200" onClick={() => setMenuOpen(false)}>
            💼 {PORTFOLIO.label}
          </Link>
          <Link href="/pricing" className="block px-3 py-1.5 rounded-lg text-sm text-accent-soft font-bold" onClick={() => setMenuOpen(false)}>
            👑 VIP
          </Link>
        </nav>
      )}
    </header>
  );
}
// ป้ายสมาชิก: login แล้วแสดงชื่อ+tier+ปุ่มออก / ยังไม่ login = ปุ่มเข้าสู่ระบบ
function MemberChip() {
  const { member, logout, loading } = useAuth();
  if (loading) return null;
  if (!member)
    return (
      <Link href="/login" className="btn-ghost !py-1.5 !px-3 text-xs whitespace-nowrap">
        🔐 สมาชิก
      </Link>
    );
  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/login"
        title={`หมดอายุ ${member.paidUntil} · รหัส ${member.code}`}
        className={`chip text-[10px] border whitespace-nowrap ${member.tier === "pro" ? "bg-accent/15 text-accent-soft border-accent/40" : "bg-zinc-500/15 text-zinc-300 border-base-600"}`}
      >
        {member.tier === "pro" ? "🥇" : "🥉"} {member.name.split(" ")[0]}
      </Link>
      <button className="text-zinc-600 hover:text-down text-xs" onClick={() => logout()} title="ออกจากระบบ">ออก</button>
    </div>
  );
}
