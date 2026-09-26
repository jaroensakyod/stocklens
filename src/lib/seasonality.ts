// ===== Seasonality (ฤดูกาลหุ้น) — ผลตอบแทนรายเดือน/รายไตรมาส ย้อนหลัง 5 ปี =====
// แรงบันดาลใจจาก "Seasons Change" ของ StockRadars — เราทำจากกราฟราคาจริงรายเดือนของ Yahoo
import { getChart } from "./yahoo";

export const MONTH_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export interface Seasonality {
  symbol: string;
  years: number[];
  monthly: { year: number; months: (number | null)[] }[]; // 12 ค่า/ปี (%)
  avg: (number | null)[]; // เฉลี่ยแต่ละเดือน (%)
  posRate: (number | null)[]; // % ของปีที่เดือนนั้นบวก
  qAvg: (number | null)[]; // เฉลี่ยรายไตรมาส Q1-Q4 (%)
  bestMonth: { m: number; avg: number } | null;
  worstMonth: { m: number; avg: number } | null;
  sampleYears: number;
}

export async function computeSeasonality(symbol: string): Promise<Seasonality | null> {
  const candles = await getChart(symbol, "5YM").catch(() => []);
  const clean = candles.filter((c) => isFinite(c.close) && c.close > 0 && c.time > 0);
  if (clean.length < 13) return null;
  // Yahoo chart timestamp เป็นวินาที → แปลงเป็น ms (กันกรณีบาง path ส่ง ms แล้ว)
  const toDate = (t: number) => new Date(t < 1e12 ? t * 1000 : t);
  // ตัดเดือนปัจจุบันที่ยังไม่ครบออก (เทียบเดือนของ candle สุดท้ายกับเดือนปัจจุบัน)
  const now = new Date();
  const lastDate = toDate(clean[clean.length - 1].time);
  const lastIsCurrent =
    lastDate.getFullYear() === now.getFullYear() && lastDate.getMonth() === now.getMonth();
  const series = lastIsCurrent ? clean.slice(0, -1) : clean;

  // คำนวณ return รายเดือน (จาก close เดือนก่อน)
  const rows = new Map<string, number>(); // "YYYY-MM" -> ret%
  for (let i = 1; i < series.length; i++) {
    const d = toDate(series[i].time);
    const prev = series[i - 1].close;
    rows.set(`${d.getFullYear()}-${d.getMonth()}`, (series[i].close / prev - 1) * 100);
  }
  const years = [...new Set([...rows.keys()].map((k) => Number(k.split("-")[0])))].sort();
  if (!years.length) return null;

  const monthly = years.map((y) => ({
    year: y,
    months: Array.from({ length: 12 }, (_, m) => {
      const v = rows.get(`${y}-${m}`);
      return v === undefined ? null : Math.round(v * 10) / 10;
    }),
  }));

  const avg: (number | null)[] = [];
  const posRate: (number | null)[] = [];
  for (let m = 0; m < 12; m++) {
    const vals = monthly.map((r) => r.months[m]).filter((v): v is number => v !== null);
    if (vals.length >= 2) {
      avg[m] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
      posRate[m] = Math.round((vals.filter((v) => v > 0).length / vals.length) * 100);
    } else {
      avg[m] = null;
      posRate[m] = null;
    }
  }
  const qAvg: (number | null)[] = [0, 1, 2, 3].map((q) => {
    const vals = [] as number[];
    for (let m = q * 3; m < q * 3 + 3; m++) if (avg[m] !== null) vals.push(avg[m] as number);
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
  });

  const valid = avg.map((a, m) => ({ m, a })).filter((x): x is { m: number; a: number } => x.a !== null);
  const sorted = [...valid].sort((a, b) => b.a - a.a);

  return {
    symbol,
    years,
    monthly,
    avg,
    posRate,
    qAvg,
    bestMonth: sorted.length >= 2 ? { m: sorted[0].m, avg: sorted[0].a } : null,
    worstMonth: sorted.length >= 2 ? { m: sorted[sorted.length - 1].m, avg: sorted[sorted.length - 1].a } : null,
    sampleYears: years.length,
  };
}
