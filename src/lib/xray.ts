// ===== Portfolio X-ray — ส่องพอร์ตลึกกว่ากำไรขาดทุน: benchmark / ความเสี่ยง / ความเข้มข้น / ปันผล / fee =====
import { getChart, getQuotes, getUsdThb, getAnalystConsensus } from "./yahoo";
import { buildAnalysis } from "./analysis";
import { findSectorInfo } from "./tvscanner";

export interface XrayHolding { ticker: string; qty: number; avgCost?: number; core?: boolean }

export interface XrayResult {
  totalValueThb: number;
  currencyNote: string;
  returns: { period: string; portfolio: number | null; set: number | null; spx: number | null }[];
  equity: { d: string; p: number; set: number; spx: number }[]; // ปีล่าสุด (สัปดาห์ละจุด)
  factorsAvg: { valuation: number; growth: number; profitability: number; momentum: number; health: number; overall: number } | null;
  risk: { volAnnual: number | null; betaSet: number | null; maxDrawdown: number | null };
  concentration: { topWeightPct: number; hhi: number; sectors: { name: string; pct: number }[] };
  dividend: { estAnnualThb: number; yieldPct: number } | null;
  feeDragPct: number;
  weakPoints: string[];
}

const PERIODS: { label: string; days: number }[] = [
  { label: "1 เดือน", days: 30 },
  { label: "3 เดือน", days: 91 },
  { label: "6 เดือน", days: 182 },
  { label: "1 ปี", days: 365 },
  { label: "3 ปี", days: 1095 },
];

const closeOnOrBefore = (candles: { time: number; close: number }[], target: number): number | null => {
  let lo = 0;
  let hi = candles.length - 1;
  let ans: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time <= target) {
      ans = candles[mid].close;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
};

export async function runXray(holdings: XrayHolding[]): Promise<XrayResult | null> {
  const clean = holdings.filter((h) => h.ticker && h.qty > 0).slice(0, 20);
  if (clean.length < 1) return null;

  const syms = clean.map((h) => h.ticker);
  const [quotes, usdThb, benchSETRaw, benchSPX, benchTHD] = await Promise.all([
    getQuotes(syms).catch(() => ({}) as Record<string, { price: number; currency: string }>),
    getUsdThb().catch(() => 36),
    getChart("^SET.BK", "5YD").then((c) => (c.length > 60 ? c : [])).catch(() => [] as { time: number; close: number }[]),
    // ^SET.BK ประวัติบน Yahoo เสียบ่อย (เหลือ 1 จุด) — fallback ใช้ THD = ETF ไทยใน NYSE เป็นตัวแทนตลาดไทย (หน่วย USD จึงเทียบเป็น % ได้ตรง)
    getChart("^GSPC", "5YD").catch(() => [] as { time: number; close: number }[]),
    getChart("THD", "5YD").catch(() => [] as { time: number; close: number }[]),
  ]);
  const benchSET = benchSETRaw.length > 60 ? benchSETRaw : benchTHD;

  // มูลค่าต่อตัว (แปลงเป็นบาท) + น้ำหนัก
  const values: { sym: string; valueThb: number; weight: number; isThai: boolean }[] = [];
  let totalThb = 0;
  for (const h of clean) {
    const q = quotes[h.ticker];
    if (!q || !isFinite(q.price)) continue;
    const thb = q.currency === "THB" ? q.price : q.price * usdThb;
    const v = thb * h.qty;
    totalThb += v;
    values.push({ sym: h.ticker, valueThb: v, weight: 0, isThai: h.ticker.endsWith(".BK") });
  }
  if (!totalThb) return null;
  for (const v of values) v.weight = v.valueThb / totalThb;

  // ---- ผลตอบแทนย้อนหลัง (buy&hold ตามสัดส่วนปัจจุบัน) เทียบ SET/S&P ----
  const charts = await Promise.all(syms.map((s) => getChart(s, "5YD").catch(() => [])));
  const chartMap = new Map(syms.map((s, i) => [s, charts[i]]));
  const now = Date.now() / 1000;
  const portfolioReturn = (days: number): number | null => {
    let start = 0;
    let end = 0;
    let ok = false;
    for (const v of values) {
      const c = chartMap.get(v.sym) ?? [];
      const p0 = closeOnOrBefore(c, now - days * 86400);
      const p1 = c.length ? c[c.length - 1].close : null;
      if (p0 && p1) {
        start += v.weight * p0;
        end += v.weight * p1;
        ok = true;
      }
    }
    if (!ok || !start) return null;
    return (end / start - 1) * 100;
  };
  const benchReturn = (c: { time: number; close: number }[], days: number): number | null => {
    const p0 = closeOnOrBefore(c, now - days * 86400);
    const p1 = c.length ? c[c.length - 1].close : null;
    if (!p0 || !p1) return null;
    return (p1 / p0 - 1) * 100;
  };
  const returns = PERIODS.map((p) => ({
    period: p.label,
    portfolio: portfolioReturn(p.days),
    set: benchReturn(benchSET, p.days),
    spx: benchReturn(benchSPX, p.days),
  }));

  // ---- equity curve 1 ปี (รายสัปดาห์) ----
  const weekPoints: number[] = [];
  for (let d = 365; d >= 0; d -= 7) weekPoints.push(now - d * 86400);
  const equity = weekPoints.map((t) => {
    let pv = 0;
    for (const v of values) {
      const c = chartMap.get(v.sym) ?? [];
      const p = closeOnOrBefore(c, t) ?? closeOnOrBefore(c, now);
      if (p) pv += v.weight * p;
    }
    return {
      d: new Date(t * 1000).toISOString().slice(0, 10),
      p: Math.round(pv * 100) / 100,
      set: closeOnOrBefore(benchSET, t) ?? 0,
      spx: closeOnBeforeClamp(benchSPX, t),
    };
  }).filter((x, i, arr) => x.p > 0 && (i === 0 || x.d !== arr[i - 1].d));
  // นอร์มัลไลซ์เป็น 100
  const norm = (arr: { d: string; p: number; set: number; spx: number }[]) => {
    const b = arr[0];
    if (!b) return arr;
    return arr.map((x) => ({ ...x, p: (x.p / b.p) * 100, set: b.set ? (x.set / b.set) * 100 : 0, spx: b.spx ? (x.spx / b.spx) * 100 : 0 }));
  };

  // ---- ความเสี่ยง: vol/beta/MDD จากผลตอบแทนพอร์ตรายวัน 1 ปี ----
  const daySet = new Map<number, number>();
  const daily: { t: number; p: number }[] = [];
  for (let i = 0; i * 86400 <= 365 * 86400; i++) {
    const t = now - i * 86400;
    let pv = 0;
    for (const v of values) {
      const c = chartMap.get(v.sym) ?? [];
      const p = closeOnOrBefore(c, t);
      if (p) pv += v.weight * p;
    }
    if (pv > 0) daily.push({ t, p: pv });
  }
  daily.reverse();
  let volAnnual: number | null = null;
  let betaSet: number | null = null;
  let mdd: number | null = null;
  if (daily.length > 30) {
    const rets: number[] = [];
    for (let i = 1; i < daily.length; i++) rets.push(daily[i].p / daily[i - 1].p - 1);
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    volAnnual = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length) * Math.sqrt(252) * 100;
    // beta เทียบ SET
    const setRets: number[] = [];
    for (let i = 1; i < daily.length; i++) {
      const a = closeOnOrBefore(benchSET, daily[i - 1].t);
      const b = closeOnOrBefore(benchSET, daily[i].t);
      if (a && b) setRets.push(b / a - 1);
    }
    const n = Math.min(rets.length, setRets.length);
    if (n > 30) {
      const r = rets.slice(0, n);
      const m = setRets.slice(0, n);
      const mr = r.reduce((a, b) => a + b, 0) / n;
      const mm = m.reduce((a, b) => a + b, 0) / n;
      const cov = r.reduce((a, x, i) => a + (x - mr) * (m[i] - mm), 0) / n;
      const varM = m.reduce((a, x) => a + (x - mm) ** 2, 0) / n;
      if (varM > 0) betaSet = cov / varM;
    }
    let peak = daily[0].p;
    mdd = 0;
    for (const d of daily) {
      peak = Math.max(peak, d.p);
      mdd = Math.min(mdd, d.p / peak - 1);
    }
    mdd = Math.abs(mdd) * 100;
  }

  // ---- factor เฉลี่ยถ่วงน้ำหนัก (ตัวอย่าง 8 ตัวแรกพอ ประหยัด) ----
  let factorsAvg: XrayResult["factorsAvg"] = null;
  {
    const picks = values.slice(0, 8);
    const anas = await Promise.all(picks.map((v) => buildAnalysis(v.sym).catch(() => null)));
    const acc = { valuation: 0, growth: 0, profitability: 0, momentum: 0, health: 0, overall: 0 };
    let n = 0;
    for (let i = 0; i < picks.length; i++) {
      const f = anas[i]?.factors;
      if (f) {
        acc.valuation += f.valuation * picks[i].weight;
        acc.growth += f.growth * picks[i].weight;
        acc.profitability += f.profitability * picks[i].weight;
        acc.momentum += f.momentum * picks[i].weight;
        acc.health += f.health * picks[i].weight;
        acc.overall += f.overall * picks[i].weight;
        n++;
      }
    }
    if (n >= Math.min(2, picks.length)) factorsAvg = acc;
  }

  // ---- ความเข้มข้น ----
  const topWeightPct = Math.round(Math.max(...values.map((v) => v.weight)) * 1000) / 10;
  const hhi = Math.round(values.reduce((a, v) => a + v.weight ** 2, 0) * 10000) / 10000; // >0.25 = เข้มข้นมาก
  const sectorCount = new Map<string, number>();
  const sectorInfos = await Promise.all(values.slice(0, 12).map((v) => findSectorInfo(v.sym).catch(() => null)));
  values.forEach((v, i) => {
    const s = sectorInfos[i]?.sector || "อื่นๆ";
    sectorCount.set(s, (sectorCount.get(s) ?? 0) + v.weight);
  });
  const sectors = [...sectorCount.entries()].map(([name, w]) => ({ name, pct: Math.round(w * 1000) / 10 })).sort((a, b) => b.pct - a.pct);

  // ---- ปันผลคาดรับ (จากที่จ่ายจริง 12 เดือนล่าสุด ต่อหุ้น) ----
  let dividend: XrayResult["dividend"] = null;
  {
    const { getTrailingDividends } = await import("./yahoo");
    const results = await Promise.all(values.map(async (v) => ({ v, d: await getTrailingDividends(v.sym).catch(() => null) })));
    let estAnnual = 0;
    const symQty = new Map(clean.map((h) => [h.ticker, h.qty]));
    for (const { v, d } of results) {
      if (!d || !d.sum12m) continue;
      const qty = symQty.get(v.sym) ?? 0;
      const thbPer = v.isThai ? d.sum12m : d.sum12m * usdThb;
      estAnnual += thbPer * qty;
    }
    if (estAnnual > 0) dividend = { estAnnualThb: estAnnual, yieldPct: (estAnnual / totalThb) * 100 };
  }

  // ---- fee/tax drag ประมาณ (สมมติถือเฉลี่ย 8 เดือน/ตัว) ----
  const feeDragPct = Math.round((0.0015 * 2 + 0.0011) * (12 / 8) * 100 * 100) / 100 / 100;

  // ---- จุดอ่อน ----
  const weakPoints: string[] = [];
  if (topWeightPct >= 30) weakPoints.push(`น้ำหนัก "${values.sort((a, b) => b.weight - a.weight)[0].sym}" สูงถึง ${topWeightPct}% — ความเสี่ยงตัวเดียวสูง`);
  if (hhi > 0.25) weakPoints.push(`พอร์ตเข้มข้น (HHI ${hhi.toFixed(2)}) — กระจายน้อยกว่า 4 ตัวหลัก`);
  if (sectors[0] && sectors[0].pct >= 50) weakPoints.push(`${sectors[0].pct}% ของพอร์ตอยู่หมวด ${sectors[0].name} — พึ่งอุตสาหกรรมเดียวสูง`);
  if (mdd !== null && mdd >= 30) weakPoints.push(`เคยตกหนักสุด ${mdd.toFixed(0)}% ใน 1 ปี — ทนแรงกดดันได้แค่ไหน?`);
  if (dividend === null) weakPoints.push("พอร์ตยังไม่มีกระแสเงินสดจากปันผล");

  return {
    totalValueThb: totalThb,
    currencyNote: "มูลค่ารวมแปลงเป็นบาท (หุ้น US × อัตราปัจจุบัน)",
    returns,
    equity: norm(equity),
    factorsAvg,
    risk: { volAnnual, betaSet, maxDrawdown: mdd },
    concentration: { topWeightPct, hhi, sectors },
    dividend,
    feeDragPct,
    weakPoints,
  };
}

function closeOnBeforeClamp(c: { time: number; close: number }[], t: number): number {
  return closeOnOrBefore(c, t) ?? (c.length ? c[c.length - 1].close : 0);
}
