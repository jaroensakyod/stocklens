"use client";

import { useState } from "react";
import { useAuth } from "@/lib/authContext";
import LockGate from "@/components/LockGate";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface QuarterPoint {
  date: string;
  label: string;
  advisorValue: number;
  holdValue: number;
  spyValue: number;
  actions: { ticker: string; rule: string; from: number; to: number }[];
  cashPct: number;
}

interface Result {
  tickers: string[];
  startDate: string;
  endDate: string;
  quarters: QuarterPoint[];
  advisor: { totalPct: number; cagrPct: number; maxDrawdownPct: number; beatsHold: boolean; beatsSpy: boolean };
  hold: { totalPct: number; cagrPct: number; maxDrawdownPct: number };
  spy: { totalPct: number; cagrPct: number };
  actionCount: number;
  grade: string;
  note: string;
  preset?: string | null;
  error?: string;
}

const PRESETS = [
  { id: "normal", label: "💼 พอร์ตปกติ 10 ตัว", desc: "AAPL · MSFT · NVDA · GOOGL · AMZN · META · TSLA · JPM · XOM · UNH" },
  { id: "surge", label: "🚀 พอร์ตซิ่ง 10 ตัว", desc: "PLTR · COIN · MARA · SMCI · MU · AMD · SOFI · NU · HOOD · RBLX" },
];

const GRADE_STYLE: Record<string, string> = {
  S: "text-emerald-400 border-emerald-500/50 bg-emerald-500/10",
  A: "text-up border-up/50 bg-up/10",
  B: "text-accent-soft border-accent/50 bg-accent/10",
  C: "text-amber-400 border-amber-500/50 bg-amber-500/10",
  D: "text-down border-down/50 bg-down/10",
};

// 🧪 ทดสอบย้อนหลัง: "AI ปรับพอร์ตของเราแม่นจริงไหม?" — สมมติถือหุ้น 10 ตัว 3 ปี
// ให้กฎเดียวกับ AI Advisor ทำงานทุกไตรมาส เทียบกับถือเฉยๆ และตลาด (SPY)
export default function AdvisorTestPage() {
  const { tier } = useAuth();
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState("");
  const [custom, setCustom] = useState("");

  const run = async (preset?: string, tickers?: string[]) => {
    setBusy(preset ?? "custom");
    setResult(null);
    try {
      const res = await fetch("/api/advisor-backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preset ? { preset } : { tickers: tickers ?? custom.split(",").map((s) => s.trim()).filter(Boolean) }),
      });
      setResult(await res.json());
    } catch {
      setResult(null);
    }
    setBusy("");
  };

  const chartData = result?.quarters.map((q) => ({
    name: q.label,
    advisor: q.advisorValue,
    hold: q.holdValue,
    spy: q.spyValue,
  })) ?? [];

  if (tier !== "pro")
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">🧪 ทดสอบย้อนหลัง: AI ปรับพอร์ตแม่นจริงไหม?</h1>
          <p className="text-sm text-zinc-400 mt-1">เครื่องมือพิสูจน์ด้วยข้อมูลย้อนหลัง 3 ปีจริง — สิทธิ์สมาชิก 🥇 Pro</p>
        </div>
        <LockGate need="pro" title="เครื่องมือทดสอบ AI ปรับพอร์ต + ก๊อปปี้กูรูย้อนหลัง" />
      </div>
    );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🧪 ทดสอบย้อนหลัง: AI ปรับพอร์ตแม่นจริงไหม?</h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-3xl leading-relaxed">
          สมมติเป็นคนถือหุ้น 10 ตัว (ซื้อน้ำหนักเท่ากัน) ย้อนหลัง 3 ปี — ทุกไตรมาสให้{" "}
          <span className="text-zinc-200">เครื่องยนต์กฎเดียวกับ AI Advisor ในหน้าพอร์ต</span> ตัดสินใจ (ลดตัวใหญ่เกิน 30% · ลดของที่ RSI ร้อนแรง ·
          ลดตัวที่หลุด SMA200 · ตัดครึ่งเมื่อขาดทุนเกิน 45% · ถือเงินสดเมื่อพอร์ตเอียงลบครึ่งหนึ่ง) เทียบกับ ถือเฉยๆ (Buy &amp; Hold) และตลาด (SPY)
          — ทุกการตัดสินใจใช้ข้อมูลถึงวันนั้นเท่านั้น ไม่แอบดูอนาคต
        </p>
      </div>

      <div className="card p-4 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className="text-left p-4 rounded-xl border border-base-700 bg-base-850 hover:border-accent/50 transition-colors"
              onClick={() => run(p.id)}
              disabled={busy !== ""}
            >
              <p className="font-bold text-zinc-100">{p.label}</p>
              <p className="text-[11px] text-zinc-500 mt-1">{p.desc}</p>
              <p className="text-[11px] text-accent-soft mt-2">{busy === p.id ? "กำลังรัน simulation…" : "กดเพื่อรัน →"}</p>
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input className="input flex-1 min-w-60" placeholder="หรือพิมพ์ ticker เอง (USD) คั่นด้วย , เช่น NVDA, META, XOM, ..." value={custom} onChange={(e) => setCustom(e.target.value.toUpperCase())} />
          <button className="btn-primary shrink-0" onClick={() => run(undefined)} disabled={busy !== "" || custom.trim().length < 4}>
            {busy === "custom" ? "กำลังรัน…" : "🧪 ทดสอบพอร์ตฉัน"}
          </button>
        </div>
      </div>

      {result?.error && <div className="card p-5 text-sm text-down">{result.error}</div>}

      {result && !result.error && (
        <>
          {/* คำตัดสิน */}
          <div className="grid md:grid-cols-4 gap-3">
            <div className={`card p-5 border ${GRADE_STYLE[result.grade] || ""}`}>
              <div className="text-xs opacity-70">เกรดของเครื่องยนต์</div>
              <div className="text-4xl font-black mt-1">{result.grade}</div>
              <div className="text-[11px] mt-1 opacity-80">{result.advisor.beatsHold ? "ชนะถือเฉยๆ" : "แพ้ถือเฉยๆ"} · {result.advisor.beatsSpy ? "ชนะตลาด" : "แพ้ตลาด"}</div>
            </div>
            <Metric k="🤖 ทำตาม AI Advisor" total={result.advisor.totalPct} cagr={result.advisor.cagrPct} mdd={result.advisor.maxDrawdownPct} highlight />
            <Metric k="🛋️ ถือเฉยๆ (Buy & Hold)" total={result.hold.totalPct} cagr={result.hold.cagrPct} mdd={result.hold.maxDrawdownPct} />
            <Metric k="📊 ตลาด (SPY)" total={result.spy.totalPct} cagr={result.spy.cagrPct} />
          </div>

          {/* กราฟ */}
          <div className="card p-4">
            <h2 className="text-sm font-bold text-zinc-100 mb-3">มูลค่าพอร์ต (เริ่มต้น 100) — {result.startDate} → {result.endDate}</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="advisor" name="🤖 ตาม AI Advisor" stroke="#2dd4bf" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="hold" name="🛋️ ถือเฉยๆ" stroke="#a1a1aa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="spy" name="📊 SPY" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* สมุดบันทึกการปรับพอร์ต */}
          <div className="card p-4">
            <h2 className="text-sm font-bold text-zinc-100 mb-1">📓 สมุดบันทึก: AI สั่งอะไรทุกไตรมาส ({result.actionCount} คำสั่ง)</h2>
            <p className="text-[11px] text-zinc-600 mb-3">พอร์ต: {result.tickers.join(" · ")}</p>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {result.quarters.filter((q) => q.actions.length > 0).map((q) => (
                <div key={q.date} className="border border-base-700/60 rounded-lg p-3 bg-base-850">
                  <p className="text-xs font-bold text-zinc-200">{q.label} <span className="text-zinc-600 font-normal">({q.date})</span></p>
                  {q.actions.map((a, i) => (
                    <p key={i} className="text-[11px] text-zinc-400 mt-1 leading-snug">
                      → <span className="text-zinc-200 font-semibold">{a.ticker}</span> {a.rule}
                      {a.from ? ` (${a.from.toFixed(0)}% → ${a.to.toFixed(0)}%)` : ""}
                    </p>
                  ))}
                </div>
              ))}
              {result.actionCount === 0 && <p className="text-xs text-zinc-500">ตลอด 3 ปี กฎไม่ทริกเกอร์เลย — พอร์ตสมดุลดีตลอด</p>}
            </div>
          </div>

          <p className="text-[10px] text-zinc-600 leading-relaxed">⚠️ {result.note} · ผลอดีตไม่รับประกันอนาคต ใช้ประกอบการตัดสินใจเท่านั้น ·{" "}
            <Link href="/portfolio" className="text-accent-soft underline underline-offset-2">ใช้ AI ปรับพอร์ตจริงที่หน้าพอร์ต</Link>
          </p>
        </>
      )}
    </div>
  );
}

function Metric({ k, total, cagr, mdd, highlight }: { k: string; total: number; cagr: number; mdd?: number; highlight?: boolean }) {
  return (
    <div className={`card p-4 ${highlight ? "border-accent/40" : ""}`}>
      <div className="text-xs text-zinc-500">{k}</div>
      <div className={`num text-2xl font-bold mt-1 ${total >= 0 ? "text-up" : "text-down"}`}>
        {total >= 0 ? "+" : ""}{total.toFixed(1)}%
      </div>
      <div className="text-[11px] text-zinc-500 mt-0.5 num">
        CAGR {cagr.toFixed(1)}%{mdd !== undefined ? ` · ลดลงสูงสุด ${mdd.toFixed(1)}%` : ""}
      </div>
    </div>
  );
}
