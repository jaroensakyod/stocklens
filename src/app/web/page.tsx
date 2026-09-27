"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// 🕸️ News Web — แผนผังข่าวเชื่อมโยง "ข่าวนี้ → เกิดนี้ → กระทบหุ้นนี้" + Dual-Lens AI แชท
interface Node { id: string; label: string; type: string; emoji?: string; x?: number; y?: number }
interface Edge { from: string; to: string; label: string; direction: string }
interface WebData { nodes: Node[]; edges: Edge[]; hotNews: { title: string; source: string; time: number; sentiment?: string }[] }
interface Analysis {
  event: string;
  thaweesakh: { signal: string; view: string; assets: string[] };
  jiang: { signal: string; view: string; assets: string[] };
  jevSentiment?: { sentiment: string; impact: number; confidence: number };
  chains: { name: string; stocks: string[] }[];
}

const TYPE_COLOR: Record<string, string> = { theme: "#eab308", asset: "#22c55e", stock: "#3b82f6" };
const DIR_COLOR: Record<string, string> = { up: "#22c55e", down: "#ef4444", neutral: "#71717a" };
const fmtTime = (t: number) => { const h = Math.floor((Date.now() - t) / 3600e3); return h < 1 ? "เมื่อสักครู่" : h < 24 ? `${h} ชม.ก่อน` : `${Math.floor(h / 24)} วันก่อน`; };

export default function WebPage() {
  const [data, setData] = useState<WebData | null>(null);
  const [input, setInput] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => { fetch("/api/web").then(r => r.json()).then(setData).catch(() => {}); }, []);

  const analyze = async () => {
    if (input.trim().length < 5) return;
    setLoading(true); setAnalysis(null);
    try { const res = await fetch("/api/web", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: input }) }); setAnalysis(await res.json()); } catch {}
    setLoading(false);
  };

  if (!data) return <div className="card p-8 text-center text-sm text-zinc-500">กำลังโหลดแผนผัง…</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🕸️ News Web — แผนผังข่าวเชื่อมโยง</h1>
        <p className="text-sm text-zinc-400 mt-1">ข่าวนี้ → เกิดอะไรต่อ → กระทบหุ้นไหน — เห็นเป็นภาพเดียว พร้อมแชท AI ตอบตามมุมมอง AT + PJ</p>
      </div>

      {/* 1. SVG Graph */}
      <div className="card p-4 overflow-x-auto">
        <h2 className="text-sm font-bold text-zinc-100 mb-3">📊 แผนผังวันนี้ (คลิก node เพื่อดูรายละเอียด)</h2>
        <svg viewBox="0 0 800 500" className="w-full min-w-[600px] h-[400px]">
          {/* Edges */}
          {data.edges.map((e, i) => {
            const from = data.nodes.find(n => n.id === e.from);
            const to = data.nodes.find(n => n.id === e.to);
            if (from?.x === undefined || from?.y === undefined || to?.x === undefined || to?.y === undefined) return null;
            const color = DIR_COLOR[e.direction] ?? "#71717a";
            return (
              <g key={i}>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={e.direction === "neutral" ? 1 : 2} opacity={0.5} />
                <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 3} textAnchor="middle" fontSize="7" fill={color} opacity={0.7}>{e.label}</text>
              </g>
            );
          })}
          {/* Nodes */}
          {data.nodes.map(n => {
            if (n.x === undefined || n.y === undefined) return null;
            const color = TYPE_COLOR[n.type] ?? "#71717a";
            const r = n.type === "theme" ? 28 : n.type === "asset" ? 20 : 14;
            return (
              <g key={n.id} onClick={() => setSelectedNode(n)} className="cursor-pointer">
                <circle cx={n.x} cy={n.y} r={r} fill={color} opacity={0.2} stroke={color} strokeWidth="2" />
                <text x={n.x} y={n.y - r - 4} textAnchor="middle" fontSize={n.type === "theme" ? "10" : "8"} fill="#a1a1aa">{n.emoji} {n.label.slice(0, 14)}</text>
              </g>
            );
          })}
        </svg>
        {/* Legend */}
        <div className="flex gap-3 text-[10px] text-zinc-500 mt-2">
          <span>🟡 ธีม/เหตุการณ์</span><span>🟢 สินทรัพย์/กลุ่ม</span><span>🔵 หุ้นรายตัว</span>
          <span className="text-up">— ▲ หนุน</span><span className="text-down">— ▼ กด</span>
        </div>
        {selectedNode && (
          <div className="mt-3 bg-base-850 rounded-lg p-3 text-sm">
            <span className="font-bold text-zinc-100">{selectedNode.emoji} {selectedNode.label}</span>
            <span className="text-[10px] text-zinc-500 ml-2">({selectedNode.type === "theme" ? "ธีม" : selectedNode.type === "asset" ? "สินทรัพย์" : "หุ้น"})</span>
            {selectedNode.type === "stock" && <Link href={`/stock/${encodeURIComponent(selectedNode.label)}`} className="ml-2 text-accent-soft hover:underline text-xs">ดูหน้าวิเคราะห์ →</Link>}
            {selectedNode.id.startsWith("theme:") && <Link href="/radar" className="ml-2 text-accent-soft hover:underline text-xs">ดู Radar →</Link>}
          </div>
        )}
      </div>

      {/* 2. ข่าวร้อนวันนี้ */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100 mb-3">🔥 ข่าวที่กำลังขับเคลื่อนแผนผัง</h2>
        <ul className="space-y-2">
          {data.hotNews.slice(0, 6).map((n, i) => (
            <li key={i} className="bg-base-850 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-sm">{n.sentiment === "bullish" ? "🟢" : n.sentiment === "bearish" ? "🔴" : "⚪"}</span>
                <div className="flex-1">
                  <p className="text-xs text-zinc-300 leading-snug">{n.title}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{n.source} · {fmtTime(n.time)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 3. Dual-Lens AI Chat */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100 mb-1">🤖 AI แชท — ถามอะไรก็ได้เกี่ยวกับเหตุการณ์/ข่าว</h2>
        <p className="text-[10px] text-zinc-600 mb-3">ระบบจะตอบผ่านมุมมองของ AT + PJ พร้อม Jev ให้คะแนน + โยงหุ้นที่กระทบ</p>
        <div className="flex gap-2 mb-4">
          <input className="input flex-1" placeholder="เช่น: อิหร่านปิดช่องแคบฮอร์มุซ / ทรัมป์ลดดอกเบี้ย / จีนบุกไต้หวัน / ทองทะลุ 5,000" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && analyze()} />
          <button className="btn-primary shrink-0" onClick={analyze} disabled={loading || input.trim().length < 5}>{loading ? "กำลังวิเคราะห์…" : "ถาม"}</button>
        </div>

        {analysis && (
          <div className="space-y-4">
            {/* Jev Sentiment */}
            {analysis.jevSentiment && (
              <div className={`rounded-lg p-3 border ${analysis.jevSentiment.sentiment === "bullish" ? "bg-up/5 border-up/20" : analysis.jevSentiment.sentiment === "bearish" ? "bg-down/5 border-down/20" : "bg-base-800 border-base-700"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{analysis.jevSentiment.sentiment === "bullish" ? "🟢" : analysis.jevSentiment.sentiment === "bearish" ? "🔴" : "⚪"}</span>
                  <span className="text-sm font-bold text-zinc-100">Jev AI: {analysis.jevSentiment.sentiment === "bullish" ? "เหตุการณ์นี้เป็นบวกต่อตลาด" : analysis.jevSentiment.sentiment === "bearish" ? "เหตุการณ์นี้เป็นลบต่อตลาด" : "เหตุการณ์นี้เป็นกลาง"}</span>
                  <span className="chip bg-base-700 text-zinc-400 !text-[9px] num">impact {analysis.jevSentiment.impact.toFixed(1)}/2</span>
                </div>
              </div>
            )}

            {/* ทวีสุข Lens */}
            <div className="bg-base-850 rounded-lg p-4 border-l-4 border-accent">
              <div className="text-xs font-bold text-accent-soft mb-1">🔬 มุมมอง AT</div>
              <div className="text-sm font-bold text-zinc-100">{analysis.thaweesakh.signal}</div>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{analysis.thaweesakh.view}</p>
              {analysis.thaweesakh.assets.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-zinc-600">สินทรัพย์ที่ได้ประโยชน์:</span>
                  {analysis.thaweesakh.assets.map(a => <Link key={a} href={`/stock/${encodeURIComponent(a)}`} className="chip bg-up/10 text-up border border-up/30 !text-[9px]">▲ {a}</Link>)}
                </div>
              )}
            </div>

            {/* Jiang Lens */}
            <div className="bg-base-850 rounded-lg p-4 border-l-4 border-blue-500">
              <div className="text-xs font-bold text-blue-400 mb-1">🧠 มุมมอง PJ</div>
              <div className="text-sm font-bold text-zinc-100">{analysis.jiang.signal}</div>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{analysis.jiang.view}</p>
              {analysis.jiang.assets.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-zinc-600">สินทรัพย์ที่เกี่ยวข้อง:</span>
                  {analysis.jiang.assets.map(a => <Link key={a} href={`/stock/${encodeURIComponent(a)}`} className="chip bg-blue-500/10 text-blue-400 border border-blue-500/30 !text-[9px]">{a}</Link>)}
                </div>
              )}
            </div>

            {/* Chains */}
            {analysis.chains.length > 0 && (
              <div>
                <div className="text-xs text-zinc-400 mb-2">🕸️ ห่วงโซ่ผลกระทบ:</div>
                <div className="space-y-2">
                  {analysis.chains.map(c => (
                    <div key={c.name} className="bg-base-850 rounded-lg p-3 flex items-center justify-between">
                      <span className="text-sm text-zinc-200">{c.name}</span>
                      <div className="flex gap-1.5">{c.stocks.map(s => <Link key={s} href={`/stock/${encodeURIComponent(s)}`} className="chip bg-base-700 text-zinc-300 !text-[9px]">{s}</Link>)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
