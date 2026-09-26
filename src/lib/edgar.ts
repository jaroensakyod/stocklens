// ===== SEC EDGAR — งบจาก filings จริงของบริษัทสหรัฐฯ (ฟรี ไม่ต้องมี key, จำกัด 10 req/s) =====
// ใช้ 2 อย่าง: (1) เติมงบ 4 ปี (equity/cash/R&D/buyback) ที่ Yahoo ฟรีไม่ให้ (2) ยืนยันความแม่นตัวเลขรายได้/กำไร
// เก็บใน cache ของ yahoo.ts (memory) — ไม่ลง Redis เพราะข้อมูลเปลี่ยนปีละครั้ง
import { getCached, setCached } from "./yahoo";

const UA = process.env.SEC_UA || "StockLens research stocklens.app contact:jaroensak.yod@gmail.com";

async function jget<T>(url: string): Promise<T | null> {
  try {
    // companyfacts บางบริษัทใหญ่ ~8MB ใช้เวลา ~13 วินาที — เผื่อ 25s
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(25_000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

let cikMapCache: { at: number; map: Map<string, string> } | null = null;

/** ticker → CIK (ไฟล์ทางการของ SEC ทั้งตลาด ~10k บริษัท — เป็น map ตรงๆ ไม่มี field data — แคชใน memory 24 ชม.) */
async function cikOf(symbol: string): Promise<string | null> {
  if (cikMapCache && Date.now() - cikMapCache.at < 24 * 3600_000) return cikMapCache.map.get(symbol) ?? null;
  const j = await jget<Record<string, { ticker?: string; cik_str?: number }>>("https://www.sec.gov/files/company_tickers.json");
  const map = new Map<string, string>();
  for (const row of Object.values(j ?? {})) {
    if (row?.ticker && row.cik_str) map.set(row.ticker.toUpperCase(), "CIK" + String(row.cik_str).padStart(10, "0"));
  }
  cikMapCache = { at: Date.now(), map };
  return map.get(symbol) ?? null;
}

type Units = { units?: Record<string, { fy?: number; fp?: string; form?: string; frame?: string; end?: string; filed?: string; val?: number }[]> };
type Facts = Record<string, Units>;

/** ทุกปี (form 10-K) ของ concept หนึ่ง → [{year, value, filed}]
 *  year ยึดวันสิ้นสุดงวด (end) ให้ตรงกับ label FY#### ของ Yahoo (บริษัทปีบัญชีไม่ตรง ธ.ค. เช่น NVDA จบม.ค.) */
function annualSeries(facts: Facts, concept: string): { year: number; value: number; filed: string }[] {
  const arr = facts[concept]?.units?.["USD"] ?? [];
  const byYear = new Map<number, { value: number; filed: string }>();
  for (const x of arr) {
    if (x.form !== "10-K" || typeof x.val !== "number" || !isFinite(x.val) || !x.end) continue;
    const year = Number(x.end.slice(0, 4));
    if (!year) continue;
    const prev = byYear.get(year);
    if (!prev || (x.filed ?? "") > prev.filed) byYear.set(year, { value: x.val, filed: x.filed ?? "" });
  }
  return [...byYear.entries()].map(([year, v]) => ({ year, value: v.value, filed: v.filed })).sort((a, b) => b.year - a.year);
}

/** รวมหลาย concept (บริษัทบางแห่งเปลี่ยน tag รายได้กลางทาง) — ปีเดียวกันเอาตัวที่ filed ทีหลัง */
function mergeSeries(lists: { year: number; value: number; filed: string }[][]): Map<number, number> {
  const out = new Map<number, number>();
  const filedMap = new Map<number, string>();
  for (const list of lists) {
    for (const x of list) {
      const prevFiled = filedMap.get(x.year) ?? "";
      if (!out.has(x.year) || x.filed > prevFiled) {
        out.set(x.year, x.value);
        filedMap.set(x.year, x.filed);
      }
    }
  }
  return out;
}

export interface EdgarYear {
  year: number;
  revenue?: number;
  netIncome?: number;
  equity?: number;
  cash?: number;
  rd?: number;
  buyback?: number; // เงินใช้ซื้อหุ้นคืน (ติดลบ = จ่ายจริง)
}
export interface EdgarFacts {
  symbol: string;
  years: EdgarYear[];
  updatedAt: number;
}

/** งบรายปีจาก 10-K ของบริษัทสหรัฐฯ — คืน null ถ้าหุ้นต่างชาติ/ไม่มีข้อมูล */
export async function edgarFacts(symbol: string): Promise<EdgarFacts | null> {
  const sym = symbol.toUpperCase();
  if (!/^[A-Z]{1,5}$/.test(sym)) return null; // EDGAR มีแต่หุ้นสหรัฐฯ
  const key = "edgar:" + sym;
  const hit = getCached<EdgarFacts>(key, 24 * 3600_000);
  if (hit) return hit;
  const cik = await cikOf(sym);
  if (!cik) return null;
  const j = await jget<{ facts?: { "us-gaap"?: Facts } }>(`https://data.sec.gov/api/xbrl/companyfacts/${cik}.json`);
  const gaap = j?.facts?.["us-gaap"];
  if (!gaap || !Object.keys(gaap).length) return null;
  // บริษัทบางแห่งเปลี่ยน tag รายได้ระหว่างทาง → รวมสอง concept เอาตัวที่ filed ทีหลังต่อปี
  const revenue = mergeSeries([
    annualSeries(gaap, "RevenueFromContractWithCustomerExcludingAssessedTax"),
    annualSeries(gaap, "Revenues"),
  ]);
  const netIncome = mergeSeries([annualSeries(gaap, "NetIncomeLoss")]);
  const equity = mergeSeries([annualSeries(gaap, "StockholdersEquity")]);
  const cash = mergeSeries([annualSeries(gaap, "CashAndCashEquivalentsAtCarryingValue")]);
  const rd = mergeSeries([annualSeries(gaap, "ResearchAndDevelopmentExpense")]);
  const buyback = mergeSeries([annualSeries(gaap, "PaymentsForRepurchaseOfCommonStock")]);
  if (!revenue.size && !netIncome.size) return null;
  const pick = (m: Map<number, number>, year: number) => m.get(year);
  const yearsSet = new Set<number>([...revenue.keys(), ...netIncome.keys(), ...equity.keys()]);
  const years: EdgarYear[] = [...yearsSet]
    .sort((a, b) => b - a)
    .slice(0, 4)
    .map((year) => ({
      year,
      revenue: pick(revenue, year),
      netIncome: pick(netIncome, year),
      equity: pick(equity, year),
      cash: pick(cash, year),
      rd: pick(rd, year),
      buyback: pick(buyback, year),
    }));
  const out: EdgarFacts = { symbol: sym, years, updatedAt: Date.now() };
  setCached(key, out);
  return out;
}
