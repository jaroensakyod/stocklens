"use client";

import { useState } from "react";
import Link from "next/link";

interface PlayResult {
  stance: string; confidence: number; play: string; optionType: string;
  strike: number; expiry: string; entryEst: number; entryTotal: number;
  target: number; stop: number; contracts: number; breakEven: number;
  reasons: string[]; risks: string[]; exitPlan: string;
  delta: number; thetaDay: number;
  atmIv: number | null; ivPremiumPct: number | null; daysToEarnings: number | null;
  jevVerdict?: string; jevStance?: number | null;
  mode: string;
}

// 🎯 Option Play — AI นักยุทธ์ options เสนอไม้ (Gemini เขียน + Jev ตรวจ + hard rules บังคับ delta/premium)
export default function OptionPlayCard({ symbol }: { symbol: string }) {
  const [result, setResult] = useState<PlayResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const r = await fetch("/api/options/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "วิเคราะห์ไม่สำเร็จ");
      setResult(j);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  const noPlay = result?.play === "no_play";
  const isCall = result?.optionType === "call";

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-zinc-100">🎯 AI Option Play — {symbol}</h3>
        <button className="btn-primary text-xs !py-1.5" onClick={run} disabled={busy}>
          {busy ? "AI กำลังวิเคราะห์…" : result ? "วิเคราะห์ใหม่" : "🧠 ให้ AI เสนอไม้"}
        </button>
      </div>
      <p className="text-[10px] text-zinc-600 mt-1">
        ประกอบจากคะแนนปัจจัยจริง + สัญญาณเทคนิค + งบถัดไป + IV เทียบความผันผวน — บังคับ delta 0.30-0.70 + premium ≤ 3% ทุน — เพื่อการศึกษา
      </p>

      {err && <p className="text-xs text-down mt-3">{err}</p>}
      {busy && <p className="text-xs text-zinc-500 mt-3">กำลังรวบรวมข้อมูลจริง + สอบถาม AI… (~10-20 วินาที)</p>}

      {result && noPlay && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-400 font-bold">⚖️ AI ไม่แนะนำไม้ตอนนี้</p>
          <p className="text-xs text-zinc-400 mt-1">{result.reasons[0]}</p>
        </div>
      )}

      {result && !noPlay && (
        <div className="mt-4 space-y-4">
          {/* สรุปไม้ */}
          <div className="grid md:grid-cols-[auto_1fr] gap-4 items-center">
            <div className={`text-center rounded-xl border p-4 ${isCall ? "border-up/40 bg-up/10" : "border-down/40 bg-down/10"}`}>
              <div className="text-[10px] text-zinc-500">{isCall ? "📈 ซื้อ CALL" : "📉 ซื้อ PUT"}</div>
              <div className="num text-2xl font-black text-zinc-50">{symbol}</div>
              <div className="num text-sm text-zinc-300">
                {isCall ? "C" : "P"} {result.strike} · {result.expiry.slice(5)}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["เข้า (premium)", `$${result.entryEst.toFixed(2)}`],
                ["🎯 TP", `$${result.target.toFixed(2)}`, "text-up"],
                ["🛑 SL", `$${result.stop.toFixed(2)}`, "text-down"],
              ].map(([k, v, cls]) => (
                <div key={k as string} className="rounded-lg border border-base-700 bg-base-800/40 p-2.5 text-center">
                  <div className="text-[10px] text-zinc-500">{k}</div>
                  <div className={`num text-sm font-bold ${cls ?? "text-zinc-100"}`}>{v}</div>
                </div>
              ))}
              <div className="rounded-lg border border-base-700 bg-base-800/40 p-2.5 text-center">
                <div className="text-[10px] text-zinc-500">ความมั่นใจ</div>
                <div className="num text-sm font-bold text-accent-soft">{result.confidence}%</div>
              </div>
              <div className="rounded-lg border border-base-700 bg-base-800/40 p-2.5 text-center">
                <div className="text-[10px] text-zinc-500">Break-even</div>
                <div className="num text-sm font-bold text-zinc-100">${result.breakEven.toFixed(1)}</div>
              </div>
              <div className="rounded-lg border border-base-700 bg-base-800/40 p-2.5 text-center">
                <div className="text-[10px] text-zinc-500">Theta/วัน</div>
                <div className="num text-sm font-bold text-down">−${Math.abs(result.thetaDay).toFixed(0)}</div>
              </div>
            </div>
          </div>

          {/* ข้อมูลเสริม */}
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="chip bg-base-800 text-zinc-400 border border-base-700 num">Delta {result.delta.toFixed(2)}</span>
            {result.atmIv !== null && <span className="chip bg-base-800 text-zinc-400 border border-base-700 num">ATM IV {(result.atmIv * 100).toFixed(1)}%</span>}
            {result.ivPremiumPct !== null && <span className={`chip num border ${result.ivPremiumPct > 15 ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-base-800 text-zinc-400 border-base-700"}`}>IV {result.ivPremiumPct > 0 ? "+" : ""}{result.ivPremiumPct.toFixed(0)}% vs HV</span>}
            {result.daysToEarnings !== null && <span className="chip bg-accent/10 text-accent-soft border border-accent/30 num">📅 งบอีก {result.daysToEarnings} วัน</span>}
            <span className="chip bg-base-800 text-zinc-400 border border-base-700 num">{result.contracts} สัญญา = ${result.entryTotal.toFixed(0)}</span>
          </div>

          {/* เหตุผล + ความเสี่ยง */}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold text-zinc-500 mb-1.5">💡 เหตุผลที่เข้า</p>
              <ul className="space-y-1">
                {result.reasons.map((r, i) => (
                  <li key={i} className="text-xs text-zinc-300 flex gap-1.5"><span className="text-up">✓</span>{r}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-500 mb-1.5">⚠️ ความเสี่ยง</p>
              <ul className="space-y-1">
                {result.risks.map((r, i) => (
                  <li key={i} className="text-xs text-zinc-400 flex gap-1.5"><span className="text-amber-400">!</span>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-xs text-zinc-400 bg-base-800/50 rounded-lg p-3 border border-base-700/40">📋 <b>แผนออก:</b> {result.exitPlan}</p>

          {result.jevVerdict && (
            <div className={`text-xs rounded-lg p-3 border ${result.jevVerdict.includes("✅") ? "border-up/30 bg-up/5 text-up" : result.jevVerdict.includes("🔥") || result.jevVerdict.includes("⏰") ? "border-down/30 bg-down/5 text-down" : "border-amber-500/30 bg-amber-500/5 text-amber-400"}`}>
              🧠 Jev ตรวจ: {result.jevVerdict}
              {result.jevStance !== null && result.jevStance !== undefined && ` · โทนเอียง ${result.jevStance >= 3.5 ? "บวก" : result.jevStance <= 1.5 ? "ลบ" : "กลาง"} (${result.jevStance.toFixed(1)}/4)`}
            </div>
          )}

          <p className="text-[10px] text-zinc-600 border-t border-base-700/40 pt-2">
            ⚠️ เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน — ซื้อ option ขาดทุนได้สูงสุด = premium ทั้งหมด · ตรวจสอบ chain ล่าสุดก่อนตัดสินใจจริงเสมอ
          </p>
        </div>
      )}
    </div>
  );
}
