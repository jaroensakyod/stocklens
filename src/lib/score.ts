// ===== StockLens Score — คะแนนรวม 6 เสา สูตรเปิดเผยทุกตัว (จุดขาย: ตรวจสอบได้ + บอก confidence) =====
// ออกแบบ: แต่ละเสา 0-100 ถ่วงน้ำหนักรวม · เสาไหนไม่มีข้อมูล = ใช้ 50 (กลาง) และหัก confidence
// ไม่ลงโทษหุ้นที่ข้อมูลไม่ครบด้วยการเดา — บอกตรงๆ ว่า "เรารู้อะไร ไม่รู้อะไร" (แนว trust-model ของเว็บ)
// แหล่งข้อมูล: buildAnalysis (factors/technicals/news) + kb (งบ 4 ปี + EDGAR) + analyst consensus + กราฟ 1 ปี

import { buildAnalysis } from "./analysis";
import { kbFundamentals } from "./kb";
import { getAnalystConsensus } from "./yahoo";
import { cached } from "./yahoo";
import { getQuotes } from "./yahoo";

export interface ScorePillars {
  quality: number | null;
  valuation: number | null;
  momentum: number | null;
  news: number | null;
  street: number | null;
  safety: number | null;
}
export interface StockLensScore {
  symbol: string;
  total: number; // 0-100
  grade: string; // แก่นพอง่วนไทย
  pillars: ScorePillars;
  confidence: number; // 0-100 ว่าข้อมูลครบแค่ไหน
  reasons: string[];
  risks: string[];
  updatedAt: number;
}

const W = { quality: 0.22, valuation: 0.18, momentum: 0.18, news: 0.12, street: 0.15, safety: 0.15 };
const NEUTRAL = 50;
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const growthScore = (v: number, lo: number, hi: number) => clamp(((v - lo) / (hi - lo)) * 100);

function gradeOf(t: number): string {
  if (t >= 80) return "น่าสนใจมาก";
  if (t >= 68) return "น่าสนใจ";
  if (t >= 55) return "ปานกลาง-บวก";
  if (t >= 45) return "ปานกลาง";
  return "เฝ้าระวัง";
}

export async function computeScore(symbol: string): Promise<StockLensScore | null> {
  const sym = symbol.toUpperCase();
  return cached<StockLensScore>(`score:v1:${sym}`, 12 * 3600_000, async () => {
    const [a, kb, analyst] = await Promise.all([
      buildAnalysis(sym).catch(() => null),
      kbFundamentals(sym).catch(() => null),
      getAnalystConsensus(sym).catch(() => null),
    ]);
    if (!a || !isFinite(a.quote.price)) return null;

    const reasons: string[] = [];
    const risks: string[] = [];
    const f = a.factors;

    // ---- Quality: คุณภาพธุรกิจจากงบจริง (kb) ----
    let quality: number | null = null;
    if (kb) {
      const ttm = kb.annual[0];
      const parts: number[] = [];
      if (kb.ratios.revenueCagr !== undefined) parts.push(growthScore(kb.ratios.revenueCagr, -0.05, 0.25));
      if (kb.ratios.netIncomeCagr !== undefined) parts.push(growthScore(kb.ratios.netIncomeCagr, -0.1, 0.4));
      if (ttm?.netMargin !== undefined) parts.push(growthScore(ttm.netMargin, -0.05, 0.25));
      if (ttm?.roe !== undefined) parts.push(growthScore(ttm.roe, -0.05, 0.35));
      if (kb.ratios.fcfMargin !== undefined) parts.push(growthScore(kb.ratios.fcfMargin, -0.05, 0.2));
      if (parts.length) {
        quality = parts.reduce((x, y) => x + y, 0) / parts.length;
        if (kb.edgarVerified) quality = clamp(quality + 5);
        if (kb.ratios.netDebt !== undefined && kb.ratios.netDebt > 0) quality = clamp(quality - Math.min(15, kb.ratios.netDebt * 30));
        if (quality >= 75) {
          const hi = ttm?.roe !== undefined ? ` ROE ${(ttm.roe * 100).toFixed(0)}%` : "";
          reasons.push(`พื้นฐานแข็ง: โต/กำไรดี (${kb.edgarVerified ? "ยืนยัน SEC" : "งบบริษัท"}${hi})`);
        }
        if (kb.ratios.netDebt !== undefined && kb.ratios.netDebt > 0.8) risks.push(`หนี้สุทธิสูง ${(kb.ratios.netDebt * 100).toFixed(0)}% ของทุน`);
      }
    }

    // ---- Valuation: ต่อจาก factors เดิม + ปันผล ----
    let valuation: number | null = f ? f.valuation : null;
    if (valuation !== null && kb?.dividendYieldPct) {
      valuation = clamp(valuation + Math.min(10, kb.dividendYieldPct * 1.5));
      if (kb.dividendYieldPct >= 4) reasons.push(`ปันผล ${kb.dividendYieldPct.toFixed(1)}% ต่อปี`);
    }

    // ---- Momentum: factors + สัญญาณเทคนิค ----
    let momentum: number | null = f ? f.momentum : null;
    const t = a.technicals;
    if (momentum !== null && t?.signal) {
      momentum = clamp(momentum + (t.signal === "bullish" ? 8 : t.signal === "bearish" ? -8 : 0));
      if (t.signal === "bearish" && momentum < 45) risks.push("โมเมนตัมราคาเป็นลบ (สัญญาณเทคนิคเอียงลบ)");
    }

    // ---- News AI: จากคะแนนข่าวรายหุ้นของ Jev (ไม่มี = null ไม่ลงโทษ) ----
    let news: number | null = null;
    const scored = a.news.filter((n) => n.score).slice(0, 5);
    if (scored.length) {
      const s = scored.reduce(
        (acc, n) => acc + ((n.score!.sentiment === "bullish" ? 1 : n.score!.sentiment === "bearish" ? -1 : 0) * Math.max(0.3, n.score!.impact)),
        0
      );
      const susp = scored.filter((n) => n.score!.suspicious).length;
      news = clamp(50 + s * 12 - susp * 12);
      if (susp) risks.push(`ข่าวน่าสงสัย ${susp} ชิ้น (ลักษณะข่าวปั่น/อ้างอิงไม่ชัด)`);
      if (news >= 70) reasons.push(`ข่าวล่าสุดเอียงบวก (${scored.length} ชิ้นที่ตรวจ)`);
      if (news <= 30) risks.push("ข่าวล่าสุดเอียงลบ");
    }

    // ---- Street: คอนเซนซัสโบรกเกอร์ ----
    let street: number | null = null;
    if (analyst && analyst.nAnalysts >= 3) {
      const buyRatio = (analyst.strongBuy + analyst.buy) / Math.max(1, analyst.strongBuy + analyst.buy + analyst.hold + analyst.sell + analyst.strongSell);
      const upside = analyst.targetMean && a.quote.price ? (analyst.targetMean / a.quote.price - 1) * 100 : 0;
      street = clamp(50 + (buyRatio - 0.5) * 60 + Math.max(-15, Math.min(20, upside * 0.5)));
      if (street >= 70 && analyst.nAnalysts >= 10) reasons.push(`โบรกเกอร์ ${analyst.nAnalysts} สำนักเฉลี่ยเป้าสูงกว่าราคา ${upside >= 0 ? "+" : ""}${upside.toFixed(0)}%`);
    }

    // ---- Safety: ความผันผวน + drawdown + หนี้ + บรรยากาศตลาด ----
    let safety: number | null = null;
    {
      const [chart, vixQ] = await Promise.all([
        import("./yahoo").then((m) => m.getChart(sym, "1Y")).catch(() => [] as { close: number }[]),
        getQuotes(["^VIX"]).catch(() => ({}) as Record<string, { price: number }>),
      ]);
      const closes = chart.map((c) => c.close).filter((v: number) => isFinite(v) && v > 0);
      if (closes.length > 60) {
        const rets: number[] = [];
        for (let i = 1; i < closes.length; i++) rets.push(closes[i] / closes[i - 1] - 1);
        const mean = rets.reduce((x, y) => x + y, 0) / rets.length;
        const vol = Math.sqrt(rets.reduce((x, y) => x + (y - mean) ** 2, 0) / rets.length) * Math.sqrt(252);
        let peak = closes[0];
        let mdd = 0;
        for (const c of closes) {
          peak = Math.max(peak, c);
          mdd = Math.min(mdd, c / peak - 1);
        }
        const de = a.financials?.debtToEquity;
        const vix = vixQ["^VIX"]?.price;
        safety = clamp(100 - vol * 130 - Math.abs(mdd) * 60 - (de && de > 150 ? 8 : 0) - (vix && vix > 25 ? 8 : 0));
        if (safety <= 35) risks.push(`ผันผวนสูง (vol ${(vol * 100).toFixed(0)}%/ปี, ตกสูงสุด ${(mdd * 100).toFixed(0)}%)`);
        else if (safety >= 75) reasons.push("ราคานิ่ง ความเสี่ยงราคาต่ำ");
      }
    }

    const pillars: ScorePillars = { quality, valuation, momentum, news, street, safety };
    const filled: [keyof ScorePillars, number][] = (Object.keys(W) as (keyof ScorePillars)[]).map((k) => [k, pillars[k] ?? NEUTRAL]);
    const total = clamp(filled.reduce((acc, [k, v]) => acc + v * W[k], 0));
    const haveW = (Object.keys(W) as (keyof ScorePillars)[]).reduce((acc, k) => acc + (pillars[k] !== null ? W[k] : 0), 0);
    const confidence = Math.round((haveW / 1) * 100);
    return {
      symbol: sym,
      total,
      grade: gradeOf(total),
      pillars,
      confidence,
      reasons: reasons.slice(0, 4),
      risks: risks.slice(0, 4),
      updatedAt: Date.now(),
    };
  });
}

/** บันทึกประวัติคะแนนรายวัน (เรียกจาก cron) — สะสม track record จริงของ Score ทีละวัน */
export async function recordScoreHistory(symbol: string): Promise<void> {
  const s = await computeScore(symbol).catch(() => null);
  if (!s) return;
  const { kvGet, kvSet } = await import("./storage");
  const key = `score:hist:${symbol}`;
  const list = (await kvGet<{ d: string; t: number }[]>(key).catch(() => null)) ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const next = [...list.filter((x) => x.d !== today), { d: today, t: s.total }].slice(-400);
  await kvSet(key, next).catch(() => {});
}
