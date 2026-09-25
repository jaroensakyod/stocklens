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

  // ===== เทคนิคขั้นสูง: pivots → Fibonacci / RSI divergence / ATR / Elliott Wave =====
  const pivots = findPivots(candles.slice(-260), 5);
  const fib = fibAnalysis(candles, pivots, last);
  const div = rsiDivergence(candles, pivots);
  const atr14 = atr(candles, 14);
  const ew = elliottWave(pivots, last);

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

  // สัญญาณจากเทคนิคขั้นสูง — มีน้ำหนักคะแนนเบาๆ เพราะเป็นระดับ/โครงสร้าง ไม่ใช่ trigger
  if (fib) {
    const at = fib.retracedPct;
    if (at !== null && at < 0) {
      reasons.push(`Fibonacci: ราคาทะลุปลายขาเดิมไปแล้ว ${Math.abs(at).toFixed(0)}% — อยู่ในโซนส่วนขยาย เป้าถัดไปตามทฤษฎี ${fib.extensions.map((e) => (e.ratio * 100).toFixed(1) + "%→" + e.price.toFixed(2)).join(" / ")}`);
    } else if (at !== null && at >= 55 && at <= 65 && fib.direction === "up") {
      score += 0.5;
      reasons.push(`Fibonacci: ย่อตัวแล้ว ${at.toFixed(0)}% อยู่แถบ golden ratio 61.8% ($${fib.nearestSupport?.price.toFixed(2) ?? "?"}) — โซน pullback คลาสสิกของเทรนด์ขึ้น`);
    } else if (at !== null && at >= 100) {
      reasons.push(`Fibonacci: ย่อเกิน 100% ของขาล่าสุด — เทรนด์ขาเดิม (${fib.direction === "up" ? "ขึ้น" : "ลง"}) ถูกทดสอนหนัก`);
    }
  }
  if (div) {
    score += div.type === "bullish" ? 1 : -1;
    reasons.push(`RSI Divergence ${div.type === "bullish" ? "บวก" : "ลบ"}: ${div.detail}`);
  }
  if (ew && ew.confidence >= 60) {
    reasons.push(`Elliott Wave (อ่านแบบเป็นระบบ): ${ew.waveLabel} — ${ew.expectation}${ew.invalidation ? ` (ถ้าทะลุ ${ew.invalidation.toFixed(2)} = นับเวฟใหม่)` : ""}`);
  }

  const signal: SignalLevel = score >= 2 ? "bullish" : score <= -2 ? "bearish" : "neutral";
  return {
    sma20: s20, sma50: s50, sma200: s200, rsi14: r, macd: m, bollinger: bb, signal, reasons,
    fib, divergence: div, atr14, atrStop: atr14 && isFinite(last) ? { long: last - 2 * atr14, short: last + 2 * atr14 } : undefined,
    elliott: ew,
  };
}

// =====================================================================
// ===== เทคนิคขั้นสูง: Pivots · Fibonacci · RSI Divergence · ATR · Elliott Wave =====
// =====================================================================

/** จุดกลับตัว (swing high/low) แบบ zigzag — high/low ที่สูง/ต่ำกว่า `w` แท่งซ้ายขวา */
export function findPivots(candles: Candle[], w = 5): { i: number; price: number; type: "H" | "L" }[] {
  const out: { i: number; price: number; type: "H" | "L" }[] = [];
  for (let i = w; i < candles.length - w; i++) {
    let isH = true;
    let isL = true;
    for (let k = i - w; k <= i + w; k++) {
      if (k === i) continue;
      if (candles[k].high >= candles[i].high) isH = false;
      if (candles[k].low <= candles[i].low) isL = false;
    }
    if (isH) out.push({ i, price: candles[i].high, type: "H" });
    else if (isL) out.push({ i, price: candles[i].low, type: "L" });
  }
  // ตัดให้สลับ H/L เสมอ (เก็บตัวที่สุดขั้วกรณีซ้ำ)
  const alt: typeof out = [];
  for (const p of out) {
    const prev = alt[alt.length - 1];
    if (!prev || prev.type !== p.type) alt.push(p);
    else if ((p.type === "H" && p.price > prev.price) || (p.type === "L" && p.price < prev.price)) alt[alt.length - 1] = p;
  }
  return alt;
}

/** Fibonacci retracement — วัดจาก "ขาล่าสุดที่สำคัญ" (pivot สองจุดท้ายสุดที่เคลื่อน ≥5%) */
export function fibAnalysis(candles: Candle[], pivots: { price: number; type: "H" | "L" }[], last: number) {
  if (pivots.length < 2) return undefined;
  // หาขาล่าสุดที่กว้างพอ (จากหลังมาหน้า)
  let leg: { from: number; to: number; dir: "up" | "down" } | null = null;
  for (let k = pivots.length - 1; k > 0; k--) {
    const b = pivots[k];
    const a = pivots[k - 1];
    if (a.type === b.type) continue;
    const move = Math.abs(b.price - a.price) / a.price;
    if (move >= 0.05) {
      leg = { from: a.price, to: b.price, dir: b.type === "H" ? "up" : "down" };
      break;
    }
  }
  if (!leg) return undefined;
  const range = leg.to - leg.from;
  const RATIOS = [0.236, 0.382, 0.5, 0.618, 0.786];
  const EXT = [1.272, 1.618];
  const levels = RATIOS.map((r) => ({ ratio: r, price: Math.round((leg!.to - range * r) * 100) / 100 }));
  const extensions = EXT.map((r) => ({ ratio: r, price: Math.round((leg!.from + range * r) * 100) / 100 }));
  const retracedPct = range !== 0 ? Math.round(((leg.to - last) / range) * 1000) / 10 : null;
  // แนวรับ/ต้านจากระดับ fib ทั้งหมด (รวมส่วนขยาย) ที่ใกล้ราคาสุด — รองรับเคสราคาทะลุปลายขาไปแล้ว
  const all = [...levels, ...extensions].sort((a, b) => a.price - b.price);
  const below = [...all].reverse().find((l) => l.price < last) ?? null;
  const above = all.find((l) => l.price > last) ?? null;
  return {
    direction: leg.dir,
    from: leg.from,
    to: leg.to,
    legPct: Math.round(Math.abs(range / leg.from) * 1000) / 10,
    retracedPct,
    levels,
    extensions,
    // ความหมายสากล: รับ = ระดับใต้ราคาปัจจุบัน · ต้าน = ระดับเหนือราคา (ไม่ขึ้นกับทิศขา)
    nearestSupport: below,
    nearestResistance: above,
  };
}

/** RSI Divergence — ราคาทำจุดต่ำใหม่แต่ RSI สูงขึ้น (บวก) หรือราคาสูงใหม่แต่ RSI ต่ำลง (ลบ) */
export function rsiDivergence(candles: Candle[], pivots: { i: number; price: number; type: "H" | "L" }[]): { type: "bullish" | "bearish"; detail: string } | undefined {
  const closes = candles.map((c) => c.close);
  const lows = pivots.filter((p) => p.type === "L").slice(-2);
  const highs = pivots.filter((p) => p.type === "H").slice(-2);
  const rsiAt = (i: number): number | null => {
    const upTo = closes.slice(0, i + 1);
    if (upTo.length < 15) return null;
    const v = rsi(upTo);
    return v ?? null;
  };
  if (lows.length === 2 && lows[1].price < lows[0].price) {
    const r0 = rsiAt(lows[0].i);
    const r1 = rsiAt(lows[1].i);
    if (r0 !== null && r1 !== null && r1 > r0 + 2) {
      return { type: "bullish", detail: `ราคาทำจุดต่ำใหม่ ${lows[1].price.toFixed(2)} แต่ RSI ดีดขึ้นจาก ${r0.toFixed(0)} → ${r1.toFixed(0)} — แรงขายอ่อนแรงแอบแฝง` };
    }
  }
  if (highs.length === 2 && highs[1].price > highs[0].price) {
    const r0 = rsiAt(highs[0].i);
    const r1 = rsiAt(highs[1].i);
    if (r0 !== null && r1 !== null && r1 < r0 - 2) {
      return { type: "bearish", detail: `ราคาทำจุดสูงใหม่ ${highs[1].price.toFixed(2)} แต่ RSI ลดลงจาก ${r0.toFixed(0)} → ${r1.toFixed(0)} — โมเมนตัมซื้อเริ่มหมดแรง` };
    }
  }
  return undefined;
}

/** ATR — ค่าเฉลี่ยช่วงกว้างจริง 14 แท่ง (ใช้ตั้งระยะจุดตัดขาดทุน) */
export function atr(candles: Candle[], period = 14): number | undefined {
  if (candles.length < period + 1) return undefined;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    sum += Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
  }
  return sum / period;
}

/**
 * Elliott Wave — แบบอ่านเป็นระบบจาก pivots (ไม่ใช่การทำนาย)
 * ทดสอบ impulse 5 เวฟด้วยกฎหลัก 3 ข้อ: (1) W2 ไม่ทลุจุดเริ่ม W1 (2) W3 ไม่สั้นที่สุด
 * (3) W4 ไม่ซ้อนแดนราคา W1 — ผ่านทุกข้อ = โครงสร้าง impulse น่าเชื่อ + ระบุเวฟปัจจุบัน
 */
export function elliottWave(
  pivots: { price: number; type: "H" | "L" }[],
  last: number
): TechnicalRead["elliott"] | undefined {
  if (pivots.length < 4) return undefined;
  const p = pivots.slice(-5); // ใช้ 5 pivots ล่าสุดพิจารณา

  const analyze = (dir: "up" | "down") => {
    // ลำดับ pivot ตามทิศ: up = L,H,L,H,L ; down = H,L,H,L,H — ตรงกันทั้ง 5 จุดจึงพิจารณาต่อ
    const seq = dir === "up" ? ["L", "H", "L", "H", "L"] : ["H", "L", "H", "L", "H"];
    if (p.some((x, i) => x.type !== seq[i])) return null;

    const [P0, P1, P2, P3, P4] = p.map((x) => x.price);
    const len1 = Math.abs(P1 - P0);
    const len2 = Math.abs(P2 - P1);
    const len3 = Math.abs(P3 - P2);
    if (len1 <= 0) return null;
    const retrace2 = len2 / len1;

    const rules: boolean[] = [];
    // กฎ 1: W2 ย่อไม่เกิน 100% ของ W1
    rules.push(dir === "up" ? P2 > P0 : P2 < P0);
    // กฎ 3: W4 ไม่เข้าแดนราคา W1 (ใช้แบบเข้ม: ไม่ทลุปลาย W1)
    rules.push(dir === "up" ? P4 > P1 : P4 < P1);
    const passed = rules.filter(Boolean).length;
    // W3 ไม่สั้นที่สุด (เทียบ W5 ประมาณด้วยระยะถึงราคาปัจจุบัน)
    const len5SoFar = Math.abs(last - P4);
    rules.push(len3 >= Math.min(len1, len5SoFar > 0 ? len5SoFar : len1));
    const w3Ok = rules[2];
    const rulesPassed: number = passed + (w3Ok ? 1 : 0);

    const labelUp =
      last > P3
        ? "กำลังเล่นเวฟ 5 (ช่วงสุดท้ายของ impulse — ระวัง divergence)"
        : "น่าจะอยู่ในเวฟ 4 (พักตัวย่อ) หรือเวฟ 5 กำลังก่อตัว";
    const labelDown =
      last < P3
        ? "กำลังเล่นเวฟ 5 ขาลง (ช่วงท้ายของการขายออกแรง — ระวังพลิก)"
        : "น่าจะอยู่ในเวฟ 4 ขาลง (เด้งพัก) หรือเวฟ 5 ขาลงกำลังก่อตัว";

    const golden = retrace2 >= 0.382 && retrace2 <= 0.786;
    const confidence = Math.min(95, 35 + (rulesPassed) * 18 + (golden ? 8 : 0));

    const invalidation = dir === "up" ? (last > P3 ? P4 : P1) : (last < P3 ? P4 : P1);
    return {
      structure: dir === "up" ? `impulse ขาขึ้น 5 เวฟ (ผ่านกฎ ${rulesPassed}/3${golden ? " · W2 ย่อแถบ golden ratio" : ""})` : `impulse ขาลง 5 เวฟ (ผ่านกฎ ${rulesPassed}/3${golden ? " · W2 เด้งแถบ golden ratio" : ""})`,
      waveLabel: dir === "up" ? labelUp : labelDown,
      expectation:
        dir === "up"
          ? last > P3
            ? "ทฤษฎีบอก: จบ W5 มักตามด้วย corrective ABC ย่อ — เก็บกำไรเป็นระยะ อย่าไล่ท้ายเวฟ"
            : `W4 มักย่อแถว 38.2% ของ W3 (${(P3 - (P3 - P2) * 0.382).toFixed(2)}) แล้วเข้า W5 ทำจุดสูงใหม่`
          : last < P3
            ? "ทฤษฎีบอก: จบ W5 ลง มักตามด้วยเด้ง ABC — อย่าเพิ่งไล่ขายท้ายเวฟ"
            : `W4 มักเด้งแถว 38.2% ของ W3 (${(P3 + (P2 - P3) * 0.382).toFixed(2)}) แล้ววกลงทำจุดต่ำใหม่`,
      invalidation,
      confidence,
    };
  };

  if (p.length < 5) return undefined;
  return analyze("up") ?? analyze("down") ?? undefined;
}
