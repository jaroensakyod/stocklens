// ===== 🛠️ ปรับพอร์ตเอง — มือใหม่เลือกสัดส่วนตลาด / จำนวนตัว / ธีม / เกรด / หุ้นซิ่ง =====
// หลักการเดียวกับ starterPortfolio: ประกอบจากเครื่องยนต์ข้อมูลจริงของวัน (universe / set-watchlist /
// หุ้นปันผล / Daily Picks / เรดาร์หุ้นซิ่ง / คะแนน StockLens) — ตัวอย่างเพื่อการเรียนรู้ ไม่ใช่คำแนะนำการลงทุน
// เรื่องสกุลเงิน: ทุกอย่างนอกไทยเป็น USD ทั้งหมด (ETF ประเทศ + ADR ที่จดทะเบียนเมกา) จึงใช้ท่อราคา/พอร์ต/ย้อนหลังเดิมได้
import { getQuotes, getUsdThb, getChart, cached } from "./yahoo";
import { getPicks } from "./picks";
import { getSurge } from "./surge";
import { getLongterm, type LTRow } from "./longterm";
import { computeScore } from "./score";
import { statsOf } from "./starterPortfolio";
import type { StarterPosition, StarterProfile } from "./starterPortfolio";
import type { Quote } from "./types";
import { CUSTOM_THEMES, INTL_REGIONS, type StarterCustomOptions, type ThemeDef } from "./customThemes";
import universe from "@/data/universe.json";
import setWatch from "@/data/set-watchlist.json";

export { CUSTOM_THEMES, INTL_REGIONS };
export type { StarterCustomOptions };

export interface StarterCustomResult {
  asOf: string;
  profile: StarterProfile;
  notes: string[]; // หมายเหตุความจริง (ธีมไม่มีของในตลาดนั้น / ผ่อนเกณฑ์เกรด / ความเสี่ยงซิ่ง)
  ai?: StarterAIInfo; // มีเมื่อสร้างผ่านโหมด Jev+AI (starterCustomAI.ts)
}

/** ข้อมูลชั้น AI ที่แนบมากับผลลัพธ์ — engine "rules" = วันนี้ AI ไม่ว่าง ใช้เครื่องยนต์กฎล้วน */
export interface StarterAIInfo {
  engine: "jev+ai" | "rules";
  summary?: string; // สรุปพอร์ตภาษามือใหม่ (GLM เขียนจาก packet จริง)
  jevCheck?: string | null; // "🧠 Jev ตรวจพอร์ตนี้: …" มุมมองที่สอง
}

// กองทุน (แทนด้วย ETF จริง — TDEX.BK คือ SET50 ETF เทียบเท่ากองทุน K-SET50)
const FUNDS: { symbol: string; name: string; kind: StarterPosition["kind"]; risk: StarterPosition["risk"]; reason: string }[] = [
  { symbol: "VOO", name: "กองทุนดัชนี S&P 500", kind: "etf", risk: "ต่ำ", reason: "ซื้อครั้งเดียว = ถือครบ 500 บริษัทใหญ่ของสหรัฐฯ ไม่ต้องเลือกเอง — เทียบเท่ากองทุนรวม S&P500 ที่ขายในไทย" },
  { symbol: "QQQ", name: "กองทุนดัชนี Nasdaq 100", kind: "etf", risk: "กลาง", reason: "ตะกร้า 100 บริษัทเทคโนโลยีชั้นนำสหรัฐฯ — โตแรงเมื่อยุคเทคดี" },
  { symbol: "GLD", name: "ทองคำ (ETF)", kind: "commodity", risk: "ต่ำ", reason: "ของกันเงินเฟ้อ/ความไม่แน่นอน — ช่วยลดคลื่นพอร์ต (หรือใช้กองทุนทอง TGOLD ของ TISCO แทนได้)" },
  { symbol: "TDEX.BK", name: "กองทุนดัชนี SET50", kind: "etf", risk: "กลาง", reason: "50 หุ้นใหญ่สุดของไทยในตัวเดียว ซื้อเป็นบาทใน SET เหมือนหุ้นปกติ — เทียบเท่ากองทุน K-SET50" },
];

// ---------- โครงภายใน ----------
interface CDraft {
  symbol: string;
  name: string;
  kind: StarterPosition["kind"];
  weight: number;
  reason: string;
  risk: StarterPosition["risk"];
  market: "US" | "TH" | "INTL";
  flag?: string;
  pe?: number | null;
  yieldPct?: number | null;
  roePct?: number | null;
  health?: number | null;
  cagr5yPct?: number | null;
  grade?: string | null;
  scoreTotal?: number | null;
}

const GRADE_RANK: Record<string, number> = { AAA: 4, AA: 3, A: 2, B: 1, C: 0 };
const gradeLetter = (total: number) => (total >= 80 ? "AAA" : total >= 68 ? "AA" : total >= 55 ? "A" : total >= 45 ? "B" : "C");

const uniRows = (universe as { tickers: { t: string; n: string; s: string }[] }).tickers;
const thRows = (setWatch as { tickers: { t: string; n: string; s: string }[] }).tickers;
const uniName = new Map(uniRows.map((r) => [r.t, r.n]));

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((res) => setTimeout(() => res(null), ms))]);
}

/** CAGR 5 ปี (ราคาล้วน) สำหรับ ETF — cache 12 ชม. ต่อตัว */
async function cagr5yCached(symbol: string): Promise<number | null> {
  return cached(`starter:custom:5y:${symbol}`, 12 * 3600_000, async () => {
    try {
      const c = await getChart(symbol, "5YD");
      if (c.length < 100) return null;
      const first = c[0].close;
      const last = c[c.length - 1].close;
      if (!(first > 0)) return null;
      return ((last / first) ** (1 / 5) - 1) * 100;
    } catch {
      return null;
    }
  });
}

// ---------- คลังผู้สมัครแต่ละตลาด ----------
export interface Cand {
  symbol: string;
  name: string;
  themeLabel?: string; // ธีมที่ดึงตัวนี้เข้ามา (แสดงในเหตุผล)
  lt?: LTRow; // ถ้ามาจากเครื่องยนต์หุ้นปันผล → มีตัวเลขงบจริง
  cat?: string; // หมวดไทย (สำหรับเหตุผลหุ้นไทยทั่วไป)
  sector?: string; // หมวดเมกา
  grade?: string | null; // เกรด StockLens (เติมเมื่อเปิดกรองเกรด)
  scoreTotal?: number | null;
}

function usCandidates(themeIds: string[], lt: { dividends: LTRow[] } | null): Cand[] {
  const themes = CUSTOM_THEMES.filter((t) => themeIds.includes(t.id));
  const out: Cand[] = [];
  const seen = new Set<string>();
  const push = (c: Cand) => {
    if (!c.symbol || seen.has(c.symbol)) return;
    seen.add(c.symbol);
    out.push(c);
  };
  // 1) ตัวเด่นประจำธีม + หุ้นใน sector ของธีม — สลับรอบทีละธีม (ธีมแรกไม่กินโควตาหมดก่อน)
  const perTheme = themes.map((th) => {
    const list: Cand[] = [];
    for (const t of th.usTickers ?? []) if (uniName.has(t)) list.push({ symbol: t, name: uniName.get(t)!, themeLabel: `${th.emoji} ${th.label}` });
    for (const r of uniRows) if ((th.usSectors ?? []).includes(r.s)) list.push({ symbol: r.t, name: r.n, themeLabel: `${th.emoji} ${th.label}`, sector: r.s });
    return list;
  });
  const maxThemeLen = Math.max(0, ...perTheme.map((l) => l.length));
  for (let i = 0; i < maxThemeLen; i++) for (const list of perTheme) if (list[i]) push(list[i]);
  // 3) หุ้นปันผลเมกาจากเครื่องยนต์จริง (มีตัวเลขงบ) — เด่นเมื่อเลือกธีมปันผล หรือใช้เติมท้ายคิว
  const wantDiv = themeIds.length === 0 || themeIds.includes("dividend");
  const usDivs = (lt?.dividends ?? []).filter((r) => !r.market.includes("🇹🇭"));
  if (wantDiv) for (const r of usDivs) push({ symbol: r.ticker, name: r.name, lt: r, themeLabel: "💰 ปันผลสม่ำเสมอ" });
  // 4) ไม่เลือกธีม (หรือเลือกแล้วได้ไม่ครบ) → แกนใหญ่ S&P500 ตามลำดับ universe
  for (const r of uniRows.slice(0, 25)) push({ symbol: r.t, name: r.n, sector: r.s });
  if (!wantDiv) for (const r of usDivs) push({ symbol: r.ticker, name: r.name, lt: r, themeLabel: "💰 ปันผลสม่ำเสมอ" });
  return out.slice(0, 40);
}

function thCandidates(themeIds: string[], lt: { dividends: LTRow[] } | null, thPicks: { ticker: string; name: string; sector: string }[]): { cands: Cand[]; themesWithNoThai: string[] } {
  const themes = CUSTOM_THEMES.filter((t) => themeIds.includes(t.id));
  const out: Cand[] = [];
  const seen = new Set<string>();
  const push = (c: Cand) => {
    if (!c.symbol || seen.has(c.symbol)) return;
    seen.add(c.symbol);
    out.push(c);
  };
  // 1) หุ้นปันผลไทยจากเครื่องยนต์จริง (มีตัวเลขงบ) — ธีม "ปันผล" หรือไม่เลือกธีม → ยกให้เป็นแถวหน้า
  const wantDiv = themeIds.length === 0 || themeIds.includes("dividend");
  if (wantDiv) for (const r of (lt?.dividends ?? []).filter((r) => r.market.includes("🇹🇭"))) push({ symbol: r.ticker, name: r.name, lt: r, themeLabel: "💰 ปันผลสม่ำเสมอ" });
  // 2) หุ้นไทยตามหมวดของธีม — สลับรอบทีละธีมเหมือนฝั่งเมกา
  const perTh = themes
    .filter((th) => (th.thCats ?? []).length > 0)
    .map((th) => thRows.filter((r) => (th.thCats ?? []).includes(r.s)).map((r) => ({ symbol: r.t, name: r.n, cat: r.s, themeLabel: `${th.emoji} ${th.label}` })));
  const maxThLen = Math.max(0, ...perTh.map((l) => l.length));
  for (let i = 0; i < maxThLen; i++) for (const list of perTh) if (list[i]) push(list[i]);
  // ไม่ได้เลือกธีม → คลังไทยทั้งหมดตามลำดับไฟล์ (หุ้นใหญ่ก่อน)
  if (!themes.some((th) => (th.thCats ?? []).length > 0)) for (const r of thRows) push({ symbol: r.t, name: r.n, cat: r.s });
  // 3) หุ้นไทยที่เด่นวันนี้ (Daily Picks)
  for (const p of thPicks) push({ symbol: p.ticker, name: p.name, sector: p.sector, themeLabel: "🎯 เด่นวันนี้" });
  // ธีมที่เลือกแต่ไม่มีของในไทยเลย → เตือน
  const themesWithNoThai = themes.filter((th) => (th.thCats ?? []).length === 0 && th.id !== "dividend").map((th) => `${th.emoji} ${th.label}`);
  return { cands: out.slice(0, 40), themesWithNoThai };
}

function intlCandidates(regionIds: string[]): Cand[] {
  const regions = regionIds.length ? INTL_REGIONS.filter((r) => regionIds.includes(r.id)) : INTL_REGIONS.slice(0, 4);
  const out: Cand[] = [];
  // วนรอบทีละภูมิภาค: ETF ก่อน แล้ว ADR — ให้กระจายภูมิภาคก่อนลงลึกบริษัท
  const maxLen = Math.max(1, ...regions.map((r) => 1 + r.adrs.length));
  for (let i = 0; i < maxLen; i++) {
    for (const r of regions) {
      if (i === 0) out.push({ symbol: r.etf, name: r.etfName, themeLabel: `ETF ${r.label}` });
      else if (r.adrs[i - 1]) out.push({ symbol: r.adrs[i - 1][0], name: r.adrs[i - 1][1], themeLabel: r.label });
    }
  }
  return out;
}

// ---------- จัดสรรจำนวนตำแหน่งตามน้ำหนัก (largest remainder + ขั้นต่ำ 1) ----------
function allocateCounts(weights: number[], count: number, caps: number[]): number[] {
  const n = weights.length;
  const raw = weights.map((w) => (count * w) / 100);
  const base = raw.map(Math.floor);
  let remain = count - base.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; remain > 0; k = (k + 1) % n, remain--) base[order[k % n][1]]++;
  for (let i = 0; i < n; i++) base[i] = Math.max(1, base[i]); // น้ำหนัก > 0 ต้องมีอย่างน้อย 1 ตัว
  // ปรับให้รวม = count (เพิ่ม/ลดที่ตัวใหญ่สุด) + เคารพ cap ของแต่ละถัง
  for (let guard = 0; guard < 10; guard++) {
    let sum = base.reduce((a, b) => a + b, 0);
    if (sum === count) break;
    const bigIdx = base.indexOf(Math.max(...base));
    if (sum > count) base[bigIdx] = Math.max(1, base[bigIdx] - 1);
    else base[bigIdx]++;
  }
  for (let i = 0; i < n; i++) base[i] = Math.min(base[i], caps[i]);
  // cap ทำให้เหลือ slot ว่าง → ยัดกลับเข้าถังที่ยังรับได้
  for (let guard = 0; guard < 10; guard++) {
    const sum = base.reduce((a, b) => a + b, 0);
    if (sum >= count) break;
    const room = base.map((v, i) => [caps[i] - v, i]).sort((a, b) => b[0] - a[0]);
    if (room[0][0] <= 0) break;
    base[room[0][1]]++;
  }
  return base;
}

// ---------- เกรด StockLens (เรียกเฉพาะเมื่อผู้ใช้เลือกกรองเกรด) ----------
async function gradeCands(cands: Cand[], need: number, minGrade: string, notes: string[]): Promise<Cand[]> {
  const minRank = GRADE_RANK[minGrade] ?? 0;
  const shortlist = cands.slice(0, Math.min(cands.length, need + 4, 14)); // กันไม่เรียกหนักเกิน
  const graded = await Promise.all(
    shortlist.map(async (c) => {
      const s = await withTimeout(computeScore(c.symbol), 25_000);
      return { c, total: s?.total ?? null };
    })
  );
  const pass = graded.filter((g) => g.total !== null && GRADE_RANK[gradeLetter(g.total)] >= minRank).sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  const unknown = graded.filter((g) => g.total === null);
  const passSet = new Set(pass);
  const failSorted = graded.filter((g) => g.total !== null && !passSet.has(g)).sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  const picked = [...pass.map((g) => g.c), ...unknown.map((g) => g.c), ...failSorted.map((g) => g.c)].slice(0, need);
  if (pass.length < need) {
    notes.push(
      pass.length === 0
        ? `🔍 วันนี้ไม่มีตัวไหนถึงเกรด ${minGrade} (หรือข้อมูลยังไม่พอคำนวณ) — ใช้ตัวที่คะแนนสูงสุดตามลำดับแทน พร้อมแสดงเกรดจริงกำกับทุกตัว`
        : `🔍 ผ่านเกณฑ์เกรด ${minGrade} แค่ ${pass.length}/${need} ตัว — ที่เหลือใส่จากลำดับคิว (ตัวที่ยังคำนวณเกรดไม่ได้จะขึ้น "ยังไม่มีเกรด")`
    );
  }
  // เก็บเกรดกลับไปแสดงบนตาราง
  const gradeOf = new Map(graded.map((g) => [g.c.symbol, g.total]));
  return picked.map((c) => {
    const t = gradeOf.get(c.symbol);
    return t !== undefined && t !== null ? { ...c, grade: gradeLetter(t), scoreTotal: t } : c;
  });
}

// ---------- ประกอบพอร์ต ----------
// ---------- คลังผู้สมัครทั้ง 4 ถัง — ใช้ทั้งโหมดเครื่องยนต์ และโหมด Jev (จัดอันดับก่อนส่งต่อเป็น override) ----------
export interface CustomPools {
  thPool: Cand[];
  usPool: Cand[];
  intlPool: Cand[];
  surgeCands: Cand[];
}

/** ธีมที่เลือกแต่ไทยยังไม่มีของ — ไว้ทำหมายเหตุ (ใช้ได้ทั้งสองโหมด ไม่ผูกกับการสร้าง pool) */
function themesWithNoThaiOf(themeIds: string[]): string[] {
  return CUSTOM_THEMES.filter((t) => themeIds.includes(t.id) && (t.thCats ?? []).length === 0 && t.id !== "dividend").map((t) => `${t.emoji} ${t.label}`);
}

/** หุ้นซิ่ง/หุ้นเด่นวันนี้ ~10% — รับเฉพาะไทย+เมกา เพราะตลาดอื่นราคาไม่ใช่ THB/USD (แปลงข้ามสกุลไม่ได้ในระบบนี้) */
function surgeCandsOf(momentum: boolean, picks: Awaited<ReturnType<typeof getPicks>> | null, surge: Awaited<ReturnType<typeof getSurge>> | null): Cand[] {
  const out: Cand[] = [];
  if (!momentum) return out;
  const tradeable = (t: string) => /^[A-Z]{1,5}$/.test(t) || t.endsWith(".BK");
  for (const r of (surge?.rows ?? []).filter((r) => tradeable(r.ticker))) {
    if (out.length >= 1) break;
    out.push({ symbol: r.ticker, name: r.name, sector: r.sector });
  }
  const p0 = (picks?.picks ?? []).find((p) => tradeable(p.ticker) && !p.ticker.endsWith(".BK"));
  if (p0 && out.length < 2) out.push({ symbol: p0.ticker, name: p0.name, sector: p0.sector });
  return out;
}

export async function buildPools(opts: StarterCustomOptions): Promise<CustomPools> {
  const themes = [...new Set((opts.themes ?? []).filter((t) => CUSTOM_THEMES.some((d) => d.id === t)))];
  const regions = [...new Set((opts.regions ?? []).filter((r) => INTL_REGIONS.some((d) => d.id === r)))];
  const [lt, picks, surge] = await Promise.all([getLongterm().catch(() => null), getPicks().catch(() => null), getSurge().catch(() => null)]);
  const thPicks = (picks?.picks ?? []).filter((p) => p.ticker.endsWith(".BK"));
  return {
    thPool: thCandidates(themes, lt, thPicks).cands,
    usPool: usCandidates(themes, lt),
    intlPool: intlCandidates(regions),
    surgeCands: surgeCandsOf(opts.momentum === true && (opts.count ?? 5) >= 3, picks, surge),
  };
}

export async function buildCustomPortfolio(opts: StarterCustomOptions, override?: CustomPools): Promise<StarterCustomResult> {
  const notes: string[] = [];
  const themes = [...new Set((opts.themes ?? []).filter((t) => CUSTOM_THEMES.some((d) => d.id === t)))];
  const regions = [...new Set((opts.regions ?? []).filter((r) => INTL_REGIONS.some((d) => d.id === r)))];
  const count = [3, 5, 8, 10, 12].includes(opts.count) ? opts.count : 5;

  // normalize mix ให้รวม 100 (กันค่าจาก client ไม่ตรง)
  let mix = {
    th: Math.max(0, Math.min(100, Math.round(opts.mix?.th ?? 0))),
    us: Math.max(0, Math.min(100, Math.round(opts.mix?.us ?? 0))),
    fund: Math.max(0, Math.min(100, Math.round(opts.mix?.fund ?? 0))),
    intl: Math.max(0, Math.min(100, Math.round(opts.mix?.intl ?? 0))),
  };
  const sumMix = mix.th + mix.us + mix.fund + mix.intl;
  if (sumMix <= 0) mix = { th: 25, us: 45, fund: 20, intl: 10 };
  else if (sumMix !== 100) {
    const k = 100 / sumMix;
    mix = { th: Math.round(mix.th * k), us: Math.round(mix.us * k), fund: Math.round(mix.fund * k), intl: 100 - Math.round(mix.th * k) - Math.round(mix.us * k) - Math.round(mix.fund * k) };
  }

  // คลังผู้สมัคร — โหมด AI ส่ง pools ที่ Jev เรียงแล้วมาแทนได้ (ไม่ส่ง = สร้างเองตามเงื่อนไข)
  const fetched = override ?? (await buildPools(opts));
  const { thPool, usPool, intlPool } = fetched;
  const noThai = themesWithNoThaiOf(themes);
  if (noThai.length && mix.th > 0) notes.push(`🗺️ ธีม ${noThai.join(" · ")} ยังไม่มีหุ้นไทยในคลัง — สัดส่วนไทยเลือกจากหุ้นไทยทั่วไปแทน`);

  // ดึงข้อมูลวันนี้ (ทุกตัวมี cache ของตัวเองอยู่แล้ว — ใช้ทำเหตุผล/แปลงราคา/ltByTicker)
  const [lt, picks, surge, usdThb] = await Promise.all([getLongterm().catch(() => null), getPicks().catch(() => null), getSurge().catch(() => null), getUsdThb().catch(() => 36)]);

  // ถัง + น้ำหนัก
  type BucketKey = "th" | "us" | "fund" | "intl" | "surge";
  let buckets: { key: BucketKey; weight: number }[] = [];
  if (mix.th > 0 && thPool.length) buckets.push({ key: "th", weight: mix.th });
  if (mix.us > 0 && usPool.length) buckets.push({ key: "us", weight: mix.us });
  if (mix.fund > 0) buckets.push({ key: "fund", weight: mix.fund });
  if (mix.intl > 0 && intlPool.length) buckets.push({ key: "intl", weight: mix.intl });

  // หุ้นซิ่ง: กันไว้ 10% (ถ้ามีของจริงวันนี้) — มาจาก pools (สร้างตอน buildPools ตาม opts.momentum)
  const surgeCands = fetched.surgeCands;

  // จัดจำนวนตำแหน่ง
  const caps = buckets.map((b) => (b.key === "fund" ? FUNDS.length : b.key === "th" ? thPool.length : b.key === "us" ? usPool.length : intlPool.length));
  let ns = allocateCounts(buckets.map((b) => b.weight), Math.max(3, count) - surgeCands.length, caps);
  // ถังหุ้นซิ่งถือ 10% — หักจากถังที่หนักสุด
  if (surgeCands.length) {
    const big = buckets.reduce((best, b) => (b.weight > best.weight ? b : best), buckets[0]);
    big.weight = Math.max(0, big.weight - 10);
    buckets = [...buckets, { key: "surge", weight: 10 }];
  }

  // เลือกตัวจริงทีละถัง (เก็บเกรดเมื่อกรอง) + กันซ้ำข้ามถัง
  let chosen: { cand: Cand; key: BucketKey; weightEach: number }[] = [];
  const used = new Set<string>();
  const needGrade = opts.minGrade && opts.minGrade !== "all";

  const poolOf = (key: BucketKey): Cand[] => (key === "th" ? thPool : key === "us" ? usPool : key === "intl" ? intlPool : surgeCands);

  for (let bi = 0; bi < buckets.length; bi++) {
    const b = buckets[bi];
    if (b.key === "surge") {
      // ตัวที่ถูกถังอื่นหยิบไปแล้วไม่หยิบซ้ำ
      const fresh = surgeCands.filter((c) => !used.has(c.symbol));
      for (const c of fresh) chosen.push({ cand: c, key: "surge", weightEach: b.weight / Math.max(1, fresh.length) });
      if (!fresh.length) notes.push("🚀 วันนี้ยังไม่มีหุ้นซิ่ง/หุ้นเด่นที่ไม่ซ้ำกับตัวอื่นในพอร์ต — ส่วน 10% นี้คืนให้ส่วนอื่นของพอร์ตอัตโนมัติ");
      continue;
    }
    const n = ns[bi] ?? 1;
    const pool = poolOf(b.key).filter((c) => !used.has(c.symbol));
    let picked: Cand[];
    if (needGrade && (b.key === "th" || b.key === "us")) {
      picked = await gradeCands(pool, n, opts.minGrade, notes);
    } else if (b.key === "fund") {
      // กองทุน: ลำดับคงที่ แต่ธีมทอง → ยก GLD มาก่อน
      const order = themes.includes("gold") ? ["VOO", "GLD", "QQQ", "TDEX.BK"] : ["VOO", "QQQ", "GLD", "TDEX.BK"];
      picked = order.map((s) => FUNDS.find((f) => f.symbol === s)!).slice(0, n).map((f) => ({ symbol: f.symbol, name: f.name, themeLabel: "🧺 กองทุน" }));
    } else {
      picked = pool.slice(0, n);
    }
    picked = picked.filter((c) => !used.has(c.symbol));
    for (const c of picked) {
      used.add(c.symbol);
      chosen.push({ cand: c, key: b.key, weightEach: b.weight / Math.max(1, picked.length) });
    }
    if (picked.length < n && b.weight > 0) {
      // ถังนี้ขอไม่ครบ → น้ำหนักส่วนที่เหลือย้ายไป VOO (ทางออกปลอดภัยสุดของมือใหม่)
      const leftover = Math.round(b.weight * (1 - picked.length / n) * 10) / 10;
      b.weight = Math.round((b.weight - leftover) * 10) / 10;
      if (leftover >= 5) {
        const vo = chosen.find((x) => x.key === "fund" && x.cand.symbol === "VOO");
        if (vo) vo.weightEach = Math.round((vo.weightEach + leftover) * 10) / 10;
        else {
          chosen.push({ cand: { symbol: "VOO", name: FUNDS[0].name, themeLabel: "🧺 กองทุน" }, key: "fund", weightEach: leftover });
          used.add("VOO");
        }
        notes.push("🧺 บางตลาดได้ตัวไม่ครบตามที่ขอ — ส่วนที่เหลือเติมเป็นกองทุนดัชนี S&P500 ให้อัตโนมัติ");
      }
    }
  }

  if (!chosen.length) {
    // กันสุดท้าย: อะไรก็ไม่ได้เลย → VOO ล้วน
    chosen.push({ cand: { symbol: "VOO", name: FUNDS[0].name, themeLabel: "🧺 กองทุน" }, key: "fund", weightEach: 100 });
    notes.push("⚠️ วันนี้ดึงข้อมูลรายตัวไม่ได้พอ — แสดงพอร์ตกองทุนดัชนีพื้นฐานให้ก่อน ลองกดประกอบใหม่อีกครั้งได้");
  }

  // CAGR 5 ปีให้ ETF (กองทุน + ETF ต่างประเทศ)
  const etfSymbols = chosen.filter((c) => c.key === "fund" || (c.key === "intl" && INTL_REGIONS.some((r) => r.etf === c.cand.symbol))).map((c) => c.cand.symbol);
  const cagrs = new Map(await Promise.all(etfSymbols.map(async (s) => [s, await cagr5yCached(s)] as const)));

  // ราคาสดรวมก้อนเดียว + fallback ก้อนเล็ก (แพตเทิร์นเดียวกับ starterPortfolio)
  const allSymbols = [...new Set(chosen.map((c) => c.cand.symbol))];
  let quotes: Record<string, Quote> = {};
  try {
    quotes = await getQuotes(allSymbols);
  } catch {
    /* ผ่านไป fallback */
  }
  if (Object.keys(quotes).filter((s) => isFinite(quotes[s]?.price)).length < 3) {
    for (let i = 0; i < allSymbols.length; i += 5) {
      try {
        Object.assign(quotes, await getQuotes(allSymbols.slice(i, i + 5)));
      } catch {
        /* ข้าม */
      }
    }
  }

  // กันซ้ำซ้ำสุดท้าย + ตัดตัวที่ไม่มีราคาจริงออก (แสดง/ซื้อไม่ได้) — ถ้าเหลือน้อยกว่า 3 เติมจากคลังสำรองที่มีราคา
  const seenFinal = new Set<string>();
  chosen = chosen.filter((x) => (seenFinal.has(x.cand.symbol) ? false : (seenFinal.add(x.cand.symbol), true)));
  const hasPrice = (s: string) => {
    const q = quotes[s];
    return q != null && isFinite(q.price) && q.price > 0;
  };
  const dropped = chosen.filter((x) => !hasPrice(x.cand.symbol)).map((x) => x.cand.symbol);
  if (dropped.length) notes.push(`✂️ ตัดออกเพราะยังดึงราคาไม่ได้วันนี้: ${dropped.join(" · ")}`);
  chosen = chosen.filter((x) => hasPrice(x.cand.symbol));
  if (chosen.length < count) {
    const targetN = Math.max(3, count);
    // เติมจากถังที่ผู้ใช้จัดน้ำหนักหนักสุดก่อน (ไทยล้วนก็เติมของไทย ไม่ดันเมกาใส่)
    const poolsByWeight = (["th", "us", "intl", "fund"] as const)
      .filter((k) => mix[k] > 0)
      .sort((a, b) => mix[b] - mix[a])
      .flatMap((k) => (k === "th" ? thPool : k === "us" ? usPool : k === "intl" ? intlPool : FUNDS.map((f) => ({ symbol: f.symbol, name: f.name }))));
    const backup = poolsByWeight.filter((c) => !chosen.some((x) => x.cand.symbol === c.symbol));
    const addedSyms: string[] = [];
    for (const c of backup) {
      if (chosen.length >= targetN) break;
      chosen.push({
        cand: c,
        key: FUNDS.some((f) => f.symbol === c.symbol) ? "fund" : c.symbol.endsWith(".BK") ? "th" : "us",
        weightEach: 25,
      });
      addedSyms.push(c.symbol);
    }
    if (addedSyms.length) {
      // ตัวเติมใหม่ยังไม่มีราคา — ดึงรอบสองแล้วคัดเฉพาะที่มีราคาจริง (กันเหลือน้อยกว่า 3)
      try {
        Object.assign(quotes, await getQuotes([...new Set(addedSyms)]));
      } catch {
        /* คัดทิ้งด้านล่าง */
      }
      const priced = chosen.filter((x) => hasPrice(x.cand.symbol));
      if (priced.length >= 3) chosen = priced;
      notes.push("🧺 บางตัวดึงข้อมูลไม่ได้ — เติมตำแหน่งสำรองที่มีราคาจริงให้อัตโนมัติ");
    }
  }

  // Cand → CDraft (เหตุผลภาษามือใหม่)
  const ltByTicker = new Map((lt?.dividends ?? []).map((r) => [r.ticker, r]));
  const toDraft = (c: Cand, key: BucketKey, weight: number): CDraft => {
    const q = quotes[c.symbol];
    const isThb = c.symbol.endsWith(".BK") || q?.currency === "THB";
    const ltRow = c.lt ?? ltByTicker.get(c.symbol);
    let kind: StarterPosition["kind"] = "growth";
    let reason = "";
    let risk: StarterPosition["risk"] = "กลาง";
    let flag: string | undefined;
    let market: "US" | "TH" | "INTL" = "US";
    if (key === "fund") {
      const f = FUNDS.find((x) => x.symbol === c.symbol);
      kind = f?.kind ?? "etf";
      reason = f?.reason ?? "กองทุนดัชนี — กระจายความเสี่ยงในตัวเดียว";
      risk = f?.risk ?? "ต่ำ";
      market = c.symbol.endsWith(".BK") ? "TH" : "US";
    } else if (key === "surge") {
      kind = "surge";
      const s0 = surge?.rows?.find((r) => r.ticker === c.symbol);
      reason = s0
        ? `🚀 หุ้นซิ่งวันนี้ ขยับ +${s0.changePct.toFixed(1)}% ${s0.flags.length ? `· ${s0.flags.join(" ")}` : ""} — เสี่ยงสูงมาก เอาแค่เล็กน้อยพอ หยุดวิ่งก็ตัดขาดทุนได้เร็ว`
        : "🎯 หุ้นที่เด่นที่สุดวันนี้จาก Daily Picks — โมเมนตัมแรงแต่แลกมาด้วยความเสี่ยงสูง เอาเล็กน้อยพอ";
      risk = "สูง";
      market = isThb ? "TH" : "US";
    } else if (key === "intl") {
      const region = INTL_REGIONS.find((r) => r.etf === c.symbol);
      if (region) {
        kind = "etf";
        reason = `🌏 ${region.etfName} — กระจายครบหุ้นใหญ่ของ${region.label}ด้วยตัวเดียว ซื้อผ่านบัญชีเมกาเป็นดอลลาร์`;
        risk = "กลาง";
      } else {
        const rByAdr = INTL_REGIONS.find((r) => r.adrs.some((a) => a[0] === c.symbol));
        reason = `🌏 บริษัทใหญ่ของ${rByAdr?.label ?? "ต่างประเทศ"} — ซื้อในตลาดเมกาเป็นดอลลาร์ (ADR) ไม่ต้องเปิดบัญชีประเทศนั้น`;
        risk = "กลาง";
      }
      market = "INTL";
      flag = region?.flag ?? INTL_REGIONS.find((r) => r.adrs.some((a) => a[0] === c.symbol))?.flag ?? "🌏";
    } else if (key === "th") {
      kind = ltRow ? "dividend" : "growth";
      market = "TH";
      flag = "🇹🇭";
      reason = ltRow
        ? `หุ้นไทยจ่ายปันผลสม่ำเสมอ — ปันผล ~${ltRow.yieldPct?.toFixed(1) ?? "?"}%/ปี · ROE ${ltRow.roePct?.toFixed(0) ?? "?"}% · งบแข็งแรง ${ltRow.health ?? "?"}/100`
        : c.themeLabel
          ? `หุ้นไทยที่เข้าธีม${c.themeLabel} (หมวด${c.cat ?? c.sector ?? "—"}) — เลือกจากหุ้นใหญ่คุ้นชื่อของตลาดไทย`
          : `หุ้นใหญ่คุ้นชื่อของตลาดไทย (หมวด${c.cat ?? "—"}) — ใกล้ตัว เข้าใจธุรกิจง่าย ปันผลเป็นบาท`;
      if (c.themeLabel?.includes("เด่นวันนี้")) risk = "กลาง";
    } else {
      // US stock
      market = "US";
      flag = "🇺🇸";
      kind = ltRow ? "dividend" : "growth";
      reason = c.themeLabel
        ? `จากธีม${c.themeLabel} ที่คุณสนใจ${c.sector ? ` — หมวด ${c.sector}` : ""} — เลือกจากบริษัทใหญ่ของ S&P500`
        : ltRow
          ? `หุ้นสหรัฐฯ จ่ายปันผล งบแข็งแรง — ปันผล ~${ltRow.yieldPct?.toFixed(1) ?? "?"}%/ปี`
          : `หุ้นแกนใหญ่ของตลาดสหรัฐฯ (S&P500) — ธุรกิจที่ยืนหยัดมานาน ซื้อผ่าน Dime เป็นบาทได้`;
    }
    return {
      symbol: c.symbol,
      name: c.name,
      kind,
      weight,
      reason,
      risk,
      market,
      flag,
      pe: ltRow?.pe ?? null,
      yieldPct: ltRow?.yieldPct ?? null,
      roePct: ltRow?.roePct ?? null,
      health: ltRow?.health ?? null,
      cagr5yPct: cagrs.get(c.symbol) ?? null,
      grade: c.grade ?? null,
      scoreTotal: c.scoreTotal ?? null,
    };
  };

  let drafts = chosen.map((x) => toDraft(x.cand, x.key, x.weightEach));

  // ตำแหน่งจริง + ราคา
  const positions: StarterPosition[] = drafts.map((d) => {
    const q = quotes[d.symbol];
    const price = q && isFinite(q.price) && q.price > 0 ? q.price : null;
    const isThb = q?.currency === "THB" || d.symbol.endsWith(".BK");
    return {
      symbol: d.symbol,
      name: d.name,
      kind: d.kind,
      weight: d.weight,
      priceThb: price !== null ? (isThb ? price : price * usdThb) : null,
      priceLocal: price,
      currency: isThb ? "THB" : "USD",
      unitThb: isThb,
      changePct: q && isFinite(q.changePct) ? q.changePct : null,
      reason: d.reason,
      risk: d.risk,
      market: d.market,
      flag: d.flag,
      pe: d.pe ?? null,
      yieldPct: d.yieldPct ?? null,
      roePct: d.roePct ?? null,
      health: d.health ?? null,
      cagr5yPct: d.cagr5yPct ?? null,
      grade: d.grade ?? null,
      scoreTotal: d.scoreTotal ?? null,
    };
  });

  // เงินสด 10% + normalize + จัด drift (แพตเทิร์นเดิมของ starterPortfolio)
  const cashPct = 10;
  const have = 100 - cashPct;
  const wSum = positions.reduce((a, p) => a + p.weight, 0) || 1;
  for (const p of positions) p.weight = Math.round((p.weight / wSum) * have * 10) / 10;
  const diff = Math.round((have - positions.reduce((a, p) => a + p.weight, 0)) * 10) / 10;
  if (positions.length && diff !== 0) positions[0].weight = Math.round((positions[0].weight + diff) * 10) / 10;

  // สรุปตัวเลขสถิติ (ใช้ statsOf ของเดิม)
  const themeText = themes.length ? `ธีม ${themes.map((id) => CUSTOM_THEMES.find((t) => t.id === id)?.label).filter(Boolean).join(" · ")}` : "ไม่จำกัดธีม";
  const mixText = [
    mix.th > 0 ? `ไทย ${mix.th}%` : "",
    mix.us > 0 ? `เมกา ${mix.us}%` : "",
    mix.fund > 0 ? `กองทุน ${mix.fund}%` : "",
    mix.intl > 0 ? `ต่างประเทศ ${mix.intl}%` : "",
  ]
    .filter(Boolean)
    .join(" + ");
  const profile: StarterProfile = {
    id: "custom",
    emoji: "🛠️",
    title: "ปรับพอร์ตเอง",
    desc: `${mixText} · ${positions.length} ตำแหน่ง · ${themeText}${opts.momentum ? " · เติมหุ้นซิ่ง 10%" : ""}`,
    cashPct,
    positions,
    stats: statsOf(positions),
  };

  if (opts.momentum) notes.push("🚀 ส่วนหุ้นซิ่ง/หุ้นเด่นวันนี้ = ความเสี่ยงสูง เหมาะเฉพาะเงินที่เสียได้ไม่เจ็บ — หยุดวิ่งอาจตกเร็วมาก");
  if (needGrade) notes.push("🔍 เกรด AAA/AA/A/B คือคะแนน StockLens 6 เสาของเว็บเรา (ไม่ใช่เกรดทางการ เช่น SET ESG หรือเครดิตเรตติ้ง) — ดูรายละเอียดกดเข้าไปที่ตัวหุ้นได้");

  return {
    asOf: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.",
    profile,
    notes: [...new Set(notes)],
  };
}

// ---------- cache ตาม options (30 นาที) ----------
export function hashOpts(o: StarterCustomOptions): string {
  const s = JSON.stringify({ m: [o.mix?.th, o.mix?.us, o.mix?.fund, o.mix?.intl], c: o.count, t: [...(o.themes ?? [])].sort(), r: [...(o.regions ?? [])].sort(), g: o.minGrade, x: !!o.momentum });
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export async function getStarterCustom(o: StarterCustomOptions): Promise<StarterCustomResult> {
  return cached(`starter:custom:${hashOpts(o)}`, 30 * 60_000, async () => {
    const fresh = { ...o, mix: { ...o.mix } };
    return buildCustomPortfolio(fresh);
  }) as Promise<StarterCustomResult>;
}
