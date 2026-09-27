"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// 🇺🇸 Political Pulse — ข่าวการเมืองที่กระทบตลาด: auto-fetch + Jev + ผลกระทบหุ้นรายตัว

interface StockHit { t: string; price: number | null; chgPct: number | null; why: string }
interface Item {
  title: string; source: string; time: number; link?: string; topic: string;
  direction: string | null; impact: number | null; fedImplication: string | null;
  stocks: StockHit[]; atlasCard: string | null;
}
interface Feed {
  items: Item[]; asOf: string;
  overall: { impact: number | null; direction: string | null; topRisk: string | null } | null;
}
interface Analysis {
  impact: number | null; direction: string | null; fed: string | null;
  sectors: string[]; stocks: { t: string; price: number | null; chgPct: number | null }[];
  atlasCards: string[]; jevText: string; error?: string;
}

const fmtTime = (t: number) => { const h = Math.floor((Date.now() - t) / 3600e3); return h < 1 ? "เมื่อสักครู่" : h < 24 ? `${h} ชม.` : `${Math.floor(h / 24)} วัน`; };
const DIR_ICON = (d: string | null) => d === "bullish" ? "🟢" : d === "bearish" ? "🔴" : "⚪";

export default function PoliticsPage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/political${refresh ? "?refresh=1" : ""}`);
      const j = await res.json();
      if (j.error) setErr(j.error); else { setFeed(j); setErr(""); }
    } catch { setErr("โหลดไม่สำเร็จ"); }
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const analyze = async () => {
    if (q.trim().length < 10) return;
    setLoading(true); setAnalysis(null);
    try {
      const res = await fetch("/api/political", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: q }) });
      setAnalysis(await res.json());
    } catch {}
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">🇺🇸 Political Pulse — ข่าวการเมือง × ผลกระทบหุ้น</h1>
          <p className="text-sm text-zinc-400 mt-1">
            ข่าว Trump · Fed · จีน · สงคราม · การเมืองไทย — อัปเดตอัตโนมัติทุก 20 นาที พร้อม Jev วิเคราะห์ทิศทาง + <b className="text-zinc-200">ราคาหุ้นที่โดนกระทบแบบเรียลไทม์</b>
          </p>
        </div>
        <button className="btn-ghost !py-1.5 !px-3 !text-xs shrink-0" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? "⟳ กำลังรีเฟรช…" : "⟳ รีเฟรช"}
        </button>
      </div>

      {/* สรุปภาพรวม */}
      {feed?.overall && (
        <div className={`card p-4 border ${feed.overall.direction === "bullish" ? "border-up/30 bg-up/5" : feed.overall.direction === "bearish" ? "border-down/30 bg-down/5" : "border-base-700"}`}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-sm font-bold text-zinc-100">
              ภาพรวม: {DIR_ICON(feed.overall.direction)} {feed.overall.direction === "bullish" ? "หนุนหุ้น" : feed.overall.direction === "bearish" ? "กดหุ้น" : "สมดุล"}
              {feed.overall.impact !== null && <span className="text-zinc-500 ml-2 num">รุนแรง {feed.overall.impact.toFixed(0)}/3</span>}
            </span>
            {feed.overall.topRisk && <span className="chip bg-amber-500/10 text-amber-400 border border-amber-500/25 !text-[11px]">⚠️ ความเสี่ยงหลัก: {feed.overall.topRisk === "inflation" ? "เงินเฟ้อ/ดอกเบี้ย" : feed.overall.topRisk === "war" ? "สงคราม" : feed.overall.topRisk === "policy" ? "นโยบาย" : feed.overall.topRisk === "china" ? "จีน/การค้า" : "การเมือง"}</span>}
            <span className="text-[10px] text-zinc-600 ml-auto">อัปเดต {new Date(feed.asOf).toLocaleTimeString("th-TH")}</span>
          </div>
        </div>
      )}

      {/* วิเคราะห์รายชิ้น */}
      <div className="card p-4">
        <h2 className="text-sm font-bold text-zinc-100 mb-2">🔍 วิเคราะห์ข่าว/เหตุการณ์เอง</h2>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="วางข่าวที่อยากรู้ผลกระทบ เช่น Trump ยกเลิกกฎ EV / Fed ขึ้นดอกเบี้ย / จีนบุกไต้หวัน..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && analyze()} />
          <button className="btn-primary shrink-0" onClick={analyze} disabled={loading || q.trim().length < 10}>{loading ? "🧠…" : "ตรวจ"}</button>
        </div>
        {analysis && "error" in analysis && <div className="mt-3 text-sm text-down">{analysis.error}</div>}
        {analysis && !("error" in analysis) && (
          <div className="mt-4 space-y-3">
            <div className={`rounded-lg border px-3 py-2 text-sm ${analysis.direction === "bullish" ? "bg-up/5 border-up/25 text-up" : analysis.direction === "bearish" ? "bg-down/5 border-down/25 text-down" : "bg-base-900 border-base-700 text-zinc-300"}`}>
              {analysis.jevText}
            </div>
            {analysis.stocks.length > 0 && (
              <div>
                <div className="text-xs font-bold text-zinc-300 mb-2">📈 หุ้นที่กระทบ (ราคาปัจจุบัน)</div>
                <div className="flex flex-wrap gap-2">
                  {analysis.stocks.map(s => (
                    <Link key={s.t} href={`/stock/${encodeURIComponent(s.t)}`} className="flex items-center gap-2 bg-base-850 border border-base-700 rounded-lg px-3 py-1.5 hover:border-accent/50">
                      <span className="text-sm font-bold text-zinc-100">{s.t}</span>
                      {s.price !== null && <span className="text-xs num text-zinc-300">{s.price >= 1000 ? s.price.toFixed(0) : s.price.toFixed(2)}</span>}
                      {s.chgPct !== null && <span className={`text-xs num ${s.chgPct >= 0 ? "text-up" : "text-down"}`}>{s.chgPct >= 0 ? "+" : ""}{s.chgPct.toFixed(1)}%</span>}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {analysis.atlasCards.length > 0 && (
              <Link href="/atlas" className="inline-flex gap-1.5 items-center text-xs text-purple-300 hover:underline">🕵️ บริบทใน Atlas ({analysis.atlasCards.length} การ์ด) →</Link>
            )}
          </div>
        )}
      </div>

      {/* Feed */}
      {err && <div className="card p-6 text-sm text-down">{err}</div>}
      {!feed && !err && <div className="card p-6 text-sm text-zinc-500">กำลังดึงข่าว…</div>}
      {feed && feed.items.length === 0 && <div className="card p-6 text-sm text-zinc-500">ไม่มีข่าวตอนนี้ — กด ⟳ รีเฟรช</div>}

      {feed && feed.items.length > 0 && (
        <div className="space-y-2">
          {feed.items.map((n, i) => (
            <div key={i} className={`card p-4 ${n.impact !== null && n.impact >= 2 ? "border-l-4 " + (n.direction === "bearish" ? "border-l-down" : n.direction === "bullish" ? "border-l-up" : "border-l-amber-500") : ""}`}>
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">{n.topic}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="text-lg shrink-0">{DIR_ICON(n.direction)}</span>
                    <p className="text-sm text-zinc-100 leading-snug flex-1">{n.title}</p>
                    {n.impact !== null && <span className={`chip !text-[10px] border shrink-0 ${n.impact >= 2 ? "bg-amber-500/10 text-amber-400 border-amber-500/25" : "bg-base-800 text-zinc-500 border-base-700"}`} title="ความรุนแรงจาก Jev">รุนแรง {n.impact.toFixed(0)}/3</span>}
                    {n.fedImplication && n.fedImplication !== "neutral" && <span className="chip !text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/25 shrink-0">{n.fedImplication === "hawkish" ? "Fed ⚖️" : "Fed 🕊️"}</span>}
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-1">{n.source} · {fmtTime(n.time)}</div>

                  {/* หุ้นที่กระทบ + ราคา */}
                  {n.stocks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {n.stocks.map(s => (
                        <Link key={s.t} href={`/stock/${encodeURIComponent(s.t)}`} className="flex items-center gap-1.5 bg-base-850 border border-base-700 rounded-md px-2 py-0.5 hover:border-accent/40 text-[11px]">
                          <span className="font-semibold text-zinc-200">{s.t}</span>
                          {s.price !== null && <span className="text-zinc-400 num">{s.price >= 1000 ? s.price.toFixed(0) : s.price.toFixed(2)}</span>}
                          {s.chgPct !== null && <span className={`num ${s.chgPct >= 0 ? "text-up" : "text-down"}`}>{s.chgPct >= 0 ? "+" : ""}{s.chgPct.toFixed(1)}%</span>}
                        </Link>
                      ))}
                    </div>
                  )}

                  {n.atlasCard && (
                    <Link href={`/atlas?card=${n.atlasCard}`} className="inline-flex mt-1.5 text-[10px] text-purple-300 hover:underline">🕵️ บริบท: {n.atlasCard} →</Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
