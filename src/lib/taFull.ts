// ===== แผงทางเทคนิคเต็มรูปแบบ (สไตล์ investing.com) =====
// คำนวณจากแท่งเทียนรายวันของ Yahoo ล้วนๆ — ไม่พึ่ง API ภายนอกเพิ่ม
// ออกแบบให้เป็น "ตารางสัญญาณ" ที่เห็นภาพรวมใน 3 วินาที: ออสซิลเลเตอร์ · ค่าเฉลี่ยเคลื่อนที่ · จุดหมุน

import type { Candle, TechnicalRead } from "./types";
import { sma, rsi, macd, readTechnicals } from "./indicators";

export type TaSignal = "buy" | "sell" | "neutral";
export type SummaryLevel = "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";

export interface OscRow { name: string; value: string; signal: TaSignal }
export interface MaRow { name: string; value: number; signal: TaSignal }
export interface PivotSet { pp: number; s1: number; s2: number; s3: number; r1: number; r2: number; r3: number }

export interface FullTechnical {
  symbol: string;
  price: number;
  asOf: number; // เวลาแท่งเทียนล่าสุด (unix sec)
  oscillators: { buy: number; sell: number; neutral: number; rows: OscRow[] };
  movingAverages: { buy: number; sell: number; neutral: number; rows: MaRow[] };
  pivots: { classic: PivotSet; fib: PivotSet; signal: TaSignal } | null;
  summary: SummaryLevel;
  classic: TechnicalRead; // ชุดเดิม (เหตุผล + เทคนิคขั้นสูง Fib/Elliott/Divergence/ATR)
}

const n2 = (v: number) => (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(2));
const vote = (rows: { signal: TaSignal }[]) => ({
  buy: rows.filter((r) => r.signal === "buy").length,
  sell: rows.filter((r) => r.signal === "sell").length,
  neutral: rows.filter((r) => r.signal === "neutral").length,
});

/** EMA ณ จุดปัจจุบัน */
function emaLast(values: number[], period: number): number | undefined {
  if (values.length < period) return undefined;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) prev = values[i] * k + prev * (1 - k);
  return prev;
}

/** Stochastic ช้า (14,3,3) — คืน %K, %D */
function stoch(candles: Candle[], period = 14, kSm = 3, dSm = 3): { k: number; d: number } | undefined {
  if (candles.length < period + kSm + dSm) return undefined;
  const rawK: number[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hh = Math.max(hh, candles[j].high);
      ll = Math.min(ll, candles[j].low);
    }
    rawK.push(hh === ll ? 50 : (100 * (candles[i].close - ll)) / (hh - ll));
  }
  const k = sma(rawK, kSm);
  if (k === undefined) return undefined;
  const kSeries: number[] = [];
  for (let i = kSm - 1; i < rawK.length; i++) kSeries.push(rawK.slice(i - kSm + 1, i + 1).reduce((a, b) => a + b, 0) / kSm);
  const d = sma(kSeries, dSm);
  if (d === undefined) return undefined;
  return { k, d };
}

/** CCI (20) */
function cci(candles: Candle[], period = 20): number | undefined {
  if (candles.length < period) return undefined;
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  const slice = tp.slice(-period);
  const m = slice.reduce((a, b) => a + b, 0) / period;
  const md = slice.reduce((a, b) => a + Math.abs(b - m), 0) / period;
  return md === 0 ? 0 : (tp[tp.length - 1] - m) / (0.015 * md);
}

/** Williams %R (14) */
function williamsR(candles: Candle[], period = 14): number | undefined {
  if (candles.length < period) return undefined;
  let hh = -Infinity, ll = Infinity;
  for (let i = candles.length - period; i < candles.length; i++) {
    hh = Math.max(hh, candles[i].high);
    ll = Math.min(ll, candles[i].low);
  }
  if (hh === ll) return -50;
  return (-100 * (hh - candles[candles.length - 1].close)) / (hh - ll);
}

/** ADX (14) แบบ Wilder — พร้อม +DI/-DI */
function adx(candles: Candle[], period = 14): { adx: number; plusDI: number; minusDI: number } | undefined {
  if (candles.length < period * 2 + 1) return undefined;
  const tr: number[] = [], pdm: number[] = [], ndm: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
    const up = c.high - p.high, dn = p.low - c.low;
    pdm.push(up > dn && up > 0 ? up : 0);
    ndm.push(dn > up && dn > 0 ? dn : 0);
  }
  let str = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let sp = pdm.slice(0, period).reduce((a, b) => a + b, 0);
  let sn = ndm.slice(0, period).reduce((a, b) => a + b, 0);
  const dxs: number[] = [];
  for (let i = period; i < tr.length; i++) {
    str = str - str / period + tr[i];
    sp = sp - sp / period + pdm[i];
    sn = sn - sn / period + ndm[i];
    const pdi = str === 0 ? 0 : (100 * sp) / str;
    const ndi = str === 0 ? 0 : (100 * sn) / str;
    dxs.push(pdi + ndi === 0 ? 0 : (100 * Math.abs(pdi - ndi)) / (pdi + ndi));
  }
  if (dxs.length < period) return undefined;
  let a = dxs.slice(0, period).reduce((x, y) => x + y, 0) / period;
  for (let i = period; i < dxs.length; i++) a = (a * (period - 1) + dxs[i]) / period;
  const pdiNow = str === 0 ? 0 : (100 * sp) / str;
  const ndiNow = str === 0 ? 0 : (100 * sn) / str;
  return { adx: a, plusDI: pdiNow, minusDI: ndiNow };
}

/** จุดหมุน (Pivot Points) — จากแท่งเมื่อวาน (แท่งปิดสมบูรณ์ล่าสุด) */
function pivotsFrom(c: Candle): { classic: PivotSet; fib: PivotSet } {
  const pp = (c.high + c.low + c.close) / 3;
  const range = c.high - c.low;
  const classic: PivotSet = {
    pp,
    r1: 2 * pp - c.low,
    s1: 2 * pp - c.high,
    r2: pp + range,
    s2: pp - range,
    r3: c.high + 2 * (pp - c.low),
    s3: c.low - 2 * (c.high - pp),
  };
  const fib: PivotSet = {
    pp,
    r1: pp + 0.382 * range,
    s1: pp - 0.382 * range,
    r2: pp + 0.618 * range,
    s2: pp - 0.618 * range,
    r3: pp + range,
    s3: pp - range,
  };
  return { classic, fib };
}

function levelFrom(avg: number): SummaryLevel {
  if (avg >= 0.5) return "strong_buy";
  if (avg >= 0.15) return "buy";
  if (avg <= -0.5) return "strong_sell";
  if (avg <= -0.15) return "sell";
  return "neutral";
}

export function buildFullTechnical(symbol: string, candles: Candle[]): FullTechnical | null {
  if (candles.length < 30) return null;
  const closes = candles.map((c) => c.close);
  const last = closes[closes.length - 1];
  if (!isFinite(last)) return null;

  // ---------- ออสซิลเลเตอร์ ----------
  const rows: OscRow[] = [];
  const r = rsi(closes, 14);
  if (r !== undefined) rows.push({ name: "RSI (14)", value: n2(r), signal: r < 30 ? "buy" : r > 70 ? "sell" : "neutral" });
  const st = stoch(candles);
  if (st) rows.push({ name: "Stochastic %K (14,3,3)", value: n2(st.k), signal: st.k < 20 ? "buy" : st.k > 80 ? "sell" : "neutral" });
  const m = macd(closes);
  if (m) rows.push({ name: "MACD (12,26) histogram", value: (m.hist >= 0 ? "+" : "") + n2(m.hist), signal: m.hist > 0 ? "buy" : "sell" });
  const cc = cci(candles);
  if (cc !== undefined) rows.push({ name: "CCI (20)", value: n2(cc), signal: cc < -100 ? "buy" : cc > 100 ? "sell" : "neutral" });
  const ax = adx(candles);
  if (ax && isFinite(ax.adx)) {
    const trend = ax.adx >= 22 ? (ax.plusDI > ax.minusDI ? "buy" : "sell") : "neutral";
    rows.push({ name: `ADX (14) ${n2(ax.adx)}`, value: `+DI ${n2(ax.plusDI)} / -DI ${n2(ax.minusDI)}`, signal: trend });
  }
  const wr = williamsR(candles);
  if (wr !== undefined) rows.push({ name: "Williams %R (14)", value: n2(wr), signal: wr < -80 ? "buy" : wr > -20 ? "sell" : "neutral" });
  if (closes.length > 34) {
    const mid = candles.map((c) => (c.high + c.low) / 2);
    const s5 = sma(mid.slice(-39), 5), s34 = sma(mid.slice(-34), 34);
    if (s5 !== undefined && s34 !== undefined) rows.push({ name: "Awesome Oscillator", value: n2(s5 - s34), signal: s5 > s34 ? "buy" : "sell" });
  }
  if (closes.length > 10) {
    const mom = last - closes[closes.length - 11];
    rows.push({ name: "Momentum (10)", value: (mom >= 0 ? "+" : "") + n2(mom), signal: mom > 0 ? "buy" : "sell" });
  }

  // ---------- ค่าเฉลี่ยเคลื่อนที่ ----------
  const maDefs: [string, number, boolean][] = [
    ["SMA 5", 5, false], ["SMA 10", 10, false], ["SMA 20", 20, false], ["SMA 50", 50, false], ["SMA 100", 100, false], ["SMA 200", 200, false],
    ["EMA 12", 12, true], ["EMA 20", 20, true], ["EMA 50", 50, true], ["EMA 200", 200, true],
  ];
  const maRows: MaRow[] = [];
  for (const [name, period, isEma] of maDefs) {
    const v = isEma ? emaLast(closes, period) : sma(closes, period);
    if (v !== undefined && isFinite(v)) maRows.push({ name, value: v, signal: last > v ? "buy" : "sell" });
  }

  // ---------- จุดหมุน ----------
  const prevCandle = candles[candles.length - 2] ?? candles[candles.length - 1];
  const piv = pivotsFrom(prevCandle);
  const pivotSignal: TaSignal = last > piv.classic.pp ? "buy" : last < piv.classic.pp ? "sell" : "neutral";

  // ---------- สรุปรวม ----------
  const all = [...rows.map((x) => x.signal), ...maRows.map((x) => x.signal), pivotSignal];
  const avg = all.length ? all.reduce((a, s) => a + (s === "buy" ? 1 : s === "sell" ? -1 : 0), 0) / all.length : 0;

  return {
    symbol,
    price: last,
    asOf: candles[candles.length - 1].time,
    oscillators: { ...vote(rows), rows },
    movingAverages: { ...vote(maRows), rows: maRows },
    pivots: { ...piv, signal: pivotSignal },
    summary: levelFrom(avg),
    classic: readTechnicals(candles),
  };
}
