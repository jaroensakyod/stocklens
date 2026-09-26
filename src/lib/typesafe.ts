// ===== Jev (TypeSafe System One) — ผู้ตัดสินราคาถูก ~$0.00002/ครั้ง เร็ว ~0.3s =====
// หน้าที่: ให้คะแนนข่าว (sentiment/impact) — ไม่ใช่ตัวเขียนบทวิเคราะห์ (นั่นยังเป็นของ Gemini)
// กติกา: ไม่มี TYPESAFE_API_KEY / ยิงพัง / timeout = คืน null เสมอ → ผู้เรียกต้อง fallback ระบบเดิมได้
// แคช 2 ชั้น: memory 1 ชม. + Redis 24 ชม. (คะแนนข่าว 1 พาดหัวนิ่งพอ ไม่ต้องยิงซ้ำ)

import { createHash } from "crypto";
import { kvGet, kvSet } from "./storage";

const API = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-latest";
const TIMEOUT = 8_000;

export type JevAnswers = Record<string, unknown> | null;

const mem = new Map<string, { at: number; val: Record<string, unknown> }>();
const MEM_TTL = 3600e3;
const KV_TTL = 24 * 3600;

/** ถาม Jev คำถามแบบมี type — คืน answers หรือ null (ไม่มี key/พัง) */
export async function jevAsk(state: string, questions: Record<string, unknown>): Promise<JevAnswers> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key || !state) return null;
  const h = createHash("sha1").update(JSON.stringify([state, questions])).digest("hex").slice(0, 24);
  const m = mem.get(h);
  if (m && Date.now() - m.at < MEM_TTL) return m.val;
  try {
    const cached = await kvGet<Record<string, unknown>>("jev:" + h);
    if (cached && typeof cached === "object") {
      mem.set(h, { at: Date.now(), val: cached });
      return cached;
    }
  } catch {
    // Redis ล่ม = ยังยิงตรงได้
  }
  const call = async () =>
    fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ state, model: MODEL, questions }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
  try {
    let res = await call();
    if (res.status === 429 || res.status === 529) {
      await new Promise((r) => setTimeout(r, 1200)); // backoff ครั้งเดียวตามคู่มือ
      res = await call();
    }
    if (!res.ok) return null;
    const j = (await res.json()) as { answers?: Record<string, unknown> };
    if (!j.answers) return null;
    mem.set(h, { at: Date.now(), val: j.answers });
    kvSet("jev:" + h, j.answers, KV_TTL).catch(() => {});
    return j.answers;
  } catch {
    return null;
  }
}

// ---------- ให้คะแนนข่าวหุ้น (จุดใช้งานหลัก) ----------
export interface NewsScore {
  sentiment: "bullish" | "bearish" | "neutral";
  impact: number; // 0-2 (0 เสียงเบา · 2 catalyst)
  confidence: number; // 0-1 ของ sentiment
  substantive?: boolean; // true = ข่าวจริงมีนัยยะ (ใช้กรองขยะ/วาไรตี้)
  suspicious?: boolean; // true = มีลักษณะข่าวปั่น/โฆษณา (เช็คความน่าเชื่อถือ)
  verifiable?: boolean; // true = claim ตรวจสอบกับแหล่งทางการได้
}

const NEWS_QUESTIONS = {
  sentiment: {
    type: "choice",
    instructions: "Overall news sentiment for the stock or market mentioned",
    criteria: {
      bullish: "Positive for the stock price",
      neutral: "Little or no price impact",
      bearish: "Negative for the stock price",
    },
  },
  impact: {
    type: "score",
    instructions: "How significant this news is for the stock price short term",
    criteria: [
      "Minor noise, no real impact",
      "Moderate impact, may move price slightly",
      "Major catalyst, likely to move price significantly",
    ],
  },
  substantive: {
    type: "noul",
    instructions: "This is substantive market or business news with real informational value (not an ad, listicle, evergreen tutorial, or celebrity trivia)",
  },
  // ⚠️ เช็คความน่าเชื่อถือ (กรณี "สุภาพร" — ป้องกันข่าวปั่นหุ้นไทย): ยิงรวมชุดเดิม ไม่เพิ่มต้นทุน
  verifiable_claim: {
    type: "noul",
    instructions: "The headline makes a specific factual claim (deal size, named buyer, earnings number, regulatory approval) that could be checked against an official filing or announcement",
  },
  pump_pattern: {
    type: "noul",
    instructions: "The headline shows hallmarks of stock manipulation or baseless hype: unnamed or vague big investors, urgency words, guaranteed gains, or sensational claims without a verifiable source",
  },
} as const;

/** ให้คะแนนข่าว 1 พาดหัว — null = ยังไม่พร้อมใช้ (ไม่มี key ฯลฯ) */
export async function scoreNews(title: string): Promise<NewsScore | null> {
  const a = (await jevAsk(title, NEWS_QUESTIONS as unknown as Record<string, unknown>)) as
    | { sentiment?: { choice?: string; confidence?: number }; impact?: { score?: number }; substantive?: { noul?: number }; verifiable_claim?: { noul?: number }; pump_pattern?: { noul?: number } }
    | null;
  const s = a?.sentiment?.choice;
  if (s !== "bullish" && s !== "bearish" && s !== "neutral") return null;
  const suspicious = typeof a?.pump_pattern?.noul === "number" ? a.pump_pattern.noul >= 0.6 : undefined;
  // ไม่มี Jev → ใช้ heuristic เอง (rule ภาษาไทย ไม่ง้อใคร)
  const heur = heuristicRisk(title);
  return {
    sentiment: s,
    impact: typeof a?.impact?.score === "number" ? a.impact.score : 0.5,
    confidence: typeof a?.sentiment?.confidence === "number" ? a.sentiment.confidence : 0.5,
    substantive: typeof a?.substantive?.noul === "number" ? a.substantive.noul >= 0.5 : undefined,
    verifiable: typeof a?.verifiable_claim?.noul === "number" ? a.verifiable_claim.noul >= 0.5 : undefined,
    suspicious: suspicious ?? heur >= 2,
  };
}

// ---------- Heuristic ตรวจข่าวหุ้นไทย (rule เอง — ทำงานแม้ไม่มี TYPESAFE_API_KEY) ----------
const RISK_KEYWORDS: [RegExp, string][] = [
  [/ผู้ถือหุ้นรายใหญ่|นักลงทุนรายใหญ่|เศรษฐี|เซียนหุ้น/, "อ้างผู้ซื้อรายใหญ่ไม่ระบุตัว"],
  [/กำลังเข้าซื้อ|จะเข้าซื้อ|เตรียมเข้าซื้อ|เสนอซื้อ/, "อ้างการเข้าซื้อ"],
  [/มูลค่า.{0,12}(พันล้าน|หมื่นล้าน|ล้านบาท)|พันล้านบาท/, "อ้างมูลค่าดีล"],
  [/ด่วน|รีบ|ห้ามพลาด|last chance|อาจไม่ทัน/, "คำกระตุ้นความเร่งรีบ"],
  [/การันตี|แน่นอนว่า|รวยแน่|กำไรแน่/, "สัญญาผลตอบแทน"],
  [/ก่อนประกาศ|ก่อนข่าว|คนใน/, "อ้างข้อมูลก่อนเปิดเผย"],
];
export function heuristicRisk(title: string): number {
  let risk = 0;
  for (const [re] of RISK_KEYWORDS) if (re.test(title)) risk++;
  return risk;
}
/** ป้ายความน่าเชื่อถือ: รวม Jev + heuristic → ok | warn | danger (+เหตุผล) */
export function credibilityBadge(score: NewsScore | null, title: string): { label: "ok" | "warn" | "danger"; text: string } | null {
  const heur = heuristicRisk(title);
  if (score?.suspicious || heur >= 3) return { label: "danger", text: "มีลักษณะข่าวปั่น — ตรวจกับ 246-1/56-1 ของ SET ก่อนเชื่อ" };
  if ((score && score.verifiable === false) || heur === 2) return { label: "warn", text: "อ้างอิงไม่ชัด — รอยืนยันจากแหล่งทางการ" };
  if (score?.verifiable === true) return { label: "ok", text: "claim ตรวจสอบได้" };
  return null;
}

/** ให้คะแนนหลายพาดหัวพร้อมกัน (concurrency 8 กันยิงรัว) — คืน Map ตาม title */
export async function scoreNewsMany(titles: string[]): Promise<Map<string, NewsScore>> {
  const uniq = [...new Set(titles.filter((t) => t && t.length > 10))].slice(0, 24);
  const out = new Map<string, NewsScore>();
  for (let i = 0; i < uniq.length; i += 8) {
    const chunk = uniq.slice(i, i + 8);
    const scores = await Promise.all(chunk.map((t) => scoreNews(t)));
    chunk.forEach((t, j) => {
      if (scores[j]) out.set(t, scores[j] as NewsScore);
    });
  }
  return out;
}

// ---------- Guardrail: กันคำตอบ AI เกินขอบเขตก่อนส่งถึงผู้ใช้ ----------
export interface GuardResult {
  flagged: boolean;
  guaranteedReturns: boolean;
  recklessDirective: boolean;
}

const GUARD_QUESTIONS = {
  guaranteed_returns: {
    type: "noul",
    instructions: "The text promises, guarantees, or strongly implies guaranteed investment returns or a sure outcome (e.g. 'รับประกันกำไร', 'แน่นอนว่าราคาขึ้น')",
  },
  reckless_directive: {
    type: "noul",
    instructions: "The text tells the reader to buy or sell a specific investment with certainty, without any hedging, risk caveat, or disclaimer",
  },
} as const;

/** ตรวจคำตอบ AI ก่อนโชว์ — null = ตรวจไม่ได้ (ถือว่าผ่าน อย่า block ผู้ใช้เพราะระบบเสริมล่ม) */
export async function guardAdvice(text: string): Promise<GuardResult | null> {
  if (!text || text.length < 40) return { flagged: false, guaranteedReturns: false, recklessDirective: false };
  const a = (await jevAsk(text.slice(0, 6000), GUARD_QUESTIONS as unknown as Record<string, unknown>)) as
    | { guaranteed_returns?: { noul?: number }; reckless_directive?: { noul?: number } }
    | null;
  if (!a) return null;
  const g = (a.guaranteed_returns?.noul ?? 0) >= 0.6;
  const r = (a.reckless_directive?.noul ?? 0) >= 0.6;
  return { flagged: g || r, guaranteedReturns: g, recklessDirective: r };
}

// ---------- Theme matcher: จับธีมจากเหตุการณ์ด้วยความเข้าใจ (แทน keyword ล้วน) ----------
/** ถาม Jev แบบ choice แล้วคืน probability ของทุกตัวเลือก (เอา top-N เองได้) — null = ใช้ไม่ได้ */
export async function jevChoiceProbabilities(
  state: string,
  instructions: string,
  options: Record<string, string>,
): Promise<Record<string, number> | null> {
  const a = (await jevAsk(state, { theme: { type: "choice", instructions, criteria: options } })) as
    | { theme?: { probabilities?: Record<string, number> } }
    | null;
  const p = a?.theme?.probabilities;
  if (!p || typeof p !== "object") return null;
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(p)) if (typeof v === "number" && isFinite(v)) clean[k] = v;
  return Object.keys(clean).length ? clean : null;
}
