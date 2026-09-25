// ===== เครื่องยนต์ Backtest อย่างง่าย — ทดสอบกลยุทธ์ย้อนหลังจากกราฟราคาจริง =====
// หลักการ: โปร่งใส ตรวจสอบได้ สมมติฐาน保守 (เข้าที่ราคาปิดวันถัดไป, ไม่มีค่าธรรมเนียมนอกจากที่ระบุ)
import type { Candle } from "./types";
import { rsi, sma } from "./indicators";

export type StrategyId = "rsi_oversold" | "golden_cross" | "sma200_filter";

export const STRATEGIES: Record<StrategyId, { name: string; desc: string }> = {
  rsi_oversold: {
    name: "RSI Oversold (เข้าตอน RSI<30 ออกเมื่อ RSI>55)",
    desc: "ซื้อเมื่อ RSI(14) ต่ำกว่า 30 (ขาลงมากเกินไป) แล้วขายเมื่อ RSI กลับขึ้นเหนือ 55 หรือถือเกิน 60 วันทำการ",
  },
  golden_cross: {
    name: "Golden/Death Cross (SMA50 × SMA200)",
    desc: "ถือหุ้นเมื่อ SMA50 ตัดขึ้นเหนือ SMA200 ขายเมื่อตัดลงใต้ — จับเทรนด์ระยะยาว",
  },
  sma200_filter: {
    name: "Trend Filter (ถือเฉพาะเมื่อราคาเหนือ SMA200)",
    desc: "ถือหุ้นเมื่อราคาปิดอยู่เหนือ SMA200 กลับเป็นเงินสดเมื่อหลุด — Buy&Hold ที่หลบน้ำแข็ง",
  },
};

export interface Trade {
  entryIdx: number;
  exitIdx: number;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
}

export interface BacktestResult {
  ticker: string;
  strategy: StrategyId;
  bars: number;
  from: string;
  to: string;
  trades: number;
  winRate: number; // %
  avgReturnPerTrade: number; // %
  strategyReturn: number; // % รวม (ทบต้นเฉพาะช่วงถือ)
  buyHoldReturn: number; // %
  outperformance: number; // strategy - buy&hold
  maxDrawdown: number; // % (จากยอดสะสมเชิงกลยุทธ์)
  equityCurve: number[]; // normalized 1.0 เริ่มต้น (ต่อ bar)
  buyHoldCurve: number[];
}

/** จำลอง: เข้า-ออกที่ราคาปิดวันเดียวกับสัญญาณ (สมมติฐาน conservative ที่เขียนกำกับ) */
function simulate(candles: Candle[], signals: ("buy" | "sell" | null)[], maxHoldBars = Infinity): { trades: Trade[]; equityCurve: number[] } {
  const trades: Trade[] = [];
  const equity: number[] = [];
  let inPos = false;
  let entryPrice = 0;
  let entryIdx = 0;
  let value = 1;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const sig = signals[i];
    if (!inPos && sig === "buy") {
      inPos = true;
      entryPrice = c.close;
      entryIdx = i;
    } else if (inPos && (sig === "sell" || i - entryIdx >= maxHoldBars)) {
      inPos = false;
      trades.push({ entryIdx, exitIdx: i, entryPrice, exitPrice: c.close, returnPct: (c.close / entryPrice - 1) * 100 });
      value *= c.close / entryPrice;
    }
    if (inPos) {
      equity.push(value * (c.close / candles[entryIdx].close));
    } else {
      equity.push(value);
    }
  }
  // ปิดพอร์ตค้างท้าย (ถือจน bar สุดท้าย เพื่อรายงานครบ)
  if (inPos) {
    const last = candles[candles.length - 1];
    trades.push({ entryIdx, exitIdx: candles.length - 1, entryPrice, exitPrice: last.close, returnPct: (last.close / entryPrice - 1) * 100 });
    value *= last.close / entryPrice;
    equity[equity.length - 1] = value;
  }
  return { trades, equityCurve: equity };
}

function buildSignals(candles: Candle[], strategy: StrategyId): ("buy" | "sell" | null)[] {
  const closes = candles.map((c) => c.close);
  const n = candles.length;
  const sigs: ("buy" | "sell" | null)[] = new Array(n).fill(null);

  if (strategy === "rsi_oversold") {
    // RSI ทุก bar (rolling) — ใช้ window 14
    for (let i = 15; i < n; i++) {
      const r = rsi(closes.slice(0, i + 1), 14);
      if (r === undefined) continue;
      const prev = rsi(closes.slice(0, i), 14);
      if (r < 30 && (prev === undefined || prev >= 30)) sigs[i] = "buy";
      else if (r > 55) sigs[i] = "sell";
    }
    return sigs;
  }
  if (strategy === "golden_cross") {
    for (let i = 1; i < n; i++) {
      const f = sma(closes.slice(0, i + 1), 50);
      const s = sma(closes.slice(0, i + 1), 200);
      const fp = sma(closes.slice(0, i), 50);
      const sp = sma(closes.slice(0, i), 200);
      if ([f, s, fp, sp].some((v) => v === undefined)) continue;
      if ((f as number) > (s as number) && (fp as number) <= (sp as number)) sigs[i] = "buy";
      if ((f as number) < (s as number) && (fp as number) >= (sp as number)) sigs[i] = "sell";
    }
    return sigs;
  }
  // sma200_filter
  for (let i = 1; i < n; i++) {
    const s = sma(closes.slice(0, i + 1), 200);
    const sp = sma(closes.slice(0, i), 200);
    const c = closes[i], cp = closes[i - 1];
    if (s === undefined || sp === undefined) continue;
    if (c > (s as number) && cp <= (sp as number)) sigs[i] = "buy";
    if (c < (s as number) && cp >= (sp as number)) sigs[i] = "sell";
  }
  return sigs;
}

export function runBacktest(ticker: string, candles: Candle[], strategy: StrategyId): BacktestResult | null {
  if (candles.length < 220) return null; // ต้องมีข้อมูลพอสำหรับ SMA200
  const maxHold = strategy === "rsi_oversold" ? 60 : Infinity;
  const { trades, equityCurve } = simulate(candles, buildSignals(candles, strategy), maxHold);
  const closes = candles.map((c) => c.close);
  const first = closes[0];
  const last = closes[closes.length - 1];
  const buyHoldCurve = closes.map((c) => c / first);
  const strategyReturn = (equityCurve[equityCurve.length - 1] - 1) * 100;
  const buyHoldReturn = (last / first - 1) * 100;
  const wins = trades.filter((t) => t.returnPct > 0);

  // max drawdown ของ equity curve
  let peak = -Infinity, mdd = 0;
  for (const v of equityCurve) {
    peak = Math.max(peak, v);
    mdd = Math.max(mdd, (peak - v) / peak);
  }

  return {
    ticker,
    strategy,
    bars: candles.length,
    from: new Date(candles[0].time * 1000).toISOString().slice(0, 10),
    to: new Date(candles[candles.length - 1].time * 1000).toISOString().slice(0, 10),
    trades: trades.length,
    winRate: trades.length ? Math.round((wins.length / trades.length) * 100) : 0,
    avgReturnPerTrade: trades.length ? trades.reduce((a, t) => a + t.returnPct, 0) / trades.length : 0,
    strategyReturn,
    buyHoldReturn,
    outperformance: strategyReturn - buyHoldReturn,
    maxDrawdown: mdd * 100,
    equityCurve,
    buyHoldCurve,
  };
}
