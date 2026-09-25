"use client";

import { useState } from "react";
import { mdToHtml } from "@/lib/markdown";
import { usePortfolio } from "@/lib/store";

interface AdviceItem { action: string; title: string; detail: string; tone: "warn" | "info" | "good" }
interface AdvisorResult {
  totalValue: number; topHoldingPct: number; topHolding: string; topSector: string; topSectorPct: number;
  avgFactors: { valuation: number; growth: number; profitability: number; momentum: number; health: number };
  bullishCount: number; bearishCount: number; count: number;
  radarTop: { name: string; emoji: string; heat: number }[];
  demoAdvice: AdviceItem[];
  aiText: string;
  aiMode: string;
}

// AI Portfolio Advisor — วิเคราะห์พอร์ตจริง แนะนำการปรับ 4-6 ข้อ พร้อมเหตุผล
export default function PortfolioAdvisor() {
  const { holdings } = usePortfolio();
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = async () => {
    if (holdings.length < 2) { setErr("ใส่ holdings อย่างน้อย 2 ตัวก่อน (แท็บ 💼)"); return; }
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const res = await fetch("/api/ai/portfolio-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings }),
      });
      const j = await res.json();
      if (!res.ok) setErr(j.error || "วิเคราะห์ไม่สำเร็จ");
      else setResult(j);
    } catch { setErr("วิเคราะห์ไม่สำเร็จ"); }
    setBusy(false);
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="text-sm font-bold text-zinc-100">🤖 AI Portfolio Advisor — ให้ AI ปรับพอร์ตให้</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">ดึงข้อมูลจริงทั้งพอร์ต (sector/ปัจจัย/เทคนิค/Radar) → วิเคราะห์ความเสี่ยง → แนะนำ "ลด/เพิ่ม/กระจาย" เป็นข้อๆ พร้อมเหตุผล · <a href="/advisor-test" className="text-accent-soft underline underline-offset-2">🧪 ดูผลทดสอบย้อนหลัง 3 ปี</a></p>
        </div>
        <button className="btn-primary" onClick={run} disabled={busy || holdings.length < 2}>
          {busy ? "กำลังวิเคราะห์… (~20 วิ)" : "▶ ให้ AI ปรับพอร์ต"}
        </button>
      </div>

      {err && <p className="text-xs text-down mb-2">{err}</p>}
      {holdings.length < 2 && !busy && <p className="text-xs text-zinc-600">ต้องมี holdings อย่างน้อย 2 ตัว — ไปแท็บ 💼 เพิ่มก่อน</p>}

      {result && (
        <div className="space-y-4 animate-fadeUp">
          {/* สรุปตัวเลข */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Metric k="มูลค่าพอร์ต" v={"$" + (result.totalValue / 1000).toFixed(1) + "K"} />
            <Metric k="ตัวใหญ่สุด" v={`${result.topHolding} ${result.topHoldingPct}%`} warn={result.topHoldingPct > 30} />
            <Metric k="Sector ใหญ่สุด" v={`${result.topSector.slice(0, 14)} ${result.topSectorPct}%`} warn={result.topSectorPct > 60} />
            <Metric k="สัญญาณ" v={`📈${result.bullishCount} 📉${result.bearishCount} / ${result.count} ตัว`} />
          </div>

          {/* Factor เฉลี่ยของพอร์ต */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[11px] text-zinc-500">ปัจจัยเฉลี่ยพอร์ต:</span>
            {[
              { k: "Val", v: result.avgFactors.valuation }, { k: "Grow", v: result.avgFactors.growth },
              { k: "Profit", v: result.avgFactors.profitability }, { k: "Mom", v: result.avgFactors.momentum },
              { k: "Health", v: result.avgFactors.health },
            ].map((f) => (
              <span key={f.k} className={`chip num !text-[10px] ${f.v >= 66 ? "bg-up/10 text-up" : f.v >= 40 ? "bg-accent/10 text-accent-soft" : "bg-down/10 text-down"}`}>
                {f.k} {f.v}
              </span>
            ))}
          </div>

          {/* Demo advice cards (rule-based ทำงานเสมอ) */}
          <div className="space-y-2">
            {result.demoAdvice.map((a, i) => (
              <div key={i} className={`rounded-lg px-3 py-2 border ${
                a.tone === "warn" ? "border-rose-500/30 bg-rose-500/5" :
                a.tone === "good" ? "border-emerald-500/30 bg-emerald-500/5" :
                "border-base-600 bg-base-850"
              }`}>
                <div className="text-xs font-bold text-zinc-100">{a.title}</div>
                <div className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{a.detail}</div>
              </div>
            ))}
          </div>

          {/* AI analysis */}
          {result.aiText && (
            <div className="border-t border-base-700/60 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-accent-soft">🧠 คำแนะนำเชิงลึก (AI)</span>
                <span className={`chip !text-[9px] ${result.aiMode === "live" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"}`}>
                  {result.aiMode === "live" ? "LIVE" : result.aiMode === "error" ? "AI ERROR" : "DEMO"}
                </span>
              </div>
              <div className="ai-chat text-sm text-zinc-300" dangerouslySetInnerHTML={{ __html: mdToHtml(result.aiText) }} />
            </div>
          )}

          <p className="text-[10px] text-zinc-600 leading-snug pt-2 border-t border-base-700/40">
            ⚠️ การวิเคราะห์เชิงข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุนเฉพาะบุคคล — ใช้วิจารณญาณและศึกษาข้อมูลเพิ่มก่อนตัดสินใจ · AI ไม่สามารถซื้อ/ขายแทนคุณได้ (ทำได้แค่แนะนำ)
          </p>
        </div>
      )}
    </div>
  );
}

function Metric({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className={`bg-base-850 rounded-lg px-3 py-2 ${warn ? "border border-rose-500/30" : ""}`}>
      <div className="text-[10px] text-zinc-500">{k}</div>
      <div className={`num text-sm font-bold ${warn ? "text-rose-400" : "text-zinc-100"}`}>{v}</div>
    </div>
  );
}
