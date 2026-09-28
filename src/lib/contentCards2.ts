// ===== 🎨 Content Studio ชุด 2 — การ์ดคอนเทนต์ 5 แบบใหม่ =====
// 1) 📊 สรุปตลาดวันนี้ (ดัชนี+movers+สินทรัพย์+ข่าว Jev)  2) ⏪ ถ้าลงเดือนละ X฿ เมื่อ N ปีก่อน (DCA สินทรัพย์เดียว)
// 3) 🗓️ ปฏิทิน XD เดือนหน้า (คาดการณ์จากรอบจ่ายจริง)  4) 🦈 กูรู 13F ถืออะไร  5) 😱 ห่วงโซ่มหภาค ใครได้ใครเสีย
import { getQuotes, getUsdThb, cached, getChart, getDividendHistory } from "./yahoo";
import { getLatestNews } from "./latestNews";
import { getLiveGurus } from "./gurus13f";
import { keywordAnalyze } from "./radar";
import { prettySym } from "./prettySymbol";
import { TH_DIV_CANDIDATES } from "./dividendCard";
import universe from "@/data/universe.json";
import setWatch from "@/data/set-watchlist.json";

const uniName = new Map<string, string>((universe as { tickers: { t: string; n: string }[] }).tickers.map((r) => [r.t, r.n]));
const thName = new Map<string, string>((setWatch as { tickers: { t: string; n: string }[] }).tickers.map((r) => [r.t, r.n]));
const nameOf = (s: string) => thName.get(s) ?? uniName.get(s) ?? s;
const thDate = (d: Date) => d.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
const djb2 = (s: string) => { let h = 5381; for (let k = 0; k < s.length; k++) h = ((h << 5) + h + s.charCodeAt(k)) >>> 0; return h.toString(36); };

// ---------- 1) 📊 สรุปตลาดวันนี้ ----------
export interface RecapData {
  asOfTh: string;
  indices: { s: string; label: string; price: number; changePct: number }[];
  assets: { s: string; label: string; price: number; changePct: number }[];
  usdThb: number;
  gainers: { symbol: string; name: string; changePct: number }[];
  losers: { symbol: string; name: string; changePct: number }[];
  news: { title: string; source: string; sentiment: string | null; impact: number | null; time: number }[];
  mood: { dir: "bullish" | "bearish" | "neutral"; score: number } | null;
  note: string;
}

const RECAP_INDICES = ["^GSPC", "^IXIC", "^DJI", "^VIX", "^SET.BK", "^N225"];
const RECAP_ASSETS = ["GC=F", "CL=F", "BTC-USD"];
const RECAP_UNIVERSE = ["NVDA", "AAPL", "TSLA", "MSFT", "AMZN", "META", "GOOGL", "AMD", "PLTR", "MU", "COIN", "ORCL", "PTT.BK", "KBANK.BK", "AOT.BK", "DEL.BK", "ADVANC.BK", "CPALL.BK"];

export async function getDailyRecap(): Promise<RecapData> {
  return cached("studio:recap:v1", 10 * 60_000, async () => {
    const [q1, q2, q3, usdThb, feed] = await Promise.all([
      getQuotes(RECAP_INDICES),
      getQuotes(RECAP_ASSETS),
      getQuotes(RECAP_UNIVERSE),
      getUsdThb().catch(() => 36),
      getLatestNews().catch(() => null),
    ]);
    const idx = RECAP_INDICES.filter((s) => q1[s]?.price).map((s) => ({ s, label: prettySym(s), price: q1[s].price, changePct: q1[s].changePct }));
    const assets = RECAP_ASSETS.filter((s) => q2[s]?.price).map((s) => ({ s, label: prettySym(s), price: q2[s].price, changePct: q2[s].changePct }));
    const movers = RECAP_UNIVERSE.filter((s) => q3[s]?.price)
      .map((s) => ({ symbol: s, name: nameOf(s), changePct: q3[s].changePct }))
      .sort((a, b) => b.changePct - a.changePct);
    return {
      asOfTh: thDate(new Date()),
      indices: idx,
      assets,
      usdThb,
      gainers: movers.slice(0, 5),
      losers: movers.slice(-5).reverse(),
      news: (feed?.items ?? []).slice(0, 4).map((n) => ({ title: n.title, source: n.source, sentiment: n.score?.sentiment ?? null, impact: n.score?.impact ?? null, time: n.time })),
      mood: feed?.mood ?? null,
      note: "ราคา delay ~15 นาที (Yahoo Finance) · คะแนนข่าวโดย Jev · เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน",
    };
  }) as Promise<RecapData>;
}

// ---------- 2) ⏪ ถ้าลงเดือนละ X฿ เมื่อ N ปีก่อน ----------
export interface DcaData {
  asOfTh: string;
  symbol: string;
  name: string;
  years: number;
  monthlyThb: number;
  currency: string;
  priceThbNow: number;
  startTh: string;
  endTh: string;
  curve: { t: number; v: number }[]; // มูลค่าพอร์ตรายสัปดาห์ (บาท)
  investedCurve: { t: number; m: number }[]; // เงินที่ลงสะสม
  finalThb: number;
  investedThb: number;
  xirrPct: number | null;
  growthPct: number; // (final-invested)/invested
  note: string;
}

function xirrPctOf(cashflows: { monthsFromStart: number; amount: number }[], finalValue: number, totalMonths: number): number | null {
  const flows = [...cashflows, { monthsFromStart: totalMonths, amount: -finalValue }];
  const npv = (r: number) => flows.reduce((a, f) => a + f.amount / (1 + r) ** (f.monthsFromStart / 12), 0);
  let lo = -0.9, hi = 5;
  let fLo = npv(lo), fHi = npv(hi);
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) return mid * 100;
    if (fLo * fMid < 0) { hi = mid; fHi = fMid; } else { lo = mid; fLo = fMid; }
  }
  return ((lo + hi) / 2) * 100;
}

export async function computeDcaCard(symbol: string, years: number, monthlyThb: number): Promise<DcaData> {
  const sym = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9.\-=^]{1,10}$/.test(sym)) throw new Error("สัญลักษณ์ไม่ถูกต้อง");
  const ys = [1, 3, 5, 10].includes(years) ? years : 5;
  const monthly = Math.min(1_000_000, Math.max(500, Math.round(monthlyThb || 1000)));
  const [candles, usdThb] = await Promise.all([getChart(sym, ys <= 5 ? "5Y" : "10YD"), getUsdThb().catch(() => 36)]);
  const isThb = sym.endsWith(".BK");
  const fx = isThb ? 1 : usdThb;
  const cut = Date.now() / 1000 - ys * 365.25 * 86400;
  // สะสมเป็นรายสัปดาห์ (จุดสุดท้ายของสัปดาห์ เหมือน portfolioCard)
  const byWeek = new Map<number, number>();
  for (const c of candles) if (c.time >= cut && isFinite(c.close) && c.close > 0) byWeek.set(Math.floor(c.time / 604800), c.close * fx);
  const weekly = [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([w, p]) => ({ t: w * 604800, p }));
  if (weekly.length < Math.min(40, ys * 52 * 0.5)) throw new Error(`ข้อมูล ${sym} ย้อนหลังไม่พอ ${ys} ปี — ลองลดจำนวนปี`);

  // จำลอง DCA รายเดือน: ซื้อต้นเดือนที่เจอแท่งรายสัปดาห์แรกของเดือน
  let units = 0;
  let invested = 0;
  let lastMonth = -1;
  const curve: { t: number; v: number }[] = [];
  const investedCurve: { t: number; m: number }[] = [];
  const cashflows: { monthsFromStart: number; amount: number }[] = [];
  const monthOf = (t: number) => { const d = new Date(t * 1000); return d.getFullYear() * 12 + d.getMonth(); };
  for (const w of weekly) {
    const m = monthOf(w.t);
    if (m !== lastMonth) {
      units += monthly / w.p;
      invested += monthly;
      if (lastMonth >= 0) cashflows.push({ monthsFromStart: m - monthOf(weekly[0].t), amount: monthly });
      else cashflows.push({ monthsFromStart: 0, amount: monthly });
      lastMonth = m;
    }
    curve.push({ t: w.t, v: Math.round(units * w.p) });
    investedCurve.push({ t: w.t, m: invested });
  }
  const finalThb = curve[curve.length - 1]?.v ?? 0;
  const totalMonths = monthOf(weekly[weekly.length - 1].t) - monthOf(weekly[0].t);
  const xirr = finalThb > 0 ? xirrPctOf(cashflows, finalThb, totalMonths) : null;
  return {
    asOfTh: thDate(new Date()),
    symbol: sym,
    name: nameOf(sym),
    years: ys,
    monthlyThb: monthly,
    currency: isThb ? "THB" : "USD",
    priceThbNow: Math.round((weekly[weekly.length - 1]?.p ?? 0) * 100) / 100,
    startTh: new Date(weekly[0].t * 1000).toLocaleDateString("th-TH", { year: "numeric", month: "short" }),
    endTh: new Date(weekly[weekly.length - 1].t * 1000).toLocaleDateString("th-TH", { year: "numeric", month: "short" }),
    curve,
    investedCurve,
    finalThb,
    investedThb: invested,
    xirrPct: xirr,
    growthPct: invested > 0 ? ((finalThb - invested) / invested) * 100 : 0,
    note: "จำลอง DCA รายเดือนจากราคาย้อนหลังจริง (รายสัปดาห์) · ราคา USD แปลงที่อัตราปัจจุบันคงที่ทั้งช่วง · ไม่นับค่าธรรมเนียม/ภาษี · ผลอดีตไม่รับประกันอนาคต ไม่ใช่คำแนะนำการลงทุน",
  };
}

export async function getDcaCard(symbol: string, years: number, monthlyThb: number): Promise<DcaData> {
  return cached(`studio:dca:v1:${djb2(symbol + years + monthlyThb)}`, 6 * 3600_000, async () => computeDcaCard(symbol, years, monthlyThb)) as Promise<DcaData>;
}

// ---------- 3) 🗓️ ปฏิทิน XD เดือนหน้า (คาดการณ์จากรอบจ่ายจริง) ----------
export interface XdCalData {
  asOfTh: string;
  monthTh: string;
  rows: { symbol: string; name: string; dateTh: string; dateIso: string; amount: number; currency: string; yieldPct: number | null; freq: string }[];
  note: string;
}

export async function getXdCalendar(monthsAhead = 1): Promise<XdCalData> {
  const ahead = Math.min(3, Math.max(1, monthsAhead));
  return cached(`studio:xdcal:v2:${ahead}`, 6 * 3600_000, async () => {
    const target = new Date();
    target.setMonth(target.getMonth() + ahead);
    const tm = target.getMonth();
    const ty = target.getFullYear();
    const symbols = [...TH_DIV_CANDIDATES.slice(0, 30), "O", "MAIN", "SCHD", "JEPQ"]; // ไทยรายปี/ครึ่งปี + อเมริกันจ่ายรายเดือน
    const histories = await Promise.all(symbols.map((s) => getDividendHistory(s, 2).catch(() => [])));
    type Row = XdCalData["rows"][number] & { ts: number };
    const rows: Row[] = [];
    symbols.forEach((s, i) => {
      const evs = histories[i];
      if (!evs.length) return;
      const isTh = s.endsWith(".BK");
      let ts = 0;
      let amount = 0;
      if (isTh) {
        // ไทย: หางวดของเดือนเป้าหมายจากปีก่อนๆ → คาดวันเดียวกันของปีนี้
        const sameMonth = evs.filter((e) => new Date(e.ts * 1000).getUTCMonth() === tm);
        const last = sameMonth[sameMonth.length - 1];
        if (!last) return;
        const d = new Date(last.ts * 1000);
        ts = Date.UTC(ty, tm, d.getUTCDate()) / 1000;
        amount = last.amount;
      } else {
        // อเมริกันจ่ายรายเดือน: งวดล่าสุด + ~30 วัน
        const last = evs[evs.length - 1];
        ts = last.ts + 30 * 86400;
        if (new Date(ts * 1000).getUTCMonth() !== tm) return;
        amount = last.amount;
      }
      if (ts * 1000 < Date.now()) return; // ตัดเฉพาะงวดที่ผ่านมาแล้ว
      const ttm = evs.filter((e) => Date.now() / 1000 - e.ts <= 365 * 86400).reduce((a, e) => a + e.amount, 0);
      const paysPerYear = new Set(evs.map((e) => new Date(e.ts * 1000).getUTCFullYear())).size ? (evs.length >= 8 ? 12 : evs.length >= 3 ? 2 : 1) : 1;
      rows.push({
        symbol: s, name: nameOf(s),
        dateTh: new Date(ts * 1000).toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
        dateIso: new Date(ts * 1000).toISOString().slice(0, 10),
        amount, currency: isTh ? "THB" : "USD",
        yieldPct: null, freq: isTh ? (paysPerYear >= 2 ? "2 ครั้ง/ปี" : "ปีละครั้ง") : "รายเดือน",
        ts,
      });
    });
    // yield จากราคาจริง batch
    const quotes = await getQuotes([...new Set(rows.map((r) => r.symbol))]).catch(() => ({} as Record<string, { price: number }>));
    for (const r of rows) {
      const p = quotes[r.symbol]?.price;
      const ttmApprox = r.currency === "THB" ? r.amount * (r.freq === "รายเดือน" ? 12 : r.freq.includes("2") ? 2 : 1) : r.amount * 12;
      r.yieldPct = p ? Math.round((ttmApprox / p) * 10000) / 100 : null;
    }
    rows.sort((a, b) => a.ts - b.ts);
    const top = rows.slice(0, 12).map(({ ts: _t, ...r }) => r);
    return {
      asOfTh: thDate(new Date()),
      monthTh: target.toLocaleDateString("th-TH", { month: "long", year: "numeric" }),
      rows: top,
      note: "วัน XD เป็นการคาดการณ์จากรอบการจ่ายจริงปีก่อน (อเมริกัน: รอบจ่ายรายเดือน) — บริษัทเปลี่ยนกำหนดได้เสมอ ตรวจกับประกาศ 246-1/56-1 ก่อนตัดสินใจ · เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน",
    } as XdCalData;
  }) as Promise<XdCalData>;
}

// ---------- 4) 🦈 กูรู 13F ----------
export interface GuruCardData {
  asOfTh: string;
  guru: { id: string; name: string; firm: string; emoji: string; style: string; thesis: string; caution: string; asOf: string };
  totalValueUsdB: number;
  top: { ticker: string; issuer: string; valueUsdB: number; pct: number; change?: string; note?: string }[];
  qoq: { increased: number; decreased: number; newCount: number; exited: { issuer: string; prevPct: number }[] } | null;
  note: string;
}

export async function getGuruCard(guruId?: string): Promise<GuruCardData> {
  return cached(`studio:guru:v1:${guruId ?? "auto"}`, 6 * 3600_000, async () => {
    const gurus = await getLiveGurus().catch(() => []);
    if (!gurus.length) throw new Error("ดึงข้อมูลกูรู 13F ไม่สำเร็จ — ลองอีกครั้ง");
    const g = (guruId && gurus.find((x) => x.id === guruId)) || gurus[0];
    const fmtChange = (c?: { type: string; deltaPct?: number }) =>
      !c ? undefined : c.type === "new" ? "🆕 เปิดพอร์ตใหม่" : c.type === "increased" ? `⬆️ เพิ่ม${c.deltaPct ? ` +${Math.round(c.deltaPct)}%` : ""}` : c.type === "decreased" ? `⬇️ ลด${c.deltaPct ? ` -${Math.round(c.deltaPct)}%` : ""}` : "= ถือเท่าเดิม";
    return {
      asOfTh: thDate(new Date()),
      guru: { id: g.id, name: g.name, firm: g.firm, emoji: g.emoji, style: g.style, thesis: g.thesis, caution: g.caution, asOf: g.asOf ?? g.filedAt ?? "ล่าสุด" },
      totalValueUsdB: Math.round((g.totalValueUsd ?? 0) / 1e9),
      top: g.holdings.slice(0, 8).map((h) => ({
        ticker: h.ticker ?? h.issuer.slice(0, 6),
        issuer: h.issuer,
        valueUsdB: Math.round(h.valueUsd / 1e9),
        pct: h.pct,
        change: fmtChange(h.change),
        note: h.note,
      })),
      qoq: g.qoq ?? null,
      note: `ข้อมูลจากแบบ 13F งวด ${g.asOf ?? ""} (SEC EDGAR) — เห็นเฉพาะฝั่งหุ้นสหรัฐฯ ฝั่ง long ณ สิ้นไตรมาส · เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน`,
    } as GuruCardData;
  }) as Promise<GuruCardData>;
}

// ---------- 5) 😱 ห่วงโซ่มหภาค — ใครได้ ใครเสีย ----------
export interface MacroCardData {
  asOfTh: string;
  input: string;
  headline: string;
  chains: { name: string; reason: string; stocks: { ticker: string; direction: "positive" | "negative"; reason: string; chgPct: number | null }[] }[];
  note: string;
}

export async function getMacroCard(text: string): Promise<MacroCardData> {
  const input = text.trim().slice(0, 200);
  if (input.length < 4) throw new Error("พิมพ์เหตุการณ์อย่างน้อย 4 ตัวอักษร เช่น 'น้ำมันขึ้น 5%'");
  return cached(`studio:macro:v1:${djb2(input)}`, 6 * 3600_000, async () => {
    const base = await keywordAnalyze(input);
    const chains = base.chains.slice(0, 4);
    const allT = [...new Set(chains.flatMap((c) => c.stocks.map((s) => s.ticker)))].slice(0, 15);
    const quotes = allT.length ? await getQuotes(allT).catch(() => ({} as Record<string, { changePct: number }>)) : {};
    return {
      asOfTh: thDate(new Date()),
      input,
      headline: base.headline,
      chains: chains.map((c) => ({
        name: c.name,
        reason: c.reason,
        stocks: c.stocks.slice(0, 6).map((s) => ({ ticker: s.ticker, direction: s.direction, reason: s.reason, chgPct: quotes[s.ticker]?.changePct ?? null })),
      })),
      note: "ห่วงโซ่จากฐานความรู้ Global Radar (เชิงตรรกะ ไม่ใช่คำทำนาย) · ราคา delay ~15 นาที · เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน",
    } as MacroCardData;
  }) as Promise<MacroCardData>;
}
