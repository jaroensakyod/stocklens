"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrokerBadge from "@/components/BrokerBadge";
import type { Quote } from "@/lib/types";

interface Holding {
  issuer: string; ticker?: string; valueUsd: number; pct: number; shares: number;
  putCall?: "PUT" | "CALL"; note?: string; quote?: Quote;
  change?: { type: "new" | "increased" | "decreased" | "same"; deltaPct?: number };
}
interface Guru {
  id: string; name: string; firm: string; emoji: string; thesis: string; caution: string;
  source: "live" | "snapshot"; asOf?: string; filedAt?: string; totalValueUsd?: number; holdings: Holding[];
  qoq?: { increased: number; decreased: number; newCount: number; exited: { issuer: string; ticker?: string }[] };
}

export default function GurusPage() {
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [err, setErr] = useState("");
  const [why, setWhy] = useState<Record<string, string>>({});
  const [busyWhy, setBusyWhy] = useState("");

  useEffect(() => {
    fetch("/api/gurus")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "โหลดไม่สำเร็จ");
        setGurus(j.gurus ?? []);
      })
      .catch((e) => setErr(e.message));
  }, []);

  const askWhy = async (id: string) => {
    setBusyWhy(id);
    try {
      const res = await fetch("/api/gurus/why", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const j = await res.json();
      setWhy((w) => ({ ...w, [id]: j.why || "ไม่สำเร็จ" }));
    } catch {
      setWhy((w) => ({ ...w, [id]: "ไม่สำเร็จ" }));
    }
    setBusyWhy("");
  };

  if (err) return <div className="card p-8 text-center text-down text-sm">{err}</div>;
  if (!gurus.length) return <div className="py-20 text-center text-zinc-500 text-sm">กำลังดึง 13F สดจาก SEC EDGAR… (ครั้งแรกใช้เวลา ~20-40 วินาที)</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🐋 พอร์ตกูรู — 13F สดจาก SEC โดยตรง</h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-3xl leading-relaxed">
          ข้อมูลดึงตรงจาก<b className="text-zinc-200">ใบยื่น 13F-HR ล่าสุดที่ SEC รับไว้</b> (แหล่งเดียวกับที่สถาบันใช้) — ไม่ผ่านคนกลาง ไม่มีค่าใช้จ่าย ·
          พร้อมเหตุผล 💡 ว่าทำไมเขาเลือก และปุ่มให้ AI ถอดรหัสพอร์ตเต็มรูปแบบ
        </p>
      </div>

      {gurus.map((g) => (
        <div key={g.id} className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-zinc-50">
                {g.emoji} {g.name} <span className="text-sm font-normal text-zinc-500">· {g.firm}</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                <span className={`chip ${g.source === "live" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"}`}>
                  {g.source === "live" ? "🔴 LIVE จาก SEC EDGAR" : "📸 Snapshot"}
                </span>
                {g.asOf && <span className="num text-zinc-500">งวด {g.asOf}</span>}
                {g.filedAt && <span className="num text-zinc-600">ยื่น {g.filedAt}</span>}
                {g.totalValueUsd && g.totalValueUsd > 1e8 ? <span className="num text-accent-soft font-semibold">พอร์ต ${(g.totalValueUsd / 1e9).toFixed(1) + "B$"}</span> : null}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button className="btn-ghost text-xs !py-1.5" onClick={() => askWhy(g.id)} disabled={busyWhy === g.id}>
                {busyWhy === g.id ? "AI กำลังถอดรหัส…" : "🧠 ทำไมเขาถึงเลือก (AI)"}
              </button>
              <CloneTestButton guruId={g.id} />
            </div>
          </div>

          {g.qoq && (
            <div className="flex flex-wrap gap-1.5 mt-2 text-[11px]">
              <span className="chip bg-base-800 text-zinc-300 border border-base-700">เทียบไตรมาสก่อน:</span>
              {g.qoq.newCount > 0 && <span className="chip bg-emerald-500/15 text-emerald-400">🆕 เปิดใหม่ {g.qoq.newCount}</span>}
              {g.qoq.increased > 0 && <span className="chip bg-up/10 text-up">▲ เพิ่ม {g.qoq.increased}</span>}
              {g.qoq.decreased > 0 && <span className="chip bg-down/10 text-down">▼ ลด {g.qoq.decreased}</span>}
              {g.qoq.exited.length > 0 && (
                <span className="chip bg-rose-500/15 text-rose-400" title={g.qoq.exited.map((e) => e.ticker || e.issuer).join(", ")}>
                  🚪 ขายออก: {g.qoq.exited.slice(0, 3).map((e) => e.ticker || e.issuer.slice(0, 12)).join(", ")}{g.qoq.exited.length > 3 ? "…" : ""}
                </span>
              )}
            </div>
          )}

          <p className="text-sm text-zinc-300 mt-3 leading-relaxed">{g.thesis}</p>

          {why[g.id] && (
            <div className="mt-3 bg-base-850 border-l-4 border-l-accent rounded-lg p-4 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{why[g.id]}</div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-[11px] text-zinc-500 border-b border-base-700/60">
                  <th className="text-left py-2">บริษัท</th>
                  <th className="text-right py-2">% พอร์ต</th>
                  <th className="text-right py-2 hidden sm:table-cell">มูลค่า</th>
                  <th className="text-right py-2 hidden md:table-cell">หุ้น/สัญญา</th>
                  <th className="text-right py-2">ราคาตอนนี้</th>
                  <th className="text-right py-2 hidden sm:table-cell">QoQ</th>
                  <th className="text-right py-2 hidden lg:table-cell">ช่องทางซื้อ</th>
                </tr>
              </thead>
              <tbody>
                {g.holdings.map((h) => {
                  const q = h.quote;
                  const isPut = h.putCall === "PUT";
                  return (
                    <tr key={h.issuer} className={`border-b border-base-700/30 ${isPut ? "bg-rose-500/5" : ""}`}>
                      <td className="py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {h.ticker ? (
                            <Link href={`/stock/${h.ticker}`} className="font-bold text-zinc-100 hover:text-accent-soft">{h.ticker}</Link>
                          ) : (
                            <span className="font-semibold text-zinc-300 text-xs">{h.issuer}</span>
                          )}
                          {isPut && <span className="chip bg-rose-500/15 text-rose-400 !text-[9px]">PUT (short)</span>}
                          {h.putCall === "CALL" && <span className="chip bg-sky-500/15 text-sky-400 !text-[9px]">CALL</span>}
                          {h.ticker && <BrokerBadge ticker={h.ticker} compact />}
                        </div>
                        {h.note && <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">💡 {h.note}</p>}
                      </td>
                      <td className="py-2 text-right num text-zinc-100 font-semibold">{h.pct.toFixed(1)}%</td>
                      <td className="py-2 text-right num text-zinc-400 hidden sm:table-cell">{h.valueUsd ? "$" + (h.valueUsd / 1e6).toFixed(0) + "M" : "—"}</td>
                      <td className="py-2 text-right num text-zinc-500 hidden md:table-cell">{h.shares ? h.shares.toLocaleString() : "—"}</td>
                      <td className={`py-2 text-right num text-xs ${q ? (q.changePct >= 0 ? "text-up" : "text-down") : "text-zinc-600"}`}>
                        {q ? `${q.price.toFixed(1)} (${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(1)}%)` : "—"}
                      </td>
                      <td className="py-2 text-right text-[11px] hidden sm:table-cell">
                        {h.change?.type === "new" && <span className="chip bg-emerald-500/15 text-emerald-400">🆕</span>}
                        {h.change?.type === "increased" && <span className="num text-up">▲{h.change.deltaPct}%</span>}
                        {h.change?.type === "decreased" && <span className="num text-down">▼{Math.abs(h.change.deltaPct ?? 0)}%</span>}
                        {(!h.change || h.change.type === "same") && <span className="text-zinc-700">—</span>}
                      </td>
                      <td className="py-2 text-right hidden lg:table-cell">{h.ticker ? <BrokerBadge ticker={h.ticker} compact /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-amber-400/80 mt-4 leading-relaxed bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">⚠️ {g.caution}</p>
        </div>
      ))}

      <p className="text-[11px] text-zinc-600 leading-relaxed">
        ข้อมูล: SEC EDGAR 13F-HR filings (ดึงสด cache 12 ชม.) · 13F ล่าช้าสูงสุด 45 วันหลังสิ้นไตรมาส และเห็นเฉพาะตำแหน่งหุ้นสหรัฐฯ ·
        เหตุผล 💡 เป็นความรู้สาธารณะเกี่ยวกับสไตล์การลงทุน ไม่ใช่ข้อมูลจากกูรูโดยตรง · เชิงการศึกษา ไม่ใช่คำแนะนำการลงทุน
      </p>
    </div>
  );
}

// ===== 🧪 ก๊อปปี้กูรูแบบมีหลักฐาน — ตาม top-10 ทุกไตรมาส ย้อนหลัง ~3 ปี เทียบ SPY =====
const GRADE_STYLE: Record<string, string> = {
  S: "text-emerald-400 border-emerald-500/50 bg-emerald-500/10",
  A: "text-up border-up/50 bg-up/10",
  B: "text-accent-soft border-accent/50 bg-accent/10",
  C: "text-amber-400 border-amber-500/50 bg-amber-500/10",
  D: "text-down border-down/50 bg-down/10",
};

function CloneTestButton({ guruId }: { guruId: string }) {
  const CLONABLE = new Set(["buffett", "ackman", "druckenmiller", "tepper", "klarman"]);
  const [result, setResult] = useState<null | {
    name: string; firm: string; emoji: string;
    clone: { totalPct: number; cagrPct: number; maxDrawdownPct: number };
    spy: { totalPct: number; cagrPct: number };
    grade: string; beatsSpy: boolean; turnoverNote: string; currentTop: string[];
    quarters: { filedAt: string; holdings: string[]; quarterPct: number; spyPct: number; cumClone: number; cumSpy: number }[];
    note: string; error?: string;
  }>(null);
  const [busy, setBusy] = useState(false);

  if (!CLONABLE.has(guruId)) return null; // multi-strategy พัน holdings → top-10 ไม่แทนตัว

  const run = async () => {
    if (result) {
      setResult(null);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/guru-backtest?guru=${guruId}`);
      setResult(await res.json());
    } catch {
      setResult(null);
    }
    setBusy(false);
  };

  return (
    <div className="w-full space-y-3">
      <button className="btn-primary text-xs !py-1.5" onClick={run} disabled={busy}>
        {busy ? "กำลังย้อน 12 ไตรมาสจาก SEC… (~30-60 วิ)" : result ? "ซ่อนผลทดสอบ" : "🧪 ตามเขาแล้วรวยไหม? (ย้อนหลัง 3 ปี)"}
      </button>

      {result && !result.error && (
        <div className="border border-base-700 rounded-xl p-4 bg-base-850 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className={`rounded-lg border p-2.5 ${GRADE_STYLE[result.grade] || ""}`}>
              <div className="text-[10px] opacity-70">ตามกูรูแล้วเทียบ SPY</div>
              <div className="text-3xl font-black">{result.grade}</div>
            </div>
            <div className="rounded-lg border border-base-700 p-2.5">
              <div className="text-[10px] text-zinc-500">👥 ก๊อปปี้ top-10 ทุกไตรมาส</div>
              <div className={`num text-xl font-bold ${result.clone.totalPct >= 0 ? "text-up" : "text-down"}`}>
                {result.clone.totalPct >= 0 ? "+" : ""}{result.clone.totalPct}%
              </div>
              <div className="text-[10px] text-zinc-600 num">CAGR {result.clone.cagrPct}% · ลดลงสูงสุด {result.clone.maxDrawdownPct}%</div>
            </div>
            <div className="rounded-lg border border-base-700 p-2.5">
              <div className="text-[10px] text-zinc-500">📊 SPY ถือยาวช่วงเดียวกัน</div>
              <div className="num text-xl font-bold text-zinc-200">{result.spy.totalPct >= 0 ? "+" : ""}{result.spy.totalPct}%</div>
              <div className="text-[10px] text-zinc-600 num">CAGR {result.spy.cagrPct}%</div>
            </div>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            {result.beatsSpy ? "🏆 ตามเขาชนะตลาด" : "📉 ตามเขาแพ้ตลาด"} — {result.turnoverNote}
          </p>

          <div>
            <p className="text-[11px] font-semibold text-zinc-400 mb-1">🗓️ ทำตามได้เลยวันนี้ — top-10 ล่าสุดของเขา:</p>
            <div className="flex flex-wrap gap-1.5">
              {result.currentTop.map((t) => (
                <Link key={t} href={`/stock/${t}`} className="chip bg-accent/10 text-accent-soft border border-accent/30 hover:bg-accent/20">
                  {t} →
                </Link>
              ))}
            </div>
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-zinc-400">ดูบันทึกทุกไตรมาส ({result.quarters.length} ไตรมาส)</summary>
            <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
              {result.quarters.map((q) => (
                <p key={q.filedAt} className="text-[11px] text-zinc-500 num">
                  ยื่น {q.filedAt} · [{q.holdings.slice(0, 6).join(", ")}{q.holdings.length > 6 ? "…" : ""}] →{" "}
                  <span className={q.quarterPct >= q.spyPct ? "text-up" : "text-down"}>{q.quarterPct >= 0 ? "+" : ""}{q.quarterPct}%</span>
                  {" vs SPY "}<span className="text-zinc-400">{q.spyPct >= 0 ? "+" : ""}{q.spyPct}%</span>
                </p>
              ))}
            </div>
          </details>
          <p className="text-[10px] text-zinc-600 leading-relaxed">⚠️ {result.note}</p>
        </div>
      )}
      {result?.error && <p className="text-xs text-down">{result.error}</p>}
    </div>
  );
}
