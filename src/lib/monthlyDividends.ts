// ===== หุ้น/ETF จ่ายปันผลรายเดือน — เอา curated list ไปตีกับข้อมูลสด (yield จาก TradingView + ราคาบาท) =====
import listJson from "@/data/monthly-dividends.json";
import { tvUniverse } from "./tvscanner";
import { getQuotes, getUsdThb, getTrailingDividends } from "./yahoo";

export interface MonthlyDivRow {
  symbol: string;
  name: string;
  type: string;
  risk: "ต่ำ" | "กลาง" | "สูง";
  note: string;
  yieldPct: number; // สดจากปันผลจ่ายจริง 12 เดือน ÷ ราคา / fallback ค่าโดยประมาณ
  yieldSource: "live" | "approx";
  priceUsd: number | null;
  priceThb: number | null;
  changePct: number | null;
  mcapB: number | null; // มูลค่าตลาด (พันล้าน USD) — จาก TradingView (ถ้ามี)
  payCount12m: number | null; // จ่ายกี่ครั้งใน 12 เดือน (12 = รายเดือนจริง)
  lastDivUsd: number | null; // ปันผลงวดล่าสุดต่อหุ้น
  lastDivDate: string | null; // วันที่จ่ายล่าสุด
  // ปันผลต่อเดือนโดยประมาณ (สุทธิหลังภาษี 15%) ต่อเงินลง 100,000฿
  monthlyPer100kThb: number;
}

let cached: { at: number; data: { rows: MonthlyDivRow[]; asOf: string } } | null = null;
const TTL = 60 * 60_000; // yield/ราคาเปลี่ยนช้า — รีเฟรชชั่วโมงละครั้งพอ

async function build() {
  const raw = (listJson as { list: { symbol: string; name: string; type: string; approxYieldPct: number; risk: "ต่ำ" | "กลาง" | "สูง"; note: string }[] }).list;
  const [tv, quotes, usdThb] = await Promise.all([
    tvUniverse("america", 1000).catch(() => [] as Awaited<ReturnType<typeof tvUniverse>>),
    getQuotes(raw.map((r) => r.symbol)).catch(() => ({} as Awaited<ReturnType<typeof getQuotes>>)),
    getUsdThb().catch(() => 36),
  ]);
  const tvBySymbol = new Map(tv.map((r) => [r.symbol, r]));

  // ETF ส่วนใหญ่ไม่อยู่ใน TV universe → ดึงปันผลจ่ายจริง 12 เดือนจาก Yahoo events=div มาคิด yield เอง
  const rows: MonthlyDivRow[] = await Promise.all(
    raw.map(async (r) => {
      const t = tvBySymbol.get(r.symbol);
      const q = quotes[r.symbol];
      const priceUsd = q && isFinite(q.price) ? q.price : null;
      // ประวัติปันผลจ่ายจริง 12 เดือน (events=div) — ใช้ทั้งคิด yield และยืนยันว่า "จ่ายรายเดือน" จริงไหม
      const div = priceUsd ? await getTrailingDividends(r.symbol).catch(() => null) : null;
      const trailYield = div && div.sum12m > 0 && priceUsd ? (div.sum12m / priceUsd) * 100 : null;
      let yieldPct: number | null = trailYield ?? (t?.dividendYield && t.dividendYield > 0 ? t.dividendYield : null);
      let yieldSource: "live" | "approx" = yieldPct ? "live" : "approx";
      return {
        symbol: r.symbol,
        name: r.name,
        type: r.type,
        risk: r.risk,
        note: r.note,
        yieldPct: yieldPct ?? r.approxYieldPct,
        yieldSource,
        priceUsd,
        priceThb: priceUsd ? priceUsd * usdThb : null,
        changePct: q && isFinite(q.changePct) ? q.changePct : null,
        mcapB: t?.mcap ? Math.round((t.mcap / 1e9) * 10) / 10 : null,
        payCount12m: div?.count12m ?? null,
        lastDivUsd: div?.lastAmount ?? null,
        lastDivDate: div?.lastDateIso ?? null,
        // yield/12 × 0.85 (ภาษี 15% ที่สหรัฐฯ หัก ณ ที่จ่ายสำหรับคนไทยที่ยื่น W-8BEN)
        monthlyPer100kThb: Math.round(((100000 * (yieldPct ?? r.approxYieldPct)) / 100 / 12) * 0.85),
      };
    })
  );

  return {
    rows,
    asOf: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.",
  };
}

export async function getMonthlyDividends() {
  if (cached && Date.now() - cached.at < TTL) return cached.data;
  const data = await build();
  cached = { at: Date.now(), data };
  return data;
}
