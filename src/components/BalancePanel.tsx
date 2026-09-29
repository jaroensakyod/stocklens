"use client";

import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { balanceScore, rebalancePlan, type TargetMode } from "@/lib/portfolioScore";
import type { Holding, PriceAlert } from "@/lib/store";
import type { Quote } from "@/lib/types";
import AiBrief from "@/components/AiBrief";

// 🧭 จัดสมดุลพอร์ต — Balance Score 5 มิติ + เกรด + แผนปรับสมดุล (ซื้อ/ขายเท่าไหร่) + จำลองคะแนนหลังปรับ
// แซงคู่แข่ง: รองรับหุ้นไทย+ข้ามตลาด+เงินสด+หุ้นแกนยืดเพดาน และโชว์ THB ได้
interface Meta { sector?: string; mcap?: number | null; beta?: number | null; quality?: number }

const DONUT_COLORS = ["#eab308", "#2dd4bf", "#f472b6", "#a78bfa", "#fb923c", "#34d399", "#60a5fa", "#f87171", "#c084fc", "#facc15", "#94a3b8", "#4ade80"];

const gradeCls = (g: string) =>
  g === "S" ? "text-up" : g === "A" ? "text-emerald-400" : g === "B" ? "text-accent-soft" : g === "C" ? "text-orange-400" : "text-down";

export default function BalancePanel({
  holdings,
  quotes,
  usdThb,
}: {
  holdings: Holding[];
  quotes: Record<string, Quote>;
  usdThb: number | null;
}) {
  const [meta, setMeta] = useState<Record<string, Meta>>({});
  const [cash, setCash] = useState<string>("");
  const [groupCeil, setGroupCeil] = useState(35);
  const [singleCeil, setSingleCeil] = useState(20);
  const [mode, setMode] = useState<TargetMode>("equal");
  const [showTHB, setShowTHB] = useState(false);

  const symbols = useMemo(() => holdings.map((h) => h.ticker), [holdings]);

  useEffect(() => {
    if (!symbols.length) return;
    fetch(`/api/portfolio-meta?s=${encodeURIComponent(symbols.join(","))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.meta && setMeta(j.meta))
      .catch(() => {});
  }, [symbols.join(",")]);

  const cashUsd = Number(cash) || 0;
  const scoreInput = useMemo(() => {
    const rows = holdings
      .map((h) => {
        const q = quotes[h.ticker];
        const price = q?.price ?? h.avgCost;
        return {
          ticker: h.ticker,
          value: h.qty * price,
          sector: meta[h.ticker]?.sector,
          quality: meta[h.ticker]?.quality ?? null,
          beta: meta[h.ticker]?.beta ?? null,
          core: h.core,
        };
      })
      .filter((h) => h.value > 0);
    return { holdings: rows, cash: cashUsd, groupCeiling: groupCeil, singleCeiling: singleCeil };
  }, [holdings, quotes, meta, cashUsd, groupCeil, singleCeil]);

  const result = useMemo(() => (scoreInput.holdings.length ? balanceScore(scoreInput) : null), [scoreInput]);
  const plan = useMemo(() => {
    if (!scoreInput.holdings.length) return null;
    const mcaps: Record<string, number> = {};
    for (const h of scoreInput.holdings) mcaps[h.ticker] = meta[h.ticker]?.mcap ?? 0;
    return rebalancePlan({ ...scoreInput, mode, mcaps });
  }, [scoreInput, mode, meta]);

  const fmtMoney = (usd: number) => {
    const v = showTHB && usdThb ? usd * usdThb : usd;
    return (showTHB && usdThb ? "฿" : "$") + Math.abs(v).toLocaleString("th-TH", { maximumFractionDigits: 0 });
  };

  if (!holdings.length) {
    return (
      <div className="card p-10 text-center">
        <p className="text-3xl mb-2">🧭</p>
        <p className="text-zinc-300 font-semibold">เพิ่มหุ้นเข้าพอร์ตก่อน — แล้วระบบจะให้คะแนนสมดุลและแผนปรับสมดุลอัตโนมัติ</p>
        <p className="text-xs text-zinc-500 mt-1">รองรับหุ้นไทย 🇹🇭 + สหรัฐฯ 🇺🇸 + ข้ามตลาด และเงินสดในพอร์ต</p>
      </div>
    );
  }

  const donutData = result ? [...result.groups.slice(0, 10).map((g) => ({ name: g.name, value: g.weightPct })), ...(result.cashPct > 1 ? [{ name: "เงินสด", value: result.cashPct }] : [])] : [];
  const dimTotal = result?.dimensions.reduce((a, d) => a + d.max, 0) ?? 100;

  return (
    <div className="space-y-4">
      {/* คะแนนรวม + ธีม */}
      <div className="card p-5">
        <div className="grid md:grid-cols-[auto_1fr] gap-6 items-center">
          <div className="text-center">
            <div className={`num text-5xl font-black ${gradeCls(result?.grade ?? "D")}`}>{result?.score ?? 0}</div>
            <div className="text-xs text-zinc-500">/100 · เกรด <b className={gradeCls(result?.grade ?? "D")}>{result?.grade ?? "—"}</b></div>
            <div className="text-[10px] text-zinc-600 mt-1 num">มูลค่าพอร์ต {fmtMoney(result?.totalValue ?? 0)}{result && result.cashPct > 0.5 ? ` · เงินสด ${result.cashPct.toFixed(0)}%` : ""}</div>
          </div>
          <div className="space-y-2.5">
            {(result?.dimensions ?? []).map((d) => (
              <div key={d.id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-300">{d.label} <span className="text-zinc-600 num">{d.score.toFixed(1)}/{d.max}</span></span>
                </div>
                <div className="h-1.5 bg-base-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${d.score / d.max >= 0.7 ? "bg-up" : d.score / d.max >= 0.4 ? "bg-accent" : "bg-down"}`} style={{ width: `${(d.score / d.max) * 100}%` }} />
                </div>
                <p className="text-[10px] text-zinc-600 mt-0.5">{d.detail}</p>
              </div>
            ))}
            <p className="text-[10px] text-zinc-600 pt-1 border-t border-base-700/40">เกณฑ์เต็ม {dimTotal} คะแนน: กระจายรายตัว 25 · กลุ่ม 25 · จำนวน 15 · ใกล้เป้า/เพดาน 20 · คุณภาพ 15 — คำนวณจากน้ำหนักมูลค่าจริงในพอร์ต</p>
          </div>
        </div>

        {/* สรุป AI (Gemini เขียนจากตัวเลขจริง + Jev ตรวจมุมมองที่สอง) */}
        {result && plan && (
          <AiBrief
            ticker="พอร์ตของฉัน"
            section="balance"
            lines={[
              `Balance Score ${result.score}/100 เกรด ${result.grade} · ถือ ${holdings.length} ตัว · ${result.groups.length} กลุ่ม · เงินสด ${result.cashPct.toFixed(0)}%`,
              ...result.dimensions.map((d) => `${d.label} ${d.score.toFixed(0)}/${d.max}`),
              ...result.issues.slice(0, 3).map((i) => i.text),
              ...plan.rows.slice(0, 4).map((r) => `${r.deltaUsd > 0 ? "ซื้อเพิ่ม" : "ขายออก"} ${r.ticker} ${fmtMoney(r.deltaUsd).replace("-", "")} (${r.currentPct.toFixed(1)}% → ${r.targetPct.toFixed(1)}%)`),
              `หลังปรับตามแผน: ${result.score} → ${plan.projectedScore}/100 เกรด ${plan.projectedGrade}`,
            ]}
            rule={`พอร์ตได้ ${result.score}/100 (เกรด ${result.grade}) — จุดอ่อนหลักคือ ${[...result.dimensions].sort((a, b) => a.score / a.max - b.score / b.max)[0]?.label} · แผนปรับสมดุลช่วยให้ ${plan.projectedScore}/100 ได้ — อ่านเป็นข้อมูลประกอบการพิจารณา`}
          />
        )}
      </div>

      {/* สิ่งที่ควรแก้ */}
      {result && (
        <div className="card p-4">
          <h3 className="text-sm font-bold text-zinc-100 mb-2">🔧 สิ่งที่ควรแก้</h3>
          <ul className="space-y-1.5">
            {result.issues.map((iss, i) => (
              <li key={i} className="text-xs text-zinc-300 flex gap-1.5">
                <span className={iss.severity === "high" ? "text-down" : iss.severity === "mid" ? "text-orange-400" : "text-zinc-500"}>●</span>
                {iss.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* สัดส่วนกลุ่ม + การตั้งค่า */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-bold text-zinc-100 mb-1">🍩 สัดส่วนตามกลุ่มธุรกิจ</h3>
          <p className="text-[10px] text-zinc-600 mb-2">เส้นแนวตั้งของตาราง = เพดาน {groupCeil}% ที่ตั้งไว้ — กลุ่มที่เกินจะถูกทำเครื่องหมาย</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="80%" paddingAngle={1} stroke="none">
                  {donutData.map((_, i) => (<Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />))}
                </Pie>
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1">
            {result?.groups.slice(0, 8).map((g, i) => (
              <div key={g.name} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                <span className="text-zinc-400 flex-1 truncate">{g.name}</span>
                <span className={`num ${g.over ? "text-down font-bold" : "text-zinc-200"}`}>{g.weightPct.toFixed(1)}%{g.over ? " ⚠️" : ""}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-bold text-zinc-100">⚙️ การตั้งค่าพอร์ต</h3>
          <div>
            <label className="text-xs text-zinc-500">เงินสดในพอร์ต (USD)</label>
            <input className="input num mt-1" type="number" placeholder="0" value={cash} onChange={(e) => setCash(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500">เพดานกลุ่ม (%)</label>
              <input className="input num mt-1" type="number" value={groupCeil} onChange={(e) => setGroupCeil(Math.max(10, Math.min(100, Number(e.target.value) || 35)))} />
            </div>
            <div>
              <label className="text-xs text-zinc-500">เพดานต่อตัว (%)</label>
              <input className="input num mt-1" type="number" value={singleCeil} onChange={(e) => setSingleCeil(Math.max(5, Math.min(100, Number(e.target.value) || 20)))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500">โหมดเป้าหมายของแผนปรับสมดุล</label>
            <select className="input mt-1" value={mode} onChange={(e) => setMode(e.target.value as TargetMode)}>
              <option value="equal">เท่ากันทุกตัว</option>
              <option value="mcap">ตามมูลค่าตลาด (หุ้นใหญ่น้ำหนักมาก)</option>
            </select>
          </div>
          {usdThb && (
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input type="checkbox" className="accent-yellow-500 w-4 h-4" checked={showTHB} onChange={(e) => setShowTHB(e.target.checked)} /> แสดงจำนวนเงินเป็นบาท (฿)
            </label>
          )}
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            📌 หุ้นแกน (กด 📌 ในแท็บพอร์ต) ได้เพดานยืด 1.5 เท่า — ระบบไม่แนะนำตัดหุ้นแกนเพียงเพราะ "น้ำหนักใหญ่"
          </p>
        </div>
      </div>

      {/* หุ้นที่ถือมากสุด */}
      {result && result.singles.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-bold text-zinc-100 mb-2">📊 หุ้นที่ถือมากที่สุด <span className="text-zinc-600 font-normal">(แดง = เกินเพดาน {singleCeil}%)</span></h3>
          <div className="space-y-1.5">
            {result.singles.slice(0, 10).map((s) => (
              <div key={s.ticker} className="flex items-center gap-2 text-xs">
                <span className="text-zinc-300 w-16">{s.ticker}{s.core ? " 📌" : ""}</span>
                <div className="flex-1 h-2 bg-base-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.over ? "bg-down" : s.weightPct > singleCeil * 0.7 ? "bg-accent" : "bg-up"}`} style={{ width: `${Math.min(100, s.weightPct)}%` }} />
                </div>
                <span className={`num w-14 text-right ${s.over ? "text-down font-bold" : "text-zinc-200"}`}>{s.weightPct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* แผนปรับสมดุล */}
      {plan && plan.rows.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h3 className="text-sm font-bold text-zinc-100">🎯 แผนปรับสมดุลที่แนะนำ</h3>
            <span className="text-xs text-zinc-400 num">
              หลังปรับ: <b className={gradeCls(plan.projectedGrade)}>{plan.projectedScore}</b>/100 ({result?.score ?? 0} → {plan.projectedScore}) เกรด {plan.projectedGrade}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[480px]">
              <thead>
                <tr className="text-zinc-500 border-b border-base-700/60">
                  <th className="text-left py-2">หุ้น</th>
                  <th className="text-right py-2">น้ำหนักเดิม</th>
                  <th className="text-right py-2">เป้าหมาย</th>
                  <th className="text-right py-2">การปรับ</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((r) => (
                  <tr key={r.ticker} className="border-b border-base-700/30">
                    <td className="py-2 font-bold text-zinc-100">{r.ticker}</td>
                    <td className="py-2 text-right num text-zinc-400">{r.currentPct.toFixed(1)}%</td>
                    <td className="py-2 text-right num text-zinc-300">{r.targetPct.toFixed(1)}%</td>
                    <td className="py-2 text-right num font-semibold">
                      {r.deltaUsd > 0 ? (
                        <span className="text-up">ซื้อเพิ่ม +{fmtMoney(r.deltaUsd)}</span>
                      ) : (
                        <span className="text-down">ขายออก −{fmtMoney(r.deltaUsd)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">
            แผนนี้คำนวณจากสัดส่วนเป้าหมาย ({mode === "equal" ? "เท่ากันทุกตัว" : "ตามมูลค่าตลาด"}) + บังคับเพดานต่อตัว {singleCeil}% (หุ้นแกน 1.5 เท่า) — เป็นกรอบเชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน · ไม่รวมภาษี/ค่าธรรมเนียมการซื้อขาย
          </p>
          {/* ลิงก์ไขว้ไปเครื่องมือที่เกี่ยวข้อง — ต่อยอดซ้อนกันเป็นชุดเดียว */}
          <div className="flex flex-wrap gap-2 mt-3">
            <a href="/portfolio?tab=advisor" className="chip bg-base-800 text-accent-soft border border-base-700 !text-[11px]">🤖 ให้ AI ปรับพอร์ตต่อ →</a>
            <a href="/portfolio?tab=xray" className="chip bg-base-800 text-accent-soft border border-base-700 !text-[11px]">🩻 X-ray ความเสี่ยง/beta →</a>
            <a href="/backtest" className="chip bg-base-800 text-accent-soft border border-base-700 !text-[11px]">📊 ทดสอบกลยุทธ์บนพอร์ตนี้ →</a>
          </div>
        </div>
      )}
    </div>
  );
}
