// ===== ปฏิทินงบรายไตรมาส (สหรัฐฯ) =====
// วันแถลงผลถัดไป + คอนเซนซัส EPS/รายได้ ของหุ้น US ยอดนิยม ~170 ตัว
// ที่มา: Yahoo quoteSummary(earningsTrend) ผ่าน crumb — ทางเดียวกับที่ AnalystPanel ใช้อยู่แล้ว
// แคช: ทั้งชุด 6 ชม. ใน Redis (ข้าม cold-start) · ต่อตัว 6 ชม. ใน memory

import { getQuoteSummaryModule, getQuotes } from "./yahoo";
import { cached, getCached, setCached } from "./yahoo";
import universeJson from "@/data/earnings-universe.json";

export interface EarningsRow {
  ticker: string;
  name: string;
  ts: number; // เวลาแถลงโดยประมาณ (unix ms — Yahoo ให้ระดับวัน)
  dateIso: string;
  epsEst?: number; // คอนเซนซัส EPS ไตรมาสนี้ (USD)
  revEst?: number; // คอนเซนซัสรายได้ไตรมาสนี้ (USD)
  growth?: number; // เติบโต EPS ทั้งปีบัญชีที่คาด (0.12 = +12%)
  dateEstimated?: boolean; // Yahoo บอกว่าเป็นวันที่โดยประมาณ
  price?: number;
  changePct?: number;
}

const UNIVERSE = (universeJson as { tickers: { t: string; n: string }[] }).tickers;

interface RawNum { raw?: number }
interface CalEvents {
  calendarEvents?: {
    earnings?: {
      earningsDate?: RawNum[];
      isEarningsDateEstimate?: boolean;
      earningsAverage?: RawNum;
      revenueAverage?: RawNum;
    };
  };
  earningsTrend?: { trend?: { period?: string; growth?: RawNum }[] };
}

async function nextEarningsOf(ticker: string): Promise<Omit<EarningsRow, "ticker" | "name"> | null> {
  const mkey = "ec:t:" + ticker;
  type Cached = Omit<EarningsRow, "ticker" | "name">;
  const hit = getCached<Cached>(mkey, 6 * 3600_000);
  if (hit !== undefined) return hit;
  const r = await getQuoteSummaryModule<CalEvents>(ticker, "calendarEvents,earningsTrend");
  const e = r?.calendarEvents?.earnings;
  const raw = e?.earningsDate?.[0]?.raw;
  if (!raw || !isFinite(raw)) return null; // ไม่มีวันงบ = ไม่เก็บ cache รอรอบหน้า
  const out: Cached = {
    ts: raw * 1000,
    dateIso: new Date(raw * 1000).toISOString().slice(0, 10),
    epsEst: e?.earningsAverage?.raw,
    revEst: e?.revenueAverage?.raw,
    growth: r?.earningsTrend?.trend?.find((x) => x.period === "0y")?.growth?.raw,
    dateEstimated: !!e?.isEarningsDateEstimate,
  };
  setCached(mkey, out);
  return out;
}

/** ทำงานทีละก้อนพร้อมกัน (จำกัด concurrency กันยิง Yahoo รัว) */
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function getEarningsCalendar(days = 35): Promise<EarningsRow[]> {
  const toTs = Date.now() + days * 86400e3;
  const base = await cached<EarningsRow[]>("ecal:v3", 6 * 3600_000, async () => {
    const infos = await mapLimit(UNIVERSE, 8, (u) => nextEarningsOf(u.t).then((r) => ({ u, r })));
    const rows: EarningsRow[] = [];
    for (const { u, r } of infos) {
      if (!r) continue;
      rows.push({
        ticker: u.t,
        name: u.n,
        ts: r.ts,
        dateIso: r.dateIso,
        epsEst: r.epsEst,
        revEst: r.revEst,
        growth: r.growth,
        dateEstimated: r.dateEstimated,
      });
    }
    rows.sort((a, b) => a.ts - b.ts);
    return rows;
  });
  if (!base) return [];
  const inRange = base.filter((r) => r.ts >= Date.now() - 2 * 86400e3 && r.ts <= toTs);
  // ราคา/เปลี่ยนแปลงวันนี้ — ดึงสดแยก (แคชราคา 1 นาทีในตัว getQuotes) ไม่ฝังในแคช 6 ชม.
  if (inRange.length) {
    const qs = await getQuotes(inRange.map((r) => r.ticker));
    for (const r of inRange) {
      const q = qs[r.ticker];
      if (q && isFinite(q.price)) {
        r.price = q.price;
        r.changePct = q.changePct;
      }
    }
  }
  return inRange;
}
