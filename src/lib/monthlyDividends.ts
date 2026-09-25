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
  yieldPct: number; // สดจาก TV ถ้าเจอ / ไม่เจอใช้ค่าโดยประมาณ
  yieldSource: "live" | "approx";
  priceUsd: number | null;
  priceThb: number | null;
  changePct: number | null;
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
      let yieldPct: number | null = t?.dividendYield && t.dividendYield > 0 ? t.dividendYield : null;
      let yieldSource: "live" | "approx" = yieldPct ? "live" : "approx";
      if (yieldPct === null && priceUsd) {
        const div = await getTrailingDividends(r.symbol).catch(() => null);
        const y = div ? (div / priceUsd) * 100 : null;
        if (y && y > 0) {
          yieldPct = Math.round(y * 10) / 10;
          yieldSource = "live";
        }
      }
      const finalYield = yieldPct ?? r.approxYieldPct;
      return {
        symbol: r.symbol,
        name: r.name,
        type: r.type,
        risk: r.risk,
        note: r.note,
        yieldPct: finalYield,
        yieldSource,
        priceUsd,
        priceThb: priceUsd ? priceUsd * usdThb : null,
        changePct: q && isFinite(q.changePct) ? q.changePct : null,
        // yield/12 × 0.85 (ภาษี 15% ที่สหรัฐฯ หัก ณ ที่จ่ายสำหรับคนไทยที่ยื่น W-8BEN)
        monthlyPer100kThb: Math.round(((100000 * finalYield) / 100 / 12) * 0.85),
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
