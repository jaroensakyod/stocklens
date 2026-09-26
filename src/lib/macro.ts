// ===== FRED (Federal Reserve Economic Data) — ค่าทางการ macro สหรัฐฯ (optional) =====
// สมัคร key ฟรี 5 นาที: https://fred.stlouisfed.org/docs/api/api_key.html → ใส่ FRED_API_KEY ใน .env.local
// ไม่มี key = คืน null แล้ว kbMacro ใช้ Yahoo indexes แทน (ทำงานได้ปกติ) — pattern เดียวกับ Alpaca
import { getCached, setCached } from "./yahoo";

const BASE = "https://api.stlouisfed.org/fred/series/observations";

export interface FredMacro {
  dgs10?: number; // อัตราผลตอบแทนพันธบัตร 10 ปี (%)
  dgs2?: number; // 2 ปี (%)
  cpiYoY?: number; // เงินเฟ้อ YoY (% — คำนวณจาก CPI index)
  unemployment?: number; // อัตราว่างงาน (%)
  fetchedAt: number;
}

export function hasFred(): boolean {
  return !!process.env.FRED_API_KEY;
}

async function series(id: string): Promise<{ date: string; value: number }[]> {
  const key = "fred:" + id;
  const hit = getCached<{ date: string; value: number }[]>(key, 6 * 3600_000);
  if (hit) return hit;
  const res = await fetch(`${BASE}?series_id=${id}&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=260`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const j = (await res.json()) as { observations?: { date: string; value: string }[] };
  const out = (j.observations ?? [])
    .filter((o) => o.value !== "." && isFinite(Number(o.value)))
    .map((o) => ({ date: o.date, value: Number(o.value) }));
  if (out.length) setCached(key, out);
  return out;
}

export async function fredMacro(): Promise<FredMacro | null> {
  if (!hasFred()) return null;
  const [dgs10, dgs2, cpi, unrate] = await Promise.all([series("DGS10"), series("DGS2"), series("CPIAUCSL"), series("UNRATE")]);
  // CPI เป็น index → เทียบ 12 เดือนย้อนหลังเป็น % เงินเฟ้อ
  let cpiYoY: number | undefined;
  if (cpi.length >= 13) cpiYoY = Math.round(((cpi[0].value / cpi[12].value - 1) * 100) * 100) / 100;
  return {
    dgs10: dgs10[0]?.value,
    dgs2: dgs2[0]?.value,
    cpiYoY,
    unemployment: unrate[0]?.value,
    fetchedAt: Date.now(),
  };
}
