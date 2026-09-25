// ===== ชนิดข้อมูลหลักของ StockLens =====

export type MarketId = "US" | "TH" | "HK" | "JP" | "EU" | "COMMODITY" | "INDEX" | "FX" | "CRYPTO";

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  currency: string;
  market?: string;
  exchange?: string;
}

export interface Candle {
  time: number; // unix sec
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FactorDetail {
  label: string;
  value: string;
  score: number; // 0-100
}

export interface FactorScores {
  valuation: number;
  growth: number;
  profitability: number;
  momentum: number;
  health: number;
  overall: number;
  details: FactorDetail[];
  gaps: string[];
}

export type SignalLevel = "bullish" | "bearish" | "neutral";

export interface TechnicalRead {
  sma20?: number;
  sma50?: number;
  sma200?: number;
  rsi14?: number;
  macd?: { macd: number; signal: number; hist: number };
  bollinger?: { upper: number; mid: number; lower: number; pctB: number };
  signal: SignalLevel;
  reasons: string[];
}

export interface StockAnalysis {
  quote: Quote;
  profile?: {
    sector?: string;
    industry?: string;
    business?: string;
    marketCap?: number;
    trailingPE?: number;
    forwardPE?: number;
    priceToBook?: number;
    priceToSales?: number;
    evToEbitda?: number;
    dividendYield?: number;
    eps?: number;
    fiftyTwoHigh?: number;
    fiftyTwoLow?: number;
    beta?: number;
    raw?: Record<string, unknown>;
  };
  financials?: {
    revenueGrowth?: number;
    earningsGrowth?: number;
    grossMargins?: number;
    operatingMargins?: number;
    profitMargins?: number;
    returnOnEquity?: number;
    returnOnAssets?: number;
    debtToEquity?: number;
    currentRatio?: number;
    freeCashflow?: number;
    totalCash?: number;
    totalDebt?: number;
  };
  factors?: FactorScores;
  technicals?: TechnicalRead;
  news: { title: string; publisher: string; link: string; time: number }[];
}

export interface ImpactStock {
  ticker: string;
  market: MarketId;
  direction: "positive" | "negative";
  strength: "strong" | "medium" | "weak";
  reason: string;
}

export interface ImpactNode {
  id: string; // เช่น "oil", "cocoa"
  type: "commodity" | "theme";
  name: string; // ชื่อไทย
  yahoo?: string; // ticker สินค้าโภคภัณฑ์ เช่น CL=F
  upReason: string; // เหตุผลเมื่อราคาสินค้า "ขึ้น"
  stocks: ImpactStock[];
}

export interface RadarTheme {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  watch: string[]; // yahoo tickers ที่ติดตาม
  impactIds: string[];
  keys: string[]; // คีย์เวิร์ดไทย/อังกฤษ
}

export interface ChainResult {
  eventId: string;
  name: string;
  yahoo?: string;
  reason: string;
  stocks: (ImpactStock & { quote?: Quote })[];
}

export interface EventAnalysis {
  input: string;
  engine: "ai" | "keyword";
  headline: string;
  narrative?: string;
  chains: ChainResult[];
  note: string;
}

export interface GuruHolding {
  ticker: string;
  name: string;
  action: "long" | "short" | "put";
  note?: string;
}

export interface GuruPortfolio {
  id: string;
  name: string;
  firm: string;
  emoji: string;
  asOf: string;
  thesis: string;
  holdings: GuruHolding[];
  caution: string;
}

export interface Member {
  id: string;
  name: string;
  contact: string;
  tier: "starter" | "pro";
  startedAt: string;
  paidUntil: string;
  note?: string;
  /** LINE User ID (U...) — สำหรับส่งข้อความส่วนตัว เช่น Flash Pro / สรุปวอตช์ลิสต์ */
  lineUserId?: string;
  /** หุ้นที่สมาชิกอยากติดตาม (yahoo symbol เช่น MU, PTT.BK) — ใช้ทำสรุปส่วนตัวผ่าน LINE */
  watch?: string[];
}

export interface TrackRecordEntry {
  id: string;
  date: string;
  thesis: string;
  tickers: string[];
  stance: "bullish" | "bearish" | "neutral";
  status: "open" | "win" | "loss" | "flat";
  resultPct?: number;
  note?: string;
}
