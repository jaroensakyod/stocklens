// ===== Track Record อัตโนมัติ — ประเมินผลสัญญาณ /value จริงเมื่อครบ 14 วัน =====
// หลักคิด: "ถูกก็บอกว่าถูก ผิดก็บอกว่าผิด ไม่ลบ ไม่แก้" — สัญญาณรายวัน (🤿 ใต้น้ำ / 🎈 แพงเกินตัว)
// ถูกจด snapshot ไว้แล้วใน value-history ระบบ (cron รายคืน) จะเทียบราคาปิดวันปล่อยสัญญาณ
// กับราคาปิดล่าสุด แล้ววัด "เกิน/ตามตลาด" เทียบ benchmark (US=SPY · ไทย=SET) แบบไม่มีมนุษย์เข้าแตะ
// กติกาเปิดเผย: alpha = ผลตัวหุ้น − ผลตลาด · >+1% = ถูก · <−1% = ผิด · ช่วงกลาง = เที่ยว (ฝั่ง 🎈 กลับด้าม)
import { getChart } from "./yahoo";
import { readTrackRecord, writeTrackRecord } from "./trackRecord";
import { getAllValueDays, type ValueDay, type ValueRow } from "./valueScan";
import type { TrackRecordEntry } from "./types";

export const EVAL_DAYS = 14; // ประเมินผลสัญญาณเมื่อครบ 14 วัน (ครั้งเดียว — dedup ด้วย id)
const BENCH = { US: "SPY", TH: "^SET.BK" } as const;
const BENCH_FALLBACK_TH = "THD"; // ^SET.BK บน Yahoo เสียบ่อย (เหลือ 1 จุด) — ใช้ ETF ไทยใน NYSE แทน (คิดเป็น % จึงเทียบได้)

const dayKey = (t: number) => new Date(t * 1000).toLocaleDateString("sv-SE"); // candle epoch-sec → yyyy-mm-dd local
const parseDay = (d: string) => new Date(`${d}T00:00:00`);
const dayAge = (d: string) => Math.floor((Date.now() - parseDay(d).getTime()) / 86_400_000);
const round1 = (v: number) => Math.round(v * 10) / 10;

/** หาราคา "ปิดวันที่ต้องการ" จากกราฟ — ยอมข้ามช่วงเสาร์-อาทิตย์/หยุดยาวสุด 5 วัน (เอาแท่งล่าสุดที่ ≤ วันนั้น) */
function closeAt(candles: { time: number; close: number }[], date: string): number | null {
  const target = parseDay(date).getTime() + 86_400_000; // จบวัน (รวมแท่งของวันนั้นเอง)
  let best: { time: number; close: number } | null = null;
  for (const c of candles) {
    if (c.time * 1000 <= target && (!best || c.time > best.time)) best = c;
  }
  if (!best || target - best.time * 1000 > 5 * 86_400_000) return null; // แท่งใกล้สุดยังไกล >5 วัน = ถือว่าไม่มีข้อมูลวันนั้น
  return best.close > 0 ? best.close : null;
}

/** ผลตอบแทน benchmark ของ market นั้นช่วง date → ปัจจุบัน (จากกราฟเดียวกันทั้งสองปลาย = ปิดเทียบปิด) */
async function benchReturn(market: "US" | "TH", date: string): Promise<number | null> {
  const primary = market === "US" ? BENCH.US : BENCH.TH;
  const trySym = async (sym: string) => {
    const c = await getChart(sym, "3M").catch(() => []);
    const base = closeAt(c, date);
    const last = c.length ? c[c.length - 1].close : null;
    if (base === null || !last || last <= 0) return null;
    return (last / base - 1) * 100;
  };
  const main = await trySym(primary);
  if (main !== null) return main;
  if (market === "TH") return trySym(BENCH_FALLBACK_TH);
  return null;
}

const evalOne = async (day: ValueDay, side: "undervalued" | "overpriced", row: ValueRow): Promise<TrackRecordEntry | null> => {
  const id = `value:${day.date}:${side === "undervalued" ? "u" : "o"}:${row.symbol}`;
  const chart = await getChart(row.symbol, "3M").catch(() => []);
  // ฐาน: ราคาปิดวันปล่อยสัญญาณจากกราฟ (fallback: ราคา ณ เวลาสแกนที่จดใน snapshot — สำหรับ snapshot เก่าที่ยังไม่มี chart)
  const base = closeAt(chart, day.date) ?? row.priceLocal;
  const last = chart.length ? chart[chart.length - 1].close : null;
  if (!base || base <= 0 || !last || last <= 0) return null;
  const ret = (last / base - 1) * 100;

  const bench = await benchReturn(row.market, day.date);
  if (bench === null) return null; // ไม่มีตลาดเทียบ = ไม่ควรตัดสิน (ปีที่แล้ว เดี๋ยว cron รอบหลังลองใหม่)
  const alpha = ret - bench;

  const stance: TrackRecordEntry["stance"] = side === "undervalued" ? "bullish" : "bearish";
  // 🤿 มองบวก: ชนะ = วิ่งเกินตลาด >1% · 🎈 มองลบ: ชนะ = อ่อนกว่าตลาด >1% (ความเห็นถูก)
  const status: TrackRecordEntry["status"] =
    stance === "bullish" ? (alpha > 1 ? "win" : alpha < -1 ? "loss" : "flat") : alpha < -1 ? "win" : alpha > 1 ? "loss" : "flat";

  const head = side === "undervalued" ? `🤿 สัญญาณ "ใต้น้ำพร้อมกลับตัว"` : `🎈 สัญญาณ "แพงเกินตัว — เฝ้าระวัง"`;
  const why = row.reasons[0] ?? (row.from52wHighPct !== null ? `ตกจากยอด 52 สัปดาห์ ${Math.abs(row.from52wHighPct).toFixed(0)}%` : "ผ่านเกณฑ์สแกนของวันนั้น");
  return {
    id,
    date: day.dateTh ?? day.date,
    thesis: `${head}: ${row.name} (${row.symbol}) — ${why}`,
    tickers: [row.symbol],
    stance,
    status,
    resultPct: round1(ret),
    benchPct: round1(bench),
    source: "value",
    note: `ประเมินอัตโนมัติเมื่อครบ ${EVAL_DAYS} วัน · เทียบ${row.market === "US" ? " S&P500 (SPY)" : "ดัชนี SET"} · ราคาปิดเทียบราคาปิด ไม่หักค่าธรรมเนียม`,
  };
};

/**
 * ประเมินสัญญาณทุก snapshot ที่อายุครบ EVAL_DAYS วัน → เขียนเข้า track-record สาธารณะ (dedup ด้วย id)
 * เรียกจาก cron รายคืน — พังทั้งฟังก์ชันไม่กระทบงานอื่น (caller ใส่ .catch ไว้แล้ว)
 */
export async function resolveValueTrackRecord(): Promise<{ added: number; skipped: number }> {
  const days = await getAllValueDays();
  const existing = await readTrackRecord();
  const have = new Set(existing.map((e) => e.id));
  const due = days.filter((d) => dayAge(d.date) >= EVAL_DAYS);
  const fresh: TrackRecordEntry[] = [];
  let skipped = 0;

  for (const day of due) {
    for (const side of ["undervalued", "overpriced"] as const) {
      for (const row of day[side]) {
        const id = `value:${day.date}:${side === "undervalued" ? "u" : "o"}:${row.symbol}`;
        if (have.has(id)) continue; // ประเมินไปแล้ว — ไม่ re-evaluate (ตัวเลขเดิมอยู่คู่กับ entry)
        const entry = await evalOne(day, side, row).catch(() => null);
        if (entry) {
          fresh.push(entry);
          have.add(id);
        } else skipped++;
      }
    }
  }

  if (fresh.length) {
    // ใหม่สุด (เพิ่งประเมิน) ขึ้นก่อน — รายการมือเดิมคงไว้ท้าย
    fresh.sort((a, b) => b.id.localeCompare(a.id));
    await writeTrackRecord([...fresh, ...existing]);
  }
  return { added: fresh.length, skipped };
}

/** สถานะสัญญาณที่ยังรอวันประเมิน — ให้หน้า /track-record บอกผู้ใช้ตรงๆ ว่ากล้องกำลังอัดอะไรอยู่ */
export async function valueTrackMeta(): Promise<{
  watchingSignals: number;
  watchingDays: number;
  nextEvalDateTh?: string;
  firstSignalDateTh?: string;
}> {
  const days = await getAllValueDays();
  if (!days.length) return { watchingSignals: 0, watchingDays: 0 };
  const pending = days.filter((d) => dayAge(d.date) < EVAL_DAYS);
  const sortedDates = days.map((d) => d.date).sort();
  const first = sortedDates[0];
  const nextEval = pending.length ? pending.map((d) => d.date).sort()[0] : null;
  const evalDate = nextEval ? parseDay(nextEval).getTime() + EVAL_DAYS * 86_400_000 : parseDay(first).getTime() + EVAL_DAYS * 86_400_000;
  return {
    watchingSignals: pending.reduce((a, d) => a + d.undervalued.length + d.overpriced.length, 0),
    watchingDays: pending.length,
    nextEvalDateTh: new Date(evalDate).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }),
    firstSignalDateTh: parseDay(first).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }),
  };
}
