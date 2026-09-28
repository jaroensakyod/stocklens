// ===== 🎨 Content Studio — การ์ด "หุ้นปันผลต่อเนื่อง" + การ์ด "ตำนาน XD" =====
// ตอบกระแฟน "หุ้นปันผล 10 ปีต่อเนื่อง / จ่ายทุกเดือน / ซื้อก่อน XD ได้ปันผลฟรีไหม" ด้วยข้อมูลจริง:
// - streak: คัดจากประวัติจ่ายปันผลจริง (Yahoo events=div, date ของ .BK = วัน XD) ย้อนหลัง 10 ปี
// - xd: เปิดราคารอบวัน XD จริงของหุ้น .BK ว่า "ราคาอ้างอิง" ถูกปรับลงพอดีส่วนต่างปันผล — ไม่มีเงินฟรี
import { getChart, getQuotes, getDividendHistory, cached } from "./yahoo";
import universe from "@/data/universe.json";
import setWatch from "@/data/set-watchlist.json";

// ผู้สมัครไทย: หุ้นสภาพคล่องสูงที่จ่ายปันผลเป็นประจำ (คัดจาก set-watchlist — เครื่องยิงเองตัดที่ไม่ผ่านเกณฑ์)
export const TH_DIV_CANDIDATES = [
  "PTT.BK", "PTTEP.BK", "TOP.BK", "IRPC.BK", "BANPU.BK", "GPSC.BK", "GULF.BK", "EGCO.BK", "RATCH.BK",
  "AOT.BK", "BEM.BK", "BTS.BK", "MINT.BK", "CENTEL.BK", "CPALL.BK", "HMPRO.BK", "COM7.BK", "CPF.BK", "SAPPE.BK",
  "BDMS.BK", "BH.BK", "BBL.BK", "KBANK.BK", "SCB.BK", "KTB.BK", "TISCO.BK", "KTC.BK",
  "INTUCH.BK", "ADVANC.BK", "SCC.BK", "IVL.BK", "PTTGC.BK", "WHA.BK", "LH.BK", "OR.BK", "SCGP.BK", "TPIPP.BK", "CK.BK", "GLOBAL.BK", "ROBINS.BK",
];
// ผู้สมัคร US: หุ้นจ่ายปันผลยาวนาน (aristocrats) + กองทุน/หุ้นจ่ายรายเดือน (ตอบเทรนด์ "จ่ายทุกเดือน")
const US_DIV_CANDIDATES = [
  "KO", "JNJ", "PG", "PEP", "MCD", "XOM", "CVX", "IBM", "ABBV", "T", "VZ", "O", "MAIN", "STAG", "OHI", "EPR", "ARCC", "SCHD", "VYM", "JEPQ",
];

const uniName = new Map<string, string>((universe as { tickers: { t: string; n: string }[] }).tickers.map((r) => [r.t, r.n]));
const thName = new Map<string, string>((setWatch as { tickers: { t: string; n: string }[] }).tickers.map((r) => [r.t, r.n]));
const nameOf = (s: string) => thName.get(s) ?? uniName.get(s) ?? s;

// ---------- การ์ด 1: หุ้นปันผลต่อเนื่อง ----------

export interface StreakRow {
  symbol: string;
  name: string;
  streakYears: number; // จ่ายต่อเนื่องกี่ปี (นับถอยจากปีที่จ่ายล่าสุด ยอมให้ปีนี้ยังไม่จ่าย)
  paysPerYear: number; // ครั้ง/ปี จากรอบล่าสุด
  ttmTotal: number; // รวมปันผล 12 เดือนล่าสุด ต่อหุ้น (สกุลเงินของหุ้น)
  currency: string;
  price: number;
  yieldPct: number | null; // ttm ÷ ราคาล่าสุด
  specialFlag: boolean; // 12 ด.ล่าสุดมีปันผลพิเศษทำ yield สูงผิดปกติ (เทียบ median ปันผลรายปี)
  yearTotals: { year: number; total: number }[]; // ≤10 ปีล่าสุด สำหรับกราฟแท่ง
}

export interface DividendStreakData {
  asOfTh: string;
  market: "TH" | "US" | "CUSTOM";
  minYears: number;
  scanned: number;
  rows: StreakRow[]; // เรียงตาม streak → yield เอา ≤7 ตัว
  note: string;
}

function analyzeEvents(symbol: string, events: { ts: number; amount: number }[], price: number, currency: string): StreakRow {
  const now = Date.now() / 1000;
  const byYear = new Map<number, number>();
  for (const e of events) {
    const y = new Date(e.ts * 1000).getUTCFullYear();
    byYear.set(y, (byYear.get(y) ?? 0) + e.amount);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const nowY = new Date().getUTCFullYear();
  let streak = 0;
  // ปีล่าสุดที่จ่ายต้องเป็นปีนี้หรือปีก่อน (ปันผลไทยส่วนใหญ่จ่ายช่วง มี.-พ.ค.) — นับย้อนเป็นสายต่อเนื่อง
  if (years.length && years[0] >= nowY - 1) {
    for (const y of years) {
      if (y === years[0] - streak) streak++;
      else break;
    }
  }
  const recent = events.filter((e) => now - e.ts <= 365 * 86400);
  const ttm = Math.round(recent.reduce((a, e) => a + e.amount, 0) * 1000) / 1000;
  const prevCycle = events.filter((e) => now - e.ts > 365 * 86400 && now - e.ts <= 730 * 86400);
  const paysPerYear = recent.length || prevCycle.length;
  const yearTotals = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-10)
    .map(([year, total]) => ({ year, total: Math.round(total * 1000) / 1000 }));
  // ธงปันผลพิเศษ: 12 ด.ล่าสุดจ่ายมากเกิน ~1.8 เท่าของปันผลรายปี "ปกติ" (median 5 ปีที่จบแล้ว) เช่น ADVANC ปันพิเศษ 27฿ จากการขายหุ้นลูก
  const nowYear = new Date().getUTCFullYear();
  const completeYearlys = [...byYear.entries()].filter(([y]) => y < nowYear).map(([, v]) => v);
  const last5 = completeYearlys.slice(-5).sort((a, b) => a - b);
  const median5 = last5.length ? last5[Math.floor(last5.length / 2)] : 0;
  const specialFlag = median5 > 0 && ttm > median5 * 1.8;
  return {
    symbol,
    name: nameOf(symbol),
    streakYears: streak,
    paysPerYear,
    ttmTotal: ttm,
    currency,
    price,
    yieldPct: price > 0 ? (ttm / price) * 100 : null,
    specialFlag,
    yearTotals,
  };
}

export async function computeDividendStreak(market: "TH" | "US" | "CUSTOM", customSymbols: string[], minYears: number): Promise<DividendStreakData> {
  const cleanCustom = [...new Set(customSymbols.map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9.\-]{1,10}$/.test(s)))].slice(0, 30);
  const symbols = market === "CUSTOM" ? cleanCustom : market === "TH" ? [...TH_DIV_CANDIDATES] : [...US_DIV_CANDIDATES];
  if (!symbols.length) throw new Error("ต้องมีอย่างน้อย 1 สัญลักษณ์");

  // ยิงทีละ 6 ตัว (burst เต็มสปีดโดน Yahoo throttle ตัดทิ้งเงียบๆ)
  const histories: { ts: number; amount: number }[][] = new Array(symbols.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(6, symbols.length) }, async () => {
      while (next < symbols.length) {
        const k = next++;
        histories[k] = await getDividendHistory(symbols[k], 10);
      }
    })
  );
  // รอบสอง: ตัวที่หาย (โดน rate-limit) ยิงซ้ำช้าๆ ทีละตัว
  for (let k = 0; k < symbols.length; k++) {
    if (!histories[k] || !histories[k].length) {
      await new Promise((r) => setTimeout(r, 400));
      histories[k] = await getDividendHistory(symbols[k], 10);
    }
  }
  const paid = symbols.map((s, i) => ({ s, events: histories[i] ?? [] })).filter((x) => x.events.length >= 2);
  if (!paid.length) throw new Error("ไม่พบประวัติปันผลของสัญลักษณ์เหล่านี้");

  const quotes = await getQuotes(paid.map((x) => x.s));
  const rows = paid
    .map((x) => {
      const q = quotes[x.s];
      if (!q || !isFinite(q.price) || q.price <= 0) return null;
      return analyzeEvents(x.s, x.events, q.price, q.currency);
    })
    .filter((r): r is StreakRow => r !== null && r.streakYears >= minYears && r.ttmTotal > 0)
    .sort((a, b) => b.streakYears - a.streakYears || (b.yieldPct ?? 0) - (a.yieldPct ?? 0))
    .slice(0, 7);
  if (!rows.length) throw new Error(`ไม่มีตัวไหนจ่ายต่อเนื่อง ≥ ${minYears} ปี (สแกน ${paid.length} ตัว) — ลองลดเกณฑ์`);

  return {
    asOfTh: new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }),
    market,
    minYears,
    scanned: symbols.length,
    rows,
    note: "คัดจากประวัติจ่ายปันผลจริง (วันขึ้นเครื่องหมาย XD) ย้อนหลังสูงสุด 10 ปี · yield = ปันผล 12 เดือนล่าสุด ÷ ราคาล่าสุด · ◆ = มีปันผลพิเศษใน 12 ด.ล่าสุด ทำให้ yield สูงผิดปกติ ดูแท่งรายปีประกอบ · จ่ายต่อเนื่องมาก่อน ≠ การันตีว่าจะจ่ายต่อ · ผลอดีตไม่รับประกันอนาคต ไม่ใช่คำแนะนำการลงทุน",
  };
}

function hashStreak(market: string, symbols: string[], minYears: number): string {
  const s = JSON.stringify([market, [...symbols].sort(), minYears]);
  let h = 5381;
  for (let k = 0; k < s.length; k++) h = ((h << 5) + h + s.charCodeAt(k)) >>> 0;
  return h.toString(36);
}

export async function getDividendStreak(market: "TH" | "US" | "CUSTOM", customSymbols: string[], minYears: number): Promise<DividendStreakData> {
  const symbols = market === "CUSTOM" ? customSymbols : market === "TH" ? [...TH_DIV_CANDIDATES] : [...US_DIV_CANDIDATES];
  return cached(`divstreak:v2:${hashStreak(market, symbols, minYears)}`, 6 * 3600_000, async () =>
    computeDividendStreak(market, customSymbols, minYears)
  ) as Promise<DividendStreakData>;
}

// ---------- การ์ด 2: ตำนาน XD — ซื้อก่อน XD รับปันผล "ฟรี" ไหม? ----------

export interface XdMythData {
  asOfTh: string;
  symbol: string;
  name: string;
  xdTh: string; // วันขึ้น XD
  divPerShare: number; // บาท
  prevClose: number; // ปิดวันก่อน XD
  refPrice: number; // ราคาอ้างอิงวัน XD = ปิดก่อน − ปันผล (ที่ตลาดปรับให้อัตโนมัติ)
  xdOpen: number; // ราคาเปิดจริงวัน XD
  xdClose: number; // ปิดวัน XD
  close5d: number | null; // ปิดราว 5 วันทำการหลัง XD
  chart: { t: number; c: number }[]; // ราคาปิดรายวันรอบ XD (ประมาณ -15..+20 วันทำการ)
  xdIdx: number; // ตำแหน่ง XD ใน chart
  windowDays: number;
  note: string;
}

/** เลือกงวดปันผลล่าสุดของหุ้น .BK ที่ขึ้น XD ไปแล้ว 18-330 วัน (มีราคาหลัง XD ให้ดู) → ประกอบการ์ด */
export async function computeXdMyth(symbol: string): Promise<XdMythData> {
  const sym = symbol.trim().toUpperCase();
  if (!sym.endsWith(".BK")) throw new Error("การ์ด XD ใช้กับหุ้นไทย (.BK) เท่านั้น — กติการาคาอ้างอิงเป็นของตลาด SET");
  const events = await getDividendHistory(sym, 2);
  const now = Date.now() / 1000;
  const cand = [...events].reverse().find((e) => now - e.ts > 18 * 86400 && now - e.ts < 330 * 86400);
  if (!cand) throw new Error("ไม่พบงวดปันผลที่ขึ้น XD ไปแล้ว (ภายใน ~1 ปี) — ลองตัวอื่น");

  const candles = await getChart(sym, "1Y"); // รายวัน
  const idx = candles.findIndex((c) => c.time >= cand.ts);
  if (idx < 1) throw new Error("ไม่พบราคารายวันรอบวัน XD — ลองอีกครั้ง");
  const prev = candles[idx - 1];
  const xd = candles[idx];
  const after = candles.slice(idx, idx + 6);
  const close5d = after.length ? after[after.length - 1].close : null;

  const from = Math.max(0, idx - 15);
  const to = Math.min(candles.length, idx + 21);
  const chart = candles.slice(from, to).map((c) => ({ t: c.time, c: c.close }));

  return {
    asOfTh: new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }),
    symbol: sym,
    name: nameOf(sym),
    xdTh: new Date(cand.ts * 1000).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }),
    divPerShare: cand.amount,
    prevClose: prev.close,
    refPrice: Math.max(0, Math.round((prev.close - cand.amount) * 100) / 100),
    xdOpen: xd.open,
    xdClose: xd.close,
    close5d,
    chart,
    xdIdx: idx - from,
    windowDays: to - from,
    note: "ราคาอ้างอิงวัน XD = ราคาปิดวันก่อน − ปันผล (กติกาตลาด SET ปรับให้อัตโนมัติ) · ราคาเปิดจริงต่างได้ตาม demand-supply ของวันนั้น · ข้อมูลราคาจาก Yahoo Finance · เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน",
  };
}

export async function getXdMyth(symbol: string): Promise<XdMythData> {
  return cached(`xdmyth:v1:${symbol.trim().toUpperCase()}`, 6 * 3600_000, async () => computeXdMyth(symbol)) as Promise<XdMythData>;
}
