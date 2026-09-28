"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { prettySym } from "@/lib/prettySymbol";

// 🇺🇸 Political Pulse v3 — Jev จัดหัวข้อข่าว (Trump/ภาษี/เฟด/จีน/สงคราม/ไทย) + Gemini เขียนสรุปต่อหัวข้อ + หุ้นที่โดนกระทบ

interface StockHit { t: string; chgPct: number | null }
interface Item {
  title: string; source: string; time: number; link?: string; topic: string;
  direction: string | null; impact: number | null; stocks: StockHit[];
}
interface TopicSection { key: string; label: string; items: Item[]; summary: string | null }
interface Feed {
  asOf: string; topics: TopicSection[]; items: Item[]; aiSummaries: boolean;
  overall: { impact: number | null; direction: string | null; topRisk: string | null } | null;
}
interface Analysis {
  impact: number | null; direction: string | null; topic: string | null;
  stocks: { t: string; price: number | null; chgPct: number | null }[];
  jevText: string; error?: string;
}

const fmtTime = (t: number) => { const h = Math.floor((Date.now() - t) / 3600e3); return h < 1 ? "เมื่อสักครู่" : h < 24 ? `${h} ชม.` : `${Math.floor(h / 24)} วัน`; };
const DIR_ICON = (d: string | null) => d === "bullish" ? "🟢" : d === "bearish" ? "🔴" : "⚪";
const RISK_TH: Record<string, string> = { inflation: "เงินเฟ้อ/ดอกเบี้ย", war: "สงคราม", policy: "นโยบาย/กฎระเบียบ", china: "จีน/การค้า", election: "การเมือง" };

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

  useEffect(() => {
    load();
    const timer = setInterval(() => load(), 10 * 60_000); // รีเฟรชเองทุก 10 นาที (server cache 20 นาที)
    return () => clearInterval(timer);
  }, []);

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
            Jev คัดข่าวสด ≤3 วัน จัดเป็นหัวข้อ (Trump · ภาษี · เฟด · จีน · สงคราม · การเมืองไทย) — Gemini สรุปแต่ละหัวข้อ + <b className="text-zinc-200">ราคาหุ้นที่โดนกระทบ</b>
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
            {feed.overall.topRisk && <span className="chip bg-amber-500/10 text-amber-400 border border-amber-500/25 !text-[11px]">⚠️ ความเสี่ยงหลัก: {RISK_TH[feed.overall.topRisk] ?? feed.overall.topRisk}</span>}
            <span className="text-[10px] text-zinc-600 ml-auto">อัปเดต {new Date(feed.asOf).toLocaleTimeString("th-TH")} · รีเฟรชเองทุก 10 นาที</span>
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
                      <span className="text-sm font-bold text-zinc-100">{prettySym(s.t)}</span>
                      {s.price !== null && <span className="text-xs num text-zinc-300">{s.price >= 1000 ? s.price.toFixed(0) : s.price.toFixed(2)}</span>}
                      {s.chgPct !== null && <span className={`text-xs num ${s.chgPct >= 0 ? "text-up" : "text-down"}`}>{s.chgPct >= 0 ? "+" : ""}{s.chgPct.toFixed(1)}%</span>}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Feed แบ่งตามหัวข้อ */}
      {err && <div className="card p-6 text-sm text-down">{err}</div>}
      {!feed && !err && <div className="card p-6 text-sm text-zinc-500">กำลังดึงข่าว + ให้ Jev จัดหัวข้อ… (ครั้งแรกใช้ ~20 วิ)</div>}
      {feed && feed.items.length === 0 && <div className="card p-6 text-sm text-zinc-500">ไม่มีข่าวตอนนี้ — กด ⟳ รีเฟรช</div>}

      {feed && feed.items.length > 0 && (
        <div className="space-y-4">
          {feed.topics.map((t) => (
            <section key={t.key} className="card p-4">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h2 className="text-sm font-bold text-zinc-100">{t.label}</h2>
                <span className="chip bg-base-800 text-zinc-500 border border-base-700 !text-[10px] !py-0.5 num">{t.items.length} ข่าว</span>
              </div>
              {t.summary && (
                <p className="text-[13px] text-zinc-300 leading-relaxed bg-base-900 border-l-2 border-l-accent/60 rounded-lg px-3 py-2 mb-3">
                  {t.summary} <span className="text-[9px] text-zinc-600">— สรุปโดย Gemini จากพาดหัวจริง</span>
                </p>
              )}
              <div className="space-y-2">
                {t.items.map((n, i) => (
                  <div key={i} className={`flex items-start gap-2.5 bg-base-900 rounded-lg px-3 py-2 ${n.impact !== null && n.impact >= 2 ? (n.direction === "bearish" ? "border border-down/30" : n.direction === "bullish" ? "border border-up/30" : "border border-amber-500/30") : ""}`}>
                    <span className="text-base shrink-0 mt-0.5">{DIR_ICON(n.direction)}</span>
                    <div className="flex-1 min-w-0">
                      {n.link ? (
                        <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-[13px] text-zinc-200 leading-snug hover:text-accent-soft">{n.title}</a>
                      ) : (
                        <p className="text-[13px] text-zinc-200 leading-snug">{n.title}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-zinc-600">{n.source} · {fmtTime(n.time)}</span>
                        {n.impact !== null && n.impact >= 2 && <span className="chip bg-amber-500/10 text-amber-400 border border-amber-500/25 !text-[9px]">รุนแรง {n.impact.toFixed(0)}/3</span>}
                        {n.stocks.slice(0, 4).map(s => (
                          <Link key={s.t} href={`/stock/${encodeURIComponent(s.t)}`} className="chip bg-base-800 text-zinc-300 border border-base-700 !text-[9px] hover:border-accent/40">
                            {prettySym(s.t)}
                            {s.chgPct !== null && <span className={s.chgPct >= 0 ? "text-up ml-0.5" : "text-down ml-0.5"}>{s.chgPct >= 0 ? "+" : ""}{s.chgPct.toFixed(1)}%</span>}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
