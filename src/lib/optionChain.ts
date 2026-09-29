// ===== Options Data Layer — Yahoo chain (crumb auth) + Black-Scholes + Greeks =====
// ทุกอย่างเกี่ยวกับ option อยู่ไฟล์นี้ไฟล์เดียว (pattern เดียวกับ yahoo.ts — ถ้า Yahoo เปลี่ยน แก้จุดเดียว)
// ใช้คู่กับ: /api/options/chain (viewer) · /api/options/analyze (AI) · /api/options/paper (จำลอง)

const UA = { "User-Agent": "Mozilla/5.0" };

// ---------- crumb auth (แยก cache จาก yahoo.ts — pattern เดียวกัน) ----------
let crumbCache: { at: number; cookie: string; crumb: string } | null = null;
async function optCrumb(): Promise<{ cookie: string; crumb: string } | null> {
  if (crumbCache && Date.now() - crumbCache.at < 60 * 60_000) return crumbCache;
  try {
    const r1 = await fetch("https://fc.yahoo.com", { headers: UA, signal: AbortSignal.timeout(8000) });
    const cookie = (r1.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
    if (!cookie) return null;
    const r2 = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers: { ...UA, Cookie: cookie }, signal: AbortSignal.timeout(8000) });
    const crumb = (await r2.text()).trim();
    if (!crumb || crumb.length > 30) return null;
    crumbCache = { at: Date.now(), cookie, crumb };
    return crumbCache;
  } catch {
    return null;
  }
}

// ---------- Black-Scholes + Greeks (pure — ทดสอบเทียบค่าตำราเรียนได้) ----------
export interface BsResult {
  price: number;
  delta: number;
  gamma: number;
  theta: number; // ต่อปี (ลบ) — หาร 365 เป็นรายวัน
  vega: number; // ต่อ 1 เท่าของ IV
}

const SQRT_2PI = Math.sqrt(2 * Math.PI);
const normCdf = (x: number): number => {
  // Abramowitz-Stegun — แม่น ~1e-7 (พอเกิน noise ของข้อมูลจริง)
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const v = 1 - Math.exp(-0.5 * x * x) / SQRT_2PI * poly;
  return x >= 0 ? v : 1 - v;
};
const normPdf = (x: number): number => Math.exp(-0.5 * x * x) / SQRT_2PI;

/** Black-Scholes ราคา + Greeks — type: call|put, T เป็นปี (0.05 ≈ 18 วัน) */
export function blackScholes(type: "call" | "put", S: number, K: number, T: number, r: number, sigma: number): BsResult {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    const intrinsic = type === "call" ? Math.max(0, S - K) : Math.max(0, K - S);
    return { price: intrinsic, delta: 0, gamma: 0, theta: 0, vega: 0 };
  }
  const sqT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * sqT);
  const d2 = d1 - sigma * sqT;
  const disc = Math.exp(-r * T);
  const nd1 = normCdf(d1);
  const nd2 = normCdf(d2);
  const pdfD1 = normPdf(d1);

  const price = type === "call" ? S * nd1 - K * disc * nd2 : K * disc * normCdf(-d2) - S * normCdf(-d1);
  const delta = type === "call" ? nd1 : nd1 - 1;
  const gamma = pdfD1 / (S * sigma * sqT);
  const thetaCommon = -(S * pdfD1 * sigma) / (2 * sqT);
  const theta = type === "call" ? thetaCommon - r * K * disc * nd2 : thetaCommon + r * K * disc * normCdf(-d2);
  const vega = S * pdfD1 * sqT;
  return { price, delta, gamma, theta, vega };
}

/** ถอยกลับ IV จากราคาตลาด (Newton-Raphson) — ใช้เมื่อ Yahoo คืน IV เพี้ยน (เจอจริง: iv=0.00001) */
export function impliedVol(type: "call" | "put", S: number, K: number, T: number, r: number, marketPrice: number): number | null {
  if (marketPrice <= 0 || T <= 0) return null;
  const intrinsic = type === "call" ? Math.max(0, S - K * Math.exp(-r * T)) : Math.max(0, K * Math.exp(-r * T) - S);
  if (marketPrice < intrinsic * 0.95) return null;
  let sigma = 0.4;
  for (let i = 0; i < 30; i++) {
    const bs = blackScholes(type, S, K, T, r, sigma);
    const diff = bs.price - marketPrice;
    if (Math.abs(diff) < 0.005) return sigma;
    if (bs.vega < 1e-8) break;
    sigma = sigma - diff / bs.vega;
    if (sigma <= 0.005) sigma = 0.005;
    if (sigma > 5) return null;
  }
  const final = blackScholes(type, S, K, T, r, sigma);
  return Math.abs(final.price - marketPrice) < 0.05 ? sigma : null;
}

// ---------- Yahoo options chain ----------
export interface OptContract {
  strike: number;
  bid: number;
  ask: number;
  mid: number;
  last: number;
  volume: number;
  openInterest: number;
  iv: number;
  delta: number;
  gamma: number;
  thetaDay: number;
  vega1pct: number;
  breakEven: number;
  itm: boolean;
}

export interface OptChain {
  symbol: string;
  underlyingPrice: number;
  expiry: string;
  daysToExpiry: number;
  calls: OptContract[];
  puts: OptContract[];
  atmIv: number | null;
  hv20: number | null;
  ivPremiumPct: number | null;
  source: "yahoo" | "cached";
}

export interface ChainIndex {
  symbol: string;
  underlyingPrice: number;
  expiries: { date: string; daysToExpiry: number; ts: number }[];
}

export const RISK_FREE = 0.045;

const chainCache = new Map<string, { at: number; data: OptChain }>();
const CHAIN_TTL = 5 * 60_000;
const idxCache = new Map<string, { at: number; data: ChainIndex }>();
const IDX_TTL = 30 * 60_000;

interface YahooOpt {
  strike: number;
  bid?: number;
  ask?: number;
  lastPrice?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
}

async function fetchOptJson(symbol: string, expirySec?: number): Promise<{
  expiries: number[];
  underlyingPrice: number;
  options?: { calls: YahooOpt[]; puts: YahooOpt[]; expirationDate: number }[];
} | null> {
  const c = await optCrumb();
  if (!c) return null;
  const url = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}?crumb=${encodeURIComponent(c.crumb)}${expirySec ? `&date=${expirySec}` : ""}`;
  try {
    const res = await fetch(url, { headers: { ...UA, Cookie: c.cookie }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      optionChain?: { result?: { underlyingSymbol: string; expirationDates: number[]; quote?: { regularMarketPrice?: number }; options?: { calls: YahooOpt[]; puts: YahooOpt[]; expirationDate: number }[] }[] };
    };
    const r = j.optionChain?.result?.[0];
    if (!r) return null;
    return { expiries: r.expirationDates ?? [], underlyingPrice: r.quote?.regularMarketPrice ?? 0, options: r.options };
  } catch {
    return null;
  }
}

/** HV20 — ความผันผวนรายวันจริงจากกราฟ 1 เดือน (annualized) */
async function hv20(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`, { headers: UA, signal: AbortSignal.timeout(8000) });
    const j = (await res.json()) as { chart?: { result?: { indicators?: { quote?: { close?: (number | null)[] }[] } }[] } };
    const closes = (j.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter((x): x is number => typeof x === "number" && isFinite(x));
    if (closes.length < 10) return null;
    const rets: number[] = [];
    for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
    return Math.sqrt(variance * 252);
  } catch {
    return null;
  }
}

function buildContracts(raw: YahooOpt[], type: "call" | "put", S: number, T: number): OptContract[] {
  const out: OptContract[] = [];
  for (const c of raw) {
    const bid = c.bid ?? 0;
    const ask = c.ask ?? 0;
    const last = c.lastPrice ?? 0;
    if (bid <= 0 && ask <= 0 && last <= 0) continue;
    const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : last;
    let iv = typeof c.impliedVolatility === "number" && c.impliedVolatility > 0.005 && c.impliedVolatility < 3 ? c.impliedVolatility : 0;
    if (iv === 0 && mid > 0) iv = impliedVol(type, S, c.strike, T, RISK_FREE, mid) ?? 0;
    const bs = iv > 0 ? blackScholes(type, S, c.strike, T, RISK_FREE, iv) : { delta: 0, gamma: 0, theta: 0, vega: 0, price: mid };
    out.push({
      strike: c.strike,
      bid, ask, mid, last: last || mid,
      volume: c.volume ?? 0,
      openInterest: c.openInterest ?? 0,
      iv,
      delta: bs.delta,
      gamma: bs.gamma,
      thetaDay: (bs.theta / 365) * 100,
      vega1pct: bs.vega / 100,
      breakEven: type === "call" ? c.strike + mid : c.strike - mid,
      itm: type === "call" ? S > c.strike : S < c.strike,
    });
  }
  return out.sort((a, b) => a.strike - b.strike);
}

/** รายการวันหมดอายุ + ราคา underlying (cache 30 นาที) */
export async function getExpiries(symbol: string): Promise<ChainIndex | null> {
  const sym = symbol.toUpperCase();
  const hit = idxCache.get(sym);
  if (hit && Date.now() - hit.at < IDX_TTL) return hit.data;
  const j = await fetchOptJson(sym);
  if (!j || !j.expiries.length || !j.underlyingPrice) return null;
  const now = Date.now() / 1000;
  const expiries = j.expiries
    .filter((d) => d > now + 86400 * 1.5)
    .slice(0, 12)
    .map((d) => ({ date: new Date(d * 1000).toISOString().slice(0, 10), daysToExpiry: Math.round((d - now) / 86400), ts: d }));
  const data: ChainIndex = { symbol: sym, underlyingPrice: j.underlyingPrice, expiries };
  idxCache.set(sym, { at: Date.now(), data });
  return data;
}

/** Chain เต็มของวันหมดอายุหนึ่ง — calls+puts พร้อม greeks + IV context (cache 5 นาที) */
export async function getChain(symbol: string, expiry: string): Promise<OptChain | null> {
  const sym = symbol.toUpperCase();
  const key = `${sym}:${expiry}`;
  const hit = chainCache.get(key);
  if (hit && Date.now() - hit.at < CHAIN_TTL) return hit.data;

  // หา Unix timestamp จริงจาก index (Yahoo ต้องใช้ค่าตรงจาก expirationDates — สร้างเองไม่ได้)
  const idx = await getExpiries(sym);
  if (!idx) return null;
  const match = idx.expiries.find((e) => e.date === expiry);
  if (!match) return null;
  const expirySec = match.ts;

  const j = await fetchOptJson(sym, expirySec);
  if (!j || !j.options?.length) return null;
  const S = j.underlyingPrice;
  if (!S) return null;
  const expUnix = j.options[0].expirationDate ?? expirySec;
  const daysToExpiry = Math.max(0.5, (expUnix - Date.now() / 1000) / 86400);
  const T = daysToExpiry / 365;

  const calls = buildContracts(j.options[0].calls ?? [], "call", S, T);
  const puts = buildContracts(j.options[0].puts ?? [], "put", S, T);

  const near = calls.filter((c) => c.iv > 0).sort((a, b) => Math.abs(a.strike - S) - Math.abs(b.strike - S)).slice(0, 3);
  const atmIv = near.length ? near.reduce((a, c) => a + c.iv, 0) / near.length : null;
  const hv = await hv20(sym);
  const ivPremiumPct = atmIv !== null && hv !== null ? (atmIv - hv) * 100 : null;

  const data: OptChain = { symbol: sym, underlyingPrice: S, expiry, daysToExpiry: Math.round(daysToExpiry), calls, puts, atmIv, hv20: hv, ivPremiumPct, source: hit ? "cached" : "yahoo" };
  chainCache.set(key, { at: Date.now(), data });
  return data;
}

/** หาราคาสัญญาหนึ่งจาก chain (ใช้ใน paper engine mark-to-market) */
export function findContract(chain: OptChain, type: "call" | "put", strike: number): OptContract | null {
  const arr = type === "call" ? chain.calls : chain.puts;
  return arr.find((c) => Math.abs(c.strike - strike) < 0.01) ?? null;
}
