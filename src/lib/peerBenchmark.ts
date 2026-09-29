// ===== Peer Benchmark — เทียบหุ้นกับค่ากลางอุตสาหกรรมเดียวกัน (ใช้ร่วม: /api/peers · แชท AI · LINE digest) =====
import { findTvRow, tvUniverse, TV_REGIONS, type TvRow } from "@/lib/tvscanner";

type Group = "valuation" | "profitability" | "growth" | "health" | "momentum" | "dividend";

export interface PeerMetric {
  key: string; label: string; fmt: "pct" | "x" | "num"; lowerBetter: boolean;
  value: number; median: number; diffPct: number; better: boolean;
  percentile: number; sampleSize: number;
}
export interface PeerGroup { id: Group; label: string; score: number | null; metrics: PeerMetric[] }
export interface PeerResult {
  symbol: string; name: string; sector: string; industry: string; region: string;
  scope: "market" | "global"; matchLevel: "industry" | "sector"; peerCount: number;
  peers: { symbol: string; name: string; mcap: number }[];
  groups: PeerGroup[]; overall: number | null; grade: string | null;
  perf: { w?: number | null; m1?: number | null; m3?: number | null; m6?: number | null; y?: number | null; ytd?: number | null; y3?: number | null; y5?: number | null };
}

interface MetricDef { key: keyof TvRow; label: string; group: Group; lowerBetter?: boolean; fmt: "pct" | "x" | "num" }

const GROUPS: { id: Group; label: string }[] = [
  { id: "valuation", label: "มูลค่า (แพง/ถูก)" },
  { id: "profitability", label: "ความสามารถทำกำไร" },
  { id: "growth", label: "การเติบโต" },
  { id: "health", label: "สุขภาพการเงิน" },
  { id: "momentum", label: "โมเมนตัมราคา" },
  { id: "dividend", label: "เงินปันผล" },
];

const METRICS: MetricDef[] = [
  { key: "pe", label: "P/E", group: "valuation", lowerBetter: true, fmt: "x" },
  { key: "pb", label: "P/B", group: "valuation", lowerBetter: true, fmt: "x" },
  { key: "ps", label: "P/S", group: "valuation", lowerBetter: true, fmt: "x" },
  { key: "evEbitda", label: "EV/EBITDA", group: "valuation", lowerBetter: true, fmt: "x" },
  { key: "peg", label: "PEG", group: "valuation", lowerBetter: true, fmt: "num" },
  { key: "grossMargin", label: "Gross Margin", group: "profitability", fmt: "pct" },
  { key: "operMargin", label: "Oper. Margin", group: "profitability", fmt: "pct" },
  { key: "netMargin", label: "Profit Margin", group: "profitability", fmt: "pct" },
  { key: "roe", label: "ROE", group: "profitability", fmt: "pct" },
  { key: "roa", label: "ROA", group: "profitability", fmt: "pct" },
  { key: "roic", label: "ROIC", group: "profitability", fmt: "pct" },
  { key: "revYoy", label: "รายได้โต YoY", group: "growth", fmt: "pct" },
  { key: "epsYoy", label: "EPS โต YoY", group: "growth", fmt: "pct" },
  { key: "de", label: "หนี้/ทุน (D/E)", group: "health", lowerBetter: true, fmt: "x" },
  { key: "currentRatio", label: "Current Ratio", group: "health", fmt: "x" },
  { key: "quickRatio", label: "Quick Ratio", group: "health", fmt: "x" },
  { key: "perfY", label: "ผลตอบแทน 1 ปี", group: "momentum", fmt: "pct" },
  { key: "perfYTD", label: "ผลตอบแทน YTD", group: "momentum", fmt: "pct" },
  { key: "dividendYield", label: "ปันผล %", group: "dividend", fmt: "pct" },
];

const median = (arr: number[]): number | null => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const GLOBAL_REGIONS = ["america", "thailand", "japan", "taiwan", "korea", "hongkong", "china", "uk", "germany", "india"];

/** คำนวณ peer benchmark เต็ม — scope=market (ในตลาดเดียวกัน) / global (รวมตลาดหลัก) — null = peers ไม่พอ */
export async function peerBenchmark(symbol: string, scope: "market" | "global" = "market"): Promise<PeerResult | { error: string } | null> {
  const s = symbol.trim().toUpperCase();
  const hit = await findTvRow(s);
  if (!hit || !hit.row.sector) return { error: `ไม่พบ ${s} ใน universe (อาจเป็น ETF/หุ้นนอกความครอบคลุม)` };
  const me = hit.row;
  const homeRegion = hit.region;

  const regions = scope === "global"
    ? [...new Set([homeRegion, ...GLOBAL_REGIONS])].filter((r) => TV_REGIONS.some((x) => x.id === r))
    : [homeRegion];
  let pool: TvRow[] = [];
  for (const r of regions) {
    try {
      pool = pool.concat(await tvUniverse(r, r === "america" ? 1000 : 400));
    } catch {}
  }

  const byIndustry = pool.filter(
    (r) => r.symbol !== me.symbol && r.industry && r.industry === me.industry && Number.isFinite(r.price) && r.price > 0 && r.mcap > 0
  );
  let peers = byIndustry;
  let matchLevel: "industry" | "sector" = "industry";
  if (byIndustry.length < 8) {
    const bySector = pool.filter(
      (r) => r.symbol !== me.symbol && r.sector && r.sector === me.sector && Number.isFinite(r.price) && r.price > 0 && r.mcap > 0
    );
    if (bySector.length > byIndustry.length) {
      peers = bySector;
      matchLevel = "sector";
    }
  }
  if (peers.length < 3) return { error: `กลุ่มเดียวกัน (${me.industry || me.sector}) มีข้อมูลน้อยเกินไปสำหรับเปรียบเทียบ` };

  const groups: PeerGroup[] = GROUPS.map((g) => {
    const metrics = METRICS.filter((m) => m.group === g.id)
      .map((m) => {
        const mine = me[m.key];
        const vals = peers.map((p) => p[m.key]).filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v !== null);
        if (typeof mine !== "number" || !Number.isFinite(mine) || vals.length < 5) return null;
        const med = median(vals);
        if (med === null) return null;
        const worse = m.lowerBetter ? vals.filter((v) => v > mine).length : vals.filter((v) => v < mine).length;
        const diffPct = med !== 0 ? ((mine - med) / Math.abs(med)) * 100 : 0;
        return {
          key: String(m.key), label: m.label, fmt: m.fmt, lowerBetter: !!m.lowerBetter,
          value: mine, median: med, diffPct, better: m.lowerBetter ? mine < med : mine > med,
          percentile: Math.round((worse / vals.length) * 100), sampleSize: vals.length,
        };
      })
      .filter((x): x is PeerMetric => x !== null);
    const score = metrics.length ? Math.round(metrics.reduce((a, m) => a + m.percentile, 0) / metrics.length) : null;
    return { id: g.id, label: g.label, score, metrics };
  }).filter((g) => g.metrics.length > 0);

  const scored = groups.filter((g) => g.score !== null);
  const overall = scored.length ? Math.round(scored.reduce((a, g) => a + (g.score ?? 0), 0) / scored.length) : null;
  const grade = overall === null ? null : overall >= 85 ? "S" : overall >= 70 ? "A" : overall >= 55 ? "B" : overall >= 40 ? "C" : "D";

  return {
    symbol: s,
    name: me.name,
    sector: me.sector,
    industry: me.industry,
    region: homeRegion,
    scope,
    matchLevel,
    peerCount: peers.length,
    peers: [...peers].sort((a, b) => b.mcap - a.mcap).slice(0, 8).map((p) => ({ symbol: p.symbol, name: p.name, mcap: p.mcap })),
    groups,
    overall,
    grade,
    perf: { w: me.perfW, m1: me.perf1M, m3: me.perf3M, m6: me.perf6M, y: me.perfY, ytd: me.perfYTD, y3: me.perf3Y, y5: me.perf5Y },
  };
}

/** บรรทัดสรุปกระชับสำหรับแชท AI / LINE — "เทียบกลุ่มเซมิ (25 ตัว): เกรด B 59/100 · แข็งสุดกำไร(99) · อ่อนสุดโมเมนตัม(24)" */
export function peerSummaryLine(r: PeerResult): string {
  const scored = r.groups.filter((g) => g.score !== null).map((g) => ({ label: g.label, score: g.score as number }));
  const best = [...scored].sort((a, b) => b.score - a.score)[0];
  const worst = [...scored].sort((a, b) => a.score - b.score)[0];
  const bits = [
    `เทียบกลุ่ม${r.industry || r.sector} (${r.peerCount} ตัว): เกรด ${r.grade} ${r.overall}/100`,
    best ? `แข็งสุด${best.label}(${best.score})` : "",
    worst ? `อ่อนสุด${worst.label}(${worst.score})` : "",
  ].filter(Boolean);
  return bits.join(" · ");
}
