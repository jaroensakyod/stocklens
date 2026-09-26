// ===== KB (Knowledge Store) — คลังองค์ความรู้กลางของ StockLens =====
// เก็บ 2 ชั้น: in-memory (เร็ว ตาม pattern cache ของ yahoo.ts) + Redis kb:* (พ้น instance บน Vercel, TTL)
// ผู้ใช้: /api/fundamentals (หน้าหุ้น) · buildStockPacket (แชท AI) · buildMarketPacket (macro)
// และเป็นวัตถุดิบพร้อมของ StockLens Score ในอนาคต — ทุกอย่างขุดจาก filings จริงเท่านั้น
//
// ความจริงของแหล่งข้อมูล (ตรวจแล้ว 2026): Yahoo ฟรีให้รายปีแค่รายได้+กำไรสุทธิ (ฟิลด์อื่นโดน strip)
// ตัวเลขละเอียดมีแค่ timeseries 5 ไตรมาสล่าสุด → พับเป็นแถว "TTM ล่าสุด" เต็ม
// หุ้นสหรัฐฯ เติมประวัติ 4 ปี (equity/cash/R&D/buyback) จาก SEC EDGAR + ใช้ยืนยันตัวเลข Yahoo

import { getAnnualStatements, getFundamentals, getQuotes, type AnnualRaw } from "./yahoo";
import { edgarFacts } from "./edgar";
import { fredMacro } from "./macro";
import { tvUniverse } from "./tvscanner";
import { kvGet, kvSet } from "./storage";

export type AnnualRow = AnnualRaw & {
  currentRatio?: number;
  debtToEquity?: number;
  grossMargin?: number;
  netMargin?: number;
  roe?: number;
};
export interface KbFundamentals {
  symbol: string;
  updatedAt: number;
  annual: AnnualRow[]; // "TTM ล่าสุด" (ละเอียดครบ) + FY ล่าสุด 4 ปี (รายได้/กำไรเสมอ + งบเพิ่มถ้าเป็นหุ้น US)
  quarterly: { label: string; revenue?: number; netIncome?: number; eps?: number }[]; // 5-8 ไตรมาสล่าสุด
  ratios: {
    revenueCagr?: number;
    netIncomeCagr?: number;
    revenueGrowth?: number;
    fcfLatest?: number;
    fcfMargin?: number;
    netDebt?: number;
  };
  edgarVerified?: boolean; // เลขรายได้ตรงกับ SEC 10-K
  /** 🇹🇭 หุ้นไทย: ผลตอบแทนปันผลล่าสุด % (จาก universe TradingView — Yahoo ไม่ให้ div ของ .BK) */
  dividendYieldPct?: number;
}

function decorate(row: AnnualRow): AnnualRow {
  if (row.revenue && row.grossProfit !== undefined) row.grossMargin = Math.round((row.grossProfit / row.revenue) * 1000) / 10;
  if (row.revenue && row.netIncome !== undefined) row.netMargin = Math.round((row.netIncome / row.revenue) * 1000) / 10;
  if (row.netIncome !== undefined && row.equity) row.roe = Math.round((row.netIncome / Math.abs(row.equity)) * 1000) / 10;
  if (row.totalDebt !== undefined && row.equity) row.debtToEquity = Math.round((row.totalDebt / Math.abs(row.equity)) * 100) / 100;
  if (row.currentAssets && row.currentLiabilities) row.currentRatio = Math.round((row.currentAssets / row.currentLiabilities) * 100) / 100;
  return row;
}

// ---------- cache 2 ชั้น: in-memory 30 นาที + Redis TTL ----------
const mem = new Map<string, { at: number; data: unknown }>();
const MEM_TTL = 30 * 60_000;

async function kbLoad<T>(key: string): Promise<T | null> {
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < MEM_TTL) return hit.data as T;
  const fromRedis = await kvGet<T>(key);
  if (fromRedis) {
    mem.set(key, { at: Date.now(), data: fromRedis });
    return fromRedis;
  }
  return null;
}
function kbSave(key: string, data: unknown, ttlSec: number) {
  mem.set(key, { at: Date.now(), data });
  kvSet(key, data, ttlSec).catch(() => {});
}

/** งบการเงินของหุ้น (ทุกตลาด) — cache memory 30 นาที + Redis 24 ชม. */
export async function kbFundamentals(symbol: string): Promise<KbFundamentals | null> {
  const sym = symbol.toUpperCase();
  const key = `kb:fund:v2:${sym}`; // v2 = กันกินแคชโครงสร้างเก่าเมื่อ schema เปลี่ยน
  const cached = await kbLoad<KbFundamentals>(key);
  if (cached) return cached;

  // 1) timeseries 5 ไตรมาสล่าสุด (ละเอียดครบทุกฟิลด์) → พับเป็นแถว TTM + รายการ quarterly
  const f = await getFundamentals(sym).catch(() => null);
  const s = f?.series ?? {};
  const rev = s["quarterlyTotalRevenue"] ?? [];
  if (rev.length < 4) return null;
  const sum4 = (k: string, from: number) => {
    const arr = s[k];
    return arr && arr.length >= from + 4 ? Math.round(arr.slice(from, from + 4).reduce((a, b) => a + b.value, 0) * 100) / 100 : undefined;
  };
  const ttmFrom = rev.length - 4;
  const snapLatest = (k: string) => s[k]?.[s[k].length - 1]?.value;
  const ttmRow: AnnualRow = decorate({
    label: "TTM ล่าสุด",
    revenue: sum4("quarterlyTotalRevenue", ttmFrom),
    grossProfit: sum4("quarterlyGrossProfit", ttmFrom),
    operatingIncome: sum4("quarterlyOperatingIncome", ttmFrom),
    netIncome: sum4("quarterlyNetIncome", ttmFrom),
    ebitda: sum4("quarterlyNormalizedEBITDA", ttmFrom),
    ocf: sum4("quarterlyOperatingCashFlow", ttmFrom),
    fcf: sum4("quarterlyFreeCashFlow", ttmFrom),
    totalAssets: snapLatest("quarterlyTotalAssets"),
    equity: snapLatest("quarterlyStockholdersEquity"),
    totalDebt: snapLatest("quarterlyTotalDebt"),
    cash: snapLatest("quarterlyCashAndCashEquivalents"),
    currentAssets: snapLatest("quarterlyCurrentAssets"),
    currentLiabilities: snapLatest("quarterlyCurrentLiabilities"),
  });
  const quarterly = rev.slice(-8).map((p, i) => {
    const q: { label: string; revenue?: number; netIncome?: number; eps?: number } = {
      label: new Date(p.time * 1000).toLocaleDateString("th-TH", { month: "short", year: "2-digit" }),
      revenue: p.value,
    };
    const ni = s["quarterlyNetIncome"]?.slice(-8)[i]?.value;
    const eps = s["quarterlyDilutedEPS"]?.slice(-8)[i]?.value;
    if (ni !== undefined) q.netIncome = ni;
    if (eps !== undefined) q.eps = eps;
    return q;
  });

  // 2) ประวัติรายได้/กำไร 4 ปีจาก quoteSummary (ทุกตลาด) → ครอบเป็น FY rows
  const hist = await getAnnualStatements(sym).catch(() => null);
  const fyRows: AnnualRow[] = (hist ?? []).map((r) => decorate({ label: r.label, revenue: r.revenue, netIncome: r.netIncome }));

  // 3) หุ้นสหรัฐฯ: เติม equity/cash/R&D/buyback รายปีจาก SEC EDGAR + ยืนยันเลขรายได้
  let edgarVerified: boolean | undefined;
  const ed = await edgarFacts(sym).catch(() => null);
  if (ed?.years?.length) {
    for (const y of ed.years) {
      const row = fyRows.find((r) => r.label === "FY" + y.year);
      if (row) {
        if (row.equity === undefined && y.equity !== undefined) row.equity = y.equity;
        if (row.cash === undefined && y.cash !== undefined) row.cash = y.cash;
        if (y.rd !== undefined) row.rd = y.rd;
        if (y.buyback !== undefined) row.buyback = y.buyback;
        decorate(row);
      }
    }
    // ยืนยัน: รายได้ FY ล่าสุดจากทั้งสองแหล่งต่างกัน <8% = ตรง
    const fy0 = ed.years[0];
    const yRev = fyRows.find((r) => r.label === "FY" + fy0.year)?.revenue;
    if (yRev && fy0.revenue) edgarVerified = Math.abs(yRev - fy0.revenue) / Math.max(yRev, fy0.revenue) < 0.08;
  }

  const annual = [ttmRow, ...fyRows].filter((r) => r.revenue !== undefined || r.netIncome !== undefined);
  if (annual.length < 2) return null;

  const cagr = (arr: (number | undefined)[]) => {
    const first = arr[arr.length - 1];
    const last = arr[0];
    const years = arr.length - 1;
    if (!first || !last || first <= 0 || last <= 0 || years < 1) return undefined;
    return Math.round(((last / first) ** (1 / years) - 1) * 1000) / 10;
  };
  const fyOnly = annual.filter((r) => r.label.startsWith("FY"));
  const growthBase = fyOnly.length >= 2 ? fyOnly : annual;
  const latest = growthBase[0];
  const prev = growthBase[1];

  // 🇹🇭 หุ้นไทย: ดึงผลตอบแทนปันผลจาก universe ไทย (cache ฝั่ง tvscanner 6 ชม. — ยิงครั้งเดียวต่อทั้งตลาด)
  let dividendYieldPct: number | undefined;
  if (sym.endsWith(".BK")) {
    const thUni = await tvUniverse("thailand", 400).catch(() => []);
    const row = thUni.find((r) => r.symbol === sym.replace(".BK", ""));
    if (row?.dividendYield && row.dividendYield > 0) dividendYieldPct = Math.round(row.dividendYield * 100) / 100;
  }

  const out: KbFundamentals = {
    symbol: sym,
    updatedAt: Date.now(),
    annual,
    quarterly,
    dividendYieldPct,
    ratios: {
      revenueCagr: cagr(growthBase.map((a) => a.revenue)),
      netIncomeCagr: cagr(growthBase.map((a) => (a.netIncome !== undefined && a.netIncome > 0 ? a.netIncome : undefined))),
      revenueGrowth: latest?.revenue && prev?.revenue && prev.revenue > 0 ? Math.round((latest.revenue / prev.revenue - 1) * 1000) / 10 : undefined,
      fcfLatest: ttmRow.fcf,
      fcfMargin: ttmRow.fcf !== undefined && ttmRow.revenue ? Math.round((ttmRow.fcf / ttmRow.revenue) * 1000) / 10 : undefined,
      netDebt: ttmRow.totalDebt !== undefined && ttmRow.cash !== undefined ? ttmRow.totalDebt - ttmRow.cash : undefined,
    },
    edgarVerified,
  };
  kbSave(key, out, 24 * 3600);
  return out;
}

// ---------- Macro ล่าสุด (Yahoo indexes + FRED เมื่อมี key) ----------

export interface KbMacro {
  updatedAt: number;
  us: { tenYear?: number; twoYear?: number; vix?: number; dxy?: number; source: "yahoo" | "fred+yahoo"; cpiYoY?: number; unemployment?: number };
  th: { set?: number; thbPerUsd?: number };
  asOfText: string;
}

const MACRO_SYM = ["^TNX", "^IRX", "^VIX", "DX-Y.NYB", "^SET.BK", "THB=X"];

/** ภาพรวม macro ไทย+สหรัฐฯ — cache memory 15 นาที + Redis 12 ชม. (ใช้ในแชท intent market ทันที) */
export async function kbMacro(): Promise<KbMacro> {
  const key = "kb:macro";
  const cached = await kbLoad<KbMacro>(key);
  if (cached) return cached;
  const quotes = await getQuotes(MACRO_SYM).catch(() => ({}) as Record<string, never>);
  const q = (s2: string) => {
    const v = (quotes as Record<string, { price?: number }>)[s2]?.price;
    return v !== undefined && isFinite(v) ? Math.round(v * 100) / 100 : undefined;
  };
  const out: KbMacro = {
    updatedAt: Date.now(),
    us: { tenYear: q("^TNX"), twoYear: q("^IRX"), vix: q("^VIX"), dxy: q("DX-Y.NYB"), source: "yahoo" },
    th: { set: q("^SET.BK"), thbPerUsd: q("THB=X") },
    asOfText: new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }),
  };
  const fred = await fredMacro().catch(() => null);
  if (fred) {
    if (fred.dgs10 !== undefined) out.us.tenYear = fred.dgs10;
    if (fred.dgs2 !== undefined) out.us.twoYear = fred.dgs2;
    out.us.cpiYoY = fred.cpiYoY;
    out.us.unemployment = fred.unemployment;
    out.us.source = "fred+yahoo";
  }
  kbSave(key, out, 12 * 3600);
  return out;
}

/** สรุปงบแบบกระชับสำหรับยัดใส่ truth-packet ของแชท (~300 ตัวอักษร) */
export function fundTrendText(f: KbFundamentals): string {
  const fmt = (n?: number) => (n === undefined ? "?" : Math.abs(n) >= 1e9 ? (n / 1e9).toFixed(1) + "B" : Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(0) + "M" : String(Math.round(n / 1e3)) + "K");
  const rev = f.annual.map((a) => fmt(a.revenue)).join("→");
  const ni = f.annual.map((a) => fmt(a.netIncome)).join("→");
  const bits = [
    `งบ [${f.annual.map((a) => a.label).join("/")}] รายได้ ${rev}`,
    `กำไร ${ni}`,
    f.ratios.revenueCagr !== undefined ? `CAGR ${f.ratios.revenueCagr}%` : "",
    f.annual[0].netMargin !== undefined ? `net margin ${f.annual[0].netMargin}%` : "",
    f.ratios.netDebt !== undefined ? `หนี้สุทธิ ${fmt(f.ratios.netDebt)}` : "",
    f.ratios.fcfLatest !== undefined ? `FCF ${fmt(f.ratios.fcfLatest)}` : "",
    f.dividendYieldPct !== undefined ? `ปันผล ~${f.dividendYieldPct}%` : "",
    f.edgarVerified ? "✓ตรงSEC" : "",
  ].filter(Boolean);
  return bits.join(" · ");
}

/** สรุป macro กระชับสำหรับ packet */
export function macroText(m: KbMacro): string {
  const parts = [
    m.us.tenYear !== undefined ? `US10Y ${m.us.tenYear}%` : "",
    m.us.cpiYoY !== undefined ? `เงินเฟ้อUS ${m.us.cpiYoY}%` : "",
    m.us.vix !== undefined ? `VIX ${m.us.vix}` : "",
    m.th.set !== undefined ? `SET ${m.th.set}` : "",
    m.th.thbPerUsd !== undefined ? `THB ${m.th.thbPerUsd}/USD` : "",
  ].filter(Boolean);
  return `[Macro ล่าสุด ${m.asOfText} — ${parts.join(" · ")}]`;
}
