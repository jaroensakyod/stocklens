// ===== Data layer: เรียก Yahoo Finance ตรงๆ (ไม่ต้องมี key / ไม่ใช้ crumb) =====
// เส้นทางที่ใช้ (ทดสอบแล้วเสถียร ก.ย. 2026):
//  - v7/finance/spark          → ราคาแบบ batch (หุ้น/ดัชนี/สินค้าโภคภัณฑ์/FX)
//  - v8/finance/chart          → แท่งเทียนรายกรอบเวลา
//  - fundamentals-timeseries   → งบการเงินรายไตรมาส/รายปี (จริงจาก filings)
//  - v1/finance/search         → ค้นหา + ข่าว

import type { Candle, Quote } from "./types";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();
const TTL = { quote: 60_000, chart: 10 * 60_000, fundamentals: 6 * 60 * 60_000, news: 2 * 60_000, search: 24 * 60 * 60_000 };

function getCached<T>(key: string, ttl: number): T | undefined {
  const e = cache.get(key);
  if (e && Date.now() - e.at < ttl) return e.data as T;
  return undefined;
}
function setCached(key: string, data: unknown) {
  cache.set(key, { at: Date.now(), data });
  if (cache.size > 900) {
    const keys = [...cache.entries()].sort((a, b) => a[1].at - b[1].at);
    for (let i = 0; i < 300; i++) cache.delete(keys[i][0]);
  }
}

/** GET JSON พร้อม fallback query1 ↔ query2 */
async function jget(path: string): Promise<unknown | null> {
  for (const host of ["query2", "query1"]) {
    try {
      const res = await fetch(`https://${host}.finance.yahoo.com${path}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) return await res.json();
    } catch {
      // ลองโฮสต์ถัดไป
    }
  }
  return null;
}

// ---------- Quotes (spark, batch) ----------
function metaToQuote(m: Record<string, unknown>): Quote | undefined {
  const price = Number(m.regularMarketPrice ?? m.price ?? NaN);
  if (!isFinite(price)) return undefined;
  const prev = Number(m.previousClose ?? m.chartPreviousClose ?? NaN);
  const pctRaw = m.regularMarketChangePercent ?? m.regularMarketPercentChange;
  const changePct = typeof pctRaw === "number" && isFinite(pctRaw) ? pctRaw : isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : 0;
  const change = Number(m.regularMarketChange ?? (isFinite(prev) ? price - prev : 0));
  return {
    symbol: String(m.symbol ?? ""),
    name: String(m.shortName ?? m.longName ?? m.symbol ?? ""),
    price,
    change: isFinite(change) ? change : 0,
    changePct,
    currency: String(m.currency ?? "USD"),
    exchange: String(m.fullExchangeName ?? m.exchangeName ?? ""),
  };
}

// ---------- Alpaca real-time (US) — ทางเลือก: ใส่ ALPACA_KEY_ID/SECRET เมื่อไหร่ เปิดอัตโนมัติ ----------
// ใช้ snapshot: ราคาล่าสุด (real-time IEX) + แท่งวันก่อน → change% — เขียนทับ quote ของ Yahoo เฉพาะหุ้น US
export function hasAlpaca(): boolean {
  return !!(process.env.ALPACA_KEY_ID && process.env.ALPACA_SECRET_KEY);
}
async function alpacaOverwrite(out: Record<string, Quote>) {
  if (!hasAlpaca()) return;
  const usSyms = Object.keys(out).filter((s) => /^[A-Z]{1,5}$/.test(s));
  if (!usSyms.length) return;
  for (let i = 0; i < usSyms.length; i += 50) {
    const batch = usSyms.slice(i, i + 50);
    try {
      const res = await fetch(`https://data.alpaca.markets/v2/stocks/snapshots?symbols=${encodeURIComponent(batch.join(","))}&feed=ipse`, {
        headers: { "APCA-API-KEY-ID": process.env.ALPACA_KEY_ID!, "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET_KEY! },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const j = (await res.json()) as Record<string, { latestTrade?: { p?: number }; prevDailyBar?: { c?: number }; dailyBar?: { c?: number } }>;
      for (const [sym, snap] of Object.entries(j)) {
        const price = snap.latestTrade?.p ?? snap.dailyBar?.c;
        const prev = snap.prevDailyBar?.c;
        if (price === undefined || !isFinite(price) || !price) continue;
        const prevClose = prev !== undefined && isFinite(prev) && prev > 0 ? prev : out[sym]?.price;
        const q = out[sym];
        if (q) {
          q.price = price;
          q.change = prevClose ? price - prevClose : (q.change ?? 0);
          q.changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : q.changePct;
          q.exchange = "Alpaca real-time";
          setCached("q:" + sym, q);
        }
      }
    } catch {
      // Alpaca ล่ม = คงราคา Yahoo ไว้ตามเดิม
    }
  }
}

export async function getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const out: Record<string, Quote> = {};
  const need: string[] = [];
  for (const s of symbols) {
    const hit = getCached<Quote>("q:" + s, TTL.quote);
    if (hit) out[s] = hit;
    else need.push(s);
  }
  for (let i = 0; i < need.length; i += 15) {
    const batch = need.slice(i, i + 15);
    const json = (await jget(`/v7/finance/spark?symbols=${encodeURIComponent(batch.join(","))}&range=1d&interval=1d`)) as
      | { spark?: { result?: { symbol?: string; response?: { meta?: Record<string, unknown> }[] }[] } }
      | null;
    const found = new Set<string>();
    for (const r of json?.spark?.result ?? []) {
      const m = r.response?.[0]?.meta;
      if (!m) continue;
      const q = metaToQuote(m);
      if (q && q.symbol) {
        out[q.symbol] = q;
        setCached("q:" + q.symbol, q);
        found.add(q.symbol);
      }
    }
    // ตัวที่ spark ไม่มี → ลองผ่าน chart ทีละตัว (ช้าแต่ครอบคลุม)
    for (const s of batch) {
      if (found.has(s) || out[s]) continue;
      const m = await chartMeta(s);
      const q = m ? metaToQuote(m) : undefined;
      if (q) {
        q.symbol = s;
        out[s] = q;
        setCached("q:" + s, q);
      }
    }
  }
  await alpacaOverwrite(out); // มี key Alpaca = อัปเดตหุ้น US เป็น real-time (ไม่มี = ข้ามเงียบๆ)
  return out;
}

async function chartMeta(symbol: string): Promise<Record<string, unknown> | undefined> {
  const json = (await jget(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`)) as
    | { chart?: { result?: { meta?: Record<string, unknown> }[] } }
    | null;
  return json?.chart?.result?.[0]?.meta;
}

// ---------- Chart ----------
const RANGE_MAP: Record<string, { range: string; interval: string }> = {
  "1D": { range: "1d", interval: "5m" },
  "5D": { range: "5d", interval: "15m" },
  "1M": { range: "1mo", interval: "1h" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "5Y": { range: "5y", interval: "1wk" },
  "5YD": { range: "5y", interval: "1d" }, // ใช้กับ backtest
  "10YD": { range: "10y", interval: "1d" }, // backtest + walk-forward หลายหน้าต่างเวลา
};

export async function getChart(symbol: string, range = "1Y"): Promise<Candle[]> {
  const key = `c:${symbol}:${range}`;
  const hit = getCached<Candle[]>(key, TTL.chart);
  if (hit) return hit;
  const cfg = RANGE_MAP[range] ?? RANGE_MAP["1Y"];
  const json = (await jget(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=${cfg.range}&interval=${cfg.interval}&includePrePost=false`)) as
    | { chart?: { result?: { timestamp?: number[]; indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] } }[] } }
    | null;
  const r = json?.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const q = r?.indicators?.quote?.[0] ?? {};
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if ([o, h, l, c].every((v) => typeof v === "number" && isFinite(v as number))) {
      candles.push({ time: ts[i], open: o as number, high: h as number, low: l as number, close: c as number, volume: q.volume?.[i] ?? 0 });
    }
  }
  if (candles.length) setCached(key, candles);
  return candles;
}

export interface DividendTrail {
  sum12m: number; // รวมปันผล 12 เดือนล่าสุด ต่อหุ้น
  count12m: number; // จ่ายกี่ครั้งใน 12 เดือน (12 = รายเดือนจริง)
  lastAmount: number; // งวดล่าสุดต่อหุ้น
  lastDateIso: string; // วันที่จ่ายล่าสุด yyyy-mm-dd
}

/** ปันผลที่จ่าย "จริง" ใน 12 เดือนล่าสุด — จาก events=div ของ chart endpoint (ไม่ต้องมี crumb) */
export async function getTrailingDividends(symbol: string): Promise<DividendTrail | null> {
  const key = "div:" + symbol.toUpperCase();
  const hit = getCached<DividendTrail>(key, 6 * 60 * 60_000);
  if (hit !== undefined) return hit;
  const json = (await jget(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1mo&events=div`)) as
    | { chart?: { result?: { events?: { dividends?: Record<string, { amount?: number; date?: number }> } }[] } }
    | null;
  const divs = json?.chart?.result?.[0]?.events?.dividends;
  if (!divs) return null;
  const entries = Object.entries(divs)
    .map(([k, d]) => ({ ts: Number(d.date ?? k), amount: Number(d.amount ?? 0) }))
    .filter((d) => isFinite(d.amount) && d.amount > 0)
    .sort((a, b) => a.ts - b.ts);
  if (!entries.length) return null;
  const out: DividendTrail = {
    sum12m: entries.reduce((a, d) => a + d.amount, 0),
    count12m: entries.length,
    lastAmount: entries[entries.length - 1].amount,
    lastDateIso: new Date(entries[entries.length - 1].ts * 1000).toISOString().slice(0, 10),
  };
  setCached(key, out);
  return out;
}

// ---------- Fundamentals (timeseries จาก filings จริง) ----------
const TS_TYPES = [
  "quarterlyTotalRevenue", "quarterlyGrossProfit", "quarterlyOperatingIncome", "quarterlyNetIncome", "quarterlyDilutedEPS", "quarterlyDilutedAverageShares", "quarterlyNormalizedEBITDA",
  "quarterlyTotalAssets", "quarterlyCurrentAssets", "quarterlyCurrentLiabilities", "quarterlyStockholdersEquity", "quarterlyTotalDebt", "quarterlyCashAndCashEquivalents",
  "quarterlyOperatingCashFlow", "quarterlyFreeCashFlow",
];

export interface TimeseriesFundamentals {
  symbol: string;
  series: Record<string, { time: number; value: number }[]>;
}

export async function getFundamentals(symbol: string): Promise<TimeseriesFundamentals | null> {
  const key = "f:" + symbol;
  const hit = getCached<TimeseriesFundamentals>(key, TTL.fundamentals);
  if (hit) return hit;
  const p2 = Math.floor(Date.now() / 1000);
  const p1 = p2 - 4 * 365 * 86400;
  const json = (await jget(
    `/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?symbol=${encodeURIComponent(symbol)}&type=${TS_TYPES.join(",")}&merge=false&period1=${p1}&period2=${p2}&filter=orderId`
  )) as { timeseries?: { result?: { meta?: { type?: string[] }; timestamp?: number[]; quarterlyTotalRevenue?: (number | null)[]; [k: string]: unknown }[] } } | null;
  const results = json?.timeseries?.result;
  if (!results?.length) return null;
  const series: Record<string, { time: number; value: number }[]> = {};
  for (const r of results) {
    const t = r.meta?.type?.[0];
    const times = r.timestamp;
    if (!t || !Array.isArray(times)) continue;
    const vals = r[t] as unknown;
    const points: { time: number; value: number }[] = [];
    for (let i = 0; i < times.length; i++) {
      const entry = Array.isArray(vals) ? vals[i] : undefined;
      let v: unknown = entry;
      if (v && typeof v === "object") v = (v as { reportedValue?: { raw?: unknown }; raw?: unknown }).reportedValue?.raw ?? (v as { raw?: unknown }).raw;
      if (typeof v === "number" && isFinite(v)) points.push({ time: times[i], value: v });
    }
    if (points.length) series[t] = points;
  }
  if (!Object.keys(series).length) return null;
  const out = { symbol, series };
  setCached(key, out);
  return out;
}

/** แปลง timeseries → ตัวเลขสำคัญที่ factors.ts/UI ใช้ (คำนวณ TTM/YoY จาก filings จริง) */
export function deriveRatios(f: TimeseriesFundamentals, price: number): Record<string, number> {
  const s = f.series;
  const latest = (k: string) => s[k]?.[s[k].length - 1]?.value;
  const ttm = (k: string) => {
    const arr = s[k];
    if (!arr || arr.length < 4) return undefined;
    return arr.slice(-4).reduce((a, b) => a + b.value, 0);
  };
  const yoy = (k: string) => {
    const arr = s[k];
    if (!arr || arr.length < 5) return undefined;
    const now = arr[arr.length - 1].value;
    const then = arr[arr.length - 5].value;
    if (!isFinite(now) || !isFinite(then) || then === 0) return undefined;
    return (now - then) / Math.abs(then);
  };

  const out: Record<string, number> = {};
  const revenue = ttm("quarterlyTotalRevenue");
  const netIncome = ttm("quarterlyNetIncome");
  const gross = ttm("quarterlyGrossProfit");
  const opInc = ttm("quarterlyOperatingIncome");
  const ebitda = ttm("quarterlyNormalizedEBITDA");
  const equity = latest("quarterlyStockholdersEquity");
  const assets = latest("quarterlyTotalAssets");
  const debt = latest("quarterlyTotalDebt");
  const cash = latest("quarterlyCashAndCashEquivalents");
  const curA = latest("quarterlyCurrentAssets");
  const curL = latest("quarterlyCurrentLiabilities");
  const shares = latest("quarterlyDilutedAverageShares");
  const fcf = ttm("quarterlyFreeCashFlow");
  const epsTtmArr = s["quarterlyDilutedEPS"];
  const epsTtm = epsTtmArr && epsTtmArr.length >= 4 ? epsTtmArr.slice(-4).reduce((a, b) => a + b.value, 0) : undefined;

  if (revenue && revenue > 0) {
    if (gross !== undefined) out.grossMargins = gross / revenue;
    if (opInc !== undefined) out.operatingMargins = opInc / revenue;
    if (netIncome !== undefined) out.profitMargins = netIncome / revenue;
  }
  if (netIncome !== undefined && equity && equity !== 0) out.returnOnEquity = netIncome / Math.abs(equity);
  if (netIncome !== undefined && assets && assets !== 0) out.returnOnAssets = netIncome / Math.abs(assets);
  const rg = yoy("quarterlyTotalRevenue");
  if (rg !== undefined) out.revenueGrowth = rg;
  const ng = yoy("quarterlyNetIncome");
  if (ng !== undefined) out.earningsGrowth = ng;
  if (debt !== undefined && equity && equity !== 0) out.debtToEquity = (debt / Math.abs(equity)) * 100;
  if (curA !== undefined && curL !== undefined && curL !== 0) out.currentRatio = curA / curL;
  if (fcf !== undefined) out.freeCashflow = fcf;
  if (cash !== undefined) out.totalCash = cash;
  if (debt !== undefined) out.totalDebt = debt;

  if (price > 0) {
    if (epsTtm && epsTtm > 0) out.trailingPE = price / epsTtm;
    if (shares && revenue) {
      const mcap = price * shares;
      out.marketCap = mcap;
      if (revenue > 0) out.priceToSalesTrailing12Months = mcap / revenue;
      if (equity && equity !== 0) out.priceToBook = mcap / Math.abs(equity);
      if (ebitda !== undefined && ebitda > 0 && mcap) {
        const ev = mcap + (debt ?? 0) - (cash ?? 0);
        if (ev > 0) out.evToEbitda = ev / ebitda;
      }
    }
  }
  return out;
}

// ---------- Search ----------
export async function searchSymbols(query: string) {
  const key = "s:" + query.toLowerCase();
  const hit = getCached<{ symbol: string; name: string; exchange: string; type: string }[]>(key, TTL.search);
  if (hit) return hit;
  const json = (await jget(`/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&listsCount=0`)) as
    | { quotes?: { symbol?: string; shortname?: string; longname?: string; exchDisp?: string; typeDisp?: string; quoteType?: string }[] }
    | null;
  const results = (json?.quotes ?? [])
    .filter((q) => q.symbol && q.quoteType && ["EQUITY", "ETF", "INDEX"].includes(q.quoteType))
    .slice(0, 12)
    .map((q) => ({ symbol: q.symbol!, name: q.longname || q.shortname || q.symbol!, exchange: q.exchDisp ?? "", type: q.typeDisp ?? "" }));
  if (results.length) setCached(key, results);
  return results;
}

// ---------- News ----------
export async function getNews(query = "stock market", count = 12, freshMs?: number) {
  const key = `n:${query}:${freshMs ?? "all"}`;
  const hit = getCached<{ title: string; publisher: string; link: string; time: number; relatedTickers?: string[] }[]>(key, TTL.news);
  if (hit) return hit;
  const json = (await jget(`/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=0&newsCount=${count * 2}`)) as
    | { news?: { title: string; publisher: string; link: string; providerPublishTime: number; relatedTickers?: string[] }[] }
    | null;
  let items = (json?.news ?? []).map((n) => ({
    title: n.title,
    publisher: n.publisher,
    link: n.link,
    time: (n.providerPublishTime ?? 0) * 1000,
    relatedTickers: n.relatedTickers ?? [],
  }));
  if (freshMs) {
    const fresh = items.filter((n) => Date.now() - n.time < freshMs);
    if (fresh.length >= 4) items = fresh;
  }
  items = items.slice(0, count);
  if (items.length) setCached(key, items);
  return items;
}

// ---------- FX ----------
export async function getUsdThb(): Promise<number> {
  const hit = getCached<number>("fx:THB", 10 * 60_000);
  if (hit !== undefined) return hit;
  const m = await chartMeta("THB=X");
  const r = Number(m?.regularMarketPrice ?? NaN);
  if (isFinite(r) && r > 0) {
    setCached("fx:THB", r);
    return r;
  }
  return 36;
}
