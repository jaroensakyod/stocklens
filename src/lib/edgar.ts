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


// ===== โครงสร้างรายได้ (Revenue Structure) — ตาราง R-file จาก 10-K ล่าสุด =====
// EDGAR render ตาราง XBRL ทุกใบเป็นไฟล์ R*.htm แยกส่วน — เราเจาะเอาตาราง
// "Revenue by Market/Product" (แยกตามธุรกิจ) และ "Revenue by Region" (แยกตามประเทศ)
// ได้ตัวเลขจริง 3 ปีจาก filings โดยตรง — ฟรี ไม่ต้องมี AI
export interface SegmentTable {
  years: string[]; // วันสิ้นสุดงวด เช่น ["Jan. 25, 2026", ...]
  rows: { name: string; values: (number | null)[]; isTotal?: boolean }[];
}
export interface RevenueStructure {
  symbol: string;
  form: string;
  filedAt: string;
  byBusiness?: SegmentTable;
  byRegion?: SegmentTable;
}

const segCache = new Map<string, { at: number; val: RevenueStructure | null }>();
const SEG_TTL = 12 * 3600_000;

async function getText(url: string, timeoutMs = 15_000): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** parse ตาราง R*.htm → ปี + แถว [ชื่อ, ค่า...] — ตัด noise ของหัว/ท้ายตาราง
 *  โครงสร้างจริงของ EDGAR: แถว "12 Months Ended" กับแถววันที่เป็นคนละแถว และแถวรวมชื่อ "Revenue" เปล่าๆ */
function parseRTable(html: string): { years: string[]; rows: SegmentTable["rows"] } {
  const rows: SegmentTable["rows"] = [];
  let years: string[] = [];
  let pendingName = ""; // ชื่อ segment จากแถว label-only ค้างไว้ใช้กับแถวตัวเลขถัดไป
  const DATE_RE = /^[A-Z][a-z]{2}\.? \d{1,2},? \d{4}$/;
  const trs = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
  const cleanName = (s: string) =>
    s
      .replace(/\[.*?\]/g, " ")
      .replace(/Revenue from External Customer/gi, " ")
      .replace(/\$ in Millions|USD \(\$\) /g, " ")
      .replace(/\s*\|.*$/, "")
      .replace(/\s+/g, " ")
      .trim();
  for (const tr of trs.slice(0, 90)) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) =>
      c[1].replace(/<[^>]+>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/\s+/g, " ").trim()
    );
    if (!cells.length) continue;
    // แถววันที่ (อาจตามหลังแถว "Months Ended" หรือยืนอยู่คนเดียว) → เก็บเป็นปีของแต่ละคอลัมน์
    const dateCells = cells.filter((c) => DATE_RE.test(c));
    if (dateCells.length >= 2) {
      years = dateCells;
      continue;
    }
    if (cells.some((c) => /Months Ended/i.test(c))) continue; // หัวคอลัมน์ — ข้ามรอวันที่แถวถัดไป
    const nums: (number | null)[] = [];
    let hasNum = false;
    for (const c of cells.slice(1)) {
      const neg = /^\(.*\)$/.test(c);
      const raw = c.replace(/[$,%()\s]/g, "");
      if (/^-?\d+(\.\d+)?$/.test(raw) && raw !== "") {
        nums.push(Number(raw) * (neg ? -1 : 1));
        hasNum = true;
      } else nums.push(null);
    }
    // แถวไม่มีตัวเลข = ชื่อ segment ของแถวตัวเลขถัดไป (ข้ามแถวหัวโซ่ noise อย่าง "Revenues and Long-Lived Assets")
    if (!hasNum) {
      const maybe = cleanName(cells[0]);
      if (maybe && !/Line Items|Revenues and Long-Lived|Operating segments/i.test(cells[0])) pendingName = maybe;
      continue;
    }
    const rawClean = cleanName(cells[0]);
    // แถว "Revenue/Net sales/Total revenue" = ยอดของ segment ที่ชื่อค้างไว้ หรือยอดรวมทั้งบริษัท (ถ้าไม่มีชื่อค้าง)
    const isRevLabel = /^(revenue|net sales|total revenue|total net sales)$/i.test(rawClean);
    if (isRevLabel && !pendingName) {
      rows.push({ name: "รวมทั้งหมด", values: nums, isTotal: true });
      continue;
    }
    const label = pendingName || rawClean;
    pendingName = "";
    if (!label || label.length < 2 || /Line Items|Details|Document|Entity/i.test(label)) continue;
    rows.push({ name: label, values: nums });
  }
  return { years, rows };
}

/** โครงสร้างรายได้จาก 10-K ล่าสุด — null ถ้าไม่ใช่หุ้น US / ไม่มีตาราง segment */
export async function revenueSegments(symbol: string): Promise<RevenueStructure | null> {
  const sym = symbol.toUpperCase();
  if (!/^[A-Z]{1,5}$/.test(sym)) return null;
  const c0 = segCache.get(sym);
  if (c0 && Date.now() - c0.at < SEG_TTL) return c0.val;
  const cik = await cikOf(sym);
  if (!cik) return null;
  const finish = (val: RevenueStructure | null) => {
    segCache.set(sym, { at: Date.now(), val });
    return val;
  };
  const sub = await jget<{
    filings?: { recent?: { form?: string[]; accessionNumber?: string[]; accessionNumbers?: string[]; filingDate?: string[] } };
  }>(`https://data.sec.gov/submissions/${cik}.json`);
  const recent = sub?.filings?.recent;
  const forms = recent?.form ?? [];
  const accs = recent?.accessionNumber ?? recent?.accessionNumbers ?? [];
  const dates = recent?.filingDate ?? [];
  const i = forms.indexOf("10-K");
  if (i < 0 || !accs[i]) return finish(null);
  const acc = accs[i].replace(/-/g, "");
  const num = acc.slice(0, 10);
  const summary = await getText(`https://www.sec.gov/Archives/edgar/data/${num}/${acc}/FilingSummary.xml`);
  if (!summary) return finish(null);
  const reports = [...summary.matchAll(/<Report[^>]*>([\s\S]*?)<\/Report>/g)]
    .map((m) => ({
      f: m[1].match(/<HtmlFileName>(\w+\.htm)</)?.[1],
      n: m[1].match(/<ShortName>([^<]+)</)?.[1] ?? "",
    }))
    .filter((x): x is { f: string; n: string } => !!x.f);
  const bizReports = reports.filter((x) => /revenue (by|—|\W).*(market|product|disaggregat)|disaggregation of revenue/i.test(x.n));
  const regionReports = reports.filter((x) => /revenue.*region|geograph/i.test(x.n));
  const load = async (list: { f: string; n: string }[]): Promise<SegmentTable | undefined> => {
    for (const r of list.slice(0, 3)) {
      const html = await getText(`https://www.sec.gov/Archives/edgar/data/${num}/${acc}/${r.f}`);
      if (!html) continue;
      const { years, rows } = parseRTable(html);
      // เอาเฉพาะแถวรายได้ — ตาราง Region/Segment ปนแถวต้นทุน-กำไร-สินทรัพย์เข้ามา
      const named = rows.filter(
        (x) => !x.isTotal && !/long-lived|assets|concentration|cost of sales|operating income|deferred revenue|depreciation/i.test(x.name)
      );
      if (years.length && named.length >= 2) {
        // top 8 แถวตามปีล่าสุด + แถว total (ใช้คิด %)
        const sorted = [...named].sort(
          (a, b) => Math.abs(b.values[0] ?? 0) - Math.abs(a.values[0] ?? 0)
        );
        const top = sorted.slice(0, 8);
        const total = rows.find((x) => x.isTotal);
        return { years, rows: total ? [...top, total] : top };
      }
    }
    return undefined;
  };
  const out: RevenueStructure = { symbol: sym, form: accs[i], filedAt: dates[i] ?? "" };
  out.byBusiness = await load(bizReports);
  out.byRegion = await load(regionReports);
  // fallback: บริษัทที่ตั้งชื่อตารางแค่ "Segment ... (Details)" (เช่น MSFT) — ตัวกรองแถวที่ไม่ใช่รายได้ออกให้แล้ว
  if (!out.byBusiness) {
    const segReports = reports.filter(
      (x) => /segment/i.test(x.n) && !/tables|narrative|reconcil|policy|text|annual report/i.test(x.n)
    );
    out.byBusiness = await load(segReports);
  }
  if (!out.byBusiness && !out.byRegion) return finish(null);
  return finish(out);
}
