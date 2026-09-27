// ===== Squeeze Radar — ตรวจจับ "oversell ของกองทุน" แบบที่คนตรวจเจอ GME 2021 =====
// หลักการเดียวกับในคลิป: เทียบยอดหุ้นที่ถูกยืมไปขาย (short interest) กับหุ้นที่หมุนเวียนจริง (float)
// ถ้า short > 100% ของ float = "ขายฝากเกินหุ้นที่มี" = วัตถุดิบ short squeeze
// ข้อมูล: FINRA consolidatedShortInterest (ทั้งตลาดสหรัฐ ฟรี อัปเดต 2 ครั้ง/เดือน) + Yahoo float/ราคา

import { cached, getQuotes, getQuoteSummaryModule } from "./yahoo";
import { jevAsk } from "./typesafe";

export interface JevSqueezeVerdict {
  squeezeLikely: number; // 0-4 โอกาสถูกบีบแรงใน ~3 เดือน
  trap: number; // 0-4 โอกาสเป็นกับดัก (พื้นฐานแยกจริง ฝั่ง short ถูก)
  text: string;
}

/** Jev ชี้ขาดต่อตัว: หลักสวนสั้น vs กับดักพื้นฐานแยก — cache 12 ชม. */
async function jevSqueezeVerdict(symbol: string, r: { dtc: number; shortPctFloat: number | null; chgPct: number; dayChangePct: number | null; price: number | null }): Promise<JevSqueezeVerdict | null> {
  return cached("squeeze:jev:" + symbol, 12 * 3600_000, async () => {
    const a = await jevAsk(
      `Short squeeze analysis for US stock ${symbol}: price ${r.price ?? "?"} (today ${r.dayChangePct !== null ? r.dayChangePct.toFixed(1) + "%" : "?"}), days-to-cover ${r.dtc.toFixed(1)}, short % of float ${r.shortPctFloat !== null ? r.shortPctFloat.toFixed(0) + "%" : "unknown"}, short interest change vs last period ${r.chgPct.toFixed(1)}%.`,
      {
        squeezeLikely: { type: "score", instructions: "Probability of a violent short squeeze (>30% rally within ~3 months) given these positioning metrics?", criteria: ["ต่ำมาก", "มีบ้าง", "สูงพอมีนัย", "สูงชัดเจน"] },
        trap: { type: "score", instructions: "Probability this is a VALUE TRAP — company fundamentals genuinely bad, shorts are right, and retail buying the squeeze loses?", criteria: ["พื้นฐานปกติดี", "มีความเสี่ยงบ้าง", "เสี่ยงสูง", "กับดักชัดเจน"] },
      }
    );
    if (!a) return null;
    const sq = Number((a.squeezeLikely as { score?: number })?.score ?? -1);
    const tp = Number((a.trap as { score?: number })?.score ?? -1);
    if (sq < 0) return null;
    const text = tp >= 3
      ? `🧠 Jev: โอกาส squeeze ${sq.toFixed(0)}/4 แต่เสี่ยงกับดักสูง (${tp.toFixed(0)}/4) — พื้นฐานมักแยกจริง เล่นฝั่งสวนต้องถือสั้นและยอมขาดทุนเร็ว`
      : sq >= 3
        ? `🧠 Jev: โอกาสถูกบีบสูง (${sq.toFixed(0)}/4) และยังไม่ใช่กับดักชัด (${tp.toFixed(0)}/4) — เงื่อนไข positioning เหมือนตำรา แต่จังหวะยังสำคัญ`
        : `🧠 Jev: โอกาส squeeze ปานกลาง (${sq.toFixed(0)}/4) · ความเสี่ยงกับดัก ${tp.toFixed(0)}/4`;
    return { squeezeLikely: sq, trap: tp, text };
  });
}


export interface FinraRow {
  symbol: string;
  name: string;
  shortInterest: number; // หุ้นที่ถูก short (หุ้น)
  prevShort: number; // รอบเก็บก่อนหน้า
  adv: number; // วอลุ่มเฉลี่ย/วัน
  dtc: number; // days to cover = shortInterest / adv
  chgPct: number; // % เปลี่ยนของยอด short เทียบรอบก่อน
  settlementDate: string; // รอบสรุปยอด (settlement date)
}

const FINRA_URL = "https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest";

async function finraPost(body: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const res = await fetch(FINRA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error("finra " + res.status);
  const j = await res.json();
  return Array.isArray(j) ? (j as Record<string, unknown>[]) : [];
}

function toFinraRow(r: Record<string, unknown>): FinraRow | null {
  const symbol = String(r.symbolCode ?? r.issueSymbol ?? r.symbol ?? "").toUpperCase().trim();
  const si = Number(r.currentShortPositionQuantity ?? 0);
  const adv = Number(r.averageDailyVolumeQuantity ?? 0);
  if (!symbol || !/^([A-Z]{1,5})([.\-][A-Z]{1,3})?$/.test(symbol) || !isFinite(si) || si <= 0) return null;
  const prev = Number(r.previousShortPositionQuantity ?? 0);
  return {
    symbol,
    name: String(r.issueName ?? symbol),
    shortInterest: si,
    prevShort: isFinite(prev) ? prev : 0,
    adv,
    dtc: adv > 0 ? Number(r.daysToCoverQuantity ?? si / adv) : 0,
    chgPct: prev > 0 ? ((si - prev) / prev) * 100 : Number(r.changePercent ?? 0),
    settlementDate: String(r.settlementDate ?? "").slice(0, 10),
  };
}

/** ยอด short ล่าสุดทั้งตลาดสหรัฐ (~6-8k ตัว) — cache 12 ชม. (ข้อมูลอัปเดตแค่ 2 ครั้ง/เดือน)
 *  FINRA สรุปยอดทุก ~กลางเดือน+สิ้นเดือน แถมเรียงวันที่เก่า→ใหม่ และจำกัด limit ต่อครั้ง (sortFields ใช้ไม่ได้ = 400)
 *  กลยุทธ์: หน้าต่าง 16 วันล่าสุด (โดนขอบค่อยขยาย 35 วัน) แล้วเก็บเฉพาะ settlementDate ล่าสุด */
export async function getFinraShortInterest(): Promise<{ asOf: string; rows: FinraRow[] } | null> {
  return cached("squeeze:finra", 12 * 3600_000, async () => {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const now = new Date();
    let raw: Record<string, unknown>[] = [];
    for (const days of [16, 35]) {
      const from = iso(new Date(now.getTime() - days * 864e5));
      raw = [];
      for (const offset of [0, 3000, 6000, 9000]) {
        const batch = await finraPost({
          limit: 3000,
          offset,
          dateRangeFilters: [{ fieldName: "settlementDate", startDate: from, endDate: iso(now) }],
        });
        raw.push(...batch);
        if (batch.length < 3000) break;
      }
      if (raw.length) break;
    }
    if (!raw.length) return null;
    // เก็บเฉพาะรอบล่าสุด (หน้าต่างกว้างอาจได้ 2 รอบ)
    const asOf = raw.reduce((m, r) => (String(r.settlementDate) > m ? String(r.settlementDate) : m), "");
    const rows = raw.filter((r) => String(r.settlementDate) === asOf).map(toFinraRow).filter((r): r is FinraRow => !!r);
    if (!rows.length) return null;
    return { asOf: asOf.slice(0, 10), rows };
  });
}

// ---------- Yahoo: float + short% + ราคา ----------

interface YahooShortStats {
  shortPctFloat: number | null; // % ของ float ที่ถูก short
  floatShares: number | null;
  sharesShort: number | null;
  sharesShortPrior: number | null;
  shortRatio: number | null; // days to cover ตาม Yahoo
  mcap: number | null;
  price: number | null;
  name: string | null;
}

async function getShortStats(symbol: string): Promise<YahooShortStats | null> {
  return cached("squeeze:ys:" + symbol.toUpperCase(), 12 * 3600_000, async () => {
    const r = await getQuoteSummaryModule<Record<string, unknown>>(symbol, "defaultKeyStatistics,price");
    if (!r) return null;
    const num = (v: unknown): number | null => {
      const n = typeof v === "object" && v !== null && "raw" in v ? Number((v as { raw?: number }).raw) : Number(v);
      return isFinite(n) && n !== 0 ? n : null;
    };
    const dk = (r.defaultKeyStatistics ?? {}) as Record<string, unknown>;
    const priceObj = (r.price ?? {}) as Record<string, unknown>;
    const spf = num(dk.shortPercentOfFloat); // Yahoo ส่งเป็นสัดส่วน 0.14 = 14% (บางกรณีเป็น % ตรงๆ — ปรับให้เสร็จที่นี่)
    return {
      shortPctFloat: spf === null ? null : spf < 3 ? spf * 100 : spf,
      floatShares: num(dk.floatShares),
      sharesShort: num(dk.sharesShort),
      sharesShortPrior: num(dk.sharesShortPriorMonth),
      shortRatio: num(dk.shortRatio),
      mcap: num(priceObj.marketCap),
      price: num(priceObj.regularMarketPrice),
      name: typeof priceObj.shortName === "string" ? priceObj.shortName : null,
    };
  });
}

// ---------- Squeeze Score ----------

export interface SqueezeRow extends FinraRow {
  jev?: { squeezeLikely: number; trap: number; text: string } | null;
  score: number; // 0-10
  tier: "🔥" | "⚠️" | "👁";
  tierLabel: string;
  gmeZone: boolean; // short > 100% ของ float
  shortPctFloat: number | null;
  floatShares: number | null;
  mcap: number | null;
  price: number | null;
  dayChangePct: number | null; // แรงขึ้นวันนี้ (ธง squeeze กำลังเกิด)
  reasons: string[]; // เหตุผลของคะแนน เป็นภาษาคน
}

function scoreRow(f: FinraRow, ys: YahooShortStats | null, dayChangePct: number | null): SqueezeRow {
  const reasons: string[] = [];
  let score = 0;
  if (f.dtc >= 10) { score += 3; reasons.push(`ถอยยากมาก ${f.dtc.toFixed(1)} วัน (DTC≥10)`); }
  else if (f.dtc >= 7) { score += 2; reasons.push(`ถอยยาก ${f.dtc.toFixed(1)} วัน (DTC≥7)`); }
  else if (f.dtc >= 3) { score += 1; reasons.push(`DTC ${f.dtc.toFixed(1)} วัน`); }

  const spf = ys?.shortPctFloat ?? null;
  if (spf !== null) {
    if (spf > 100) { score += 4; reasons.push(`🚨 short ${spf.toFixed(0)}% ของ float — ขายเกินหุ้นที่มีจริง (โซน GME)`); }
    else if (spf >= 50) { score += 3; reasons.push(`short ${spf.toFixed(0)}% ของ float (สูงมาก)`); }
    else if (spf >= 20) { score += 2; reasons.push(`short ${spf.toFixed(0)}% ของ float (สูง)`); }
    else if (spf >= 10) { score += 1; reasons.push(`short ${spf.toFixed(0)}% ของ float`); }
  }

  if (f.chgPct >= 25) { score += 2; reasons.push(`ยอด short เพิ่มขึ้น ${f.chgPct.toFixed(0)}% ในรอบเดือน`); }
  else if (f.chgPct >= 10) { score += 1; reasons.push(`ยอด short เพิ่มขึ้น ${f.chgPct.toFixed(0)}%`); }

  const float = ys?.floatShares ?? null;
  const mcap = ys?.mcap ?? null;
  if ((float !== null && float < 30e6) || (mcap !== null && mcap < 2e9)) {
    score += 1;
    reasons.push("float เล็ก/แคปเล็ก = บีบง่าย");
  }

  if (dayChangePct !== null && dayChangePct >= 5) {
    score += 1;
    reasons.push(`วิ่งแรงวันนี้ +${dayChangePct.toFixed(1)}% — squeeze อาจกำลังเกิด`);
  }

  score = Math.min(10, score);
  const tier = score >= 8 ? "🔥" : score >= 6 ? "⚠️" : "👁";
  const tierLabel = score >= 8 ? "วัตถุดิบ squeeze หนา" : score >= 6 ? "เสี่ยงถูกบีบ" : "เฝ้าดู";
  return {
    ...f,
    score,
    tier: tier as SqueezeRow["tier"],
    tierLabel,
    gmeZone: spf !== null && spf > 100,
    shortPctFloat: spf,
    floatShares: float,
    mcap,
    price: ys?.price ?? null,
    dayChangePct,
    reasons,
  };
}

export interface CoverRow extends FinraRow {
  price: number | null;
  dayChangePct: number | null;
  shortPctFloat: number | null;
}

export interface SqueezeDashboard {
  asOf: string; // รอบ FINRA
  scanned: number; // จำนวนหุ้นที่สแกน
  risky: SqueezeRow[]; // เรียงตาม score
  gmeZoneCount: number;
  covering: CoverRow[]; // short ถอยเร็ว + ยังมีความหมาย
  thai: ThaiOversold[];
}

export interface ThaiOversold {
  symbol: string; // XXX.BK
  name: string;
  price: number;
  chg1m: number; // % 1 เดือน (ติดลบมาก = ตกมาก)
  chg3m: number;
  mcap: number;
  sector: string;
}

/** โหมดไทย: ไทยไม่มี short interest รายหุ้นแบบเปิด → ใช้ "ตกหนักด้านราคา" จาก TradingView แทน (คนละเรื่องกับ squeeze จริง) */
async function scanThaiOversold(): Promise<ThaiOversold[] | null> {
  return cached("squeeze:thai", 6 * 3600_000, async () => {
    const body = {
      filter: [
        { left: "type", operation: "equal", right: "stock" },
        { left: "market_cap_basic", operation: "in_range", right: [3e10, 1e16] }, // ≥30,000 ล้านบาท
      ],
      columns: ["name", "close", "change", "market_cap_basic", "sector", "Perf.W", "Perf.1M", "Perf.3M"],
      sort: { sortBy: "Perf.1M", sortOrder: "asc" },
      range: [0, 15],
    };
    try {
      const res = await fetch("https://scanner.tradingview.com/thailand/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { data?: { s: string; d: (string | number | null)[] }[] };
      return (j.data ?? [])
        .map((x) => ({
          symbol: (x.s.split(":").pop() ?? x.s).trim().replace(/^([A-Z0-9]+)$/, "$1.BK"),
          name: String(x.d[0] ?? x.s),
          price: Number(x.d[1] ?? 0),
          chg1m: Number(x.d[6] ?? 0),
          chg3m: Number(x.d[7] ?? 0),
          mcap: Number(x.d[3] ?? 0),
          sector: String(x.d[4] ?? ""),
        }))
        .filter((t) => t.price > 0);
    } catch {
      return null;
    }
  });
}

/** Dashboard หลัก: FINRA ทั้งตลาด → pre-score → เสริม Yahoo float/ราคาเฉพาะ top candidates */
export async function getSqueezeDashboard(): Promise<SqueezeDashboard | null> {
  const finra = await getFinraShortInterest();
  if (!finra) return null;

  // pre-score จาก FINRA ล้วน (ยังไม่มี float) เพื่อเลือกตัวที่จะเรียก Yahoo
  // กรอง micro-cap เงียบ (ADV ต่ำมาก) ที่ทำให้ DTC พุ่งเพราะอสังหา ไม่ใช่เพราะ short จริง
  const LIQUID = (f: FinraRow) => f.adv >= 5_000 && f.shortInterest >= 200_000 && Math.abs(f.chgPct) < 500 && f.dtc <= 60;
  const pre = finra.rows.filter(LIQUID).map((f) => {
    let p = 0;
    if (f.dtc >= 10) p += 3; else if (f.dtc >= 7) p += 2; else if (f.dtc >= 3) p += 1;
    if (f.chgPct >= 25) p += 2; else if (f.chgPct >= 10) p += 1;
    if (f.shortInterest > 1_000_000) p += 1; // ตัวใหญ่พอที่กองทุนจริงจัง
    return { f, p };
  });

  const WATCH = new Set(["GME", "AMC", "BBBY", "CVNA", "SOFI", "RIVN", "LCID", "PLTR", "NKLA", "BBAI"]);
  const topCandidates = [...pre].sort((a, b) => b.p - a.p).slice(0, 70).map((x) => x.f.symbol);
  for (const w of WATCH) {
    const f = finra.rows.find((r) => r.symbol === w);
    if (f && !topCandidates.includes(w)) topCandidates.push(w);
  }

  // ราคาวันนี้ batch เดียว
  const quotes = await getQuotes(topCandidates);
  const enriched: SqueezeRow[] = [];
  for (const sym of topCandidates) {
    const f = finra.rows.find((r) => r.symbol === sym);
    if (!f) continue;
    const ys = await getShortStats(sym);
    enriched.push(scoreRow(f, ys, quotes[sym]?.changePct ?? null));
  }
  enriched.sort((a, b) => b.score - a.score || (b.shortPctFloat ?? 0) - (a.shortPctFloat ?? 0));

  // Jev ชี้ขาด 8 อันดับแรก (cache 12 ชม. — ไม่ทำให้ช้ารอบถัดไป)
  const top8 = enriched.slice(0, 8);
  (await Promise.all(top8.map(async (r) => ({ sym: r.symbol, j: await jevSqueezeVerdict(r.symbol, { dtc: r.dtc, shortPctFloat: r.shortPctFloat, chgPct: r.chgPct, dayChangePct: r.dayChangePct, price: r.price }) })))).forEach(({ sym, j }) => { const t = enriched.find(e => e.symbol === sym); if (t) (t as SqueezeRow & { jev?: JevSqueezeVerdict | null }).jev = j; });

  // Shorts กำลังถอย: ยอด short ลดเร็ว (>15%) แต่ยังสูงพอจะมีความหมาย (กรอง micro-cap เงียบเช่นกัน)
  const covering: CoverRow[] = finra.rows
    .filter(LIQUID)
    .filter((f) => f.chgPct <= -15 && f.shortInterest > 500_000 && f.dtc >= 2)
    .sort((a, b) => a.chgPct - b.chgPct)
    .slice(0, 25)
    .map((f) => ({ ...f, price: quotes[f.symbol]?.price ?? null, dayChangePct: quotes[f.symbol]?.changePct ?? null, shortPctFloat: null }));

  const thai = (await scanThaiOversold()) ?? [];

  return {
    asOf: finra.asOf,
    scanned: finra.rows.length,
    risky: enriched.slice(0, 40),
    gmeZoneCount: enriched.filter((r) => r.gmeZone).length,
    covering,
    thai,
  };
}

// ---------- วิเคราะห์รายตัว ----------

export interface SqueezeAnalysis extends SqueezeRow {
  jev?: JevSqueezeVerdict | null;
  yahoo: { shortPctFloat: number | null; sharesShort: number | null; sharesShortPrior: number | null; shortRatio: number | null; floatShares: number | null } | null;
  verdict: string;
  explain: string[];
}

export async function analyzeSqueeze(input: string): Promise<SqueezeAnalysis | { error: string }> {
  const symbol = input.toUpperCase().trim();
  if (!symbol || symbol.length > 8 || !/^[A-Z]{1,5}([.\-][A-Z]{1,3})?$/.test(symbol))
    return { error: "รูปแบบ symbol ไม่ถูกต้อง (เช่น GME, AMC)" };
  if (symbol.endsWith(".BK"))
    return { error: "ตลาดไทยยังไม่มีข้อมูล short interest สาธารณะรายหุ้น (FINRA มีเฉพาะสหรัฐฯ) — ดูโหมดไทยในหน้าหลัก" };

  const finra = await getFinraShortInterest();
  const f = finra?.rows.find((r) => r.symbol === symbol);
  const [ys, q] = await Promise.all([getShortStats(symbol), (async () => (await getQuotes([symbol]))[symbol] ?? null)()]);
  if (!f && !ys) return { error: `ไม่พบ ${symbol} ในข้อมูล FINRA/Yahoo (หรือไม่ใช่หุ้นสหรัฐฯ)` };

  const base: FinraRow = f ?? {
    symbol,
    name: ys?.name ?? symbol,
    shortInterest: ys?.sharesShort ?? 0,
    prevShort: ys?.sharesShortPrior ?? 0,
    adv: 0,
    dtc: ys?.shortRatio ?? 0,
    chgPct: ys && ys.sharesShort && ys.sharesShortPrior ? ((ys.sharesShort - ys.sharesShortPrior) / ys.sharesShortPrior) * 100 : 0,
    settlementDate: finra?.asOf ?? "",
  };
  const row = scoreRow(base, ys, q?.changePct ?? null);

  const explain: string[] = [];
  explain.push("วิธีอ่านเหมือนคนตรวจเจอ GME: เทียบ 'หุ้นที่ถูกยืมไปขาย (short interest)' กับ 'หุ้นที่หมุนเวียนจริง (float)'");
  if (row.shortPctFloat !== null)
    explain.push(
      row.shortPctFloat > 100
        ? `Short ${row.shortPctFloat.toFixed(0)}% ของ float = มีคนขายฝากหุ้นมากกว่าหุ้นที่มีอยู่จริง (ยืมซ้ำ/ซื้อขายสังเคราะห์) — เงื่อนไขเดียวกับ GME ธ.ค. 2020 ที่ ~140%`
        : `Short ${row.shortPctFloat.toFixed(1)}% ของ float — เกณฑ์อ่าน: >10% เริ่มน่าสนใจ, >20% สูง, >50% สูงมาก, >100% = โซน GME`
    );
  else explain.push("Yahoo ไม่มี shortPercentOfFloat ของตัวนี้ (หุ้นจัดเก็บ/ADR บางประเภท) — ดู DTC และยอด short เทียบเดือนก่อนแทน");
  if (row.dtc > 0) explain.push(`Days-to-Cover ${row.dtc.toFixed(1)} วัน = ถ้า short ทุกคนต้องซื้อคืน จะกินวอลุ่มธรรมดา ${row.dtc.toFixed(1)} วัน — ยิ่งสูง ยิ่งบีบแรงเมื่อราคาเริ่มวิ่ง`);
  if (row.chgPct !== 0) explain.push(`ยอด short ${row.chgPct >= 0 ? "เพิ่ม" : "ลด"} ${Math.abs(row.chgPct).toFixed(1)}% จากรอบก่อน — ${row.chgPct >= 0 ? "ฝั่งหมีหนักขึ้น" : "หมีกำลังถอย (ระวังหลักสวนสั้น)"}`);

  const verdict = row.score >= 8
    ? "🔥 วัตถุดิบ squeeze หนา — ตัวเลขจัดเต็มทุกข้อ แต่จำไว้: ยิ่ง short เยอะ = ตลาดมักเห็นพื้นฐานแยกด้วย (คนถูกที่ผิดจังหวะ)"
    : row.score >= 6
      ? "⚠️ มีความเสี่ยงถูกบีบพอควร — ตามต่อว่าราคาเริ่มวิ่ง+วอลุ่มพุ่งหรือยัง"
      : "👁 ยังไม่มีสัญญาณ squeeze พอ — เก็บไว้ใน watchlist ได้";
  const jev = await jevSqueezeVerdict(symbol, { dtc: row.dtc, shortPctFloat: row.shortPctFloat, chgPct: row.chgPct, dayChangePct: row.dayChangePct, price: row.price });
  return {
    ...row,
    jev,
    name: f?.name ?? ys?.name ?? symbol,
    yahoo: ys ? { shortPctFloat: ys.shortPctFloat, sharesShort: ys.sharesShort, sharesShortPrior: ys.sharesShortPrior, shortRatio: ys.shortRatio, floatShares: ys.floatShares } : null,
    verdict,
    explain,
  };
}
