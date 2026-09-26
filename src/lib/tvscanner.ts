// ===== Universe ทั่วโลกจาก TradingView Scanner (แนวเดียวกับ bazi-investor-guide) =====
// ดึงหุ้นทั้งตลาด 30+ ประเทศ พร้อม sector/industry/mcap/IPO/premarket — cache 6 ชม.

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
const TTL = 6 * 3600_000;
const FIELDS = ["name", "close", "change", "market_cap_basic", "sector", "industry", "exchange", "ipo_date", "premarket_change", "country", "dividends_yield"];

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
  return (j.data ?? []).map((x) => ({
    symbol: (x.s.split(":").pop() ?? x.s).trim(),
    name: String(x.d[0] ?? x.s),
    price: Number(x.d[1] ?? 0),
    changePct: Number(x.d[2] ?? 0),
    mcap: Number(x.d[3] ?? 0),
    sector: String(x.d[4] ?? ""),
    industry: String(x.d[5] ?? ""),
    exchange: String(x.d[6] ?? x.s.split(":")[0] ?? ""),
    ipoDate: x.d[7] ? String(x.d[7]).slice(0, 10) : null,
    premarketPct: x.d[8] !== null && x.d[8] !== undefined ? Number(x.d[8]) : null,
    country: String(x.d[9] ?? ""),
    dividendYield: x.d[10] !== null && x.d[10] !== undefined && Number(x.d[10]) > 0 ? Number(x.d[10]) : null,
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

/** ค้นหา sector/industry ของหุ้น 1 ตัวจาก universe ที่ cache ไว้ (หรือดึงใหม่) */
export async function findSectorInfo(yahooSymbol: string): Promise<{ sector: string; industry: string; exchange: string; country: string } | null> {
  const m = yahooSymbol.toUpperCase().match(/^([A-Z0-9]+)(\.[A-Z]{2})?$/);
  if (!m) return null;
  const bare = m[1];
  const suffix = m[2] ?? "";
  const region = suffix ? (SUFFIX_TO_REGION[suffix] ?? (suffix === ".BK" ? "thailand" : undefined)) : "america";
  if (!region) return null;
  const target = suffix ? bare + suffix : bare;
  const univ = await tvUniverse(region, region === "america" ? 1000 : 400);
  const row =
    univ.find((r) => toYahooSymbol(region, r.symbol).toUpperCase() === target) ??
    univ.find((r) => r.symbol.toUpperCase() === bare);
  if (row) return { sector: row.sector, industry: row.industry, exchange: row.exchange, country: row.country };
  // ADR ต่างชาติ (TV ไม่จัดอยู่ america) → ไปหาที่ตลาดบ้านเกิดด้วยรหัส local
  const adr = ADR_HOME[bare];
  if (adr) {
    const [home, local] = adr;
    if (TV_REGIONS.some((r) => r.id === home)) {
      const homeUniv = await tvUniverse(home, 400);
      const hrow = homeUniv.find((r) => r.symbol.toUpperCase() === local.toUpperCase());
      if (hrow) return { sector: hrow.sector, industry: hrow.industry, exchange: hrow.exchange, country: hrow.country };
    }
  }
  return null;
}
