// ===== พอร์ตตัวอย่างรายวันสำหรับมือใหม่ — "ไม่รู้เรื่องหุ้นเลยก็เริ่มได้" =====
// หลักการ: จัดสรรจากเครื่องยนต์ข้อมูลจริงที่มีอยู่แล้ว (Daily Picks / หุ้นปันผล / ETF ดัชนี / 13F กูรู)
// ผู้ใช้เลือกแค่ 2 อย่าง: งบเท่าไหร่ + อยากแบบไหน (6 สไตล์) — ที่เหลือคำนวณให้ พร้อมสถิติพอร์ตรวม
// สำคัญ: เป็น "ตัวอย่างเพื่อการเรียนรู้" ไม่ใช่คำแนะนำการลงทุน — หมุนตามข้อมูลวันนั้นอัตโนมัติ
import { getQuotes, getUsdThb, getChart } from "./yahoo";
import { getPicks } from "./picks";
import { getSurge } from "./surge";
import { getLongterm, type LTRow } from "./longterm";
import { getLiveGurus } from "./gurus13f";
import type { Quote } from "./types";

export type RiskId = "calm" | "balance" | "grow" | "tech" | "thai" | "guru";

export interface StarterPosition {
  symbol: string;
  name: string; // ชื่อที่มือใหม่อ่านรู้เรื่อง
  kind: "etf" | "dividend" | "growth" | "momentum" | "surge" | "commodity" | "guru";
  weight: number; // % ของงบ
  priceThb: number | null; // ราคาต่อหน่วย ณ ตอนนี้ (บาท)
  priceLocal: number | null; // ราคาในสกุลของหุ้นเอง (บาท/ดอลลาร์) — ใช้บันทึกต้นทุนเข้า "พอร์ตของฉัน"
  currency: string; // "THB" | "USD"
  unitThb: boolean; // true = ซื้อเป็นหุ้นเต็ม (ไทย) / false = ซื้อเศษได้ (Dime)
  changePct: number | null;
  reason: string; // ทำไมอยู่ในพอร์ต — ภาษาคนไม่มีความรู้
  risk: "ต่ำ" | "กลาง" | "สูง";
  market: "US" | "TH";
  // รายละเอียดเพิ่ม (มีเมื่อข้อมูลจริงรองรับ)
  pe?: number | null;
  yieldPct?: number | null; // ปันผล % ต่อปี
  roePct?: number | null;
  health?: number | null; // คะแนนความแข็งแรงงบ /100
  cagr5yPct?: number | null; // ผลตอบแทนเฉลี่ย 5 ปี (ราคาล้วน)
  guruPct?: number | null; // สัดส่วนในพอร์ตกูรู (สำหรับสไตล์ตามรอยกูรู)
  guruChange?: string | null; // 🆕/เพิ่ม/ลด เทียบไตรมาสก่อน
}

export interface StarterProfile {
  id: RiskId;
  emoji: string;
  title: string;
  desc: string;
  cashPct: number;
  positions: StarterPosition[];
  // สถิติพอร์ตรวม (คำนวณจากน้ำหนัก × ข้อมูลจริง)
  stats: {
    yieldPerYearPct: number | null; // ปันผลคาดหมาย/ปี % ของงบ (0 ถ้าไม่มีตัวไหนจ่าย)
    avgCagr5yPct: number | null; // 5 ปีเฉลี่ยถ่วงน้ำหนัก (ราคาล้วน — อดีต)
    usPct: number;
    thPct: number;
    riskLow: number;
    riskMid: number;
    riskHigh: number;
  };
}

export interface StarterResult {
  asOf: string;
  dateTh: string;
  profiles: StarterProfile[];
  note: string;
}

let cached: { at: number; data: StarterResult } | null = null;
const TTL = 30 * 60_000;

interface Draft {
  symbol: string;
  name: string;
  kind: StarterPosition["kind"];
  weight: number; // น้ำหนักที่ "อยากได้" — ถ้าตัวไหนไม่มีข้อมูลจะโดนตัดแล้ว normalize ใหม่
  reason: string;
  risk: StarterPosition["risk"];
  pe?: number | null;
  yieldPct?: number | null;
  roePct?: number | null;
  health?: number | null;
  cagr5yPct?: number | null;
  guruPct?: number | null;
  guruChange?: string | null;
}

/** ผลตอบแทนเฉลี่ย 5 ปี (CAGR ราคาล้วน) — ใช้กับ ETF/สินทรัพย์อ้างอิง */
async function cagr5y(symbol: string): Promise<number | null> {
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
}

function statsOf(positions: StarterPosition[]): StarterProfile["stats"] {
  const wSum = positions.reduce((a, p) => a + p.weight, 0) || 1;
  const yieldKnown = positions.filter((p) => p.yieldPct != null);
  const cagrKnown = positions.filter((p) => p.cagr5yPct != null);
  const cagrWSum = cagrKnown.reduce((a, p) => a + p.weight, 0);
  return {
    // ปันผลคาดหมาย/ปี (% ของงบ) — ถ่วงน้ำหนักเฉพาะตัวที่รู้ yield จริง
    yieldPerYearPct: yieldKnown.length ? yieldKnown.reduce((a, p) => a + ((p.yieldPct ?? 0) * p.weight) / wSum, 0) : null,
    // CAGR 5 ปีเฉลี่ยถ่วงน้ำหนัก — เฉพาะตัวที่มีข้อมูลย้อนหลังครบ (ราคาล้วน)
    avgCagr5yPct: cagrWSum > 0 ? cagrKnown.reduce((a, p) => a + (p.cagr5yPct ?? 0) * p.weight, 0) / cagrWSum : null,
    usPct: Math.round(positions.filter((p) => p.market === "US").reduce((a, p) => a + p.weight, 0)),
    thPct: Math.round(positions.filter((p) => p.market === "TH").reduce((a, p) => a + p.weight, 0)),
    riskLow: Math.round(positions.filter((p) => p.risk === "ต่ำ").reduce((a, p) => a + p.weight, 0)),
    riskMid: Math.round(positions.filter((p) => p.risk === "กลาง").reduce((a, p) => a + p.weight, 0)),
    riskHigh: Math.round(positions.filter((p) => p.risk === "สูง").reduce((a, p) => a + p.weight, 0)),
  };
}

async function build(): Promise<StarterResult> {
  const [picks, lt, surge, usdThb, guruBuffett, voo5y, qqq5y, gld5y] = await Promise.all([
    getPicks().catch(() => null),
    getLongterm().catch(() => null),
    getSurge().catch(() => null),
    getUsdThb().catch(() => 36),
    getLiveGurus().catch(() => null),
    cagr5y("VOO"),
    cagr5y("QQQ"),
    cagr5y("GLD"),
  ]);

  const thDividends = (lt?.dividends ?? []).filter((r) => r.market.includes("🇹🇭"));
  const usDividend: LTRow | undefined = lt?.dividends.find((r) => !r.market.includes("🇹🇭"));
  const compounder: LTRow | undefined = lt?.compounders[0];
  const p0 = picks?.picks[0];
  const p1 = picks?.picks[1];
  const techPicks = (picks?.picks ?? []).filter((p) => /tech|semicon|electronic|computer|software|communication/i.test(p.sector)).slice(0, 2);
  const thPicks = (picks?.picks ?? []).filter((p) => p.ticker.endsWith(".BK")).slice(0, 2);
  const s0 = surge?.rows[0];
  const gurus = guruBuffett;
  const buffett = gurus?.find((g) => g.id === "buffett");
  const buffettTop = (buffett?.holdings ?? []).filter((h) => h.ticker).slice(0, 4);

  const ltDraft = (r: LTRow, weight: number, kind: StarterPosition["kind"], extraWhy: string): Draft => ({
    symbol: r.ticker,
    name: r.name,
    kind,
    weight,
    reason: `${extraWhy} — ปันผล ~${r.yieldPct?.toFixed(1) ?? "?"}%/ปี · ROE ${r.roePct?.toFixed(0) ?? "?"}% · งบแข็งแรง ${r.health ?? "?"}/100`,
    risk: "กลาง",
    pe: r.pe,
    yieldPct: r.yieldPct,
    roePct: r.roePct,
    health: r.health,
    cagr5yPct: r.cagr5yPct,
  });
  const pickDraft = (p: NonNullable<typeof p0>, weight: number, risk: StarterPosition["risk"] = "กลาง"): Draft => ({
    symbol: p.ticker,
    name: p.name,
    kind: "momentum",
    weight,
    reason: `${p.tagEmoji}${p.tag} วันนี้ — ${p.reason}`,
    risk,
  });
  const buffettDraft = (h: (typeof buffettTop)[number], weight: number): Draft => ({
    symbol: h.ticker!,
    name: h.issuer,
    kind: "guru",
    weight,
    reason: `บัฟเฟต์ถือ ${h.pct.toFixed(1)}% ของพอร์ต${h.change?.type === "new" ? " · 🆕 เพิ่งซื้อไตรมาสนี้" : h.change?.type === "increased" ? " · เพิ่งเพิ่มน้ำหนัก" : h.change?.type === "decreased" ? " · เพิ่งลดน้ำหนัก" : ""} — ธุรกิจที่เขา "เข้าใจและถือยาว"`,
    risk: "กลาง",
    guruPct: h.pct,
    guruChange: h.change?.type === "new" ? "🆕" : h.change?.type === "increased" ? "เพิ่ม" : h.change?.type === "decreased" ? "ลด" : null,
  });

  // โปรไฟล์ 6 แบบ — เหตุผลเขียนให้คนไม่มีความรู้อ่านรู้เรื่องใน 1 บรรทัด
  const draftsOf: Record<RiskId, Draft[]> = {
    calm: [
      { symbol: "VOO", name: "กองทุนดัชนี S&P 500", kind: "etf", weight: 35, reason: "ซื้อครั้งเดียว = ถือครบ 500 บริษัทใหญ่ของสหรัฐฯ ไม่ต้องเลือกเอง", risk: "ต่ำ", cagr5yPct: voo5y },
      { symbol: "GLD", name: "ทองคำ (ETF)", kind: "commodity", weight: 10, reason: "ของที่คนซื้อไว้เวลาตลาดไม่แน่นอน — ช่วยลดคลื่นพอร์ต", risk: "ต่ำ", cagr5yPct: gld5y },
      ...(thDividends[0] ? [ltDraft(thDividends[0], 25, "dividend", "หุ้นไทยจ่ายปันผลสม่ำเสมอ — เงินไหลเข้าทุกปีแบบไม่ต้องทำอะไร")] : []),
      ...(usDividend ? [ltDraft(usDividend, 20, "dividend", "บริษัทสหรัฐฯ จ่ายปันผล งบแข็งแรง")] : []),
    ],
    balance: [
      { symbol: "VOO", name: "กองทุนดัชนี S&P 500", kind: "etf", weight: 25, reason: "ก้อนหลักของพอร์ต — โตตามตลาดสหรัฐฯ ระยะยาว", risk: "ต่ำ", cagr5yPct: voo5y },
      ...(thDividends[0] ? [ltDraft(thDividends[0], 15, "dividend", "ปันผลจากตลาดไทย — เงินเข้าสม่ำเสมอ")] : []),
      ...(compounder
        ? [{ symbol: compounder.ticker, name: compounder.name, kind: "growth" as const, weight: 20, reason: `บริษัทโตต่อเนื่อง ~${compounder.cagr5yPct?.toFixed(0) ?? "?"}%/ปี เฉลี่ย 5 ปีที่ผ่านมา (ราคาล้วน)`, risk: "กลาง" as const, pe: compounder.pe, yieldPct: compounder.yieldPct, roePct: compounder.roePct, health: compounder.health, cagr5yPct: compounder.cagr5yPct }]
        : []),
      ...(p0 ? [pickDraft(p0, 15)] : []),
      ...(p1 ? [pickDraft(p1, 15)] : []),
    ],
    grow: [
      { symbol: "QQQ", name: "กองทุนดัชนี Nasdaq 100", kind: "etf", weight: 25, reason: "ครบ 100 บริษัทเทคโนโลยีชั้นนำสหรัฐฯ — โตแรงเมื่อยุคเทคดี", risk: "กลาง", cagr5yPct: qqq5y },
      ...(p0 ? [pickDraft(p0, 20, "สูง")] : []),
      ...(p1 ? [pickDraft(p1, 15, "สูง")] : []),
      ...(compounder
        ? [{ symbol: compounder.ticker, name: compounder.name, kind: "growth" as const, weight: 20, reason: `สายโตต่อเนื่อง ~${compounder.cagr5yPct?.toFixed(0) ?? "?"}%/ปี (5 ปี, ราคาล้วน)`, risk: "กลาง" as const, pe: compounder.pe, yieldPct: compounder.yieldPct, roePct: compounder.roePct, health: compounder.health, cagr5yPct: compounder.cagr5yPct }]
        : []),
      ...(s0
        ? [{ symbol: s0.ticker, name: `${s0.name} (หุ้นซิ่ง)`, kind: "surge" as const, weight: 10, reason: `ขยับ +${s0.changePct.toFixed(1)}% วันนี้ ${s0.flags.length ? `· ${s0.flags.join(" ")}` : ""} — เสี่ยงสูงมาก เอาแค่เล็กน้อยพอ`, risk: "สูง" as const }]
        : []),
    ],
    tech: [
      { symbol: "QQQ", name: "กองทุนดัชนี Nasdaq 100", kind: "etf", weight: 35, reason: "ตะกร้าเทคชั้นนำครบ 100 ตัว — แกนหลักของสายเทค", risk: "กลาง", cagr5yPct: qqq5y },
      ...(techPicks[0] ? [pickDraft(techPicks[0], 20, "สูง")] : p0 ? [pickDraft(p0, 20, "สูง")] : []),
      ...(techPicks[1] ? [pickDraft(techPicks[1], 15, "สูง")] : p1 ? [pickDraft(p1, 15, "สูง")] : []),
      ...(compounder ? [{ symbol: compounder.ticker, name: compounder.name, kind: "growth" as const, weight: 20, reason: `โตต่อเนื่อง ~${compounder.cagr5yPct?.toFixed(0) ?? "?"}%/ปี (5 ปี, ราคาล้วน)`, risk: "กลาง" as const, pe: compounder.pe, yieldPct: compounder.yieldPct, roePct: compounder.roePct, health: compounder.health, cagr5yPct: compounder.cagr5yPct }] : []),
    ],
    thai: [
      { symbol: "GLD", name: "ทองคำ (ETF)", kind: "commodity", weight: 10, reason: "ทอง — ของกันเงินเฟ้อที่คนไทยคุ้นเคยที่สุด", risk: "ต่ำ", cagr5yPct: gld5y },
      ...(thDividends[0] ? [ltDraft(thDividends[0], 30, "dividend", "หุ้นไทยปันผลหนา — รายได้เข้าเป็นบาททุกปี")] : []),
      ...(thDividends[1] ? [ltDraft(thDividends[1], 20, "dividend", "กระจายอีกตัวในตลาดไทย")] : []),
      ...(thPicks[0] ? [pickDraft(thPicks[0], 15)] : []),
      ...(thPicks[1] ? [pickDraft(thPicks[1], 10)] : []),
      ...(!thDividends.length && !thPicks.length && usDividend ? [ltDraft(usDividend, 45, "dividend", "วันนี้ยังไม่มีหุ้นไทยผ่านเกณฑ์ — ใช้ปันผลสหรัฐฯ รอก่อน")] : []),
    ],
    guru: [
      ...(buffettTop.slice(0, 4).map((h) => buffettDraft(h, 20))),
      ...(buffettTop.length ? [] : usDividend ? [ltDraft(usDividend, 40, "dividend", "ข้อมูลกูรูยังไม่พร้อม — ใช้หุ้นปันผลแทนชั่วคราว")] : []),
      { symbol: "VOO", name: "กองทุนดัชนี S&P 500", kind: "etf", weight: 20, reason: "ก้อนกันเอียง — แม้แต่พอร์ตบัฟเฟต์ก็มีส่วนตลาดรวมคล้ายกัน", risk: "ต่ำ", cagr5yPct: voo5y },
    ],
  };

  const cashOf: Record<RiskId, number> = { calm: 10, balance: 10, grow: 10, tech: 10, thai: 15, guru: 10 };
  const meta: Record<RiskId, { emoji: string; title: string; desc: string }> = {
    calm: { emoji: "😴", title: "นิ่ง ๆ กินปันผล", desc: "อยากได้เงินปีละครั้ง ไม่อยากเปิดดูทุกวัน — ขึ้นช้าหน่อยแต่หลับได้" },
    balance: { emoji: "⚖️", title: "สมดุล", desc: "อยากโตแต่ไม่เสี่ยงมาก — ครึ่งเดินช้า ครึ่งวิ่งได้" },
    grow: { emoji: "🚀", title: "เติบโต", desc: "รับความเสี่ยงได้ อยากโตแรง — ขึ้นเร็วลงก็แรง ต้องตามข่าว" },
    tech: { emoji: "🤖", title: "สายเทค/AI", desc: "เชื่อว่าเทคโนโลยีคืออนาคต — พุ่งแรงตอนยุคดี แต่ร่วงแรงตอนดอกเบี้ยขึ้น" },
    thai: { emoji: "🇹🇭", title: "ไทยเข้าใจง่าย", desc: "อยากถือของใกล้ตัว ปันผลเป็นบาท ไม่ต้องกังวลค่าเงิน" },
    guru: { emoji: "🐋", title: "ตามรอยบัฟเฟต์", desc: "ก๊อปปี้ตำแหน่งหุ้นที่เจ้าแห่ง value investing ถืออยู่จริง (13F ล่าช้า 45 วัน)" },
  };

  // ราคาสดรวมก้อนเดียว
  const allSymbols = ["VOO", "QQQ", "GLD", ...Object.values(draftsOf).flat().map((d) => d.symbol)].filter(
    (x, i, arr) => !!x && arr.indexOf(x) === i
  );
  const quotes: Record<string, Quote> = await getQuotes(allSymbols).catch(() => ({} as Record<string, Quote>));

  const mk = (d: Draft): StarterPosition | null => {
    const q = quotes[d.symbol];
    if (!q || !isFinite(q.price) || q.price <= 0) return null;
    const isThb = q.currency === "THB";
    return {
      symbol: q.symbol,
      name: d.name,
      kind: d.kind,
      weight: d.weight,
      priceThb: isThb ? q.price : q.price * usdThb,
      priceLocal: q.price,
      currency: q.currency,
      unitThb: isThb,
      changePct: isFinite(q.changePct) ? q.changePct : null,
      reason: d.reason,
      risk: d.risk,
      market: isThb ? "TH" : "US",
      pe: d.pe ?? null,
      yieldPct: d.yieldPct ?? null,
      roePct: d.roePct ?? null,
      health: d.health ?? null,
      cagr5yPct: d.cagr5yPct ?? null,
      guruPct: d.guruPct ?? null,
      guruChange: d.guruChange ?? null,
    };
  };

  const profiles: StarterProfile[] = (Object.keys(draftsOf) as RiskId[]).map((id) => {
    const wanted = cashOf[id];
    const have = 100 - wanted;
    let positions = draftsOf[id].map(mk).filter((p): p is StarterPosition => !!p);
    const sum = positions.reduce((a, p) => a + p.weight, 0);
    if (sum > 0 && positions.length) {
      positions = positions.map((p) => ({ ...p, weight: Math.round((p.weight / sum) * have * 10) / 10 }));
    }
    const diff = Math.round((have - positions.reduce((a, p) => a + p.weight, 0)) * 10) / 10;
    if (positions.length && diff !== 0) positions[0].weight = Math.round((positions[0].weight + diff) * 10) / 10;
    return { id, ...meta[id], cashPct: wanted, positions, stats: statsOf(positions) };
  });

  return {
    asOf: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.",
    dateTh: new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", weekday: "long" }),
    profiles,
    note: "พอร์ตตัวอย่างนี้ประกอบจากเครื่องยนต์ข้อมูลจริงของวัน (Daily Picks · คะแนนงบจาก filings · ปันผลจาก TradingView · 13F จาก SEC) — เป็นตัวอย่างเพื่อการเรียนรู้ ไม่ใช่คำแนะนำการลงทุน ผลอดีตไม่รับประกันผลอนาคต",
  };
}

export async function getStarterPortfolios(): Promise<StarterResult> {
  if (cached && Date.now() - cached.at < TTL) return cached.data;
  const data = await build();
  cached = { at: Date.now(), data };
  return data;
}
