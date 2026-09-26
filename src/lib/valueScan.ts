// ===== 🤿 หุ้นใต้น้ำ vs 🎈 หุ้นแพงเกินตัว — สแกนรายวันจากข้อมูลจริง =====
// ใต้น้ำพร้อมขึ้น: พื้นฐานดี (คะแนนปัจจัยจากงบจริง) + ราคาตกจากยอด 52 สัปดาห์แล้ว + สัญญาณเทคนิคเริ่มกลับตัว
// แพงเกินตัว: คะแนนมูลค่าต่ำ (แพงเทียบงบ) + ร้อนเกิน (RSI สูง/วิ่งเหนือเส้นระยะยาวมาก/แตะยอด) — ตรงข้ามกัน
import { tvUniverse, toYahooSymbol } from "./tvscanner";
import { buildAnalysis } from "./analysis";
import { getChart, getUsdThb } from "./yahoo";
import { kvGet, kvSet, hasDB } from "./storage";
import { promises as fs } from "fs";
import path from "path";

export interface ValueRow {
  symbol: string;
  name: string;
  sector: string;
  market: "US" | "TH";
  priceThb: number;
  changePct: number;
  from52wHighPct: number | null; // ต่ำกว่ายอด 52 สัปดาห์กี่ % (ติดลบ = ใต้น้ำ)
  rsi: number | null;
  overall: number; // คะแนนปัจจัยรวม /100
  valuation: number; // คะแนนความแพง /100 (สูง=ถูก)
  signal: string; // เทคนิค
  reasons: string[]; // เหตุผล 2-4 ข้อ ภาษาไทย
  score: number; // สำหรับเรียง
}

export interface ValueResult {
  asOf: string;
  undervalued: ValueRow[];
  overpriced: ValueRow[];
  scannedCount: number;
  note: string;
}

let cached: { at: number; data: ValueResult } | null = null;
const TTL = 30 * 60_000; // เหมือน Picks — คำนวณใหม่ทุก 30 นาที (ข้อมูลพื้นฐาน cache อยู่แล้ว)

// ===== บันทึกประวัติรายวัน — วันแรกที่มีคนเปิดแต่ละวันจะจด snapshot เก็บไว้ 30 วัน ย้อนดูได้ =====
const HISTORY_FILE = path.join(process.cwd(), "src/data/value-history.json");
const HISTORY_KEY = "value-history";
const HISTORY_KEEP = 30;

export interface ValueDay {
  date: string; // yyyy-mm-dd (local)
  dateTh: string;
  undervalued: ValueRow[];
  overpriced: ValueRow[];
  scannedCount: number;
}

async function readHistory(): Promise<ValueDay[]> {
  if (hasDB()) return (await kvGet<ValueDay[]>(HISTORY_KEY)) ?? [];
  try {
    const j = JSON.parse(await fs.readFile(HISTORY_FILE, "utf8")) as { days?: ValueDay[] };
    return j.days ?? [];
  } catch {
    return [];
  }
}

async function writeHistory(days: ValueDay[]) {
  if (hasDB()) {
    await kvSet(HISTORY_KEY, days);
    return;
  }
  await fs.writeFile(HISTORY_FILE, JSON.stringify({ _note: "ประวัติสแกนหุ้นใต้น้ำรายวัน (dev file — บน Vercel อยู่ใน Redis)", days }, null, 2));
}

const todayKey = () => new Date().toLocaleDateString("sv-SE"); // yyyy-mm-dd ตามเวลาท้องถิ่น

async function recordDay(data: ValueResult) {
  const day = todayKey();
  const hist = await readHistory();
  if (hist.some((h) => h.date === day)) return hist;
  const next: ValueDay[] = [
    {
      date: day,
      dateTh: new Date().toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }),
      undervalued: data.undervalued,
      overpriced: data.overpriced,
      scannedCount: data.scannedCount,
    },
    ...hist,
  ].slice(0, HISTORY_KEEP);
  await writeHistory(next);
  return next;
}

/** รายการวันที่มีบันทึก (วันใหม่สุดก่อน) */
export async function getValueHistory(): Promise<{ date: string; dateTh: string }[]> {
  return (await readHistory()).map((d) => ({ date: d.date, dateTh: d.dateTh }));
}

/** ดู snapshot ของวันใดวันหนึ่งย้อนหลัง */
export async function getValueDay(date: string): Promise<ValueDay | null> {
  return (await readHistory()).find((d) => d.date === date) ?? null;
}

interface Cand {
  sym: string;
  name: string;
  sector: string;
  market: "US" | "TH";
  mcap: number;
  changePct: number;
}

async function build(): Promise<ValueResult> {
  const [us, th, usdThb] = await Promise.all([
    tvUniverse("america", 600),
    tvUniverse("thailand", 400),
    getUsdThb().catch(() => 36),
  ]);

  const usAll: Cand[] = us
    .filter((r) => r.mcap >= 5e9 && r.symbol.length <= 4 && /^[A-Z]+$/.test(r.symbol) && r.price >= 5)
    .map((r) => ({ sym: toYahooSymbol("america", r.symbol), name: r.name, sector: r.sector || "—", market: "US" as const, mcap: r.mcap, changePct: r.changePct }));
  const thAll: Cand[] = th
    .filter((r) => r.price > 0)
    .slice(0, 60) // เอาใหญ่ก่อน (สภาพคล่อง)
    .map((r) => ({ sym: toYahooSymbol("thailand", r.symbol), name: r.name.includes("_") ? r.name.split("_").pop()! : r.name, sector: r.sector || "—", market: "TH" as const, mcap: r.mcap, changePct: r.changePct }));

  // ผู้สมัครฝั่ง "ใต้น้ำ": วันนี้ไม่วิ่งแรง — ครึ่งหนึ่งเอาตัวใหญ่สุด (สภาพคล่อง) อีกครึ่งเอาตัวที่ตกแรงสุดของวัน แล้วให้เกณฑ์ 52w/ปัจจัยกรองเอง
  const downPool = [...usAll, ...thAll].filter((r) => r.changePct <= 0.8).sort((a, b) => b.mcap - a.mcap);
  const bigDown = downPool.slice(0, 26);
  const bigSyms = new Set(bigDown.map((r) => r.sym));
  const dropDown = downPool.filter((r) => !bigSyms.has(r.sym)).sort((a, b) => a.changePct - b.changePct).slice(0, 34);
  const downSel = [...bigDown, ...dropDown];
  // ผู้สมัครฝั่ง "แพงเกิน": กำลังวิ่งแรงวันนี้ (ตัวที่ตลาดปั๊ม — เช็คว่าแพงจริงไหม)
  const upSel = [...usAll]
    .filter((r) => r.changePct >= 1.8)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 10);

  const seen = new Set<string>();
  const cands = [...downSel, ...upSel].filter((c) => (seen.has(c.sym) ? false : (seen.add(c.sym), true)));

  // วิ่งเป็นชุดๆ กันยิง Yahoo พร้อมกันเยอะเกิน (reasons/sscore เติมทีหลังตอนจัดสองฝั่ง)
  const rows: (Omit<ValueRow, "reasons" | "score"> & { from52wHigh: number | null; stretch: number | null; turning: number })[] = [];
  for (let i = 0; i < cands.length; i += 5) {
    const chunk = cands.slice(i, i + 5);
    const results = await Promise.all(
      chunk.map(async (c) => {
        try {
          const a = await buildAnalysis(c.sym);
          if (!a.factors || !isFinite(a.quote.price) || a.quote.price <= 0) return null;
          const chart = await getChart(c.sym, "1Y"); // cache เดียวกับ buildAnalysis = ฟรี
          if (chart.length < 60) return null;
          const high52 = Math.max(...chart.map((k) => k.high));
          const last = a.quote.price;
          const from52w = ((last - high52) / high52) * 100;
          const t = a.technicals;
          const rsi = t?.rsi14 ?? null;
          const sma20 = t?.sma20, sma200 = t?.sma200;
          const above20 = sma20 !== undefined && last > sma20;
          const macdPos = (t?.macd?.hist ?? 0) > 0;
          const stretch = sma200 && sma200 > 0 ? ((last - sma200) / sma200) * 100 : null;
          // สัญญาณ "กลับตัว" ของฝั่งใต้น้ำ: นับข้อที่เป็นบวก
          const turning =
            (above20 ? 1 : 0) +
            (macdPos ? 1 : 0) +
            (rsi !== null && rsi >= 40 && rsi <= 65 ? 1 : 0) +
            (sma20 !== undefined && sma200 !== undefined && sma20 > sma200 ? 1 : 0);
          return {
            symbol: a.quote.symbol,
            name: c.name,
            sector: c.sector,
            market: c.market,
            priceThb: a.quote.currency === "THB" ? a.quote.price : a.quote.price * usdThb,
            changePct: c.changePct,
            from52wHigh: Math.round(from52w * 10) / 10,
            rsi: rsi !== null ? Math.round(rsi) : null,
            overall: a.factors.overall,
            valuation: a.factors.valuation,
            signal: t ? (t.signal === "bullish" ? "เอียงบวก" : t.signal === "bearish" ? "เอียงลบ" : "เป็นกลาง") : "-",
            from52wHighPct: Math.round(from52w * 10) / 10,
            stretch: stretch !== null ? Math.round(stretch * 10) / 10 : null,
            turning,
          };
        } catch {
          return null;
        }
      })
    );
    for (const r of results) if (r) rows.push(r);
  }

  // ===== จัดสองฝั่ง =====
  // 🤿 ใต้น้ำพร้อมขึ้น: ตกจากยอด ≥8% + ปัจจัยรวมดี + มูลค่าไม่แพง + สัญญาณกลับตัว ≥2 ข้อ
  const undervalued = rows
    .filter((r) => r.from52wHigh !== null && r.from52wHigh <= -8 && r.overall >= 55 && r.valuation >= 50 && r.turning >= 2)
    .map((r) => {
      const reasons = [
        `ตกจากยอด 52 สัปดาห์ไปแล้ว ${Math.abs(r.from52wHigh!).toFixed(0)}% — ราคายัง "ใต้น้ำ"`,
        `พื้นฐานดี: คะแนนปัจจัย ${r.overall}/100 · ความแพง ${r.valuation}/100 (ยิ่งสูงยิ่งถูก)`,
      ];
      if (r.rsi !== null) reasons.push(`RSI ${r.rsi} — ออกจากขาลงสุดขั้วแล้ว`);
      if (r.stretch !== null && r.stretch < -5) reasons.push(`ยังต่ำกว่าเส้นระยะยาว SMA200 ${Math.abs(r.stretch).toFixed(0)}% — มีที่กลับขึ้น`);
      return {
        ...r,
        reasons,
        score: Math.round(r.overall * 0.4 + r.valuation * 0.3 + r.turning * 8 + Math.min(Math.abs(r.from52wHigh ?? 0), 35) * 0.4),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  // 🎈 แพงเกินตัว: ความแพงต่ำ (≤45) + ร้อนเกิน (RSI≥68 หรือวิ่งเหนือ SMA200 ≥25% หรือติดยอด) + วันนี้วิ่งแรง
  const overpriced = rows
    .filter(
      (r) =>
        r.valuation <= 45 &&
        r.changePct >= 1.2 &&
        ((r.rsi ?? 0) >= 68 || (r.stretch ?? 0) >= 25 || (r.from52wHigh ?? -100) >= -4)
    )
    .map((r) => {
      const reasons = [`วิ่งแรง +${r.changePct.toFixed(1)}% วันนี้`, `แพงเทียบงบ: คะแนนความแพง ${r.valuation}/100`];
      if (r.rsi !== null && r.rsi >= 68) reasons.push(`RSI ${r.rsi} — เข้าข่าย Overbought (ร้อนเกิน)`);
      if (r.stretch !== null && r.stretch >= 25) reasons.push(`ราคาสูงกว่าเส้น SMA200 ถึง ${r.stretch.toFixed(0)}% — ยืดตัวมาก`);
      if ((r.from52wHigh ?? -100) >= -4) reasons.push(`แตะยอด 52 สัปดาห์แล้ว (${r.from52wHigh}%)`);
      return {
        ...r,
        reasons,
        score: Math.round((50 - r.valuation) * 1.4 + Math.min((r.rsi ?? 50) - 55, 40) * 0.7 + Math.min(r.stretch ?? 0, 60) * 0.8 + Math.min(r.changePct, 8) * 2),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const clean = (r: (typeof undervalued)[number]): ValueRow => ({
    symbol: r.symbol,
    name: r.name,
    sector: r.sector,
    market: r.market,
    priceThb: r.priceThb,
    changePct: r.changePct,
    from52wHighPct: r.from52wHighPct,
    rsi: r.rsi,
    overall: r.overall,
    valuation: r.valuation,
    signal: r.signal,
    reasons: r.reasons.slice(0, 4),
    score: r.score,
  });

  return {
    asOf: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.",
    undervalued: undervalued.map(clean),
    overpriced: overpriced.map(clean),
    scannedCount: rows.length,
    note: "เกณฑ์ใต้น้ำ = ตกจากยอด 52 สัปดาห์ ≥8% + คะแนนปัจจัยจากงบจริง ≥55 + ยังไม่แพง (≥50) + สัญญาณกลับตัว ≥2 ข้อ · เกณฑ์แพงเกินตัว = คะแนนความแพง ≤45 + วิ่งแรง + RSI ร้อน/ยืดเหนือ SMA200 มาก/แตะยอด · สแกนจากหุ้นใหญ่สภาพคล่อง (US mcap ≥ $5B + ไทยตัวใหญ่) — เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน",
  };
}

export async function getValueScan(): Promise<ValueResult> {
  if (cached && Date.now() - cached.at < TTL) return cached.data;
  const data = await build();
  cached = { at: Date.now(), data };
  await recordDay(data).catch(() => {}); // จดประวัติวันนี้ (ครั้งแรกของวัน) — พังไม่ดึงฟีเจอร์หลักลง
  return data;
}
