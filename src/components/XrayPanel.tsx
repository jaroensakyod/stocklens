"use client";

import { useState } from "react";

// 🩻 Portfolio X-ray — ส่องพอร์ตลึก: benchmark / ความเสี่ยง / ความเข้มข้น / factor / ปันผล / fee / จุดอ่อน
interface Xray {
  totalValueThb: number;
  currencyNote: string;
  returns: { period: string; portfolio: number | null; set: number | null; spx: number | null }[];
  equity: { d: string; p: number; set: number; spx: number }[];
  factorsAvg: { valuation: number; growth: number; profitability: number; momentum: number; health: number; overall: number } | null;
  risk: { volAnnual: number | null; betaSet: number | null; maxDrawdown: number | null };
  concentration: { topWeightPct: number; hhi: number; sectors: { name: string; pct: number }[] };
  dividend: { estAnnualThb: number; yieldPct: number } | null;
  feeDragPct: number;
  weakPoints: string[];
}
interface Holding { ticker: string; qty: number; avgCost?: number; core?: boolean }

const pc = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);
const cls = (v: number | null) => (v === null ? "text-zinc-500" : v >= 0 ? "text-up" : "text-down");
const thb = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 0 });

export default function XrayPanel({ holdings }: { holdings: Holding[] }) {
  const [data, setData] = useState<Xray | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState("");

  const run = async () => {
    if (!holdings.length) {
      setErrMsg("เพิ่มหุ้นในพอร์ตก่อน (แท็บ \"พอร์ต\")");
      setState("err");
      return;
    }
    setState("loading");
    try {
      const res = await fetch("/api/portfolio-xray", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "ผิดพลาด");
      setData(j);
      setState("ok");
    } catch (e) {
      setErrMsg((e as Error).message);
      setState("err");
    }
  };

  if (state === "idle" || state === "err") {
    return (
      <div className="card p-8 text-center space-y-3">
        <p className="text-3xl">🩻</p>
        <h3 className="font-bold text-zinc-100">ส่องพอร์ตด้วย X-ray — ลึกกว่ากำไรขาดทุน</h3>
        <p className="text-xs text-zinc-500 max-w-lg mx-auto leading-relaxed">
          เทียบผลตอบแทนกับ SET/S&amp;P500 · ความเสี่ยง (ความผันผวน/beta/ตกหนักสุด) · ความเข้มข้นกลุ่ม/ตัว · factor เฉลี่ย · ปันผลคาดรับ · ค่าธรรมเนียมกัดกิน —
          ใช้ {holdings.length || 0} ตัวในพอร์ตปัจจุบันของคุณ
        </p>
        {state === "err" && <p className="text-xs text-down">{errMsg}</p>}
        <button className="btn-primary" onClick={run}>🔬 เริ่มส่องพอร์ต</button>
      </div>
    );
  }
  if (state === "loading") return <div className="card p-8 text-center text-sm text-zinc-500">กำลังประมวลผลทุกมิติ… รอบแรกอาจใช้ ~20 วิ</div>;
  if (!data) return null;

  const r1y = data.returns.find((r) => r.period === "1 ปี");

  return (
    <div className="space-y-4">
      {/* 1. เทียบ benchmark */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-zinc-100 mb-3">📊 ผลตอบแทนเทียบตลาด (สัดส่วนถือปัจจุบัน)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm num">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-base-700/60">
                <th className="text-left py-2">ช่วง</th>
                <th className="text-right py-2">พอร์ตคุณ</th>
                <th className="text-right py-2">SET</th>
                <th className="text-right py-2">S&amp;P500</th>
                <th className="text-right py-2">เทียบ SET</th>
              </tr>
            </thead>
            <tbody>
              {data.returns.map((r) => (
                <tr key={r.period} className="border-b border-base-700/30">
                  <td className="py-2 text-zinc-300">{r.period}</td>
                  <td className={`py-2 text-right font-bold ${cls(r.portfolio)}`}>{pc(r.portfolio)}</td>
                  <td className={`py-2 text-right ${cls(r.set)}`}>{pc(r.set)}</td>
                  <td className={`py-2 text-right ${cls(r.spx)}`}>{pc(r.spx)}</td>
                  <td className={`py-2 text-right font-semibold ${r.portfolio !== null && r.set !== null ? cls(r.portfolio - r.set) : "text-zinc-500"}`}>
                    {r.portfolio !== null && r.set !== null ? pc(r.portfolio - r.set) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.equity.length > 3 && (
          <div className="mt-4">
            <div className="text-[11px] text-zinc-500 mb-1">เส้นทาง 1 ปี (ตั้งต้น 100)</div>
            <svg viewBox="0 0 600 160" className="w-full h-40">
              {(() => {
                const pts = data.equity;
                const all = pts.flatMap((p) => [p.p, p.set, p.spx]).filter((v) => v > 0);
                const min = Math.min(...all) * 0.98;
                const max = Math.max(...all) * 1.02;
                const x = (i: number) => (i / Math.max(1, pts.length - 1)) * 600;
                const y = (v: number) => 160 - ((v - min) / (max - min || 1)) * 150;
                const line = (get: (p: (typeof pts)[0]) => number, color: string) => (
                  <polyline fill="none" stroke={color} strokeWidth="2" points={pts.map((p, i) => `${x(i)},${y(get(p))}`).join(" ")} />
                );
                return (
                  <>
                    {line((p) => p.set, "#71717a")}
                    {line((p) => p.spx, "#3f6212")}
                    {line((p) => p.p, "#eab308")}
                  </>
                );
              })()}
            </svg>
            <div className="flex gap-3 text-[10px] text-zinc-500">
              <span><span className="inline-block w-3 h-0.5 bg-accent align-middle" /> พอร์ตคุณ</span>
              <span><span className="inline-block w-3 h-0.5 bg-zinc-500 align-middle" /> SET</span>
              <span><span className="inline-block w-3 h-0.5 bg-green-800 align-middle" /> S&amp;P500</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* 2. ความเสี่ยง */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-zinc-100 mb-3">🛡️ ความเสี่ยง</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-zinc-400">ความผันผวนต่อปี</span><span className="num text-zinc-100">{data.risk.volAnnual !== null ? data.risk.volAnnual.toFixed(1) + "%" : "—"}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Beta เทียบ SET</span><span className="num text-zinc-100">{data.risk.betaSet !== null ? data.risk.betaSet.toFixed(2) : "—"}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">ตกหนักสุดใน 1 ปี</span><span className={`num ${data.risk.maxDrawdown !== null && data.risk.maxDrawdown > 25 ? "text-down" : "text-zinc-100"}`}>-{data.risk.maxDrawdown?.toFixed(1) ?? "—"}%</span></div>
          </div>
          {r1y && r1y.portfolio !== null && r1y.set !== null && (
            <p className={`text-[11px] mt-3 ${r1y.portfolio - r1y.set >= 0 ? "text-up" : "text-down"}`}>
              1 ปีที่ผ่านมา {r1y.portfolio - r1y.set >= 0 ? "ชนะ" : "แพ้"} SET อยู่ {(r1y.portfolio - r1y.set).toFixed(1)}%
            </p>
          )}
        </div>

        {/* 3. ความเข้มข้น */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-zinc-100 mb-3">🧲 ความเข้มข้น</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-zinc-400">น้ำหนักตัวเดียวสูงสุด</span><span className={`num ${data.concentration.topWeightPct >= 30 ? "text-down" : "text-zinc-100"}`}>{data.concentration.topWeightPct}%</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">HHI (กระจายตัว)</span><span className={`num ${data.concentration.hhi > 0.25 ? "text-down" : "text-up"}`}>{data.concentration.hhi.toFixed(2)}</span></div>
          </div>
          <div className="mt-3 space-y-1.5">
            {data.concentration.sectors.slice(0, 5).map((s) => (
              <div key={s.name}>
                <div className="flex justify-between text-[11px] mb-0.5"><span className="text-zinc-400 truncate">{s.name}</span><span className="num text-zinc-300">{s.pct}%</span></div>
                <div className="h-1.5 bg-base-800 rounded-full overflow-hidden"><div className="h-full rounded-full bg-accent" style={{ width: Math.min(100, s.pct * 2) + "%" }} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Factor เฉลี่ย */}
        {data.factorsAvg && (
          <div className="card p-5">
            <h3 className="text-sm font-bold text-zinc-100 mb-3">⚖️ นิสัยพอร์ต (factor เฉลี่ยถ่วงน้ำหนัก)</h3>
            <div className="space-y-2">
              {[
                ["Valuation (ถูก/แพง)", data.factorsAvg.valuation],
                ["Growth (เติบโต)", data.factorsAvg.growth],
                ["Profitability (กำไร)", data.factorsAvg.profitability],
                ["Momentum", data.factorsAvg.momentum],
                ["Health (แข็งแรง)", data.factorsAvg.health],
              ].map(([label, v]) => (
                <div key={label as string}>
                  <div className="flex justify-between text-[11px] mb-0.5"><span className="text-zinc-400">{label}</span><span className="num text-zinc-200">{Math.round(v as number)}</span></div>
                  <div className="h-1.5 bg-base-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${(v as number) >= 66 ? "bg-up" : (v as number) >= 40 ? "bg-accent" : "bg-down"}`} style={{ width: `${v}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. ปันผล + fee */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-zinc-100 mb-3">💸 เงินสด &amp; ค่าใช้จ่าย</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-zinc-400">ปันผลคาดรับ/ปี</span><span className="num text-zinc-100">{data.dividend ? `฿${thb(data.dividend.estAnnualThb)}` : "—"}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Dividend yield พอร์ต</span><span className="num text-zinc-100">{data.dividend ? data.dividend.yieldPct.toFixed(2) + "%" : "—"}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Fee+ภาษี ประมาณ/ปี</span><span className="num text-zinc-400">~{(data.feeDragPct * 100).toFixed(2)}%</span></div>
          </div>
          <p className="text-[10px] text-zinc-600 mt-2">มูลค่าพอร์ตรวม ~฿{thb(data.totalValueThb)} · {data.currencyNote}</p>
        </div>
      </div>

      {/* 6. จุดอ่อน */}
      {data.weakPoints.length > 0 && (
        <div className="card p-5 border border-down/30">
          <h3 className="text-sm font-bold text-zinc-100 mb-2">🔎 จุดที่ควรปรับ</h3>
          <ul className="space-y-1.5">
            {data.weakPoints.map((w) => (
              <li key={w} className="text-xs text-zinc-300 flex gap-2"><span className="text-down">⚠️</span>{w}</li>
            ))}
          </ul>
          <p className="text-[10px] text-zinc-600 mt-3">อยากให้ AI ช่วยจัดการจุดเหล่านี้? ไปแท็บ "🤖 AI ปรับพอร์ต" — มันเห็นข้อมูลชุดเดียวกันนี้</p>
        </div>
      )}

      <button className="btn-secondary text-xs" onClick={run}>↻ รันใหม่จากพอร์ตปัจจุบัน</button>
    </div>
  );
}
