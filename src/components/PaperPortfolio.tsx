"use client";

import { useEffect, useState } from "react";

interface PaperTrade {
  id: string; symbol: string; type: "call" | "put"; strike: number; expiry: string;
  qty: number; entryPrice: number; entryDate: string; status: "open" | "closed";
  exitPrice?: number; exitDate?: string; exitReason?: string; exitNote?: string;
  pnlUsd?: number; pnlPct?: number;
  thesis: string; reasons: string[]; checks: { date: string; optPrice: number; note: string }[];
  jevVerdict?: string;
}
interface Summary {
  initialCapital: number; realizedPnl: number; openCount: number; closedCount: number;
  wins: number; losses: number; winRate: number | null; avgWin: number | null; avgLoss: number | null;
  lossReasons: Record<string, number>;
}

// 🧪 AI Options Paper Portfolio — สาธารณะ (สร้างความเชื่อใจแบบ Track Record) — จำลองเทรดด้วย AI + chain จริง
export default function PaperPortfolio() {
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hint, setHint] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/options/paper")
      .then((r) => r.json())
      .then((j) => {
        setTrades(j.trades ?? []);
        setSummary(j.summary ?? null);
        setHint(j.hint ?? "");
      })
      .catch(() => {});
  }, []);

  if (hint && !trades.length) {
    return (
      <div className="card p-4">
        <h3 className="text-sm font-bold text-zinc-100 mb-1">🧪 AI Options Paper Portfolio</h3>
        <p className="text-xs text-zinc-500">{hint}</p>
      </div>
    );
  }
  if (!trades.length) return null;

  const open = trades.filter((t) => t.status === "open");
  const closed = trades.filter((t) => t.status === "closed");

  return (
    <div className="space-y-4">
      {/* สรุปพอร์ต */}
      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold text-zinc-100">🧪 AI Options Paper Portfolio</h3>
          <span className="chip bg-accent/10 text-accent-soft border border-accent/30 !text-[10px]">จำลอง $10,000 · สาธารณะ</span>
        </div>
        <p className="text-[10px] text-zinc-600 mt-1">
          AI เปิดไม้เองจากสัญญาณจริง (Daily Picks + IV) → ตรวจทุกวัน → TP/SL/AI-exit — เพื่อการศึกษา ไม่ใช่คำแนะนำ
        </p>
        {summary && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4">
            {[
              ["กำไร/ขาดทุนสะสม", `${summary.realizedPnl >= 0 ? "+" : ""}$${summary.realizedPnl.toFixed(0)}`, summary.realizedPnl >= 0 ? "text-up" : "text-down"],
              ["Win rate", summary.winRate !== null ? `${summary.winRate}%` : "—", ""],
              ["ชนะ/แพ้", `${summary.wins}W / ${summary.losses}L`, ""],
              ["ไม้เปิด", `${summary.openCount}`, "text-accent-soft"],
              ["เฉลี่ยชนะ", summary.avgWin !== null ? `+$${summary.avgWin.toFixed(0)}` : "—", "text-up"],
              ["เฉลี่ยแพ้", summary.avgLoss !== null ? `$${summary.avgLoss.toFixed(0)}` : "—", "text-down"],
            ].map(([k, v, cls]) => (
              <div key={k as string} className="rounded-lg border border-base-700 bg-base-800/40 p-2.5 text-center">
                <div className="text-[10px] text-zinc-500">{k}</div>
                <div className={`num text-sm font-bold ${cls || "text-zinc-100"}`}>{v}</div>
              </div>
            ))}
          </div>
        )}
        {summary && Object.keys(summary.lossReasons).length > 0 && (
          <p className="text-[10px] text-zinc-500 mt-3">
            📊 ขาดทุนเพราะ: {Object.entries(summary.lossReasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}ครั้ง`).join(" · ")}
          </p>
        )}
      </div>

      {/* ไม้เปิด */}
      {open.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-zinc-400 mb-2">📂 ไม้เปิดอยู่ ({open.length})</h4>
          <div className="grid md:grid-cols-3 gap-3">
            {open.map((t) => {
              const daysLeft = Math.ceil((Date.parse(t.expiry) - Date.now()) / 864e5);
              return (
                <div key={t.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${t.type === "call" ? "text-up" : "text-down"}`}>
                      {t.type === "call" ? "📈" : "📉"} {t.symbol} {t.type === "call" ? "C" : "P"} {t.strike}
                    </span>
                    <span className="text-[10px] text-zinc-600 num">{daysLeft > 0 ? `${daysLeft}วัน` : "หมดอายุ"}</span>
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    เข้า ${t.entryPrice.toFixed(2)} · {t.entryDate} · {t.expiry.slice(5)}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-2 leading-snug line-clamp-3">{t.thesis}</p>
                  {t.jevVerdict && <p className="text-[9px] text-zinc-600 mt-1">{t.jevVerdict}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Journal */}
      {closed.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-zinc-400 mb-2">📖 Journal — ไม้ที่ปิดแล้ว ({closed.length})</h4>
          <div className="card divide-y divide-base-700/40">
            {closed.slice(0, 10).map((t) => (
              <div key={t.id}>
                <button
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-base-800/40"
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                >
                  <div className="min-w-0 flex-1">
                    <span className={`text-xs font-bold ${t.type === "call" ? "text-up" : "text-down"}`}>
                      {t.type === "call" ? "C" : "P"} {t.symbol} {t.strike}
                    </span>
                    <span className="text-[10px] text-zinc-500 ml-2">{t.entryDate} → {t.exitDate}</span>
                    <span className={`text-[10px] ml-2 ${(t.pnlUsd ?? 0) >= 0 ? "text-up" : "text-down"}`}>{t.exitReason}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`num text-sm font-bold ${(t.pnlUsd ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                      {(t.pnlUsd ?? 0) >= 0 ? "+" : ""}${(t.pnlUsd ?? 0).toFixed(0)}
                    </div>
                    <div className={`num text-[10px] ${(t.pnlPct ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                      {(t.pnlPct ?? 0) >= 0 ? "+" : ""}{(t.pnlPct ?? 0).toFixed(0)}%
                    </div>
                  </div>
                </button>
                {expanded === t.id && (
                  <div className="px-4 pb-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 mb-1">💡 เข้าเพราะ</p>
                      <ul className="space-y-0.5">
                        {t.reasons.map((r, i) => (
                          <li key={i} className="text-[11px] text-zinc-400 flex gap-1.5"><span className="text-up">✓</span>{r}</li>
                        ))}
                      </ul>
                    </div>
                    {t.checks.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-zinc-500 mb-1">📅 เกิดอะไรระหว่างทาง</p>
                        <div className="max-h-32 overflow-y-auto space-y-0.5">
                          {t.checks.slice(-10).map((c, i) => (
                            <p key={i} className="text-[10px] text-zinc-500 num">{c.date}: ${c.optPrice.toFixed(2)} — {c.note}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 mb-1">🚪 ออกเพราะ</p>
                      <p className="text-[11px] text-zinc-300">{t.exitReason}{t.exitNote ? ` — ${t.exitNote}` : ""}</p>
                    </div>
                    <div className="flex gap-4 text-[11px]">
                      <span className="text-zinc-500">เข้า <span className="num text-zinc-300">${t.entryPrice.toFixed(2)}</span></span>
                      <span className="text-zinc-500">ออก <span className="num text-zinc-300">${(t.exitPrice ?? 0).toFixed(2)}</span></span>
                      <span className="text-zinc-500">กำไร <span className={`num ${(t.pnlUsd ?? 0) >= 0 ? "text-up" : "text-down"}`}>{(t.pnlUsd ?? 0) >= 0 ? "+" : ""}${(t.pnlUsd ?? 0).toFixed(0)}</span></span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
