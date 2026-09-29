// ===== Universe ทั่วโลกจาก TradingView Scanner (แนวเดียวกับ bazi-investor-guide) =====
// ดึงหุ้นทั้งตลาด 30+ ประเทศ พร้อม sector/industry/mcap/IPO/premarket + เมตริกเชิงลึก ~35 ตัว
// (perf หลายช่วง / SMA / RSI / margins / ROE / หนี้ / P-E / PEG / ราคาเป้าหมาย) — cache 12 ชม.

export interface TvRow {
  symbol: string; // NVDA / PTT (ไม่มี prefix)
  name: string;
  price: number;
  changePct: number;
  mcap: number;
  sector: string;
  industry: string;
  exchange: string;
  ipoDate: string | null;
  premarketPct: number | null;
  /** % ปันผลล่าสุด (จาก TV — ใช้คัดก่อน ค่าจริงยืนยันด้วย Yahoo ใน buildAnalysis) */
  dividendYield: number | null;
  country: string;
  // ---- เมตริกเชิงลึก (optional — บาง region/หุ้น TV ไม่คืน) หน่วย: เปอร์เซ็นต์เมื่อคือ % ----
  /** ผลตอบแทนย้อนหลัง % (สัปดาห์/1เดือน/3เดือน/6เดือน/1ปี/YTD/3ปี/5ปี) */
  perfW?: number | null; perf1M?: number | null; perf3M?: number | null; perf6M?: number | null;
  perfY?: number | null; perfYTD?: number | null; perf3Y?: number | null; perf5Y?: number | null;
  /** ราคาเส้นค่าเฉลี่ย (ตัวเงิน ไม่ใช่ %) */
  sma20?: number | null; sma50?: number | null; sma200?: number | null;
  rsi?: number | null; atr?: number | null; beta?: number | null; volatilityD?: number | null;
  volume?: number | null; avgVol30d?: number | null; relVol?: number | null;
  pe?: number | null; pb?: number | null; ps?: number | null; pfcf?: number | null;
  evEbitda?: number | null; peg?: number | null; epsTtm?: number | null; epsNextQ?: number | null;
  /** % (เช่น 74.67 = 74.67%) */
  grossMargin?: number | null; operMargin?: number | null; netMargin?: number | null;
  roe?: number | null; roa?: number | null; roic?: number | null;
  de?: number | null; currentRatio?: number | null; quickRatio?: number | null;
  totalDebt?: number | null; fcf?: number | null;
  revYoy?: number | null; epsYoy?: number | null;
  /** มตินักวิเคราะห์ TV: -1 (ขายแรง) .. +1 (ซื้อแรง) */
  recommend?: number | null;
  /** ราคาเป้าหมายเฉลี่ยของนักวิเคราะห์ (ตัวเงิน) */
  targetPrice?: number | null;
  dividendPayout?: number | null; employees?: number | null;
  high52w?: number | null; low52w?: number | null;
}

export const TV_REGIONS: { id: string; label: string; flag: string; minCap: number }[] = [
  { id: "america", label: "สหรัฐฯ", flag: "🇺🇸", minCap: 3e8 },
  { id: "thailand", label: "ไทย", flag: "🇹🇭", minCap: 3e7 }, // 30 ล้านบาท = ครอบทั้ง SET + mai (รวม ~876 ตัว)
  { id: "vietnam", label: "เวียดนาม", flag: "🇻🇳", minCap: 1e8 },
  { id: "indonesia", label: "อินโดนีเซีย", flag: "🇮🇩", minCap: 1e8 },
  { id: "singapore", label: "สิงคโปร์", flag: "🇸🇬", minCap: 1e8 },
  { id: "malaysia", label: "มาเลเซีย", flag: "🇲🇾", minCap: 1e8 },
  { id: "philippines", label: "ฟิลิปปินส์", flag: "🇵🇭", minCap: 1e8 },
  { id: "hongkong", label: "ฮ่องกง", flag: "🇭🇰", minCap: 3e8 },
  { id: "china", label: "จีน", flag: "🇨🇳", minCap: 3e8 },
  { id: "taiwan", label: "ไต้หวัน", flag: "🇹🇼", minCap: 1e8 },
  { id: "japan", label: "ญี่ปุ่น", flag: "🇯🇵", minCap: 3e8 },
  { id: "korea", label: "เกาหลี", flag: "🇰🇷", minCap: 3e8 },
  { id: "india", label: "อินเดีย", flag: "🇮🇳", minCap: 3e8 },
  { id: "australia", label: "ออสเตรเลีย", flag: "🇦🇺", minCap: 3e8 },
  { id: "newzealand", label: "นิวซีแลนด์", flag: "🇳🇿", minCap: 1e8 },
  { id: "canada", label: "แคนาดา", flag: "🇨🇦", minCap: 3e8 },
  { id: "uk", label: "อังกฤษ", flag: "🇬🇧", minCap: 3e8 },
  { id: "germany", label: "เยอรมัน", flag: "🇩🇪", minCap: 3e8 },
  { id: "france", label: "ฝรั่งเศส", flag: "🇫🇷", minCap: 3e8 },
  { id: "netherlands", label: "เนเธอร์แลนด์", flag: "🇳🇱", minCap: 1e8 },
  { id: "switzerland", label: "สวิส", flag: "🇨🇭", minCap: 3e8 },
  { id: "sweden", label: "สวีเดน", flag: "🇸🇪", minCap: 1e8 },
  { id: "italy", label: "อิตาลี", flag: "🇮🇹", minCap: 1e8 },
  { id: "spain", label: "สเปน", flag: "🇪🇸", minCap: 1e8 },
  { id: "turkey", label: "ตุรกี", flag: "🇹🇷", minCap: 1e8 },
  { id: "israel", label: "อิสราเอล", flag: "🇮🇱", minCap: 1e8 },
  { id: "uae", label: "UAE", flag: "🇦🇪", minCap: 1e8 },
  { id: "saudiarabia", label: "ซาอุฯ", flag: "🇸🇦", minCap: 1e8 },
  { id: "southafrica", label: "แอฟริกาใต้", flag: "🇿🇦", minCap: 1e8 },
  { id: "brazil", label: "บราซิล", flag: "🇧🇷", minCap: 3e8 },
  { id: "mexico", label: "เม็กซิโก", flag: "🇲🇽", minCap: 1e8 },
];

// suffix Yahoo ของแต่ละตลาด (จีนพิเศษ: 6xxxx→.SS, 0/3xxxx→.SZ)
export const YAHOO_SUFFIX: Record<string, string> = {
  america: "", thailand: ".BK", vietnam: ".HM", indonesia: ".JK", singapore: ".SI", malaysia: ".KL",
  philippines: ".PS", hongkong: ".HK", taiwan: ".TW", japan: ".T", korea: ".KS", india: ".NS",
  australia: ".AX", newzealand: ".NZ", canada: ".TO", uk: ".L", germany: ".DE", france: ".PA",
  netherlands: ".AS", switzerland: ".SW", sweden: ".ST", italy: ".MI", spain: ".MC", turkey: ".IS",
  israel: ".TA", uae: ".AD", saudiarabia: ".SR", southafrica: ".JO", brazil: ".SA", mexico: ".MX",
};

/** แปลง symbol TV → symbol Yahoo ของภูมิภาคนั้น */
export function toYahooSymbol(region: string, symbol: string): string {
  if (region === "china") {
    if (/^6/.test(symbol)) return symbol + ".SS";
    if (/^[03]/.test(symbol)) return symbol + ".SZ";
    return symbol + ".SS";
  }
  return symbol + (YAHOO_SUFFIX[region] ?? "");
}

/** suffix Yahoo → region id (สำหรับ /api/sector) */
export const SUFFIX_TO_REGION: Record<string, string> = Object.entries(YAHOO_SUFFIX).reduce(
  (acc, [region, suffix]) => {
    if (suffix) acc[suffix] = region;
    return acc;
  },
  { ".SS": "china", ".SZ": "china" } as Record<string, string>
);

// ตลาดที่ TV คืน mcap เป็นสกุลท้องถิ่น → ใช้ FX จริงจาก Yahoo แปลงเป็น USD (cache 1 ชม.)
const LOCAL_FX: Record<string, string> = {
  vietnam: "VND=X", indonesia: "IDR=X", korea: "KRW=X", thailand: "THB=X", japan: "JPY=X",
  hongkong: "HKD=X", taiwan: "TWD=X", china: "CNY=X", india: "INR=X", uk: "GBP=X",
  mexico: "MXN=X", turkey: "TRY=X", southafrica: "ZAR=X", brazil: "BRL=X",
  israel: "ILS=X", saudiarabia: "SAR=X", uae: "AED=X",
};
const fxCache = new Map<string, { at: number; rate: number }>();
async function usdRate(region: string): Promise<number> {
  const sym = LOCAL_FX[region];
  if (!sym) return 1;
  const hit = fxCache.get(region);
  if (hit && Date.now() - hit.at < 3600_000) return hit.rate;
  try {
    const r = await fetch("https://query2.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(sym) + "?range=1d&interval=1d", {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json()) as { chart?: { result?: { meta?: { regularMarketPrice?: number } }[] } };
    const rate = j.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (rate && rate > 0) {
      fxCache.set(region, { at: Date.now(), rate });
      return rate;
    }
  } catch {}
  return 1;
}

const CACHE_KEY = "tvuniverse:";
const cache = new Map<string, { at: number; rows: TvRow[] }>();
const TTL = 12 * 3600_000;

// ---- คอลัมน์ที่ขอจาก TV (ลำดับสำคัญ — ใช้ FIELD_INDEX แปลง อย่าอ้าง index ตรง) ----
const FIELDS = [
  "name", "close", "change", "market_cap_basic", "sector", "industry", "exchange", "ipo_date", "premarket_change", "country", "dividends_yield",
  "Perf.W", "Perf.1M", "Perf.3M", "Perf.6M", "Perf.Y", "Perf.YTD", "Perf.3Y", "Perf.5Y",
  "SMA20", "SMA50", "SMA200",
  "RSI", "ATR", "beta_1_year", "Volatility.D",
  "volume", "average_volume_30d_calc", "relative_volume_10d_calc",
  "price_earnings_ttm", "price_book_fq", "price_sales_ratio", "price_free_cash_flow", "enterprise_value_ebitda_ttm",
  "price_earnings_growth_ttm", "earnings_per_share_basic_ttm", "earnings_per_share_forecast_next_fq",
  "gross_margin", "operating_margin", "net_margin", "return_on_equity", "return_on_assets", "return_on_invested_capital",
  "debt_to_equity", "current_ratio", "quick_ratio", "total_debt", "free_cash_flow",
  "total_revenue_yoy_growth_ttm", "earnings_per_share_diluted_yoy_growth_ttm",
  "Recommend.All", "price_target_average",
  "dividend_payout_ratio_ttm", "number_of_employees", "price_52_week_high", "price_52_week_low",
];
const FIELD_INDEX: Record<string, number> = Object.fromEntries(FIELDS.map((f, i) => [f, i]));

async function scanBatch(region: string, minCap: number, from: number, count: number): Promise<TvRow[]> {
  const body = {
    filter: [
      { left: "type", operation: "equal", right: "stock" },
      { left: "market_cap_basic", operation: "in_range", right: [minCap, 1e16] }, // เพดานสูง: บางตลาดคืน mcap สกุลท้องถิ่น (VND/IDR/KRW) ตัวเลขใหญ่กว่า USD มาก
    ],
    columns: FIELDS,
    sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
    range: [from, from + count],
  };
  const res = await fetch(`https://scanner.tradingview.com/${region}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error("tv " + res.status);
  const j = (await res.json()) as { data?: { s: string; d: (string | number | null)[] }[] };
  const num = (d: (string | number | null)[], field: string): number | null => {
    const v = d[FIELD_INDEX[field]];
    return v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null;
  };
  return (j.data ?? []).map((x) => ({
    symbol: (x.s.split(":").pop() ?? x.s).trim(),
    name: String(x.d[FIELD_INDEX["name"]] ?? x.s),
    price: Number(x.d[FIELD_INDEX["close"]] ?? 0),
    changePct: Number(x.d[FIELD_INDEX["change"]] ?? 0),
    mcap: Number(x.d[FIELD_INDEX["market_cap_basic"]] ?? 0),
    sector: String(x.d[FIELD_INDEX["sector"]] ?? ""),
    industry: String(x.d[FIELD_INDEX["industry"]] ?? ""),
    exchange: String(x.d[FIELD_INDEX["exchange"]] ?? x.s.split(":")[0] ?? ""),
    ipoDate: x.d[FIELD_INDEX["ipo_date"]] ? String(x.d[FIELD_INDEX["ipo_date"]]).slice(0, 10) : null,
    premarketPct: num(x.d, "premarket_change"),
    country: String(x.d[FIELD_INDEX["country"]] ?? ""),
    dividendYield: (() => { const v = num(x.d, "dividends_yield"); return v !== null && v > 0 ? v : null; })(),
    perfW: num(x.d, "Perf.W"), perf1M: num(x.d, "Perf.1M"), perf3M: num(x.d, "Perf.3M"), perf6M: num(x.d, "Perf.6M"),
    perfY: num(x.d, "Perf.Y"), perfYTD: num(x.d, "Perf.YTD"), perf3Y: num(x.d, "Perf.3Y"), perf5Y: num(x.d, "Perf.5Y"),
    sma20: num(x.d, "SMA20"), sma50: num(x.d, "SMA50"), sma200: num(x.d, "SMA200"),
    rsi: num(x.d, "RSI"), atr: num(x.d, "ATR"), beta: num(x.d, "beta_1_year"), volatilityD: num(x.d, "Volatility.D"),
    volume: num(x.d, "volume"), avgVol30d: num(x.d, "average_volume_30d_calc"), relVol: num(x.d, "relative_volume_10d_calc"),
    pe: num(x.d, "price_earnings_ttm"), pb: num(x.d, "price_book_fq"), ps: num(x.d, "price_sales_ratio"), pfcf: num(x.d, "price_free_cash_flow"),
    evEbitda: num(x.d, "enterprise_value_ebitda_ttm"), peg: num(x.d, "price_earnings_growth_ttm"),
    epsTtm: num(x.d, "earnings_per_share_basic_ttm"), epsNextQ: num(x.d, "earnings_per_share_forecast_next_fq"),
    grossMargin: num(x.d, "gross_margin"), operMargin: num(x.d, "operating_margin"), netMargin: num(x.d, "net_margin"),
    roe: num(x.d, "return_on_equity"), roa: num(x.d, "return_on_assets"), roic: num(x.d, "return_on_invested_capital"),
    de: num(x.d, "debt_to_equity"), currentRatio: num(x.d, "current_ratio"), quickRatio: num(x.d, "quick_ratio"),
    totalDebt: num(x.d, "total_debt"), fcf: num(x.d, "free_cash_flow"),
    revYoy: num(x.d, "total_revenue_yoy_growth_ttm"), epsYoy: num(x.d, "earnings_per_share_diluted_yoy_growth_ttm"),
    recommend: num(x.d, "Recommend.All"), targetPrice: num(x.d, "price_target_average"),
    dividendPayout: num(x.d, "dividend_payout_ratio_ttm"), employees: num(x.d, "number_of_employees"),
    high52w: num(x.d, "price_52_week_high"), low52w: num(x.d, "price_52_week_low"),
  }));
}

/** ดึง universe ของภูมิภาค (sorted โดย market cap) — batches 200 จนครบ targetMax หรือหมด */
export async function tvUniverse(region: string, targetMax = 800): Promise<TvRow[]> {
  const cfg = TV_REGIONS.find((r) => r.id === region) ?? TV_REGIONS[0];
  const key = CACHE_KEY + cfg.id + ":" + targetMax;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.rows;

  const rows: TvRow[] = [];
  const BATCH = 200;
  for (let from = 0; from < targetMax; from += BATCH) {
    let batch: TvRow[] = [];
    try {
      batch = await scanBatch(cfg.id, cfg.minCap, from, BATCH);
    } catch {
      break;
    }
    rows.push(...batch);
    if (batch.length < BATCH) break;
  }
  // normalize mcap เป็น USD (บางตลาดคืนสกุลท้องถิ่น)
  if (rows.length) {
    const rate = await usdRate(cfg.id);
    if (rate > 1.5) for (const r of rows) r.mcap = r.mcap / rate;
    cache.set(key, { at: Date.now(), rows });
  }
  return rows;
}

// ADR ดังที่ TV จัดอยู่ตลาดบ้านเกิด (ไม่อยู่ใน region "america") → (ตลาดบ้านเกิด, รหัส local)
const ADR_HOME: Record<string, [string, string]> = {
  TSM: ["taiwan", "2330"], TM: ["japan", "7203"], SONY: ["japan", "6758"], HMC: ["japan", "7267"],
  BABA: ["hongkong", "9988"], JD: ["hongkong", "9618"], NIO: ["hongkong", "9866"], LI: ["hongkong", "2015"],
  XPEV: ["hongkong", "9868"], TCEHY: ["hongkong", "0700"], SHEL: ["uk", "SHEL"], BP: ["uk", "BP"], RIO: ["uk", "RIO"],
  BHP: ["australia", "BHP"], ASML: ["netherlands", "ASML"], ERIC: ["sweden", "ERIC B"],
};

/** ค้นหาแถวของหุ้น 1 ตัวใน universe (พร้อมเมตริกเต็ม) — null ถ้าไม่เจอ */
export async function findTvRow(yahooSymbol: string): Promise<{ row: TvRow; region: string } | null> {
  const m = yahooSymbol.toUpperCase().match(/^([A-Z0-9]+)(\.[A-Z]{2})?$/);
  if (!m) return null;
  const bare = m[1];
  const suffix = m[2] ?? "";
  const region = suffix ? (SUFFIX_TO_REGION[suffix] ?? (suffix === ".BK" ? "thailand" : undefined)) : "america";
  if (!region) return null;
  const target = suffix ? bare + suffix : bare;
  const univ = await tvUniverse(region, region === "america" ? 3000 : 400);
  const row =
    univ.find((r) => toYahooSymbol(region, r.symbol).toUpperCase() === target) ??
    univ.find((r) => r.symbol.toUpperCase() === bare);
  if (row) return { row, region };
  // ADR ต่างชาติ (TV ไม่จัดอยู่ america) → ไปหาที่ตลาดบ้านเกิดด้วยรหัส local
  const adr = ADR_HOME[bare];
  if (adr) {
    const [home, local] = adr;
    if (TV_REGIONS.some((r) => r.id === home)) {
      const homeUniv = await tvUniverse(home, 400);
      const hrow = homeUniv.find((r) => r.symbol.toUpperCase() === local.toUpperCase());
      if (hrow) return { row: hrow, region: home };
    }
  }
  return null;
}

/** ค้นหา sector/industry ของหุ้น 1 ตัวจาก universe ที่ cache ไว้ (หรือดึงใหม่) */
export async function findSectorInfo(yahooSymbol: string): Promise<{ sector: string; industry: string; exchange: string; country: string } | null> {
  const hit = await findTvRow(yahooSymbol);
  if (!hit) return null;
  return { sector: hit.row.sector, industry: hit.row.industry, exchange: hit.row.exchange, country: hit.row.country };
}
