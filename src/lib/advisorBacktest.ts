// ===== Advisor Backtest — ทดสอบย้อนหลังว่า "เครื่องยนต์ปรับพอร์ตของ AI Advisor" ดีจริงไหม =====
// สมมติเป็นคนถือหุ้น 10 ตัว (น้ำหนักเท่ากัน) แล้วให้กฎเดียวกับที่ AI Advisor ใช้ทำงานทุกไตรมาส ย้อนหลัง 3 ปี
// เทียบ 3 เส้นทาง: (A) ถือเฉยๆ Buy & Hold (B) ทำตามกฎ Advisor (C) ตลาด SPY
// ความซื่อสัตย์ของการทดสอบ: ทุกการตัดสินใจใช้เฉพาะข้อมูล "ณ วันนั้น" (ราคา/SMA/RSI ถึงวันนั้น) ไม่แอบดูอนาคต

import { getChart } from "./yahoo";
import type { Candle } from "./types";

export interface AdvisorAction {
  ticker: string;
  rule: string; // ชื่อกฎที่ทริกเกอร์
  from: number; // น้ำหนักเดิม %
  to: number; // น้ำหนักใหม่ %
}

export interface QuarterPoint {
  date: string; // yyyy-MM-dd
  label: string; // ไตรมาสไทย
  advisorValue: number; // มูลค่าพอร์ตที่ทำตามกฎ (เริ่ม 100)
  holdValue: number; // ถือเฉยๆ
  spyValue: number; // SPY
  actions: AdvisorAction[];
  cashPct: number; // สัดส่วนเงินสดที่กฎสั่งถือ
}

export interface AdvisorBacktestResult {
  tickers: string[];
  startDate: string;
  endDate: string;
  quarters: QuarterPoint[];
  advisor: { totalPct: number; cagrPct: number; maxDrawdownPct: number; beatsHold: boolean; beatsSpy: boolean };
  hold: { totalPct: number; cagrPct: number; maxDrawdownPct: number };
  spy: { totalPct: number; cagrPct: number };
  actionCount: number;
  totalFeesPct: number; // ค่าธรรมเนียมสะสมที่หักแล้ว (% ของพอร์ตเริ่มต้น)
  coreTickers: string[]; // 📌 หุ้นแกนที่ยกเว้นกฎ trim
  grade: string; // S/A/B/C/D — ตัดสินจากชนะ B&H และ SPY มากแค่ไหน
  note: string;
}

// ---------- ตัวช่วยคำนวณ as-of (ไม่แอบดูอนาคต) ----------
function sma(vals: number[], n: number): number | null {
  if (vals.length < n) return null;
  const slice = vals.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / n;
}

function rsi14(closes: number[]): number | null {
  if (closes.length < 15) return null;
  let gains = 0;
  let losses = 0;
  const slice = closes.slice(-15);
  for (let i = 1; i < slice.length; i++) {
    const d = slice[i] - slice[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  const avgG = gains / 14;
  const avgL = losses / 14;
  if (avgL === 0) return 100;
  return 100 - 100 / (1 + avgG / avgL);
}

// ---------- กฎเดียวกับ /api/ai/portfolio-advisor (ส่วนที่ตัดสินใจได้จริง = กติกาเชิงตัวเลข) ----------
// R1 ตัวใหญ่เกิน 30% → เหลือ 25% (กัน single-stock risk เหมือน advisor จริง) — ยกเว้น 📌หุ้นแกน (เจ้าของตั้งใจถือ)
// R2 ร้อนแรง RSI≥75 → ลด 20% ของ position — ยกเว้นหุ้นแกน (เหตุผลเดียวกัน: อย่ากัดกำไรตัวที่เจ้าของเลือกถือ)
// R3 ต่ำกว่า SMA200 และ RSI<45 → ลด 25% (สัญญาณเอียงลบทั้งระบบ)
// R4 ติดลบเกิน 45% จากราคาเข้า → ตัดครึ่ง (stop-loss ที่ advisor แนะนำเสมอ)
// R5 ถ้าตัวที่สัญญาณลบ ≥ ครึ่งพอร์ต → เก็บเงินสด 15% (de-risk เหมือน advisor)
export function applyAdvisorRules(
  holdings: { ticker: string; price: number; entryPrice: number; weight: number; rsi: number | null; sma200: number | null; core?: boolean }[]
): { targets: Record<string, number>; actions: AdvisorAction[]; cashPct: number } {
  const actions: AdvisorAction[] = [];
  const targets: Record<string, number> = {};
  for (const h of holdings) targets[h.ticker] = h.weight;

  // R1 ความเข้มข้น (หุ้นแกนยกเว้น)
  for (const h of holdings) {
    if (h.weight > 30 && !h.core) {
      actions.push({ ticker: h.ticker, rule: "ตัวใหญ่เกิน 30% → เหลือ 25%", from: h.weight, to: 25 });
      targets[h.ticker] = 25;
    }
  }
  // R2 ร้อนแรง (หุ้นแกนยกเว้น)
  for (const h of holdings) {
    if (h.rsi !== null && h.rsi >= 75 && targets[h.ticker] > 4 && !h.core) {
      const to = Math.max(3, targets[h.ticker] * 0.8);
      actions.push({ ticker: h.ticker, rule: `RSI ${h.rsi.toFixed(0)} ร้อนแรง → ลด 20%`, from: targets[h.ticker], to });
      targets[h.ticker] = to;
    }
  }
  // R3 เอียงลบ
  let bearish = 0;
  for (const h of holdings) {
    const bear = h.sma200 !== null && h.price < h.sma200 && (h.rsi ?? 50) < 45;
    if (bear) bearish++;
  }
  for (const h of holdings) {
    const bear = h.sma200 !== null && h.price < h.sma200 && (h.rsi ?? 50) < 45;
    if (bear && targets[h.ticker] > 4) {
      const to = Math.max(3, targets[h.ticker] * 0.75);
      actions.push({ ticker: h.ticker, rule: "ต่ำกว่า SMA200 + RSI อ่อน → ลด 25%", from: targets[h.ticker], to });
      targets[h.ticker] = to;
    }
  }
  // R4 stop-loss
  for (const h of holdings) {
    const pl = h.entryPrice > 0 ? (h.price - h.entryPrice) / h.entryPrice : 0;
    if (pl <= -0.45 && targets[h.ticker] > 4) {
      const to = Math.max(3, targets[h.ticker] * 0.5);
      actions.push({ ticker: h.ticker, rule: `ขาดทุน ${(pl * 100).toFixed(0)}% → ตัดครึ่ง`, from: targets[h.ticker], to });
      targets[h.ticker] = to;
    }
  }
  // R5 de-risk เป็นเงินสด
  let cashPct = 0;
  if (bearish >= Math.ceil(holdings.length / 2)) {
    cashPct = 15;
    actions.push({ ticker: "เงินสด", rule: `${bearish}/${holdings.length} ตัวสัญญาณลบ → ถือเงินสด 15%`, from: 0, to: 15 });
  }

  // ส่วนที่ลดออก + เงินสด: กระจายคืนให้ตัวที่ไม่โดนกฎ (เท่ากัน) — เหมือนคำแนะนำ "ย้ายไปตัวอื่น" ของ advisor
  const freed = 100 - cashPct - Object.values(targets).reduce((a, b) => a + b, 0);
  if (freed > 0.01) {
    const safe = holdings.filter((h) => !actions.some((a) => a.ticker === h.ticker));
    if (safe.length) {
      const add = freed / safe.length;
      for (const h of safe) targets[h.ticker] += add;
    }
  }
  return { targets, actions, cashPct };
}

function maxDrawdown(series: number[]): number {
  let peak = series[0] ?? 100;
  let mdd = 0;
  for (const v of series) {
    if (v > peak) peak = v;
    mdd = Math.min(mdd, ((v - peak) / peak) * 100);
  }
  return mdd;
}

function cagr(series: number[]): number {
  const years = (series.length - 1) / 4; // ไตรมาส → ปี
  if (years <= 0 || series[0] <= 0) return 0;
  return ((series[series.length - 1] / series[0]) ** (1 / years) - 1) * 100;
}

const TH_Q = ["ไตรมาส 1", "ไตรมาส 2", "ไตรมาส 3", "ไตรมาส 4"];

// ค่าธรรมเนียมจำลอง: 0.15% ต่อฝั่งซื้อ/ขาย (ประมาณโบรกไทย/ส่วนต่างราคาจริง) — หักจากพอร์ต advisor ตามปริมาณที่ rebalance จริง
const FEE_PER_SIDE = 0.0015;

export async function runAdvisorBacktest(tickers: string[], opts?: { endDate?: string; cores?: string[] }): Promise<AdvisorBacktestResult> {
  const symbols = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))].slice(0, 12);
  if (symbols.length < 2) throw new Error("ต้องมีอย่างน้อย 2 ตัว");
  const coreSet = new Set((opts?.cores ?? []).map((c) => c.trim().toUpperCase()));

  // ข้อมูล 10 ปีรายวัน — ทดสอบ 3 ปีล่าสุดของช่วงที่ระบุ (endDate ย้อนหลังได้ = walk-forward หลายหน้าต่าง)
  // สำคัญ: ต้องใช้ "10YD" (แท่งรายวัน) — แท่งรายสัปดาห์คำนวณ SMA200/RSI รายวันไม่ได้
  const [spyC, ...charts] = await Promise.all([getChart("SPY", "10YD"), ...symbols.map((s) => getChart(s, "10YD"))]);
  const data: Record<string, Candle[]> = {};
  symbols.forEach((s, i) => (data[s] = charts[i]));
  const valid = symbols.filter((s) => (data[s]?.length ?? 0) > 500); // ต้องมีประวัติยาวพอ
  if (valid.length < 2) throw new Error("หุ้นตัวเหล่านี้มีประวัติ < 5 ปี ย้อนหลังไม่พอ (เช่น IPO ใหม่)");

  // จุดไตรมาส: ทุก ~63 วันซื้อขาย จำนวน 13 จุด (12 ช่วง = 3 ปี) — จบที่วันสุดท้าย หรือ ณ endDate ถ้าระบุ
  const spy = spyC.filter((c) => isFinite(c.close));
  const STEP = 63;
  let lastIndex = spy.length - 1;
  if (opts?.endDate) {
    const endUnix = Date.parse(opts.endDate) / 1000;
    if (!isNaN(endUnix)) {
      const cut = spy.findIndex((c) => c.time > endUnix);
      lastIndex = (cut > 0 ? cut - 1 : lastIndex);
    }
  }
  const idxs: number[] = [];
  for (let k = 12; k >= 0; k--) {
    const i = lastIndex - k * STEP;
    if (i > 200) idxs.push(i); // เว้นหัวให้ SMA200 ของหุ้นทุกตัวมีข้อมูล
  }

  const fmtDate = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);

  // เริ่ม: น้ำหนักเท่ากัน ซื้อ ณ วันแรกของการทดสอบ ด้วยราคาปิดวันนั้น
  const startIdx = idxs[0];
  const entryPrice: Record<string, number> = {};
  for (const s of valid) {
    const c = data[s].find((x) => x.time >= spy[startIdx].time);
    entryPrice[s] = c?.close ?? data[s][data[s].length - 1].close;
  }
  let weights: Record<string, number> = {};
  const w0 = 100 / valid.length;
  for (const s of valid) weights[s] = w0;
  // น้ำหนักเป้าหมายที่กฎสั่งไว้ "ตอนต้นไตรมาส" (รอบแรก = ถือเท่ากันเหมือนคนเพิ่งซื้อ)
  let targetWeights: Record<string, number> = { ...weights };

  const quarters: QuarterPoint[] = [];
  let advisorValue = 100;
  let holdValue = 100;
  let spyValue = 100;
  const advisorSeries: number[] = [100];
  const holdSeries: number[] = [100];
  const spySeries: number[] = [100];
  let cashPct = 0;
  let actionCount = 0;
  let totalFeePct = 0; // ค่าธรรมเนียมสะสม (% ของมูลค่าพอร์ตเริ่มต้น)

  for (let q = 1; q < idxs.length; q++) {
    const prevIdx = idxs[q - 1];
    const curIdx = idxs[q];
    const prevT = spy[prevIdx].time;
    const curT = spy[curIdx].time;

    // ผลตอบแทนช่วงไตรมาสนี้ ของแต่ละตัว (ราคาปิดถึงราคาปิด)
    const ret: Record<string, number> = {};
    const priceNow: Record<string, number> = {};
    const rsiNow: Record<string, number | null> = {};
    const smaNow: Record<string, number | null> = {};
    for (const s of valid) {
      const upto = data[s].filter((c) => c.time <= curT);
      const before = data[s].filter((c) => c.time <= prevT);
      const p0 = before[before.length - 1]?.close;
      const p1 = upto[upto.length - 1]?.close;
      ret[s] = p0 && p1 ? p1 / p0 - 1 : 0;
      priceNow[s] = p1 ?? p0 ?? entryPrice[s];
      rsiNow[s] = rsi14(upto.map((c) => c.close));
      smaNow[s] = sma(upto.map((c) => c.close), 200);
    }
    const spy0 = spy[prevIdx].close;
    const spy1 = spy[curIdx].close;
    const spyRet = spy1 / spy0 - 1;
    spyValue *= 1 + spyRet;

    // (A) Buy & Hold — น้ำหนักลอยตามราคา
    let holdQ = 0;
    for (const s of valid) holdQ += (weights[s] / 100) * ret[s];
    holdValue *= 1 + holdQ;
    // อัปเดตน้ำหนักลอยของพอร์ต hold (สำหรับกฎรอบถัดไปใช้พื้นฐานเดียวกัน)
    const drifted: Record<string, number> = {};
    let total = 0;
    for (const s of valid) {
      drifted[s] = weights[s] * (1 + ret[s]);
      total += drifted[s];
    }
    for (const s of valid) weights[s] = (drifted[s] / total) * 100;

    // (B) Advisor — ใช้น้ำหนักเป้าหมายที่กฎให้ไว้ "ตอนต้นไตรมาส" (จากรอบก่อน) เงินสดส่วนที่เหลือถือเฉยๆ
    let advisorQ = 0;
    for (const s of valid) advisorQ += (targetWeights[s] / 100) * ret[s];
    advisorValue *= 1 + advisorQ;

    // สิ้นไตรมาส: ให้กฎตัดสินใจใหม่จากข้อมูล "ณ วันนี้" เท่านั้น
    const holdingsNow = valid.map((s) => ({
      ticker: s,
      price: priceNow[s],
      entryPrice: entryPrice[s],
      weight: weights[s],
      rsi: rsiNow[s],
      sma200: smaNow[s],
      ...(coreSet.has(s) ? { core: true } : {}),
    }));
    const decision = applyAdvisorRules(holdingsNow);
    targetWeights = decision.targets;
    cashPct = decision.cashPct;
    actionCount += decision.actions.length;

    // ค่าธรรมเนียม rebalance: ปริมาณซื้อขาย = ผลรวมส่วนต่างน้ำหนัก ÷ 2 (ฝั่งขาย = ฝั่งซื้อ) × อัตราต่อฝั่ง
    let turnover = 0;
    for (const s of valid) turnover += Math.abs((targetWeights[s] ?? 0) - weights[s]) / 100;
    turnover /= 2;
    const fee = turnover * FEE_PER_SIDE;
    advisorValue *= 1 - fee;
    totalFeePct += fee * 100;

    const d = new Date(spy[curIdx].time * 1000);
    quarters.push({
      date: fmtDate(spy[curIdx].time),
      label: `${TH_Q[Math.floor(d.getMonth() / 3)]} ${d.getFullYear() + 543}`,
      advisorValue: Math.round(advisorValue * 100) / 100,
      holdValue: Math.round(holdValue * 100) / 100,
      spyValue: Math.round(spyValue * 100) / 100,
      actions: decision.actions,
      cashPct,
    });
    advisorSeries.push(advisorValue);
    holdSeries.push(holdValue);
    spySeries.push(spyValue);
  }

  const advTotal = (advisorValue - 100);  const holdTotal = (holdValue - 100);
  const spyTotal = (spyValue - 100);
  const beatsHold = advisorValue > holdValue;
  const beatsSpy = advisorValue > spyValue;

  let grade = "D";
  const edge = advTotal - Math.max(holdTotal, spyTotal);
  if (beatsHold && beatsSpy && edge > 15) grade = "S";
  else if (beatsHold && beatsSpy) grade = "A";
  else if (beatsHold || beatsSpy) grade = "B";
  else if (advTotal > Math.min(holdTotal, spyTotal) - 5) grade = "C";

  const ddA = maxDrawdown(advisorSeries);
  const ddH = maxDrawdown(holdSeries);

  return {
    tickers: valid,
    startDate: idxs.length ? fmtDate(spy[idxs[0]].time) : "",
    endDate: idxs.length ? fmtDate(spy[idxs[idxs.length - 1]].time) : "",
    quarters,
    advisor: { totalPct: Math.round(advTotal * 10) / 10, cagrPct: Math.round(cagr(advisorSeries) * 10) / 10, maxDrawdownPct: Math.round(ddA * 10) / 10, beatsHold, beatsSpy },
    hold: { totalPct: Math.round(holdTotal * 10) / 10, cagrPct: Math.round(cagr(holdSeries) * 10) / 10, maxDrawdownPct: Math.round(ddH * 10) / 10 },
    spy: { totalPct: Math.round(spyTotal * 10) / 10, cagrPct: Math.round(cagr(spySeries) * 10) / 10 },
    actionCount,
    totalFeesPct: Math.round(totalFeePct * 100) / 100,
    coreTickers: valid.filter((s) => coreSet.has(s)),
    grade,
    note: "เครื่องยนต์กฎตัวเลขชุดเดียวกับที่ AI Advisor ใช้ใน /portfolio (ส่วนที่ตัดสินใจได้จริง) — ตัวสรุปภาษาไทยของ AI ไม่ได้ backtest · ทุกการตัดสินใจใช้ข้อมูลถึงวันนั้นเท่านั้น · หักค่าธรรมเนียมจำลอง 0.15% ต่อฝั่งตามปริมาณ rebalance จริงแล้ว (ยังไม่รวมภาษี)",
  };
}
