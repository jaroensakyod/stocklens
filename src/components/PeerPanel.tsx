"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AiBrief from "@/components/AiBrief";
import { addToBasket } from "@/lib/compareBasket";

// 🧭 เทียบกับอุตสาหกรรมเดียวกัน — percentile เทียบค่ากลางกลุ่ม + เกรดรวม (สูงกว่า konba: สลับทั้งตลาดเดียวกัน/ทั่วโลก + AI สรุป)
interface Metric {
  key: string; label: string; fmt: "pct" | "x" | "num"; lowerBetter: boolean;
  value: number; median: number; diffPct: number; better: boolean; percentile: number; sampleSize: number;
}
interface Group { id: string; label: string; score: number | null; metrics: Metric[] }
interface PeersData {
  symbol: string; name: string; sector: string; industry: string; region: string;
  scope: "market" | "global"; matchLevel: "industry" | "sector"; peerCount: number;
  peers: { symbol: string; name: string; mcap: number }[];
  groups: Group[]; overall: number | null; grade: string | null; asOf: string;
  perf: { w?: number | null; m1?: number | null; m3?: number | null; m6?: number | null; y?: number | null; ytd?: number | null; y3?: number | null; y5?: number | null };
}

const fmtVal = (m: Metric) => {
  const v = m.value;
  if (m.fmt === "pct") return `${v >= 0 ? "" : ""}${v.toFixed(1)}%`;
  if (m.fmt === "x") return `${v.toFixed(2)}x`;
  return v.toFixed(2);
};
const fmtMed = (m: Metric) => (m.fmt === "pct" ? `${m.median.toFixed(1)}%` : m.fmt === "x" ? `${m.median.toFixed(2)}x` : m.median.toFixed(2));

const gradeCls = (g: string | null) =>
  g === "S" ? "bg-up/15 text-up border-up/30" : g === "A" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : g === "B" ? "bg-accent/15 text-accent-soft border-accent/30" : g === "C" ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
    : "bg-down/15 text-down border-down/30";

export default function PeerPanel({ ticker }: { ticker: string }) {
  const [data, setData] = useState<PeersData | null>(null);
  const [scope, setScope] = useState<"market" | "global">("market");
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch(`/api/peers?s=${encodeURIComponent(ticker)}&scope=${scope}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "โหลดไม่สำเร็จ");
        return j;
      })
      .then((j) => {
        if (!alive) return;
        setData(j);
        setState("ok");
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e.message);
        setState("err");
      });
    return () => {
      alive = false;
    };
  }, [ticker, scope]);

  if (state === "err") {
    return (
      <div className="card p-5">
        <h2 className="text-lg font-bold text-zinc-50 mb-2">🧭 เทียบกับอุตสาหกรรมเดียวกัน</h2>
        <p className="text-xs text-zinc-500">{err}</p>
      </div>
    );
  }
  if (state === "loading" || !data) return <div className="card p-5"><div className="text-sm text-zinc-500">🧭 กำลังเทียบ {ticker} กับอุตสาหกรรมเดียวกัน… {scope === "global" && "(รวบรวมทุกตลาดรอบแรก อาจใช้เวลา ~1 นาที)"}</div></div>;

  const allMetrics = data.groups.flatMap((g) => g.metrics);
  const best = [...allMetrics].sort((a, b) => b.percentile - a.percentile)[0];
  const worst = [...allMetrics].sort((a, b) => a.percentile - b.percentile)[0];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-lg font-bold text-zinc-50">🧭 เทียบกับอุตสาหกรรมเดียวกัน</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-base-700 overflow-hidden text-[11px]">
            <button className={`px-2.5 py-1 ${scope === "market" ? "bg-accent/20 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`} onClick={() => setScope("market")}>ในตลาดนี้</button>
            <button className={`px-2.5 py-1 ${scope === "global" ? "bg-accent/20 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`} onClick={() => setScope("global")}>🌐 ทั่วโลก</button>
          </div>
          {data.grade && <span className={`chip border font-bold ${gradeCls(data.grade)}`}>{data.grade} · {data.overall}/100</span>}
        </div>
      </div>
      <p className="text-xs text-zinc-500 mb-3">
        {data.industry || data.sector} · เทียบกับหุ้นอีก <b className="num text-zinc-300">{data.peerCount.toLocaleString()}</b> ตัว
        {data.matchLevel === "sector" && " (อุตสาหกรรมย่อยครอบคลุมน้อย จึงขยายไปกลุ่มใหญ่)"} · ข้อมูล ณ {data.asOf}
      </p>

      {/* เพื่อนร่วมกลุ่ม */}
      {data.peers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4 items-center">
          {data.peers.slice(0, 8).map((p) => (
            <Link key={p.symbol} href={`/stock/${encodeURIComponent(p.symbol)}`} className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-zinc-100" title={p.name}>
              {p.symbol}
            </Link>
          ))}
          <Link href={`/screener?sector=${encodeURIComponent(data.sector)}`} className="chip bg-base-800 text-accent-soft border border-base-700">ดูทั้งกลุ่มใน Screener →</Link>
          <button
            className="chip bg-accent/10 text-accent-soft border border-accent/30"
            title="เอาหุ้นนี้ + คู่แข่งใหญ่สุด 3 ตัวไปเปรียบเทียบแบบเต็ม (70+ เมตริก)"
            onClick={() => {
              addToBasket(data.symbol);
              for (const p of data.peers.slice(0, 3)) addToBasket(p.symbol);
              location.href = "/compare";
            }}
          >
            ⚔️ เทียบกับคู่แข่ง top 3
          </button>
        </div>
      )}

      {/* กลุ่มเมตริก */}
      <div className="grid md:grid-cols-2 gap-4">
        {data.groups.map((g) => (
          <div key={g.id} className="rounded-lg border border-base-700/60 p-3 min-w-0 overflow-x-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-200">{g.label}</span>
              {g.score !== null && (
                <span className={`num text-xs font-bold px-1.5 py-0.5 rounded ${g.score >= 70 ? "text-up bg-up/10" : g.score >= 40 ? "text-accent-soft bg-accent/10" : "text-down bg-down/10"}`}>{g.score}/100</span>
              )}
            </div>
            <table className="w-full min-w-[380px] text-xs">
              <tbody>
                {g.metrics.map((m) => (
                  <tr key={m.key} className="border-t border-base-700/30">
                    <td className="py-1.5 text-zinc-500">{m.label}</td>
                    <td className="py-1.5 num text-zinc-200 text-right">{fmtVal(m)}</td>
                    <td className="py-1.5 num text-zinc-500 text-right text-[11px] whitespace-nowrap">vs {fmtMed(m)}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <span className={`num text-[11px] font-semibold ${m.better ? "text-up" : "text-down"}`}>
                        {m.diffPct <= 0 ? "▼ต่ำกว่า" : "▲สูงกว่า"} {Math.abs(m.diffPct) > 999 ? "999+" : Math.abs(m.diffPct).toFixed(0)}%
                      </span>
                      <span className="text-[10px] text-zinc-600 ml-1">({m.percentile}%)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <AiBrief
        ticker={data.symbol}
        section="peers"
        lines={[
          `อุตสาหกรรม ${data.industry || data.sector} เทียบกับหุ้นอีก ${data.peerCount} ตัว${scope === "global" ? "ทั่วโลก" : "ในตลาดเดียวกัน"}`,
          `คะแนนรวมเทียบกลุ่ม ${data.overall}/100 เกรด ${data.grade}`,
          ...(best ? [`จุดแข็งสุด: ${best.label} ${fmtVal(best)} vs ค่ากลาง ${fmtMed(best)} (ดีกว่ากลุ่ม ~${best.percentile}%)`] : []),
          ...(worst ? [`จุดอ่อนสุด: ${worst.label} ${fmtVal(worst)} vs ค่ากลาง ${fmtMed(worst)} (เหนือกว่าเพียง ~${worst.percentile}%)`] : []),
          ...data.groups.map((g) => `${g.label}: ${g.score}/100`),
        ]}
        rule={`เทียบในกลุ่ม${data.industry || data.sector}: ${data.symbol} ได้ ${data.overall}/100 (เกรด ${data.grade})${best ? ` จุดแข็งคือ ${best.label} ที่ดีกว่าค่ากลางกลุ่ม (~${best.percentile}%)` : ""}${worst ? ` ส่วนที่ตามหลังกลุ่มคือ ${worst.label}` : ""} — อ่านเป็นข้อมูลประกอบการพิจารณา`}
      />

      <p className="text-[10px] text-zinc-600 mt-3">เกรด: S≥85 · A≥70 · B≥55 · C≥40 · Dต่ำกว่า — คำนวณจาก percentile เทียบค่ากลาง (median) ของหุ้นในกลุ่มเดียวกัน ตัว "ต่ำกว่า/สูงกว่า" ดีหรือไม่ขึ้นกับชนิดตัวชี้วัด (เช่น P/E ต่ำกว่า = ถูกกว่ากลุ่ม) · เกณฑ์เดียวกันทุกตลาด</p>
    </div>
  );
}
