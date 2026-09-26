"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import LockGate from "./LockGate";

// 📊 งบการเงิน 4 ปีจาก filings จริง (TTM ละเอียด + ประวัติรายปี + EDGAR สำหรับหุ้น US)
// freemium: free เห็น TTM ล่าสุด · Starter เห็น 4 ปี · Pro เพิ่มรายไตรมาส + ดาวน์โหลด CSV
interface AnnualRow {
  label: string;
  revenue?: number;
  grossProfit?: number;
  operatingIncome?: number;
  netIncome?: number;
  ebitda?: number;
  ocf?: number;
  fcf?: number;
  rd?: number;
  buyback?: number;
  equity?: number;
  cash?: number;
  totalDebt?: number;
  grossMargin?: number;
  netMargin?: number;
  roe?: number;
  debtToEquity?: number;
  currentRatio?: number;
}
interface FundData {
  symbol: string;
  tier: "free" | "starter" | "pro";
  annual: AnnualRow[];
  quarterly?: { label: string; revenue?: number; netIncome?: number; eps?: number }[];
  ratios: { revenueCagr?: number; netIncomeCagr?: number; revenueGrowth?: number; fcfMargin?: number; netDebt?: number };
  edgarVerified?: boolean;
  dividendYieldPct?: number;
}

const fmt = (n?: number) => {
  if (n === undefined || n === null) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(1) + " ล้านล้าน";
  if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(0) + "M";
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
};

export default function FinancialsPanel({ ticker }: { ticker: string }) {
  const [d, setD] = useState<FundData | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setD(null);
    setErr("");
    fetch(`/api/fundamentals?s=${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((j) => (j.error ? setErr(j.error) : setD(j)))
      .catch(() => setErr("โหลดข้อมูลงบไม่สำเร็จ"));
  }, [ticker]);

  if (err) return null; // หุ้นที่ไม่มีข้อมูลงบ (เช่น ETF/ดัชนี) ซ่อนเงียบๆ
  if (!d) {
    return (
      <div className="card p-5">
        <h2 className="text-lg font-bold text-zinc-50">📊 งบการเงิน 4 ปี</h2>
        <p className="text-xs text-zinc-500 mt-2">กำลังโหลดจาก filings จริง…</p>
      </div>
    );
  }

  const cols = d.annual;
  const rows: { k: keyof AnnualRow; label: string }[] = [
    { k: "revenue", label: "รายได้รวม" },
    { k: "grossProfit", label: "กำไรขั้นต้น" },
    { k: "operatingIncome", label: "กำไรดำเนินงาน" },
    { k: "netIncome", label: "กำไรสุทธิ" },
    { k: "ebitda", label: "EBITDA" },
    { k: "fcf", label: "FCF (อิสระ)" },
    { k: "rd", label: "R&D (วิจัย)" },
    { k: "buyback", label: "ซื้อหุ้นคืน" },
  ];
  const pctRows: { k: keyof AnnualRow; label: string }[] = [
    { k: "grossMargin", label: "Gross Margin %" },
    { k: "netMargin", label: "Net Margin %" },
    { k: "roe", label: "ROE %" },
    { k: "debtToEquity", label: "หนี้/ทุน (D/E)" },
    { k: "currentRatio", label: "Current Ratio" },
  ];
  const chartData = cols
    .filter((c) => c.label.startsWith("FY") || c.label.startsWith("TTM"))
    .map((c) => ({ name: c.label, รายได้: c.revenue, กำไรสุทธิ: c.netIncome }));

  const csv = () => {
    const head = ["หมวด", ...cols.map((c) => c.label)];
    const lines = [head.join(",")];
    for (const r of [...rows, ...pctRows]) lines.push([r.label, ...cols.map((c) => (c[r.k] as number) ?? "")].join(","));
    if (d.quarterly) {
      lines.push("");
      lines.push(["ไตรมาส", ...d.quarterly.map((q) => q.label)].join(","));
      lines.push(["รายได้", ...d.quarterly.map((q) => q.revenue ?? "")].join(","));
      lines.push(["กำไรสุทธิ", ...d.quarterly.map((q) => q.netIncome ?? "")].join(","));
      lines.push(["EPS", ...d.quarterly.map((q) => q.eps ?? "")].join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stocklens-${d.symbol}-financials.csv`;
    a.click();
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-zinc-50">📊 งบการเงิน 4 ปี</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            จาก filings จริง (หน่วย: สกุลเงินรายงานของบริษัท)
            {d.edgarVerified === true && <span className="text-up ml-1">· ✅ ตัวเลขตรงกับ 10-K ของ SEC</span>}
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {d.ratios.revenueCagr !== undefined && <span className="chip num bg-up/10 text-up">CAGR รายได้ {d.ratios.revenueCagr}%</span>}
          {d.ratios.revenueGrowth !== undefined && (
            <span className={`chip num ${d.ratios.revenueGrowth >= 0 ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}>
              โตล่าสุด {d.ratios.revenueGrowth >= 0 ? "+" : ""}
              {d.ratios.revenueGrowth}%
            </span>
          )}
          {d.ratios.fcfMargin !== undefined && <span className="chip num bg-accent/10 text-accent-soft">FCF Margin {d.ratios.fcfMargin}%</span>}
          {d.dividendYieldPct !== undefined && <span className="chip num bg-up/10 text-up">ปันผล ~{d.dividendYieldPct}%</span>}
        </div>
      </div>

      {/* กราฟรายได้/กำไร */}
      {chartData.length >= 2 && (
        <div className="h-52 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <YAxis tickFormatter={(v) => fmt(Number(v))} tick={{ fill: "#71717a", fontSize: 10 }} width={62} />
              <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="รายได้" fill="#eab308" radius={[3, 3, 0, 0]} />
              <Bar dataKey="กำไรสุทธิ" fill="#2dd4bf" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ตาราง */}
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-500 border-b border-base-700/60">
              <th className="text-left py-2 pr-2">หมวด (หน่วย: สกุลรายงาน)</th>
              {cols.map((c) => (
                <th key={c.label} className="text-right py-2 px-2 whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(
              (r) =>
                cols.some((c) => c[r.k] !== undefined) && (
                  <tr key={r.k} className="border-b border-base-700/30">
                    <td className="py-1.5 pr-2 text-zinc-400">{r.label}</td>
                    {cols.map((c) => (
                      <td key={c.label} className="py-1.5 px-2 text-right num text-zinc-200">
                        {fmt(c[r.k] as number)}
                      </td>
                    ))}
                  </tr>
                )
            )}
            {pctRows.map(
              (r) =>
                cols.some((c) => c[r.k] !== undefined) && (
                  <tr key={r.k} className="border-b border-base-700/30">
                    <td className="py-1.5 pr-2 text-zinc-500">{r.label}</td>
                    {cols.map((c) => (
                      <td key={c.label} className="py-1.5 px-2 text-right num text-zinc-400">
                        {c[r.k] as number}
                      </td>
                    ))}
                  </tr>
                )
            )}
          </tbody>
        </table>
      </div>

      {/* Pro: รายไตรมาส + CSV */}
      {d.tier === "pro" ? (
        <div className="mt-3">
          {!!d.quarterly?.length && (
            <div className="overflow-x-auto">
              <p className="text-[11px] text-zinc-500 mb-1">รายไตรมาสล่าสุด (Pro)</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-base-700/60">
                    <th className="text-left py-1.5">ไตรมาส</th>
                    {d.quarterly.map((q) => (
                      <th key={q.label} className="text-right py-1.5 px-2">{q.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {([["revenue", "รายได้"], ["netIncome", "กำไรสุทธิ"], ["eps", "EPS"]] as const).map(([k, label]) => (
                    <tr key={k} className="border-b border-base-700/30">
                      <td className="py-1.5 text-zinc-400">{label}</td>
                      {d.quarterly!.map((q) => (
                        <td key={q.label} className="py-1.5 px-2 text-right num text-zinc-200">{fmt(q[k])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button className="btn-ghost !py-1.5 !px-3 text-xs mt-3" onClick={csv}>
            ⬇️ ดาวน์โหลด CSV
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <LockGate
            need={d.tier === "free" ? "starter" : "pro"}
            title={d.tier === "free" ? "ดูงบ 4 ปีเต็ม + รายไตรมาส + ดาวน์โหลด CSV" : "รายไตรมาส + ดาวน์โหลด CSV"}
            desc="ตอนนี้คุณเห็นเฉพาะ TTM ล่าสุด — สมาชิก Starter เห็นงบ 4 ปีเต็ม, Pro เพิ่มรายไตรมาส + CSV"
          />
        </div>
      )}
    </div>
  );
}
