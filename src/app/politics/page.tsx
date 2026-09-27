"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// 🇺🇸 Political Pulse — ติดตามข่าวการเมืองที่กระทบตลาด (Trump/Fed/จีน/สงคราม/ไทย)
// + วิเคราะห์รายชิ้นด้วย Jev → หุ้นที่กระทบ + การ์ด Atlas ที่เกี่ยว

interface Item {
  title: string; source: string; time: number; link?: string;
  impact: number | null; direction: string | null; sectors: string[]; atlasLink: string | null; jevNote: string | null;
}
interface Feed { items: Item[]; asOf: string; topics: { id: string; label: string; emoji: string; query: string }[] }
interface Analysis {
  impact: number | null; direction: string | null; sectors: string[]; stocks: string[];
  atlasCards: string[]; jevText: string; error?: string;
}

const SECTOR_LABEL: Record<string, string> = {
  ev_auto: "🚗 Auto/EV", oil_energy: "🛢️ น้ำมัน/พลังงาน", tech_ai: "💻 Tech/AI",
  banking: "🏦 ธนาคาร", defense: "🛡️ กลาโหม", bonds_rates: "🏛️ พันธบัตร/ดอกเบี้ย",
  gold_metals: "🥇 ทอง/โลหะ", thailand: "🇹🇭 ไทย", crypto: "🪙 Crypto", asia: "🌏 เอเชีย",
};

const fmtTime = (t: number) => { const h = Math.floor((Date.now() - t) / 3600e3); return h < 1 ? "เมื่อสักครู่" : h < 24 ? `${h} ชม.ก่อน` : `${Math.floor(h / 24)} วันก่อน`; };

export default function PoliticsPage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/political").then(r => r.json()).then(j => { if (j.error) setErr(j.error); else setFeed(j); }).catch(() => setErr("โหลดไม่สำเร็จ"));
  }, []);

  const analyze = async () => {
    if (q.trim().length < 10) return;
    setLoading(true); setAnalysis(null);
    try { const res = await fetch("/api/political", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: q }) }); setAnalysis(await res.json()); } catch {}
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🇺🇸 Political Pulse — ข่าวการเมืองที่กระทบพอร์ตคุณ</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Trump · Fed · จีน · สงคราม · การเมืองไทย — ข่าวการเมืองที่ตลาดต้องขยับ พร้อม Jev วิเคราะห์ว่า<b className="text-zinc-200">หุ้นกลุ่มไหนโดน</b> และโยงไปการ์ดประวัติศาสตร์ Atlas
        </p>
      </div>

      {/* วิเคราะห์ข่าวรายชิ้น */}
      <div className="card p-4">
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="วางข่าว/เหตุการณ์การเมืองที่อยากรู้ผลกระทบ เช่น Trump ยกเลิกกฎ EV..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && analyze()} />
          <button className="btn-primary shrink-0" onClick={analyze} disabled={loading || q.trim().length < 10}>{loading ? "🧠 วิเคราะห์…" : "ตรวจผลกระทบ"}</button>
        </div>
        {analysis && "error" in analysis && <div className="mt-3 text-sm text-down">{analysis.error}</div>}
        {analysis && !("error" in analysis) && (
          <div className="mt-4 space-y-3">
            <div className={`rounded-lg border px-3 py-2 text-sm ${analysis.direction === "bullish" ? "bg-up/5 border-up/25 text-up" : analysis.direction === "bearish" ? "bg-down/5 border-down/25 text-down" : "bg-base-900 border-base-700 text-zinc-300"}`}>
              {analysis.jevText}
            </div>
            {analysis.stocks.length > 0 && (
              <div>
                <div className="text-xs font-bold text-zinc-300 mb-2">📈 หุ้นที่กระทบโดยตรง</div>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.stocks.map(s => <Link key={s} href={`/stock/${encodeURIComponent(s)}`} className="chip bg-accent/15 text-accent-soft border border-accent/30 !text-[11px]">{s}</Link>)}
                </div>
              </div>
            )}
            {analysis.atlasCards.length > 0 && (
              <div>
                <div className="text-xs font-bold text-zinc-300 mb-2">🕵️ บริบทจาก Atlas</div>
                <div className="flex gap-1.5">
                  {analysis.atlasCards.map(c => <Link key={c} href={`/atlas?card=${c}`} className="chip bg-purple-500/15 text-purple-300 border border-purple-500/30 !text-[10px]">ดูการ์ด →</Link>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Feed */}
      {err && <div className="card p-6 text-sm text-down">{err}</div>}
      {!feed && !err && <div className="card p-6 text-sm text-zinc-500">กำลังดึงข่าวการเมืองล่าสุด…</div>}
      {feed && (
        <div className="card overflow-hidden">
          <div className="px-4 pt-3 pb-1 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-100">📰 ข่าวการเมืองล่าสุด ({feed.items.length} ข่าว)</h2>
            <span className="text-[10px] text-zinc-600">{new Date(feed.asOf).toLocaleString("th-TH")}</span>
          </div>
          <div className="divide-y divide-base-800">
            {feed.items.map((n, i) => (
              <div key={i} className="px-4 py-2.5 hover:bg-base-850 flex items-start gap-3">
                <span className={`text-sm mt-0.5 ${n.direction === "bullish" ? "text-up" : n.direction === "bearish" ? "text-down" : "text-zinc-500"}`}>
                  {n.direction === "bullish" ? "🟢" : n.direction === "bearish" ? "🔴" : "⚪"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 leading-snug">{n.title}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-zinc-600">{n.source} · {fmtTime(n.time)}</span>
                    {n.sectors.slice(0, 2).map(s => <span key={s} className="chip bg-base-800 text-zinc-400 border border-base-700 !text-[9px]">{SECTOR_LABEL[s] ?? s}</span>)}
                    {n.atlasLink && <span className="chip bg-purple-500/10 text-purple-300 border border-purple-500/25 !text-[9px]">Atlas</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* เชื่อมต่อ */}
      <div className="card p-4 text-xs text-zinc-400 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-zinc-300 font-bold">เชื่อมต่อต่อ:</span>
        <Link href="/radar" className="link">🌐 Radar 25 ธีม</Link>
        <Link href="/web" className="link">🕸️ แผนผังข่าววันนี้</Link>
        <Link href="/atlas" className="link">🕵️ Atlas 570 ปี</Link>
        <Link href="/supernova" className="link">🛰️ Supernova มหภาค</Link>
      </div>
    </div>
  );
}
