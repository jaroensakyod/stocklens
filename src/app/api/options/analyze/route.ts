import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { chatOnce, hasAI, SYSTEM_ANALYST } from "@/lib/ai";
import { jevAsk } from "@/lib/typesafe";
import { getExpiries, getChain, findContract, type OptContract } from "@/lib/optionChain";
import { buildAnalysis } from "@/lib/analysis";
import { getEarningsCalendar } from "@/lib/earningsCalendar";
import { getCached, setCached } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/options/analyze { symbol } — AI Options Strategist (สมาชิก Starter+)
// ประกอบ truth packet จากข้อมูลจริง (score/technicals/earnings/IV) → Gemini เสนอ play → Jev ตรวจ
interface PlayResult {
  stance: "bullish" | "bearish" | "neutral";
  confidence: number;
  play: "long_call" | "long_put" | "no_play";
  optionType: "call" | "put";
  strike: number;
  expiry: string;
  entryEst: number;       // premium ต่อสัญญา
  entryTotal: number;     // × 100 หุ้น
  target: number;         // TP (ราคา option)
  stop: number;           // SL
  contracts: number;
  breakEven: number;      // ราคา underlying ที่กำไร=0
  reasons: string[];
  risks: string[];
  exitPlan: string;
  delta: number;
  thetaDay: number;
  atmIv: number | null;
  ivPremiumPct: number | null;
  daysToEarnings: number | null;
  jevVerdict?: string;
  jevStance?: number | null;
  mode: "ai" | "no_ai";
}

const PORTFOLIO_SIM = 10_000; // พอร์ตสมมติ $10k — premium ≤ 3% ต่อไม้
const MAX_PREMIUM = PORTFOLIO_SIM * 0.03;
const MIN_DELTA = 0.30;
const MAX_DELTA = 0.70;

export async function POST(req: NextRequest) {
  const guard = requireMember(req);
  if (!guard.ok) return NextResponse.json({ error: "🔒 AI วิเคราะห์ option เป็นสิทธิ์สมาชิก Starter ขึ้นไป" }, { status: 401 });

  const { symbol } = (await req.json().catch(() => ({}))) as { symbol?: string };
  const sym = (symbol ?? "").toUpperCase().replace(/\.[A-Z]{2}$/, "");
  if (!sym) return NextResponse.json({ error: "กรอก symbol" }, { status: 400 });
  if (sym.includes(".")) return NextResponse.json({ error: "Options รองรับหุ้นสหรัฐฯ เท่านั้น" }, { status: 400 });

  // Cache 30 นาทีต่อ symbol (ไม้ option ไม่เปลี่ยนเร็วขนาดนั้น)
  const cacheKey = `optanalyze:${sym}`;
  const hit = getCached<PlayResult>(cacheKey, 30 * 60_000);
  if (hit) return NextResponse.json({ ...hit, cached: true });

  try {
    // ===== 1) ประกอบ truth packet =====
    const [analysis, idx, earnings] = await Promise.all([
      buildAnalysis(sym).catch(() => null),
      getExpiries(sym).catch(() => null),
      getEarningsCalendar(30).catch(() => null),
    ]);
    if (!analysis || !isFinite(analysis.quote.price)) {
      return NextResponse.json({ error: `ไม่พบข้อมูลหุ้น ${sym}` }, { status: 404 });
    }
    if (!idx?.expiries?.length) {
      return NextResponse.json({ error: `${sym} ไม่มี options chain (ETF/ดัชนี/หุ้นนอกสหรัฐฯ)` }, { status: 404 });
    }

    const price = analysis.quote.price;
    const f = analysis.factors;
    const tech = analysis.technicals;

    // หา earnings date
    const earn = earnings?.find((e) => e.ticker === sym);
    const daysToEarnings = earn ? Math.ceil((new Date(earn.dateIso).getTime() - Date.now()) / 864e5) : null;

    // เลือก expiry: 2-4 สัปดาห์ หรือเลย earnings ≥ 3 วัน
    let bestExpiry = idx.expiries.find((e) => e.daysToExpiry >= 14 && e.daysToExpiry <= 30);
    if (daysToEarnings !== null && daysToEarnings > 0) {
      bestExpiry = idx.expiries.find((e) => e.daysToExpiry >= daysToEarnings + 3) ?? bestExpiry;
    }
    if (!bestExpiry) bestExpiry = idx.expiries.find((e) => e.daysToExpiry >= 10) ?? idx.expiries[0];

    const chain = await getChain(sym, bestExpiry.date);
    if (!chain) return NextResponse.json({ error: `ไม่พบ chain ${bestExpiry.date}` }, { status: 500 });

    // หา strikes ที่ delta 0.35-0.65 + มีสภาพคล่อง (volume ≥ 50 หรือ OI ≥ 100)
    const liquid = (arr: OptContract[]) => arr.filter((c) => c.volume >= 50 || c.openInterest >= 100);
    const callCands = liquid(chain.calls).filter((c) => Math.abs(c.delta) >= MIN_DELTA && Math.abs(c.delta) <= MAX_DELTA);
    const putCands = liquid(chain.puts).filter((c) => Math.abs(c.delta) >= MIN_DELTA && Math.abs(c.delta) <= MAX_DELTA);

    // ===== 2) สร้าง packet ส่ง AI =====
    const packet = [
      `[หุ้น ${sym} — ${analysis.quote.name}]`,
      `ราคา: ${price.toFixed(2)} USD (${analysis.quote.changePct >= 0 ? "+" : ""}${analysis.quote.changePct.toFixed(2)}% วันนี้)`,
      f ? `คะแนนปัจจัย: มูลค่า ${f.valuation} · โต ${f.growth} · กำไร ${f.profitability} · โมเมนตัม ${f.momentum} · แข็งแรง ${f.health} (รวม ${f.overall}/100)` : "",
      tech ? `เทคนิค: สัญญาณ${tech.signal === "bullish" ? "เอียงบวก" : tech.signal === "bearish" ? "เอียงลบ" : "เป็นกลาง"}${tech.rsi14 !== undefined ? ` · RSI ${tech.rsi14.toFixed(0)}` : ""} — ${tech.reasons.slice(0, 3).join(" · ")}` : "",
      daysToEarnings !== null ? `งบถัดไป: อีก ${daysToEarnings} วัน (earnings = IV crush หลังแถลง)` : "ไม่มีงบใน 30 วันข้างหน้า",
      chain.atmIv !== null ? `ATM IV: ${(chain.atmIv * 100).toFixed(1)}%${chain.ivPremiumPct !== null ? ` (แพงกว่าความผันผวนจริง ${chain.ivPremiumPct.toFixed(1)}%)` : ""}` : "",
      analysis.scenarios ? `สถานการณ์: ${analysis.scenarios.scenarios.map((s) => `${s.label} ${s.targetPrice.toFixed(0)}`).join(" · ")}` : "",
      `Call ที่แนะนำได้ (delta 0.35-0.65): ${callCands.slice(0, 5).map((c) => `${c.strike} (delta ${c.delta.toFixed(2)}, prem $${c.mid.toFixed(2)}, theta -$${Math.abs(c.thetaDay).toFixed(0)}/วัน)`).join(" · ") || "ไม่มีไม้ที่มีสภาพคล่องพอ"}`,
      `Put ที่แนะนำได้: ${putCands.slice(0, 5).map((c) => `${c.strike} (delta ${c.delta.toFixed(2)}, prem $${c.mid.toFixed(2)})`).join(" · ") || "ไม่มีไม้ที่มีสภาพคล่องพอ"}`,
      `วันหมดอายุที่เลือก: ${bestExpiry.date} (${bestExpiry.daysToExpiry} วัน)`,
      `งบจริง: premium ต่อไม้ ≤ $${MAX_PREMIUM.toFixed(0)} (3% ของพอร์ตสมมติ $10,000)`,
    ].filter(Boolean).join("\n");

    // ===== 3) ถาม AI =====
    let result: PlayResult;
    if (!hasAI()) {
      // no-AI mode: ใช้ rule-based อย่างเดียว
      result = ruleBased(sym, analysis, chain, callCands, putCands, bestExpiry, daysToEarnings);
    } else {
      const raw = await chatOnce(
        [
          {
            role: "system",
            content: `${SYSTEM_ANALYST}\n\nหน้าที่พิเศษ: คุณคือนักยุทธ์ options — จาก truth packet ของจริง ให้เสนอไม้ option (หรือไม่เสนอถ้าไม่มั่นใจ) ตอบเป็น JSON เท่านั้น:\n{"stance":"bullish|bearish|neutral","confidence":0-100,"play":"long_call|long_put|no_play","strike":<ต้องเป็น strike จากรายการจริง>,"expiry":"${bestExpiry.date}","targetPct":<TP % ของ premium เช่น 80 คือ +80%>,"stopPct":<SL % เช่น -40>,"reasons":["เหตุผลจากข้อมูลจริง 2-3 ข้อ"],"risks":["ความเสี่ยง 1-2 ข้อ เช่น IV crush/theta"],"exitPlan":"แผนออก 1 ประโยค"}\nกติกา: ถ้า stance=neutral ต้องตอบ play=no_play เสมอ · เลือก strike จากรายการที่ให้เท่านั้น · ถ้า IV แพงมาก (>30% เหนือ HV) ให้ระบุใน risks และลด target`,
          },
          { role: "user", content: packet },
        ],
        0.2
      );

      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) {
        result = ruleBased(sym, analysis, chain, callCands, putCands, bestExpiry, daysToEarnings);
      } else {
        try {
          const ai = JSON.parse(m[0]) as {
            stance: string; confidence: number; play: string; strike: number;
            targetPct?: number; stopPct?: number; reasons?: string[]; risks?: string[]; exitPlan?: string;
          };
          const type: "call" | "put" = ai.play === "long_put" ? "put" : "call";
          const pool = type === "call" ? callCands : putCands;
          const contract = pool.find((c) => Math.abs(c.strike - ai.strike) < 0.01) ?? pool[0];

          if (!contract || ai.play === "no_play" || ai.stance === "neutral") {
            result = {
              ...ruleBased(sym, analysis, chain, callCands, putCands, bestExpiry, daysToEarnings),
              stance: "neutral", play: "no_play", confidence: ai.confidence ?? 50,
              reasons: ai.reasons ?? ["AI ประเมินว่าไม่มีความมั่นใจเพียงพอสำหรับไม้ option ตอนนี้"],
              mode: "ai",
            };
          } else {
            // hard rules: บังคับ target/stop อยู่ในกรอบ
            const targetPct = Math.min(150, Math.max(40, ai.targetPct ?? 80));
            const stopPct = Math.max(-70, Math.min(-20, ai.stopPct ?? -40));
            const entryTotal = contract.mid * 100;
            const contracts = Math.max(1, Math.floor(MAX_PREMIUM / entryTotal));
            result = {
              stance: ai.stance as "bullish" | "bearish",
              confidence: Math.min(100, Math.max(0, ai.confidence ?? 60)),
              play: type === "call" ? "long_call" : "long_put",
              optionType: type,
              strike: contract.strike,
              expiry: bestExpiry.date,
              entryEst: contract.mid,
              entryTotal,
              target: contract.mid * (1 + targetPct / 100),
              stop: contract.mid * (1 + stopPct / 100),
              contracts,
              breakEven: contract.breakEven,
              reasons: (ai.reasons ?? []).slice(0, 4),
              risks: (ai.risks ?? []).slice(0, 3),
              exitPlan: ai.exitPlan ?? `ถือถึง TP +${targetPct}% หรือ SL ${stopPct}% แล้วแต่ชนะก่อน`,
              delta: contract.delta,
              thetaDay: contract.thetaDay,
              atmIv: chain.atmIv,
              ivPremiumPct: chain.ivPremiumPct,
              daysToEarnings,
              mode: "ai",
            };
          }
        } catch {
          result = ruleBased(sym, analysis, chain, callCands, putCands, bestExpiry, daysToEarnings);
        }
      }
    }

    // ===== 4) Jev ตรวบ =====
    if (result.play !== "no_play") {
      const a = await jevAsk(
        `AI นักยุทธ์ options เสนอ: ซื้อ ${result.optionType.toUpperCase()} ${sym} strike ${result.strike} หมดอายุ ${result.expiry} @ $${result.entryEst.toFixed(2)} TP $${result.target.toFixed(2)} SL $${result.stop.toFixed(2)} — เหตุผล: ${result.reasons.join("; ")}`,
        {
          verdict: {
            type: "choice",
            instructions: "Is this options play reasonable given the stated evidence?",
            criteria: { solid: "เหตุผลแน่น คุ้มความเสี่ยง", ok: "พอใช้ แต่ควรระวัง", hype: "เอียงบวกเกินหลักฐาน", theta_trap: "theta กินกำไรก่อนหุ้นถึงเป้า" },
          },
          stance: { type: "score", instructions: "How bullish is the overall tone?", criteria: ["ลบชัด", "เอียงลบ", "สมดุล", "เอียงบวก", "บวกจัด"] },
        }
      ).catch(() => null);
      const v = (a?.verdict as { choice?: string })?.choice;
      if (v) {
        const MAP: Record<string, string> = {
          solid: "✅ เหตุผลแน่น คุ้มความเสี่ยง",
          ok: "⚠️ พอใช้ — ระวังตามที่ระบุ",
          hype: "🔥 เอียงบวกเกินหลักฐาน",
          theta_trap: "⏰ theta อาจกินกำไรก่อนหุ้นถึงเป้า",
        };
        result.jevVerdict = MAP[v] ?? v;
        result.jevStance = (a?.stance as { score?: number })?.score ?? null;
      }
    }

    setCached(cacheKey, result);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 140) }, { status: 500 });
  }
}

/** Rule-based fallback (ไม่มี AI key) — ใช้สัญญาณเทคนิค+score อย่างเดียว */
function ruleBased(
  sym: string,
  analysis: NonNullable<Awaited<ReturnType<typeof buildAnalysis>>>,
  chain: NonNullable<Awaited<ReturnType<typeof getChain>>>,
  calls: OptContract[],
  puts: OptContract[],
  expiry: { date: string; daysToExpiry: number },
  daysToEarnings: number | null,
): PlayResult {
  const f = analysis.factors;
  const tech = analysis.technicals;
  const bull = (tech?.signal === "bullish" ? 2 : 0) + (f && f.momentum >= 60 ? 1 : 0) + (f && f.overall >= 60 ? 1 : 0);
  const bear = (tech?.signal === "bearish" ? 2 : 0) + (f && f.momentum <= 40 ? 1 : 0) + (f && f.overall <= 40 ? 1 : 0);

  if (bull < 2 && bear < 2) {
    return {
      stance: "neutral", confidence: 30, play: "no_play", optionType: "call", strike: 0, expiry: expiry.date,
      entryEst: 0, entryTotal: 0, target: 0, stop: 0, contracts: 0, breakEven: 0,
      reasons: ["สัญญาณไม่ชัดเจนพอ (โหมดสรุปอัตโนมัติ — ไม่มี AI key)"],
      risks: [], exitPlan: "", delta: 0, thetaDay: 0, atmIv: chain.atmIv, ivPremiumPct: chain.ivPremiumPct, daysToEarnings, mode: "no_ai",
    };
  }

  const isBull = bull >= bear;
  const pool = isBull ? calls : puts;
  const best = pool.length ? pool.reduce((a, b) => (Math.abs(b.delta - 0.5) < Math.abs(a.delta - 0.5) ? b : a)) : null;

  if (!best) {
    return {
      stance: isBull ? "bullish" : "bearish", confidence: 50, play: "no_play", optionType: isBull ? "call" : "put", strike: 0, expiry: expiry.date,
      entryEst: 0, entryTotal: 0, target: 0, stop: 0, contracts: 0, breakEven: 0,
      reasons: ["ไม่มีไม้ที่ delta 0.35-0.65 และมีสภาพคล่องพอ"],
      risks: [], exitPlan: "", delta: 0, thetaDay: 0, atmIv: chain.atmIv, ivPremiumPct: chain.ivPremiumPct, daysToEarnings, mode: "no_ai",
    };
  }

  const entryTotal = best.mid * 100;
  const contracts = Math.max(1, Math.floor(MAX_PREMIUM / entryTotal));
  return {
    stance: isBull ? "bullish" : "bearish",
    confidence: Math.min(80, 40 + Math.max(bull, bear) * 10),
    play: isBull ? "long_call" : "long_put",
    optionType: isBull ? "call" : "put",
    strike: best.strike,
    expiry: expiry.date,
    entryEst: best.mid,
    entryTotal,
    target: best.mid * 1.8, // +80%
    stop: best.mid * 0.6,   // -40%
    contracts,
    breakEven: best.breakEven,
    reasons: [
      `สัญญาณเทคนิค: ${tech?.signal === "bullish" ? "เอียงบวก" : tech?.signal === "bearish" ? "เอียงลบ" : "กลาง"}`,
      f ? `คะแนนรวม ${f.overall}/100 · โมเมนตัม ${f.momentum}` : "",
      daysToEarnings !== null ? `งบอีก ${daysToEarnings} วัน` : "",
    ].filter(Boolean),
    risks: ["โหมดสรุปอัตโนมัติ (ไม่มี AI) — ตรวจสอบเพิ่มเติมก่อนใช้จริง"],
    exitPlan: "TP +80% / SL -40% ของ premium",
    delta: best.delta,
    thetaDay: best.thetaDay,
    atmIv: chain.atmIv,
    ivPremiumPct: chain.ivPremiumPct,
    daysToEarnings,
    mode: "no_ai",
  };
}
