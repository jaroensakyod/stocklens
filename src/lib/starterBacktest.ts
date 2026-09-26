// ===== 🕰️ ไทม์แมชชีนของพอร์ตมือใหม่ — "ถ้าเริ่มถือชุดนี้เมื่อ N ปีก่อน วันนี้จะมีเท่าไหร่" =====
// วิธีคำนวณ (โปร่งใส ตรวจสอบได้): ดึงกราฟราคาจริง 10 ปีของทุกตำแหน่ง → จำลองพอร์ตน้ำหนักคงที่ตามตารางของวันนี้
// · วันเริ่ม = แท่งแรกของสินทรัพย์ที่มีประวัติยาวสุดในพอร์ต · ตัวที่ยังไม่มีข้อมูลในวันใด = ถือเป็นเงินสด (น้ำหนักคูณ 1.0)
//   พอมีข้อมูลแล้วซื้อจากราคาแท่งแรกที่มี — ไม่มีการแอบดูอนาคต · เทียบ S&P500 (SPY) แบบเดียวกัน
// · ตัวเลขเป็น "ราคาล้วน" ไม่รวมปันผล/ค่าธรรมเนียม · ตำแหน่งที่หมุนรายวัน (หุ้นน่าสนใจวันนี้/กูรู) คือชุดของ "วันนี้"
//   ผลย้อนหลังจึงเป็นภาพ "ถ้าถือชุดนี้ต่อเนื่อง" ไม่ใช่ผลของการหมุนจริงย้อนหลัง
import { getChart } from "./yahoo";

export interface StarterBtPosition {
  symbol: string;
  weight: number; // % ของงบ (ไม่รวมเงินสด)
  kind?: string; // ชนิดตำแหน่ง — ใช้แยก "ส่วนตั้งฐาน" ออกจากตัวที่หมุนรายวัน
}

/** ชนิดที่ "ตั้งฐาน" ย้อนหลังได้อย่างซื่อสัตย์ = เฉพาะสัญลักษณ์คงที่ (ETF ดัชนี/ทอง) ที่ไม่ได้ถูกคัดจากผลวิ่งของวันนี้
 *  ตัวอื่นทั้งหมด (หุ้นน่าสนใจวันนี้/หุ้นซิ่ง/ตามรอยกูรู/ปันผล/โตต่อเนื่อง) ล้วนถูกระบบคัด "วันนี้" จากอันดับผลงานย้อนหลัง
 *  การเอาย้อนไปคำนวณจึงได้ผลเกินจริงเสมอ (survivorship bias) — ตัดออกแล้วบอกผู้ใช้ตรงๆ ดีกว่า */
const CORE_KINDS = new Set(["etf", "commodity"]);
const KIND_TH: Record<string, string> = {
  momentum: "หุ้นน่าสนใจวันนี้",
  surge: "หุ้นซิ่ง",
  guru: "ตามรอยกูรู",
  dividend: "หุ้นปันผลที่คัดของวันนี้",
  growth: "หุ้นโตต่อเนื่องที่คัดของวันนี้",
};

export interface StarterBtMark {
  label: string; // "5 ปี"
  years: number;
  available: boolean;
  mult: number | null; // งบ 1 บาท → กี่บาท
  cagrPct: number | null;
  spyMult: number | null;
  spyCagrPct: number | null;
}

export interface StarterBtResult {
  asOf: string;
  windowYears: number; // ความยาว curve ที่ทำได้จริง (อาจ < 10)
  windowStartTh: string;
  coreSharePct: number; // ส่วนตั้งฐานกินกี่ % ของงบทั้งพอร์ต (ก่อน renormalize)
  rotating: { symbol: string; kindTh: string }[]; // ตัวที่ถูกตัดออกเพราะย้อนหลังไม่ซื่อสัตย์ (คัดจากผลวิ่งของวันนี้)
  curve: { t: number; v: number; spy: number }[]; // v/spy = มูลค่าต่อทุน 1 บาท (curve[0] = 1)
  marks: StarterBtMark[]; // 1/3/5/10 ปี (available=false ถ้าข้อมูลไม่ถึง)
  mddPct: number;
  spyMddPct: number;
  lateStart: { symbol: string; firstDateTh: string; weight: number }[]; // ตัวที่ขึ้นจริงหลังวันเริ่ม (ก่อนหน้านั้น = เงินสด)
  failed: string[];
  note: string;
}

const MARK_YEARS: { label: string; years: number }[] = [
  { label: "1 ปี", years: 1 },
  { label: "3 ปี", years: 3 },
  { label: "5 ปี", years: 5 },
  { label: "10 ปี", years: 10 },
];

const closeAtOrBefore = (c: { time: number; close: number }[], t: number): number | null => {
  let best: { time: number; close: number } | null = null;
  for (const k of c) {
    if (k.time <= t && (!best || k.time > best.time)) best = k;
  }
  return best && best.close > 0 ? best.close : null;
};

const mddOf = (series: number[]): number => {
  let peak = series[0] ?? 1;
  let mdd = 0;
  for (const v of series) {
    if (v > peak) peak = v;
    const dd = (v / peak - 1) * 100;
    if (dd < mdd) mdd = dd;
  }
  return Math.round(mdd * 10) / 10;
};

export async function runStarterBacktest(positions: StarterBtPosition[]): Promise<StarterBtResult> {
  const clean = positions.filter((p) => p.symbol && p.weight > 0);
  if (!clean.length) throw new Error("no positions");
  // แยกส่วนตั้งฐานออกจากตัวหมุนรายวันก่อน — ย้อนหลังเฉพาะส่วนที่ซื่อสัตย์
  const core = clean.filter((p) => !p.kind || CORE_KINDS.has(p.kind));
  const rot = clean.filter((p) => p.kind && !CORE_KINDS.has(p.kind));
  if (!core.length) throw new Error("no core positions");
  const totalW = clean.reduce((a, p) => a + p.weight, 0) || 1;
  const coreSharePct = Math.round((core.reduce((a, p) => a + p.weight, 0) / totalW) * 1000) / 10;
  const rotating = rot.map((p) => ({ symbol: p.symbol.toUpperCase(), kindTh: KIND_TH[p.kind!] ?? p.kind ?? "" }));
  const wSum = core.reduce((a, p) => a + p.weight, 0) || 1;
  const norm = core.map((p) => ({ symbol: p.symbol.toUpperCase(), w: p.weight / wSum }));

  const charts = new Map<string, { time: number; close: number }[]>();
  const failed: string[] = [];
  await Promise.all(
    norm.map(async (p) => {
      const c = await getChart(p.symbol, "10YD").catch(() => []);
      if (c.length > 50) charts.set(p.symbol, c.map((k) => ({ time: k.time, close: k.close })));
      else failed.push(p.symbol);
    })
  );
  const usable = norm.filter((p) => charts.has(p.symbol));
  if (!usable.length) throw new Error("no chart data");
  const wUsable = usable.reduce((a, p) => a + p.w, 0) || 1;

  const spy = await getChart("SPY", "10YD")
    .then((c) => c.map((k) => ({ time: k.time, close: k.close })))
    .catch(() => [] as { time: number; close: number }[]);

  // anchor = สินทรัพย์ที่มีประวัติยาวสุด — เป็นแกนเวลาของ curve
  const anchorSym = [...usable].sort((a, b) => {
    const at = charts.get(a.symbol)![0].time;
    const bt = charts.get(b.symbol)![0].time;
    return at - bt; // เริ่มเร็วสุด (time น้อยสุด) มาก่อน
  })[0];
  const anchor = charts.get(anchorSym.symbol)!;
  const startT = anchor[0].time;
  const startTh = new Date(startT * 1000).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });

  // ราคา "แท่งแรกที่มี" ของแต่ละตัว = ราคาที่ซื้อตอนเข้าพอร์ต (ก่อนหน้านั้นถือเงินสด)
  const entry = new Map<string, { t: number; px: number }>();
  for (const p of usable) {
    const c = charts.get(p.symbol)!;
    const first = c[0];
    entry.set(p.symbol, { t: first.time, px: first.close });
  }
  const spyEntry = spy.length ? spy[0] : null;

  // เลือกสุ่มรายสัปดาห์ (ทุก 5 แท่ง) ให้ curve เบาแต่ MDD ยังใกล้จริง
  const sampled: { t: number; v: number; spy: number }[] = [];
  for (let i = 0; i < anchor.length; i += 5) {
    const t = anchor[i].time;
    let v = 0;
    for (const p of usable) {
      const e = entry.get(p.symbol)!;
      if (t < e.t) {
        v += (p.w / wUsable) * 1.0; // ยังไม่มีข้อมูล = เงินสด
      } else {
        const px = closeAtOrBefore(charts.get(p.symbol)!, t);
        v += (p.w / wUsable) * (px && e.px > 0 ? px / e.px : 1);
      }
    }
    let sv = 1;
    if (spyEntry && t >= spyEntry.time) {
      const px = closeAtOrBefore(spy, t);
      if (px && spyEntry.close > 0) sv = px / spyEntry.close;
    }
    sampled.push({ t, v, spy: sv });
  }
  const lastAnchor = anchor[anchor.length - 1];
  sampled.push({ t: lastAnchor.time, v: sampled.length ? sampled[sampled.length - 1].v : 1, spy: sampled.length ? sampled[sampled.length - 1].spy : 1 });
  // เติมจุดสุดท้ายให้เป็นราคาล่าสุดจริงของทุกตัว (ไม่ใช่แค่ anchor ตัวเดียว)
  {
    const t = lastAnchor.time;
    let v = 0;
    for (const p of usable) {
      const e = entry.get(p.symbol)!;
      const px = closeAtOrBefore(charts.get(p.symbol)!, t + 86_400);
      v += (p.w / wUsable) * (px && e.px > 0 && t >= e.t ? px / e.px : 1);
    }
    let sv = 1;
    if (spyEntry) {
      const px = closeAtOrBefore(spy, t + 86_400);
      if (px && spyEntry.close > 0) sv = px / spyEntry.close;
    }
    sampled[sampled.length - 1] = { t, v, spy: sv };
  }

  const now = sampled[sampled.length - 1];
  const marks: StarterBtMark[] = MARK_YEARS.map((m) => {
    const target = now.t - m.years * 365.25 * 86_400;
    const idx = sampled.findIndex((s) => s.t >= target);
    if (idx <= 0) return { ...m, available: false, mult: null, cagrPct: null, spyMult: null, spyCagrPct: null };
    const at = sampled[idx - 1].t >= target - 7 * 86_400 ? idx - 1 : idx; // จุดใกล้สุด (เสาร์-อาทิตย์ยอมข้าม)
    const base = sampled[at];
    const mult = now.v / (base.v || 1);
    const spyMult = now.spy / (base.spy || 1);
    return {
      ...m,
      available: true,
      mult: Math.round(mult * 1000) / 1000,
      cagrPct: Math.round((mult ** (1 / m.years) - 1) * 1000) / 10,
      spyMult: Math.round(spyMult * 1000) / 1000,
      spyCagrPct: Math.round((spyMult ** (1 / m.years) - 1) * 1000) / 10,
    };
  });

  const lateStart = usable
    .filter((p) => entry.get(p.symbol)!.t > startT + 30 * 86_400)
    .map((p) => ({
      symbol: p.symbol,
      weight: Math.round((p.w / wUsable) * 1000) / 10,
      firstDateTh: new Date(entry.get(p.symbol)!.t * 1000).toLocaleDateString("th-TH", { year: "numeric", month: "short" }),
    }));

  const windowYears = Math.round(((now.t - startT) / (365.25 * 86_400)) * 10) / 10;

  return {
    asOf: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.",
    windowYears,
    windowStartTh: startTh,
    coreSharePct,
    rotating,
    curve: sampled,
    marks,
    mddPct: mddOf(sampled.map((s) => s.v)),
    spyMddPct: mddOf(sampled.map((s) => s.spy)),
    lateStart,
    failed,
    note: "ย้อนหลังเฉพาะ 'ส่วนตั้งฐาน' ของพอร์ต (กองทุนดัชนี/ทอง — สัญลักษณ์คงที่) จากราคาจริง ราคาล้วน ไม่รวมปันผล/ค่าธรรมเนียม · ตัวที่เหลือ (หุ้นน่าสนใจวันนี้/หุ้นซิ่ง/ตามรอยกูรู/ปันผล/โตต่อเนื่อง) ถูกตัดออก เพราะทุกตัวถูกระบบคัด 'วันนี้' จากอันดับผลงานย้อนหลัง — ถ้าย้อนไปคำนวณจะได้ผลเกินจริงเสมอ (survivorship bias) · ตัวที่ยังไม่มีข้อมูลช่วงแรกถือเป็นเงินสดแล้วซื้อเมื่อมีข้อมูล · อดีตไม่รับประกันอนาคต",
  };
}
