// ===== ปฏิทินเศรษฐกิจ — รวม 2 ชั้นข้อมูล =====
// ชั้น 1 (สด): ForexFactory weekly JSON ฟรี — เหตุการณ์สัปดาห์นี้+หน้า พร้อมพยากรณ์/ตัวเลขจริง/ก่อนหน้า
// ชั้น 2 (curated): ตารางเหตุการณ์หลักที่เรา generate เอง (NFP/CPI/PCE/FOMC ฯลฯ) เติมช่วงที่ชั้น 1 ไม่ครอบ
// เวลาที่แสดงทั้งหมด = เวลาไทย (ICT) — แปลงจาก ET ด้วยกฎ DST สหรัฐฯ อัตโนมัติ

import { cached } from "./yahoo";

export interface EconEvent {
  id: string;
  title: string; // ไทย (ถ้าแปลได้)
  titleEn?: string; // ต้นฉบับ
  country: string; // USD | EUR | GBP | JPY | CNY | TH | ...
  flag: string;
  ts: number; // unix ms
  impact: 0 | 1 | 2 | 3; // 0=วันหยุดตลาด 1=เบา 2=กลาง 3=หนัก
  forecast?: string;
  previous?: string;
  actual?: string;
  approx?: boolean; // true = วันที่ประมาณจากรอบปกติ (~)
  source: "live" | "curated";
}

const FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", CNY: "🇨🇳", AUD: "🇦🇺", CAD: "🇨🇦", CHF: "🇨🇭", NZD: "🇳🇿", TH: "🇹🇭",
};

// ---------- แปลชื่อเหตุการณ์อังกฤษ → ไทย (เรียงตามลำดับจับคู่: เฉพาะเจาะจงก่อนกว้าง) ----------
const TITLE_MAP: [RegExp, string][] = [
  [/meeting minutes|minutes of/i, "รายงานการประชุมนโยบายฉบับเต็ม (Minutes)"],
  [/(speaks?|speech|testif|press conference)/i, "ปราศรัยสมาชิกคณะกรรมการนโยบาย"],
  [/non-?farm|nfp/i, "ค่าจ้างนอกภาคเกษตร (NFP)"],
  [/unemployment rate/i, "อัตราว่างงาน"],
  [/unemployment claims|initial jobless|continuing claims/i, "ยื่นสวัสดิการว่างงาน (รายสัปดาห์)"],
  [/core cpi/i, "เงินเฟ้อแกนกลาง CPI"],
  [/cpi/i, "เงินเฟ้อ CPI"],
  [/core pce/i, "PCE แกนกลาง (เป้าหมายเงินเฟ้อของ Fed)"],
  [/\bpce\b/i, "PCE ราคาผู้บริโภค"],
  [/\bppi\b|producer price/i, "PPI ราคาผู้ผลิต"],
  [/fomc|federal funds rate|interest rate decision/i, "FOMC ตัดสินดอกเบี้ยสหรัฐฯ"],
  [/retail sales/i, "ยอดขายปลีกรายเดือน"],
  [/\bgdp\b/i, "GDP (ผลผลิตรวมประเทศ)"],
  [/ism manufacturing/i, "ISM ภาคการผลิต PMI"],
  [/ism services/i, "ISM ภาคบริการ PMI"],
  [/jolts/i, "ตำแหน่งงานเปิดรับ JOLTS"],
  [/\badp\b/i, "จ้างงานภาคเอกชน ADP"],
  [/consumer sentiment|uom/i, "ความเชื่อมั่นผู้บริโภค (UoM)"],
  [/durable goods/i, "สั่งซื้อสินค้าทนทาน"],
  [/housing starts/i, "เริ่มก่อสร้างบ้าน"],
  [/building permits/i, "ใบอนุญาตก่อสร้าง"],
  [/existing home sales/i, "ยอดขายบ้านมือสอง"],
  [/new home sales/i, "ยอดขายบ้านใหม่"],
  [/crude oil inventories/i, "สต็อกน้ำมันดิบสหรัฐฯ"],
  [/natural gas storage/i, "สต็อกก๊าซธรรมชาติ"],
  [/manufacturing pm/i, "PMI ภาคการผลิต"],
  [/services pm/i, "PMI ภาคบริการ"],
  [/bank rate|official bank rate/i, "ดอกเบี้ยธนาคารกลางอังกฤษ (BoE)"],
  [/\becb\b|main refinancing/i, "ดอกเบี้ย ECB (ยูโรโซน)"],
  [/\bboj\b|policy rate.*japan/i, "ดอกเบี้ย BOJ (ญี่ปุ่น)"],
  [/\brba\b|cash rate/i, "ดอกเบี้ยธนาคารกลางออสเตรเลีย (RBA)"],
  [/trade balance/i, "ดุลการค้า"],
  [/industrial production/i, "ผลผลิตภาคอุตสาหกรรม"],
];
function thTitle(t: string): { th: string; en: string } {
  for (const [re, th] of TITLE_MAP) if (re.test(t)) return { th, en: t };
  return { th: t, en: t };
}

// ---------- ชั้น 1: ForexFactory (สัปดาห์นี้ + สัปดาห์หน้า) ----------
interface FFItem { title?: string; country?: string; date?: string; impact?: string; forecast?: string; previous?: string }
async function fetchFFLive(): Promise<EconEvent[] | null> {
  const grab = (url: string) =>
    fetch(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(9_000) })
      .then(async (r) => (r.ok ? ((await r.json()) as FFItem[]) : null))
      .catch(() => null);
  const [a, b] = await Promise.all([
    grab("https://nfs.faireconomy.media/ff_calendar_thisweek.json"),
    grab("https://nfs.faireconomy.media/ff_calendar_nextweek.json"),
  ]);
  const raw = [...(a ?? []), ...(b ?? [])];
  if (!a && !b) return null; // ต้นทางพังทั้งคู่ → ไม่ถือว่า "ไม่มีข้อมูล" แต่ให้ fallback curated เต็มตัว
  const impactMap: Record<string, 0 | 1 | 2 | 3> = { High: 3, Medium: 2, Low: 1, Holiday: 0 };
  const out: EconEvent[] = [];
  for (const it of raw) {
    const ts = it.date ? new Date(it.date).getTime() : NaN;
    if (!isFinite(ts) || !it.title || !it.country) continue;
    const { th, en } = thTitle(it.title);
    const impact = impactMap[it.impact ?? ""] ?? 1;
    out.push({
      id: `ff:${ts}:${en}`,
      title: th,
      titleEn: en,
      country: it.country,
      flag: FLAGS[it.country] ?? "🌐",
      ts,
      impact,
      forecast: it.forecast || undefined,
      previous: it.previous || undefined,
      source: "live",
    });
  }
  return out;
}

// ---------- ชั้น 2: curated — เหตุการณ์หลักที่รอบมาตรฐานคาดเดาได้ ----------
// (FOMC ใช้ตารางประชุมทางการ ส่วน CPI/NFP ฯลฯ ใช้รอบประจำ → ติดป้าย ~ ให้ผู้ใช้รู้ว่าเป็นการประมาณ)

/** offset ของเวลาตะวันออก (ET) เทียบ UTC ตามกฎ DST สหรัฐฯ (อา.2 มี.ค. → อา.1 พ.ย.) */
function etOffsetHours(ts: number): number {
  const y = new Date(ts).getUTCFullYear();
  const nthSunday = (month: number, n: number) => {
    const d = new Date(Date.UTC(y, month, 1));
    let count = 0;
    while (true) {
      if (d.getUTCDay() === 0 && ++count === n) return d.getTime();
      d.setUTCDate(d.getUTCDate() + 1);
    }
  };
  const dstStart = nthSunday(2, 2) + 7 * 3600e3; // 02:00 EST = 07:00 UTC
  const dstEnd = nthSunday(10, 1) + 6 * 3600e3; // 02:00 EDT = 06:00 UTC
  return ts >= dstStart && ts < dstEnd ? -4 : -5;
}
/** สร้าง timestamp จากเวลา ET (ปี เดือน(0b) วัน ชั่วโมง นาที) */
function etTs(y: number, m: number, d: number, hh = 8, mm = 30): number {
  const guess = Date.UTC(y, m, d, hh + 5, mm); // เดาด้วย EST ก่อน แล้วแก้ด้วย offset จริง
  const off = etOffsetHours(guess);
  return Date.UTC(y, m, d, hh - off, mm);
}
const pad = (n: number) => String(n).padStart(2, "0");
/** ปรับวันที่ (ข้ามเสาร์อาทิตย์ ไปหา weekday ถัดไป) */
function toWeekday(y: number, m: number, d: number): [number, number, number] {
  const dt = new Date(Date.UTC(y, m, d));
  while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) dt.setUTCDate(dt.getUTCDate() + 1);
  return [dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()];
}
const nthFriday = (y: number, m: number, n: number) => {
  const dt = new Date(Date.UTC(y, m, 1));
  let c = 0;
  while (true) {
    if (dt.getUTCDay() === 5 && ++c === n) return [dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()] as [number, number, number];
    dt.setUTCDate(dt.getUTCDate() + 1);
  }
};

// FOMC = วันแถลง (วันที่ 2 ของการประชุม 2 วัน) 14:00 ET — ตารางทางการที่ Fed ประกาศล่วงหน้าทั้งปี
const FOMC_DAYS: [number, number, number][] = [
  [2026, 9, 28], [2026, 11, 9], // ต.ค. 27-28 · ธ.ค. 8-9
  [2027, 0, 27], [2027, 2, 17], [2027, 3, 28], [2027, 5, 16], [2027, 6, 28], [2027, 8, 15], [2027, 9, 20], [2027, 11, 7],
];

function genCurated(fromTs: number, toTs: number): EconEvent[] {
  const out: EconEvent[] = [];
  const push = (y: number, m: number, d: number, hh: number, mm: number, impact: 0 | 1 | 2 | 3, title: string, country = "USD", approx = true) => {
    // เหตุการณ์ไทยรับเวลาไทยตรงๆ (UTC+7) · สหรัฐฯ แปลงจาก ET ด้วยกฎ DST
    const ts = country === "TH" ? Date.UTC(y, m, d, hh, mm) : etTs(y, m, d, hh, mm);
    if (ts < fromTs || ts > toTs) return;
    out.push({
      id: `cur:${ts}:${title}`,
      title,
      country,
      flag: FLAGS[country] ?? "🌐",
      ts,
      impact,
      approx,
      source: "curated",
    });
  };

  const start = new Date(fromTs - 3 * 86400e3);
  const end = new Date(toTs);
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth();
    // NFP: ศุกร์แรกของเดือน 8:30 ET
    const [fy, fm, fd] = nthFriday(y, m, 1);
    push(fy, fm, fd, 8, 30, 3, "ค่าจ้างนอกภาคเกษตร (NFP) + อัตราว่างงาน");
    // ยื่นสวัสดิการทุกวันพฤหัส 8:30 ET
    {
      const d = new Date(Date.UTC(y, m, 1));
      while (d.getUTCMonth() === m) {
        if (d.getUTCDay() === 4) push(y, m, d.getUTCDate(), 8, 30, 2, "ยื่นสวัสดิการว่างงาน (รายสัปดาห์)");
        d.setUTCDate(d.getUTCDate() + 1);
      }
    }
    // CPI ~12 · PPI ~14 · ปลีก ~16 · GDP ~28 (ปรับเป็นวันธรรมดา)
    push(...toWeekday(y, m, 12), 8, 30, 3, "~ CPI เงินเฟ้อรายเดือน");
    push(...toWeekday(y, m, 14), 8, 30, 2, "~ PPI ราคาผู้ผลิต");
    push(...toWeekday(y, m, 16), 8, 30, 2, "~ ยอดขายปลีกรายเดือน");
    push(...toWeekday(y, m, 28), 8, 30, 2, "~ GDP (รอบประมาณการ)");
    // PCE แกนกลาง: สิ้นเดือน (วันสุดท้ายของเดือน ปรับ weekday)
    {
      const last = new Date(Date.UTC(y, m + 1, 0));
      const [py, pm, pd] = toWeekday(y, m, Math.max(1, last.getUTCDate() - 1));
      push(py, pm, pd, 8, 30, 3, "~ PCE แกนกลาง (ตัวชี้เป้าหมายเงินเฟ้อของ Fed)");
    }
    // ISM PMI: วันธรรมดาแรก 10:00 ET
    push(...toWeekday(y, m, 1), 10, 0, 2, "~ ISM Manufacturing PMI");
    // ไทย: CPI ~วันที่ 5 (ประมาณ) 09:30 ไทย
    push(y, m, 5, 2, 30, 2, "~ ดัชนีราคาผู้บริโภคไทย (CPI ไทย)", "TH");
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  // FOMC (ตารางทางการ — ไม่ติด ~)
  for (const [y, m, d] of FOMC_DAYS) push(y, m, d, 14, 0, 3, "FOMC ตัดสินดอกเบี้ย + แถลงการณ์", "USD", false);
  return out;
}

// ---------- รวมทั้งสองชั้น ----------
export interface CalendarResult {
  events: EconEvent[];
  live: boolean; // true = มีข้อมูลสดจาก ForexFactory
}
export async function getEconCalendar(days = 14): Promise<CalendarResult> {
  const now = Date.now();
  const toTs = now + days * 86400e3;
  const live = (await cached<EconEvent[] | null>("ffcal:v2", 10 * 60_000, fetchFFLive)) ?? null;
  const curated = genCurated(now, toTs);
  let events: EconEvent[];
  if (live && live.length) {
    // ในหน้าต่างที่ข้อมูลสดครอบ (สัปดาห์นี้+หน้า) → ใช้สดเป็นหลัก ตัด curated ที่ซ้ำช่วงออก
    const tss = live.map((e) => e.ts);
    const lo = Math.min(...tss) - 6 * 3600e3;
    const hi = Math.max(...tss) + 6 * 3600e3;
    events = [...live, ...curated.filter((e) => e.ts < lo || e.ts > hi)];
  } else {
    events = curated;
  }
  // เริ่มนับตั้งแต่ 00:00 ของวันนี้ (เวลาไทย) — ยังโชว์ของวันนี้ที่ผ่านไปแล้วให้เห็นตัวเลขจริง
  const startOfDayIct = now - ((now + 7 * 3600e3) % 86400e3);
  events = events.filter((e) => e.ts >= startOfDayIct - 6 * 3600e3 && e.ts <= toTs);
  events.sort((a, b) => a.ts - b.ts);
  return { events, live: !!(live && live.length) };
}

/** สำหรับการ์ดหน้าแรก — เหตุการณ์สำคัญถัดไป (≥2 ดาว) ในรูปเดิมของ dashboard */
export async function getUpcomingEvents(count = 4): Promise<{ date: string; label: string; impact: string; star: number }[]> {
  const { events } = await getEconCalendar(21);
  const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const thDays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  // dedupe: เหตุการณ์ต่างชื่ออังกฤษแต่แปลไทยแล้วซ้ำ + วันเดียวกัน (เช่น Cash Rate + Rate Statement) โชว์แค่ครั้งเดียว
  const seen = new Set<string>();
  const uniq = events.filter((e) => {
    if (e.impact < 2 || e.ts <= Date.now() - 3600e3) return false;
    const d = new Date(e.ts + 7 * 3600e3);
    const k = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}:${e.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return uniq
    .slice(0, count)
    .map((e) => {
      const d = new Date(e.ts + 7 * 3600e3); // แสดงเป็นเวลาไทย
      const date = `${thDays[d.getUTCDay()]} ${d.getUTCDate()} ${thMonths[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} น.`;
      return { date, label: `${e.flag} ${e.title}${e.approx ? " (~)" : ""}`, impact: `${e.country} · เวลาไทย`, star: e.impact };
    });
}
