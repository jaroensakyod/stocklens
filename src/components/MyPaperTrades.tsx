"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import TickerPicker from "@/components/TickerPicker";

interface MyTrade {
  id: string; symbol: string; type: "call" | "put"; strike: number; expiry: string;
  qty: number; entryPrice: number; entryDate: string; status: "open" | "closed";
  exitPrice?: number; exitDate?: string; exitReason?: string;
  pnlUsd?: number; pnlPct?: number; thesis: string; reasons: string[]; copiedFromAi?: boolean;
}
interface MySummary {
  totalTrades: number; openCount: number; wins: number; losses: number;
  winRate: number | null; realizedPnl: number; totalPremiumSpent: number;
}

// 🎲 Paper Options ของฉัน — สมาชิก Starter+ หัดเล่นเอง (คัดลอกไม้ AI หรือสร้างเอง)
export default function MyPaperTrades({ aiOpenTrades }: { aiOpenTrades: { id: string; symbol: string; type: string; strike: number; thesis: string }[] }) {
  const { member } = useAuth();
  const [trades, setTrades] = useState<MyTrade[]>([]);
  const [summary, setSummary] = useState<MySummary | null>(null);
  const [hint, setHint] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ symbol: "", type: "call", strike: "", expiry: "", qty: "1", entryPrice: "" });

  const load = useCallback(() => {
    if (!member) return;
    fetch("/api/options/my-paper")
      .then((r) => r.json())
      .then((j) => {
        setTrades(j.trades ?? []);
        setSummary(j.summary ?? null);
        setHint(j.hint ?? "");
      })
      .catch(() => {});
  }, [member]);

  useEffect(load, [load]);

  const copyAi = async (aiId: string) => {
    setMsg("");
    const r = await fetch("/api/options/my-paper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "copy_ai", aiTradeId: aiId }),
    });
    const j = await r.json();
    setMsg(r.ok ? "✓ คัดลอกไม้ AI แล้ว" : j.error ?? "ไม่สำเร็จ");
    load();
  };

  const openTrade = async () => {
    setMsg("");
    const r = await fetch("/api/options/my-paper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "open",
        symbol: form.symbol,
        type: form.type,
        strike: Number(form.strike),
        expiry: form.expiry,
        qty: Number(form.qty) || 1,
        entryPrice: Number(form.entryPrice),
        thesis: "สร้างเองจากหน้า Options Lab",
      }),
    });
    const j = await r.json();
    if (r.ok) {
      setMsg("✓ เปิดไม้แล้ว");
      setShowForm(false);
      setForm({ symbol: "", type: "call", strike: "", expiry: "", qty: "1", entryPrice: "" });
      load();
    } else {
      setMsg(j.error ?? "ไม่สำเร็จ");
    }
  };

  const closeTrade = async (id: string) => {
    const current = trades.find((t) => t.id === id);
    if (!current) return;
    const input = prompt(`ราคา option ปัจจุบันของ ${current.symbol} ${current.type.toUpperCase()} ${current.strike} (เข้าที่ $${current.entryPrice.toFixed(2)}):`);
    if (!input) return;
    const r = await fetch("/api/options/my-paper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", tradeId: id, exitPrice: Number(input) }),
    });
    const j = await r.json();
    setMsg(r.ok ? `✓ ปิดไม้แล้ว — กำไร/ขาดทุน $${(j.trade?.pnlUsd ?? 0).toFixed(0)}` : j.error ?? "ไม่สำเร็จ");
    load();
  };

  if (!member) {
    return (
      <div className="card p-4">
        <h3 className="text-sm font-bold text-zinc-100">🎲 Paper Options ของฉัน</h3>
        <p className="text-xs text-zinc-500 mt-1">สมาชิก Starter+ หัดเล่น option โดยไม่เสียเงินจริง — คัดลอกไม้ AI หรือสร้างเอง</p>
      </div>
    );
  }
  if (hint) {
    return <div className="card p-4"><p className="text-xs text-zinc-500">{hint}</p></div>;
  }

  const open = trades.filter((t) => t.status === "open");
  const closed = trades.filter((t) => t.status === "closed");

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-zinc-100">🎲 Paper Options ของฉัน</h3>
        <button className="btn-primary text-xs !py-1.5" onClick={() => setShowForm(!showForm)}>
          {showForm ? "ยกเลิก" : "➕ เปิดไม้ใหม่"}
        </button>
      </div>
      {msg && <p className="text-xs text-accent-soft mt-2">{msg}</p>}

      {/* สรุป */}
      {summary && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4">
          {[
            ["ไม้ทั้งหมด", `${summary.totalTrades}`],
            ["เปิดอยู่", `${summary.openCount}`, "text-accent-soft"],
            ["กำไร/ขาดทุน", `${summary.realizedPnl >= 0 ? "+" : ""}$${summary.realizedPnl.toFixed(0)}`, summary.realizedPnl >= 0 ? "text-up" : "text-down"],
            ["Win rate", summary.winRate !== null ? `${summary.winRate}%` : "—"],
            ["ชนะ", `${summary.wins}`, "text-up"],
            ["แพ้", `${summary.losses}`, "text-down"],
          ].map(([k, v, cls]) => (
            <div key={k as string} className="rounded-lg border border-base-700 bg-base-800/40 p-2.5 text-center">
              <div className="text-[10px] text-zinc-500">{k}</div>
              <div className={`num text-sm font-bold ${cls || "text-zinc-100"}`}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* ฟอร์มเปิดไม้ใหม่ */}
      {showForm && (
        <div className="mt-4 rounded-lg border border-base-700 p-4 space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-500">หุ้น (US)</label>
              <TickerPicker onSelect={(s) => setForm({ ...form, symbol: s.toUpperCase() })} placeholder="เช่น NVDA" />
            </div>
            <div>
              <label className="text-xs text-zinc-500">ประเภท</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="call">📈 Call (เดิมพันขึ้น)</option>
                <option value="put">📉 Put (เดิมพันลง)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Strike</label>
              <input className="input num" type="number" placeholder="เช่น 230" value={form.strike} onChange={(e) => setForm({ ...form, strike: e.target.value })} />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-500">วันหมดอายุ (YYYY-MM-DD)</label>
              <input className="input num" type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Premium ต่อสัญญา ($)</label>
              <input className="input num" type="number" step="0.01" placeholder="เช่น 5.20" value={form.entryPrice} onChange={(e) => setForm({ ...form, entryPrice: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-zinc-500">จำนวนสัญญา</label>
              <input className="input num" type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
            </div>
          </div>
          <button className="btn-primary w-full text-sm" onClick={openTrade} disabled={!form.symbol || !form.strike || !form.expiry || !form.entryPrice}>
            เปิดไม้ ({Number(form.entryPrice) * Number(form.qty) * 100 > 0 ? `$${(Number(form.entryPrice) * Number(form.qty) * 100).toFixed(0)}` : "$0"})
          </button>
        </div>
      )}

      {/* คัดลอกไม้ AI */}
      {aiOpenTrades.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-bold text-zinc-500 mb-2">🤖 ไม้ AI ที่เปิดอยู่ — กดคัดลอกได้ทันที</p>
          <div className="flex flex-wrap gap-2">
            {aiOpenTrades.map((ai) => (
              <button
                key={ai.id}
                className="chip bg-accent/10 text-accent-soft border border-accent/30 hover:bg-accent/20 !text-[11px]"
                onClick={() => copyAi(ai.id)}
                title={ai.thesis.slice(0, 100)}
              >
                📋 {ai.symbol} {ai.type === "call" ? "C" : "P"} {ai.strike}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ไม้ของฉัน */}
      {trades.length > 0 && (
        <div className="mt-4 space-y-2">
          {open.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-zinc-500">📂 เปิดอยู่ ({open.length})</p>
              {open.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-base-700 bg-base-800/40 p-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <span className={`text-xs font-bold ${t.type === "call" ? "text-up" : "text-down"}`}>
                      {t.copiedFromAi ? "📋 " : ""}{t.type === "call" ? "C" : "P"} {t.symbol} {t.strike}
                    </span>
                    <span className="text-[10px] text-zinc-500 ml-2">เข้า ${t.entryPrice.toFixed(2)} · {t.entryDate} · หมดอายุ {t.expiry.slice(5)}</span>
                  </div>
                  <button className="chip bg-down/10 text-down border border-down/30 !text-[10px]" onClick={() => closeTrade(t.id)}>
                    ปิดไม้
                  </button>
                </div>
              ))}
            </>
          )}
          {closed.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-zinc-500 mt-2">📖 ปิดแล้ว ({closed.length})</p>
              {closed.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-base-700/40 p-2.5 text-xs flex-wrap">
                  <span className="text-zinc-400">{t.symbol} {t.type.toUpperCase()} {t.strike} · {t.exitReason}</span>
                  <span className={`num font-bold ${(t.pnlUsd ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                    {(t.pnlUsd ?? 0) >= 0 ? "+" : ""}${(t.pnlUsd ?? 0).toFixed(0)} ({(t.pnlPct ?? 0) >= 0 ? "+" : ""}{(t.pnlPct ?? 0).toFixed(0)}%)
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
