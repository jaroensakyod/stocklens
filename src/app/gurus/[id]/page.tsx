"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { Quote } from "@/lib/types";

// 🐋 พอร์ตเต็มกูรูรายคน — เลือกไตรมาสย้อนหลัง 4 งวด + donut สัดส่วน + QoQ ต่อหุ้น (เทียบหน้าพอร์ตนักลงทุนของคู่แข่ง แต่เรา LIVE)
interface Holding {
  issuer: string; ticker?: string; valueUsd: number; pct: number; shares: number;
  putCall?: "PUT" | "CALL"; note?: string; quote?: Quote;
  change?: { type: "new" | "increased" | "decreased" | "same"; deltaPct?: number };
}
interface GuruDetail {
  id: string; name: string; firm: string; emoji: string; style: string; thesis: string; caution: string;
  source: "live" | "snapshot"; asOf?: string; filedAt?: string; totalValueUsd?: number;
  holdings: Holding[];
  qoq?: { increased: number; decreased: number; newCount: number; exited: { issuer: string; ticker?: string; prevPct: number }[] };
  quarters: string[]; count: number; concentrationTop10: number;
}

const DONUT_COLORS = ["#eab308", "#2dd4bf", "#f472b6", "#a78bfa", "#fb923c", "#34d399", "#60a5fa", "#f87171", "#c084fc", "#facc15", "#3f3f46"];

export default function GuruDetailPage() {
  const routeParams = useParams<{ id: string }>();
  const id = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
  const [guru, setGuru] = useState<GuruDetail | null>(null);
  const [offset, setOffset] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => {
    setGuru(null);
    setErr("");
    fetch(`/api/gurus/${encodeURIComponent(id)}?q=${offset}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "โหลดไม่สำเร็จ");
        setGuru(j.guru);
      })
      .catch((e) => setErr(e.message));
  }, [id, offset]);

  if (err) return <div className="card p-8 text-center text-down text-sm">{err} · <Link href="/gurus" className="text-accent-soft underline">กลับหน้ารวมกูรู</Link></div>;
  if (!guru) return <div className="py-20 text-center text-zinc-500 text-sm">กำลังดึง 13F จาก SEC EDGAR… (ครั้งแรกของไตรมาสนี้อาจใช้เวลา ~1 นาที)</div>;

  const top10 = guru.holdings.slice(0, 10);
  const donutData = [...top10.map((h) => ({ name: h.ticker || h.issuer.slice(0, 10), value: h.pct })), { name: "อื่นๆ", value: Math.max(0, 100 - top10.reduce((a, h) => a + h.pct, 0)) }];

  return (
    <div className="space-y-5">
      <Link href="/gurus" className="chip bg-base-800 text-zinc-400 border border-base-700">← ทุกกูรู</Link>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-zinc-50">{guru.emoji} {guru.name}</h1>
            <p className="text-sm text-zinc-500">{guru.firm}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
              <span className={`chip ${guru.source === "live" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"}`}>
                {guru.source === "live" ? "🔴 LIVE จาก SEC EDGAR" : "📸 Snapshot"}
              </span>
              {guru.asOf && <span className="num text-zinc-500">งวด {guru.asOf}</span>}
              {guru.filedAt && <span className="num text-zinc-600">ยื่น {guru.filedAt}</span>}
            </div>
          </div>
          {guru.quarters.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-500">ไตรมาส:</span>
              {guru.quarters.map((q, i) => (
                <button key={q} onClick={() => setOffset(i)} className={`num px-2.5 py-1 rounded-lg text-[11px] font-bold ${i === offset ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 hover:bg-base-700"}`}>
                  {q.slice(2)}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-sm text-zinc-300 mt-3 leading-relaxed">{guru.thesis}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          {[
            ["มูลค่าพอร์ต 13F", guru.totalValueUsd ? `$${(guru.totalValueUsd / 1e9).toFixed(1)}B` : "—"],
            ["จำนวนหลักทรัพย์", `${guru.count.toLocaleString()} ตัว`],
            ["ความกระจุกตัว top 10", `${guru.concentrationTop10.toFixed(1)}%`],
            ["QoQ", guru.qoq ? `🆕${guru.qoq.newCount} ▲${guru.qoq.increased} ▼${guru.qoq.decreased}` : "—"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-base-700/60 bg-base-800/40 p-2.5">
              <div className="text-[10px] text-zinc-500">{k}</div>
              <div className="num text-sm font-bold text-zinc-100">{v}</div>
            </div>
          ))}
        </div>

        {/* Donut สัดส่วน */}
        <div className="grid md:grid-cols-2 gap-5 mt-5 items-center">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="82%" paddingAngle={1} stroke="none">
                  {donutData.map((_, i) => (<Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />))}
                </Pie>
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-zinc-500 mb-1">สัดส่วนพอร์ต (top 10 + ส่วนที่เหลือ) · ณ {guru.asOf}</p>
            {donutData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                <span className="text-zinc-400 flex-1">{d.name}</span>
                <span className="num text-zinc-200">{d.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {guru.qoq?.exited?.length ? (
        <div className="card p-4">
          <p className="text-xs text-zinc-500 mb-2">🚪 ขายออกทั้งหมดเทียบไตรมาสก่อน (เรียงตามขนาดเดิม)</p>
          <div className="flex flex-wrap gap-1.5">
            {guru.qoq.exited.map((e) => (
              <span key={e.issuer} className="chip bg-rose-500/10 text-rose-400 border border-rose-500/30 !text-[11px]">
                {e.ticker || e.issuer.slice(0, 16)} <span className="num opacity-70">เดิม {e.prevPct.toFixed(1)}%</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Holdings เต็ม */}
      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 text-xs text-zinc-500 border-b border-base-700/60">
          สินทรัพย์ที่ถือ ({guru.holdings.length} อันดับแรกจาก {guru.count.toLocaleString()} ตัว)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-[11px] text-zinc-500 border-b border-base-700/60">
                <th className="text-left px-4 py-2">#</th>
                <th className="text-left px-4 py-2">บริษัท</th>
                <th className="text-right px-4 py-2">% พอร์ต</th>
                <th className="text-right px-4 py-2 hidden sm:table-cell">มูลค่า</th>
                <th className="text-right px-4 py-2 hidden md:table-cell">หุ้น/สัญญา</th>
                <th className="text-right px-4 py-2">ราคาตอนนี้</th>
                <th className="text-right px-4 py-2">เทียบไตรมาสก่อน</th>
              </tr>
            </thead>
            <tbody>
              {guru.holdings.map((h, idx) => {
                const q = h.quote;
                const isPut = h.putCall === "PUT";
                return (
                  <tr key={h.issuer} className={`border-b border-base-700/30 ${isPut ? "bg-rose-500/5" : ""}`}>
                    <td className="px-4 py-2 num text-zinc-600 text-xs">{idx + 1}</td>
                    <td className="px-4 py-2">
                      {h.ticker ? (
                        <Link href={`/stock/${h.ticker}`} className="font-bold text-zinc-100 hover:text-accent-soft">{h.ticker}</Link>
                      ) : (
                        <span className="font-semibold text-zinc-300 text-xs">{h.issuer}</span>
                      )}
                      {isPut && <span className="chip bg-rose-500/15 text-rose-400 !text-[9px] ml-1.5">PUT</span>}
                      {h.note && <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">💡 {h.note}</p>}
                    </td>
                    <td className="px-4 py-2 text-right num text-zinc-100 font-semibold">{h.pct.toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right num text-zinc-400 hidden sm:table-cell">{h.valueUsd ? "$" + (h.valueUsd / 1e6).toFixed(0) + "M" : "—"}</td>
                    <td className="px-4 py-2 text-right num text-zinc-500 hidden md:table-cell">{h.shares ? h.shares.toLocaleString() : "—"}</td>
                    <td className={`px-4 py-2 text-right num text-xs ${q ? (q.changePct >= 0 ? "text-up" : "text-down") : "text-zinc-600"}`}>
                      {q ? `${q.price.toFixed(1)} (${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(1)}%)` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-[11px]">
                      {h.change?.type === "new" && <span className="chip bg-emerald-500/15 text-emerald-400">🆕 ซื้อใหม่</span>}
                      {h.change?.type === "increased" && <span className="num text-up">▲ ซื้อเพิ่ม {h.change.deltaPct}%</span>}
                      {h.change?.type === "decreased" && <span className="num text-down">▼ ลด {Math.abs(h.change.deltaPct ?? 0)}%</span>}
                      {(!h.change || h.change.type === "same") && <span className="text-zinc-700">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-amber-400/80 leading-relaxed bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">⚠️ {guru.caution}</p>
      <p className="text-[10px] text-zinc-600">13F ยื่นได้ถึง 45 วันหลังสิ้นไตรมาส · "ราคาตอนนี้" เป็นราคาสด ส่วน % พอร์ตคำนวณจากมูลค่า ณ วันสิ้นไตรมาสที่ยื่น · เชิงการศึกษา ไม่ใช่คำแนะนำการลงทุน</p>
    </div>
  );
}
