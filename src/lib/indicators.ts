// ===== ตัวชี้วัดเทคนิค: SMA / RSI / MACD / Bollinger — คำนวณเองจากราคาปิด =====
import type { Candle, SignalLevel, TechnicalRead } from "./types";

export function sma(values: number[], period: number): number | undefined {
  if (values.length < period) return undefined;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function rsi(values: number[], period = 14): number | undefined {
  if (values.length < period + 1) return undefined;
  let gain = 0, loss = 0;
  const start = values.length - period - 1;
  for (let i = start + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  const avgG = gain / period, avgL = loss / period;
  if (avgL === 0) return 100;
  return 100 - 100 / (1 + avgG / avgL);
}

function emaSeries(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function macd(values: number[]) {
  if (values.length < 35) return undefined;
  const e12 = emaSeries(values, 12);
  const e26 = emaSeries(values, 26);
  const line = values.map((_, i) => e12[i] - e26[i]);
  const sig = emaSeries(line, 9);
  const n = values.length - 1;
  return { macd: line[n], signal: sig[n], hist: line[n] - sig[n], histPrev: line[n - 1] - sig[n - 1] };
}

export function bollinger(values: number[], period = 20, mult = 2) {
  if (values.length < period) return undefined;
  const slice = values.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const sd = Math.sqrt(slice.reduce((a, b) => a + (b - mid) ** 2, 0) / period);
  const upper = mid + mult * sd, lower = mid - mult * sd;
  const last = values[values.length - 1];
  return { upper, mid, lower, pctB: upper === lower ? 0.5 : (last - lower) / (upper - lower) };
}

export function readTechnicals(candles: Candle[]): TechnicalRead {
  const closes = candles.map((c) => c.close).filter((v) => isFinite(v));
  const last = closes[closes.length - 1];
  const s20 = sma(closes, 20), s50 = sma(closes, 50), s200 = sma(closes, 200);
  const r = rsi(closes);
  const m = macd(closes);
  const bb = bollinger(closes);

  const reasons: string[] = [];
  let score = 0;
  if (s20 !== undefined && isFinite(s20)) {
    if (last > s20) { score += 1; reasons.push("ราคาอยู่เหนือ SMA20 (แนวโน้มระยะสั้นบวก)"); }
    else { score -= 1; reasons.push("ราคาอยู่ต่ำกว่า SMA20 (แนวโน้มระยะสั้นอ่อนแรง)"); }
  }
  if (s50 !== undefined && isFinite(s50)) {
    if (last > s50) { score += 1; reasons.push("ราคาอยู่เหนือ SMA50"); }
    else { score -= 1; reasons.push("ราคาอยู่ต่ำกว่า SMA50"); }
  }
  if (s200 !== undefined && isFinite(s200)) {
    if (last > s200) { score += 1.5; reasons.push("ราคาอยู่เหนือ SMA200 — แนวโน้มหลักยังเป็นบวก"); }
    else { score -= 1.5; reasons.push("ราคาอยู่ต่ำกว่า SMA200 — แนวโน้มหลักเป็นลบ"); }
  }
  if (s50 !== undefined && s200 !== undefined && isFinite(s50) && isFinite(s200)) {
    if (s50 > s200) reasons.push("Golden Cross: SMA50 ตัดขึ้นเหนือ SMA200");
    else reasons.push("Death Cross: SMA50 ตัดลงใต้ SMA200");
  }
  if (r !== undefined) {
    if (r < 30) { score += 1; reasons.push(`RSI ${r.toFixed(0)} — เข้าเขต Oversold อาจมีโอกาสเด้งตัว`); }
    else if (r > 70) { score -= 1; reasons.push(`RSI ${r.toFixed(0)} — เข้าเขต Overbought เสี่ยงพักตัว`); }
    else reasons.push(`RSI ${r.toFixed(0)} — อยู่ในเขตปกติ`);
  }
  if (m) {
    if (m.hist > 0 && m.histPrev <= 0) { score += 1; reasons.push("MACD เพิ่งตัดขึ้นเหนือ signal (สัญญาณบวกใหม่)"); }
    else if (m.hist < 0 && m.histPrev >= 0) { score -= 1; reasons.push("MACD เพิ่งตัดลงใต้ signal (สัญญาณลบใหม่)"); }
    else if (m.hist > 0) { score += 0.5; reasons.push("MACD histogram เป็นบวก"); }
    else { score -= 0.5; reasons.push("MACD histogram เป็นลบ"); }
  }
  if (bb) {
    if (bb.pctB < 0.1) reasons.push("ราคาแตะขอบล่าง Bollinger — ผันผวนสูงช่วงขาลง");
    if (bb.pctB > 0.9) reasons.push("ราคาแตะขอบบน Bollinger — โมเมนตัมแรง");
  }

  const signal: SignalLevel = score >= 2 ? "bullish" : score <= -2 ? "bearish" : "neutral";
  return { sma20: s20, sma50: s50, sma200: s200, rsi14: r, macd: m, bollinger: bb, signal, reasons };
}
