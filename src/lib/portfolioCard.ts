// ===== 🎨 Content Studio — เครื่องคำนวณข้อมูลการ์ดคอนเทนต์ "จัดพอร์ต" =====
// จำลอง "พอร์ตเดิม vs พอร์ตจัดใหม่" จากราคาจริงย้อนหลัง (Yahoo รายสัปดาห์):
// - Equity curve แบบ DCA รายเดือน + rebalance รายเดือนตามน้ำหนักเป้าหมาย
// - สถิติ: มูลค่าสุดท้าย / XIRR (ผลตอบแทนเฉลี่ยต่อปีของกระแสเงิน DCA) / ความผันผวนรายสัปดาห์×√52 / MDD
// - แผนที่ความเสี่ยง: สินทรัพย์รายตัว + ฟองพอร์ตเดิม-ใหม่
// ข้อสมมติที่กำกับเสมอ: ราคา USD แปลงที่อัตราปัจจุบันคงที่ทั้งช่วง · ผลอดีตไม่รับประกันอนาคต
import { getChart, getUsdThb, cached } from "./yahoo";
import universe from "@/data/universe.json";
import setWatch from "@/data/set-watchlist.json";

export interface CardPosition {
  symbol: string;
  weight: number; // %
}

export interface CardAssetStat {
  symbol: string;
  name: string;
  cagrPct: number | null;
  volPct: number | null;
  mddPct: number | null;
  color: string;
}

export interface CardPortfolio {
  id: "old" | "new";
  label: string;
  positions: { symbol: string; name: string; weight: number; color: string }[];
  curve: { t: number; v: number }[]; // มูลค่ารายสัปดาห์ (บาท) จาก DCA sim
  finalThb: number;
  investedThb: number;
  xirrPct: number | null; // ผลตอบแทนเฉลี่ยต่อปีแบบถ่วงกระแสเงินสด (bisection IRR)
  volPct: number | null; // ความผันผวนต่อปีของพอร์ต rebalance รายสัปดาห์
  mddPct: number | null; // จุดต่ำสุดจากยอดสูงสุด (ของ index พอร์ต)
}

export interface PortfolioCardData {
  asOfTh: string;
  startTh: string;
  endTh: string;
  years: number;
  weeks: number;
  initialThb: number;
  dcaThb: number;
  assets: CardAssetStat[];
  oldP: CardPortfolio;
  newP: CardPortfolio;
  note: string;
}

export interface CardInput {
  oldPositions: CardPosition[];
  newPositions: CardPosition[];
  years: number; // 3 | 5 | 10
  initialThb: number;
  dcaThb: number; // ต่อเดือน
}

const PALETTE = ["#10b981", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185", "#34d399", "#60a5fa", "#c084fc", "#f59e0b", "#f87171"];
const OLD_COLOR = "#f43f5e"; // โทเคน down ของเว็บ — พอร์ตเดิม
const NEW_COLOR = "#10b981"; // โทเคน up — พอร์ตจัดใหม่

const uniName = new Map<string, string>((universe as { tickers: { t: string; n: string }[] }).tickers.map((r) => [r.t, r.n]));
const thName = new Map<string, string>((setWatch as { tickers: { t: string; n: string }[] }).tickers.map((r) => [r.t, r.n]));
const nameOf = (s: string) => thName.get(s) ?? uniName.get(s) ?? s;

const thDate = (t: number) => new Date(t * 1000).toLocaleDateString("th-TH", { year: "numeric", month: "short" });
const mddOf = (series: number[]) => {
  let peak = -Infinity;
  let mdd = 0;
  for (const v of series) {
    if (v > peak) peak = v;
    if (peak > 0) mdd = Math.min(mdd, v / peak - 1);
  }
  return mdd * 100;
};
const stdev = (xs: number[]) => {
  if (xs.length < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};

/** XIRR แบบ bisection — กระแสเงินสด [เดือนที่ 0..N, ยินลบ] + มูลค่าสุดท้าย (บวก) ต่อปี */
function xirrPctOf(cashflows: { monthsFromStart: number; amount: number }[], finalValue: number, totalMonths: number): number | null {
  const flows = [...cashflows, { monthsFromStart: totalMonths, amount: -finalValue }]; // ยอดสุดท้าย = เงินออก
  const npv = (r: number) => flows.reduce((a, f) => a + f.amount / (1 + r) ** (f.monthsFromStart / 12), 0);
  let lo = -0.9;
  let hi = 5;
  let fLo = npv(lo);
  let fHi = npv(hi);
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) return mid * 100;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return ((lo + hi) / 2) * 100;
}

// ---------- จำลองพอร์ต 1 ชุด ----------
interface SimResult {
  curve: { t: number; v: number }[];
  finalThb: number;
  investedThb: number;
  xirrPct: number | null;
  volPct: number | null;
  mddPct: number | null;
}

function simulate(times: number[], prices: Record<string, number[]>, syms: string[], weights: number[], initialThb: number, dcaThb: number): SimResult {
  const n = times.length;
  // index พอร์ต rebalance ตามเป้า (normalize ราคาตั้งต้น = 1) — ใช้หา vol/MDD
  const portIndex: number[] = [];
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let k = 0; k < syms.length; k++) v += weights[k] * (prices[syms[k]][i] / prices[syms[k]][0]);
    portIndex.push(v);
  }
  const rets: number[] = [];
  for (let i = 1; i < n; i++) if (portIndex[i - 1] > 0) rets.push(portIndex[i] / portIndex[i - 1] - 1);
  const volPct = stdev(rets) != null ? (stdev(rets)! * Math.sqrt(52) * 100) : null;
  const mddPct = mddOf(portIndex);

  // DCA sim: หน่วยสะสมรายสินทรัพย์ + rebalance รายเดือนกลับไปที่น้ำหนักเป้า
  let units: number[] = [];
  const curve: { t: number; v: number }[] = [];
  const cashflows: { monthsFromStart: number; amount: number }[] = [];
  let invested = 0;
  let lastMonth = -1;
  const monthOf = (i: number) => new Date(times[i] * 1000).getMonth() + new Date(times[i] * 1000).getFullYear() * 12;

  for (let i = 0; i < n; i++) {
    const m = monthOf(i);
    if (m !== lastMonth) {
      // เดือนใหม่: ลงเงินก้อนแรก/DCA แล้ว rebalance ทั้งพอร์ตกลับไปที่น้ำหนักเป้า
      const add = lastMonth < 0 ? initialThb : dcaThb;
      if (add > 0) {
        invested += add;
        cashflows.push({ monthsFromStart: m - monthOf(0), amount: add });
      }
      const valueNow = units.reduce((a, u, k) => a + u * prices[syms[k]][i], 0) + add;
      units = weights.map((w, k) => ((valueNow * w) / 100) / prices[syms[k]][i]); // สลับเป็นหน่วยตามเป้า
      lastMonth = m;
    }
    const v = units.reduce((a, u, k) => a + u * prices[syms[k]][i], 0);
    curve.push({ t: times[i], v: Math.round(v) });
  }
  const finalThb = curve[curve.length - 1]?.v ?? 0;
  const totalMonths = monthOf(n - 1) - monthOf(0);
  const xirr = finalThb > 0 ? xirrPctOf(cashflows, finalThb, totalMonths) : null;
  return { curve, finalThb, investedThb: invested, xirrPct: xirr, volPct, mddPct };
}

// ---------- คำนวณหลัก ----------
export async function computePortfolioCard(input: CardInput): Promise<PortfolioCardData> {
  const years = [3, 5, 10].includes(input.years) ? input.years : 5;
  const initialThb = Math.max(1000, Math.round(input.initialThb || 100000));
  const dcaThb = Math.max(0, Math.round(input.dcaThb ?? 10000));

  const norm = (ps: CardPosition[]) => {
    const clean = ps.filter((p) => p && typeof p.symbol === "string" && /^[A-Z0-9.\-]{1,10}$/i.test(p.symbol.trim()) && Number(p.weight) > 0).slice(0, 6);
    const sum = clean.reduce((a, p) => a + Number(p.weight), 0) || 1;
    return clean.map((p) => ({ symbol: p.symbol.trim().toUpperCase(), weight: Math.round((Number(p.weight) / sum) * 1000) / 10 }));
  };
  const oldPos = norm(input.oldPositions);
  const newPos = norm(input.newPositions);
  if (oldPos.length < 1 || newPos.length < 1) throw new Error("ต้องมีอย่างน้อย 1 สินทรัพย์ต่อพอร์ต");

  const symbols = [...new Set([...oldPos, ...newPos].map((p) => p.symbol))];
  const [usdThb, ...charts] = await Promise.all([getUsdThb().catch(() => 36), ...symbols.map((s) => getChart(s, years <= 5 ? "5Y" : "10YD"))]);

  // แปลงเป็นบาท + เหลือช่วง years ปีล่าสุด + สำรองเป็นรายสัปดาห์ (จุดสุดท้ายของแต่ละสัปดาห์)
  const cut = Date.now() / 1000 - years * 365.25 * 86400;
  const weekly: Record<string, { t: number; p: number }[]> = {};
  symbols.forEach((s, idx) => {
    const isThb = s.endsWith(".BK");
    const rows = (charts[idx] ?? []).filter((c) => c.time >= cut && isFinite(c.close) && c.close > 0);
    const byWeek = new Map<number, number>();
    for (const c of rows) byWeek.set(Math.floor(c.time / 604800), (isThb ? 1 : usdThb) * c.close);
    const sorted = [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([w, p]) => ({ t: w * 604800, p }));
    weekly[s] = sorted;
  });

  // align ช่วงเวลาร่วม (intersection ของสัปดาห์ — เริ่มจากสัปดาห์หลังสุดที่ทุกตัวมีข้อมูล)
  let commonWeeks: number[] = [];
  const firstSet = new Map<number, number>(); // week → จำนวนตัวที่เริ่มมีข้อมูล
  for (const s of symbols) for (const r of weekly[s]) firstSet.set(r.t, (firstSet.get(r.t) ?? 0) + 1);
  const allWeeks = [...new Set(symbols.flatMap((s) => weekly[s].map((r) => r.t)))].sort((a, b) => a - b);
  let started = false;
  for (const w of allWeeks) {
    if (firstSet.get(w) === symbols.length) started = true;
    if (started) commonWeeks.push(w);
  }
  if (commonWeeks.length < 60) throw new Error(`ข้อมูลร่วมกันสั้นเกินไป (${commonWeeks.length} สัปดาห์) — ลองลดจำนวนปีหรือเปลี่ยนสินทรัพย์ที่ขึ้นจดทะเบียนไม่นาน`);

  const lookup = (s: string, w: number) => weekly[s].find((r) => r.t === w)?.p;
  const times = commonWeeks;
  const prices: Record<string, number[]> = {};
  for (const s of symbols) {
    let last = lookup(s, times[0]) ?? weekly[s][0].p;
    prices[s] = times.map((w) => {
      const p = lookup(s, w);
      if (p != null) last = p;
      return last; // carry-forward สัปดาห์ที่หาย (วันหยุดยาว)
    });
  }

  // สี + สถิติรายสินทรัพย์ (สำหรับ risk map + แถวสูตร)
  const colorOf = new Map(symbols.map((s, i) => [s, PALETTE[i % PALETTE.length]]));
  const assets: CardAssetStat[] = symbols.map((s) => {
    const ps = prices[s];
    const rets: number[] = [];
    for (let i = 1; i < ps.length; i++) rets.push(ps[i] / ps[i - 1] - 1);
    const sd = stdev(rets);
    return {
      symbol: s,
      name: nameOf(s),
      cagrPct: ps[0] > 0 ? ((ps[ps.length - 1] / ps[0]) ** (52 / ps.length) - 1) * 100 : null,
      volPct: sd != null ? sd * Math.sqrt(52) * 100 : null,
      mddPct: mddOf(ps),
      color: colorOf.get(s)!,
    };
  });

  const build = (id: "old" | "new", label: string, pos: CardPosition[]): CardPortfolio => {
    const syms = pos.map((p) => p.symbol);
    const weights = pos.map((p) => p.weight);
    const sim = simulate(times, prices, syms, weights, initialThb, dcaThb);
    return {
      id,
      label,
      positions: pos.map((p) => ({ symbol: p.symbol, name: nameOf(p.symbol), weight: p.weight, color: colorOf.get(p.symbol)! })),
      ...sim,
    };
  };

  return {
    asOfTh: new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }),
    startTh: thDate(times[0]),
    endTh: thDate(times[times.length - 1]),
    years,
    weeks: times.length,
    initialThb,
    dcaThb,
    assets,
    oldP: build("old", "พอร์ตเดิม", oldPos),
    newP: build("new", "พอร์ตจัดใหม่", newPos),
    note: "จำลองจากราคาในอดีต (รายสัปดาห์) · DCA รายเดือน + rebalance รายเดือนตามน้ำหนักเป้า · ราคา USD แปลงที่อัตราปัจจุบันคงที่ทั้งช่วง · ผลตอบแทนเฉลี่ย = XIRR ของกระแสเงินสดจริง · ผลอดีตไม่รับประกันอนาคต ไม่ใช่คำแนะนำการลงทุน",
  };
}

// ---------- cache 6 ชม. ต่อชุด input ----------
function hashInput(i: CardInput): string {
  const s = JSON.stringify({
    o: [...i.oldPositions].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    n: [...i.newPositions].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    y: i.years,
    p: i.initialThb,
    d: i.dcaThb,
  });
  let h = 5381;
  for (let k = 0; k < s.length; k++) h = ((h << 5) + h + s.charCodeAt(k)) >>> 0;
  return h.toString(36);
}

export async function getPortfolioCard(input: CardInput): Promise<PortfolioCardData> {
  return cached(`card:v1:${hashInput(input)}`, 6 * 3600_000, async () => computePortfolioCard(input)) as Promise<PortfolioCardData>;
}

export const CARD_COLORS = { OLD_COLOR, NEW_COLOR };
