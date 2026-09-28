// ===== 🧠 Jev จัดพอร์ตให้ — Jev คัดตัวจากคลังจริง · GLM เขียนวิเคราะห์ · Jev ตรวจซ้ำ =====
// หลักการเดียวกับ model-portfolio: AI เลือกจากลิสต์จริงเท่านั้น น้ำหนักยังคำนวณด้วยเครื่องยนต์กฎตามสัดส่วนที่ผู้ใช้เลือก
// ทุกขั้น fallback ได้: Jev ไม่ตอบ = ใช้ลำดับเดิมของเครื่องยนต์ · GLM ไม่พร้อม = ใช้เหตุผลเดิม · พังหมด = ผลเครื่องยนต์ล้วน
// เป็นตัวอย่างเพื่อการเรียนรู้ ไม่ใช่คำแนะนำการลงทุน — สถานะ AI รายงานตรงๆ ผ่าน field `ai`
import { jevAsk, jevChoiceProbabilities, guardAdvice } from "./typesafe";
import { chatOnce, hasAI } from "./ai";
import { cached } from "./yahoo";
import {
  buildPools,
  buildCustomPortfolio,
  hashOpts,
  CUSTOM_THEMES,
  INTL_REGIONS,
  type StarterCustomOptions,
  type StarterCustomResult,
  type Cand,
  type CustomPools,
  type StarterAIInfo,
} from "./starterCustom";

// ---------- state สำหรับถาม Jev: เงื่อนไขผู้ใช้ทั้งหมดใน 1 บรรทัด ----------
function stateOf(opts: StarterCustomOptions, brief: string): string {
  const themes = [...new Set((opts.themes ?? []).filter((t) => CUSTOM_THEMES.some((d) => d.id === t)))];
  const regions = [...new Set((opts.regions ?? []).filter((r) => INTL_REGIONS.some((d) => d.id === r)))];
  const mixText = [
    (opts.mix?.th ?? 0) > 0 ? `หุ้นไทย ${opts.mix.th}%` : "",
    (opts.mix?.us ?? 0) > 0 ? `หุ้นเมกา ${opts.mix.us}%` : "",
    (opts.mix?.fund ?? 0) > 0 ? `กองทุน/ETF ${opts.mix.fund}%` : "",
    (opts.mix?.intl ?? 0) > 0 ? `หุ้นต่างประเทศ ${opts.mix.intl}%${regions.length ? ` (${regions.map((r) => INTL_REGIONS.find((d) => d.id === r)?.label ?? r).join("/")})` : ""}` : "",
  ]
    .filter(Boolean)
    .join(" + ");
  const themeText = themes.length ? themes.map((id) => CUSTOM_THEMES.find((t) => t.id === id)?.label ?? id).join(" · ") : "ไม่จำกัดธีม";
  return [
    `มือใหม่ไทยขอพอร์ตลงทุน: ${mixText || "ไม่ระบุ"} · ${opts.count} ตำแหน่ง · แนวที่สนใจ: ${themeText}`,
    `เกรดขั้นต่ำ: ${opts.minGrade === "all" ? "ไม่จำกัด" : opts.minGrade} · หุ้นซิ่ง: ${opts.momentum ? "เปิด (~10%)" : "ปิด"}`,
    brief ? `โจทย์เพิ่มเติมจากผู้ใช้: """${brief}"""` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

// ---------- Jev คัดตัว: เรียง pool ตาม probability ที่ตอบโจทย์ผู้ใช้มากที่สุด ----------
/** ถาม Jev ครั้งเดียวต่อถัง (ส่ง head 15 ตัวแรกพอ) → {pool: เรียงใหม่, used: Jev ตอบจริงไหม} */
async function jevRankPool(pool: Cand[], state: string): Promise<{ pool: Cand[]; used: boolean }> {
  if (pool.length <= 1) return { pool, used: false };
  const head = pool.slice(0, 15);
  const options: Record<string, string> = {};
  for (const c of head) {
    const bits = [c.name, c.themeLabel, c.cat ? `หมวด${c.cat}` : c.sector, c.lt ? `ปันผล ~${c.lt.yieldPct?.toFixed(1) ?? "?"}%/ปี งบแข็งแรง ${c.lt.health ?? "?"}/100` : "", c.grade ? `เกรด ${c.grade}` : ""].filter(Boolean);
    options[c.symbol] = bits.join(" · ");
  }
  const probs = await jevChoiceProbabilities(state, "เลือกหุ้นที่ตอบโจทย์ผู้ใช้ (มือใหม่) ได้ดีที่สุด — คิดถึงความเสี่ยงที่เหมาะกับมือใหม่และความเข้าใจง่ายของธุรกิจด้วย", options);
  if (!probs) return { pool, used: false };
  const has = (c: Cand) => typeof probs[c.symbol] === "number" && isFinite(probs[c.symbol]);
  const scored = head.filter(has).sort((a, b) => probs[b.symbol] - probs[a.symbol]);
  if (!scored.length) return { pool, used: false };
  return { pool: [...scored, ...head.filter((c) => !has(c)), ...pool.slice(15)], used: true };
}

// ---------- GLM เขียนวิเคราะห์: สรุปพอร์ต + เหตุผลรายตัวภาษามือใหม่ ----------
const SYSTEM_WRITER = `คุณคือนักเขียนวิเคราะห์พอร์ตของ "พอร์ตมือใหม่ StockLens" — Jev (ผู้ตัดสิน) คัดหุ้นและเครื่องยนต์จัดน้ำหนักให้เสร็จแล้ว หน้าที่เดียวของคุณคือเขียนอธิบายให้คนไม่รู้เรื่องหุ้นอ่านรู้เรื่อง
กติกาเด็ดขาด: อ้างเฉพาะข้อมูลจริงที่ให้ใน packet เท่านั้น ห้ามเดาตัวเลขหรือข่าว · ห้ามคำว่า "ควรซื้อ/ควรขาย/การันตีผลตอบแทน" · ใช้ภาษาบ้านๆ ศัพท์การเงินต้องอธิบายง่ายๆ ติดไปด้วย
ตอบเป็น JSON เท่านั้น: {"summary":"สรุปพอร์ต 3-5 ประโยค — จัดแนวไหน เหตุผลรวม และสิ่งที่มือใหม่ควรรู้","positions":[{"symbol":"VOO","reason":"ทำไมตัวนี้อยู่ในพอร์ต 1-2 ประโยค"}]}
positions ต้องครบทุกตัวที่ให้ และใช้ symbol ตรงตาม packet เท่านั้น`;

async function writeAnalysis(
  opts: StarterCustomOptions,
  brief: string,
  profile: StarterCustomResult["profile"]
): Promise<{ summary: string; reasons: Map<string, string> } | null> {
  if (!hasAI()) return null;
  const lines = profile.positions
    .map((p) => {
      const facts = [
        p.market === "TH" ? "ตลาดไทย" : p.market === "INTL" ? "ต่างประเทศ (ซื้อเป็น USD)" : "ตลาดเมกา",
        p.pe != null ? `P/E ${p.pe.toFixed(1)}` : null,
        p.yieldPct != null ? `ปันผล ~${p.yieldPct.toFixed(1)}%/ปี` : null,
        p.roePct != null ? `ROE ${p.roePct.toFixed(0)}%` : null,
        p.health != null ? `ความแข็งแรงงบ ${p.health}/100` : null,
        p.cagr5yPct != null ? `ผลตอบแทนเฉลี่ย 5 ปี ${p.cagr5yPct.toFixed(1)}%/ปี (ราคาล้วน)` : null,
        p.grade ? `เกรด StockLens ${p.grade}` : null,
        p.changePct != null ? `วันนี้ ${p.changePct >= 0 ? "+" : ""}${p.changePct.toFixed(1)}%` : null,
        `ความเสี่ยง${p.risk}`,
      ]
        .filter(Boolean)
        .join(" · ");
      return `${p.symbol} (${p.name}) น้ำหนัก ${p.weight}% — ${facts}`;
    })
    .join("\n");
  const packet = [
    `[เงื่อนไขผู้ใช้]\n${stateOf(opts, brief)} · เงินสด ${profile.cashPct}%`,
    `\n[พอร์ตที่ Jev+เครื่องยนต์จัดแล้ว]\n${lines}`,
    `\n[เหตุผลย่อจากเครื่องยนต์ — ใช้อ้างอิงได้]\n${profile.positions.map((p) => `${p.symbol}: ${p.reason}`).join("\n")}`,
  ].join("\n");
  try {
    const raw = await chatOnce(
      [
        { role: "system", content: SYSTEM_WRITER },
        { role: "user", content: packet },
      ],
      0.3
    );
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const j = JSON.parse(cleaned.slice(start, end + 1)) as { summary?: string; positions?: { symbol?: string; reason?: string }[] };
    const reasons = new Map<string, string>();
    if (Array.isArray(j.positions)) {
      for (const p of j.positions) {
        if (p && typeof p.symbol === "string" && typeof p.reason === "string" && p.reason.trim()) {
          const sym = p.symbol.toUpperCase();
          if (profile.positions.some((x) => x.symbol === sym)) reasons.set(sym, p.reason.trim().slice(0, 300));
        }
      }
    }
    const summary = typeof j.summary === "string" && j.summary.trim() ? j.summary.trim().slice(0, 900) : null;
    if (!summary && !reasons.size) return null;
    return { summary: summary ?? "", reasons };
  } catch {
    return null;
  }
}

// ---------- Jev ตรวจพอร์ตสุดท้ายเป็นมุมมองที่สอง (แพตเทิร์นเดียวกับ jev-check) ----------
const DIV_TH: Record<string, string> = {
  ok: "กระจายเหมาะสมกับเงื่อนไขที่ขอ 👍",
  lean: "เอียงหนักบางหมวด — โอเคถ้าตั้งใจเลือกแนวนั้น แต่คอยสังเกต",
  poor: "กระจายน้อยเกินไปสำหรับมือใหม่ — ควรกระจายเพิ่ม",
};

async function jevPortfolioCheck(profile: StarterCustomResult["profile"], state: string): Promise<string | null> {
  const posLine = profile.positions.map((p) => `${p.symbol} ${p.weight}% (${p.kind}, เสี่ยง${p.risk})`).join(", ");
  const a = await jevAsk(`พอร์ตมือใหม่ที่เพิ่งจัด: ${posLine} · เงินสด ${profile.cashPct}% — เงื่อนไขผู้ใช้: ${state.slice(0, 600)}`, {
    risk: { type: "score", instructions: "ความเสี่ยงโดยรวมของพอร์ตนี้เทียบกับสภาพมือใหม่ที่ไม่เคยลงทุน", criteria: ["นอนหลับสบาย", "ผันผวนรับได้", "ต้องคอยตามบ้าง", "เสี่ยงสำหรับมือใหม่", "เสี่ยงมาก"] },
    diversity: { type: "choice", instructions: "การกระจายตัวของพอร์ตเทียบกับเงื่อนไขที่ผู้ใช้ขอ", criteria: { ok: "กระจายเหมาะสม", lean: "เอียงหนักบางหมวด", poor: "กระจายน้อยเกินไป" } },
  });
  if (!a) return null;
  const risk = (a.risk as { score?: number })?.score ?? null;
  const div = (a.diversity as { choice?: string })?.choice ?? null;
  if (risk === null && !div) return null;
  const parts: string[] = [];
  if (risk !== null) parts.push(`ความเสี่ยงรวม ${risk.toFixed(1)}/4${risk >= 3.5 ? " (เสี่ยง — ใส่เท่าที่เสียได้ไม่เจ็บ)" : risk <= 1.5 ? " (นุ่มนวลสำหรับมือใหม่)" : ""}`);
  if (div && DIV_TH[div]) parts.push(`การกระจาย: ${DIV_TH[div]}`);
  return `🧠 Jev ตรวจพอร์ตนี้: ${parts.join(" · ")}`;
}

// ---------- ตัวประสานหลัก ----------
export async function buildCustomPortfolioAI(opts: StarterCustomOptions, brief = ""): Promise<StarterCustomResult> {
  const cleanBrief = brief.slice(0, 300);
  const state = stateOf(opts, cleanBrief);
  const notes: string[] = [];

  // 1) คลังผู้สมัครจริง → Jev เรียงทีละถัง (ไทย/เมกา/นอก — ถังกองทุน+ซิ่งคงลำดับเดิม)
  const pools = await buildPools(opts);
  const [thR, usR, intlR] = await Promise.all([jevRankPool(pools.thPool, state), jevRankPool(pools.usPool, state), jevRankPool(pools.intlPool, state)]);
  const jevUsed = thR.used || usR.used || intlR.used;
  if (!jevUsed) notes.push("🧠 Jev ยังไม่ตอบตอนนี้ — ใช้ลำดับคัดของเครื่องยนต์กฎแทน (ผลพอร์ตยังใช้ได้ปกติ)");
  const ranked: CustomPools = { thPool: thR.pool, usPool: usR.pool, intlPool: intlR.pool, surgeCands: pools.surgeCands };

  // 2) ประกอบพอร์ตด้วยเครื่องยนต์เดิมบน pool ที่ Jev เรียง — น้ำหนัก/ราคา/กันซ้ำ/เติมสำรอง ใช้กลไกเดิมครบ
  const base = await buildCustomPortfolio(opts, ranked);

  // 3) GLM เขียนสรุป + เหตุผลรายตัว (ทับเฉพาะตัวที่ symbol ตรงจริง)
  const written = await writeAnalysis(opts, cleanBrief, base.profile);
  if (!written) notes.push("✍️ AI ยังไม่พร้อมเขียนวิเคราะห์วันนี้ — แสดงเหตุผลจากเครื่องยนต์กฎแทน");
  let summary = written?.summary ?? "";
  if (summary) {
    const g = await guardAdvice(summary);
    if (g?.flagged) summary += "\n⚠️ (ระบบตรวจพบถ้อยคำที่ให้คำมั่นเกินหลักฐาน — โปรดอ่านแบบมีสติ ไม่มีการลงทุนใดการันตีผลตอบแทน)";
  }
  const profile = written
    ? { ...base.profile, positions: base.profile.positions.map((p) => (written.reasons.has(p.symbol) ? { ...p, reason: written.reasons.get(p.symbol)! } : p)) }
    : base.profile;

  // 4) Jev ตรวจพอร์ตสุดท้าย (มุมมองที่สอง — ไม่มีก็ไม่ถือว่าพัง)
  const jevCheck = await jevPortfolioCheck(profile, state);

  const ai: StarterAIInfo = {
    engine: jevUsed || written ? "jev+ai" : "rules",
    ...(summary ? { summary } : {}),
    jevCheck,
  };

  return { ...base, profile, notes: [...base.notes, ...notes], ai };
}

// ---------- cache 30 นาทีต่อ (options + brief) ----------
export async function getStarterCustomAI(opts: StarterCustomOptions, brief = ""): Promise<StarterCustomResult> {
  const h = hashOpts(opts) + ":" + Buffer.from(brief.slice(0, 300)).toString("base64").slice(0, 40);
  return cached(`starter:custom-ai:${h}`, 30 * 60_000, async () => {
    return buildCustomPortfolioAI({ ...opts, mix: { ...opts.mix } }, brief);
  }) as Promise<StarterCustomResult>;
}
