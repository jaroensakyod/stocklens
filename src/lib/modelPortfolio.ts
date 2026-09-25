// ===== 💼 พอร์ตจำลอง StockLens — AI ปรับพอร์ตรายสัปดาห์ + เก็บผลงานจริงสะสม =====
// แนวคิด: ทุนสมมติ ฿100,000 ตั้งแต่เริ่ม → ทุกสัปดาห์ AI ปรับสัดส่วน (จาก truth packet ของข้อมูลจริง)
// → คิดผลตอบแทนสัปดาห์นั้นจากราคาหุ้นจริง → สะสมเป็น NAV → เป็น Track Record สาธารณะที่ตรวจสอบย้อนหลังได้
// ความซื่อสัตย์ของการทดสอบ: การตัดสินใจใช้เฉพาะข้อมูล "ณ วันปรับ" — ผลย้อนหลังคำนวณจากราคาปิดจริง (ไม่รวมปันผล/ค่าธรรมเนียม)
import { promises as fs } from "fs";
import path from "path";
import { kvGet, kvSet, hasDB } from "./storage";
import { getQuotes, getUsdThb } from "./yahoo";
import { getPicks } from "./picks";
import { getLongterm } from "./longterm";
import { computeThemeHeat } from "./radar";
import { chatOnce, hasAI } from "./ai";
import type { Quote } from "./types";

const FILE = path.join(process.cwd(), "src/data/model-portfolio.json");
const DB_KEY = "model-portfolio";
const INITIAL_THB = 100_000;

export interface ModelPos {
  symbol: string;
  name: string;
  weight: number; // % ของพอร์ต
  priceThb: number; // ราคา ณ วันปรับ
}

export interface ModelSnapshot {
  weekKey: string; // "2026-W39"
  dateTh: string;
  navThb: number; // มูลค่าพอร์ต ณ จุดปรับ
  weekReturnPct: number | null; // ผลของสัปดาห์ที่เพิ่งผ่าน (จากพอร์ตรอบก่อน)
  totalReturnPct: number;
  cashPct: number;
  positions: ModelPos[];
  rationale: string; // เหตุผลการปรับ ภาษาไทย (AI เขียน / กฎเขียนตอนไม่มี AI)
  changes: string[]; // สิ่งที่เปลี่ยนจากรอบก่อน เช่น "เพิ่ม NVDA 15%"
  engine: "ai" | "rules";
}

export interface ModelState {
  startedAt: string;
  initialThb: number;
  snapshots: ModelSnapshot[]; // เก่า → ใหม่
}

/** กุญแจสัปดาห์ ISO (เริ่มวันจันทร์) — พอร์ตถูกปรับ 1 ครั้ง/สัปดาห์ */
export function weekKeyOf(now = new Date()): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** วันจันทร์ถัดไป (รอบปรับครั้งหน้า) เป็น Date */
export function nextMonday(now = new Date()): Date {
  const d = new Date(now);
  const diff = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

async function readState(): Promise<ModelState | null> {
  if (hasDB()) return await kvGet<ModelState>(DB_KEY);
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return (JSON.parse(raw) as { state?: ModelState }).state ?? null;
  } catch {
    return null;
  }
}

async function writeState(s: ModelState) {
  if (hasDB()) {
    await kvSet(DB_KEY, s);
    return;
  }
  await fs.writeFile(
    FILE,
    JSON.stringify(
      { _note: "💼 พอร์ตจำลอง StockLens — AI ปรับรายสัปดาห์ · เก็บใน Upstash Redis บน Vercel (ไฟล์นี้ = dev) · ผลลัพธ์คำนวณจากราคาจริง ไม่ใช่คำแนะนำการลงทุน", state: s },
      null,
      2
    )
  );
}

// ---------- ชุดผู้สมัคร (truth packet ให้ AI เลือก — ห้ามเลือกนอกลิสต์) ----------

interface Candidate {
  symbol: string;
  name: string;
  priceThb: number;
  changePct: number;
  fact: string;
}

async function buildCandidates(prevSymbols: string[]): Promise<{ candidates: Candidate[]; context: string }> {
  const [picks, lt, usdThb, indices, heat] = await Promise.all([
    getPicks().catch(() => null),
    getLongterm().catch(() => null),
    getUsdThb().catch(() => 36),
    getQuotes(["^GSPC", "^IXIC", "^SET.BK"]).catch(() => ({} as Record<string, Quote>)),
    computeThemeHeat().catch(() => []),
  ]);

  type Cand = { symbol: string; name: string; fact: string };
  const raw: Cand[] = [
    { symbol: "VOO", name: "กองทุน S&P 500", fact: "ETF ดัชนี — ฐานมั่นคงของพอร์ต" },
    { symbol: "QQQ", name: "กองทุน Nasdaq 100", fact: "ETF เทค 100 ตัว" },
    { symbol: "GLD", name: "ทองคำ", fact: "กันคลื่นเวลาตลาดไม่แน่นอน" },
  ];
  for (const p of (picks?.picks ?? []).slice(0, 3)) raw.push({ symbol: p.ticker, name: p.name, fact: `Picks วันนี้ ${p.tagEmoji}${p.tag} — ${p.reason}` });
  for (const d of (lt?.dividends ?? []).slice(0, 2)) raw.push({ symbol: d.ticker, name: d.name, fact: `ปันผล ~${d.yieldPct?.toFixed(1) ?? "?"}%/ปี งบ ${d.health ?? "?"}/100` });
  for (const c of (lt?.compounders ?? []).slice(0, 2)) raw.push({ symbol: c.ticker, name: c.name, fact: `โตต่อเนื่อง ~${c.cagr5yPct?.toFixed(0) ?? "?"}%/ปี (5ปี ราคาล้วน)` });
  const th = (lt?.dividends ?? []).find((r) => r.market.includes("🇹🇭"));
  if (th && !raw.some((r) => r.symbol === th.ticker)) raw.push({ symbol: th.ticker, name: th.name, fact: `ปันผลไทย ~${th.yieldPct?.toFixed(1) ?? "?"}%/ปี` });

  const seen = new Set<string>();
  const uniq = raw.filter((r) => (r.symbol && !seen.has(r.symbol) ? (seen.add(r.symbol), true) : false));
  const symbols = [...new Set([...uniq.map((r) => r.symbol), ...prevSymbols])];
  const quotes = await getQuotes(symbols).catch(() => ({} as Record<string, Quote>));

  const candidates: Candidate[] = [];
  for (const r of uniq) {
    const q = quotes[r.symbol];
    if (!q || !isFinite(q.price) || q.price <= 0) continue;
    candidates.push({
      symbol: q.symbol,
      name: r.name,
      priceThb: q.currency === "THB" ? q.price : q.price * usdThb,
      changePct: isFinite(q.changePct) ? q.changePct : 0,
      fact: r.fact,
    });
  }

  const idxLine = Object.entries(indices)
    .filter(([, q]) => q && isFinite(q.price))
    .map(([s, q]) => `${s.includes("GSPC") ? "S&P500" : s.includes("IXIC") ? "NASDAQ" : "SET"} ${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(1)}%`)
    .join(" · ");
  const heatLine = heat.slice(0, 3).map((h) => `${h.theme.emoji}${h.theme.name} ร้อน${h.heat}`).join(", ");
  return { candidates, context: `ดัชนีวันนี้: ${idxLine || "-"}\nธีมร้อน: ${heatLine || "-"}` };
}

// ---------- ตัวตัดสินใจ ----------

const SYSTEM_PM = `คุณคือ portfolio manager ของ "พอร์ตจำลอง StockLens" (ทุนสมมติ 100,000 บาท ปรับสัปดาห์ละครั้ง)
หน้าที่: เลือกพอร์ตสำหรับสัปดาห์ถัดไปจากรายการผู้สมัครที่ให้เท่านั้น (ห้ามเสนอสัญลักษณ์อื่นเด็ดขาด)
กติกา: 5-8 ตัว · ตัวเดียวไม่เกิน 30% · เงินสด 5-30% · กระจายหมวด (อย่าเอาเทคหมดพอร์ต) · คำนึงถึงสภาพตลาดและผลงานพอร์ตรอบก่อน
ตอบเป็น JSON เท่านั้น: {"rationale":"เหตุผลการจัดพอร์ต 3-5 ประโยคภาษาไทย อ้างข้อมูลที่ให้","cashPct":เลข5ถึง30,"positions":[{"symbol":"VOO","weight":เลข}]}
weight คือ % ของพอร์ต (ตัวเลขรวมกับเงินสดต้องได้ 100)`;

async function decideAI(packet: string): Promise<{ rationale: string; cashPct: number; positions: { symbol: string; weight: number }[] } | null> {
  if (!hasAI()) return null;
  try {
    const raw = await chatOnce(
      [
        { role: "system", content: SYSTEM_PM },
        { role: "user", content: packet },
      ],
      0.3
    );
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const j = JSON.parse(cleaned.slice(start, end + 1)) as { rationale?: string; cashPct?: number; positions?: { symbol?: string; weight?: number }[] };
    if (!Array.isArray(j.positions) || !j.positions.length) return null;
    return {
      rationale: typeof j.rationale === "string" && j.rationale.trim() ? j.rationale.trim() : "—",
      cashPct: isFinite(j.cashPct as number) ? (j.cashPct as number) : 10,
      positions: j.positions
        .filter((p) => p && typeof p.symbol === "string" && isFinite(p.weight as number) && (p.weight as number) > 0)
        .map((p) => ({ symbol: (p.symbol as string).toUpperCase(), weight: p.weight as number })),
    };
  } catch {
    return null;
  }
}

/** กันพอร์ตเพี้ยน: ตัดตัวที่ไม่อยู่ในผู้สมัคร · clamp 30% · normalize ให้รวม+เงินสด = 100 */
function normalize(
  picks: { symbol: string; weight: number }[],
  cashWanted: number,
  candidates: Candidate[],
  prev: ModelPos[]
): { positions: { symbol: string; weight: number }[]; cashPct: number } {
  const ok = new Set([...candidates.map((c) => c.symbol), ...prev.map((p) => p.symbol)]);
  let cash = Math.min(40, Math.max(5, isFinite(cashWanted) ? cashWanted : 10));
  let pos = picks.filter((p) => ok.has(p.symbol)).slice(0, 8);
  if (!pos.length) {
    // ทางเลือกฉุกเฉิน: 60% VOO + 20% QQQ + 10% GLD (ถ้ามีในผู้สมัคร)
    pos = [
      { symbol: "VOO", weight: 60 },
      { symbol: "QQQ", weight: 20 },
      { symbol: "GLD", weight: 10 },
    ].filter((p) => ok.has(p.symbol));
    if (!pos.length) pos = candidates.slice(0, 3).map((c) => ({ symbol: c.symbol, weight: 20 }));
    cash = 10;
  }
  pos = pos.map((p) => ({ symbol: p.symbol, weight: Math.min(30, p.weight) }));
  const want = 100 - cash;
  const sum = pos.reduce((a, p) => a + p.weight, 0) || 1;
  pos = pos.map((p) => ({ symbol: p.symbol, weight: Math.round((p.weight / sum) * want * 10) / 10 }));
  return { positions: pos, cashPct: cash };
}

// ---------- รอบปรับรายสัปดาห์ ----------

let inflight: Promise<ModelState> | null = null;

export async function runWeeklyAdjust(force = false): Promise<ModelState> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const state = await readState();
      const week = weekKeyOf();
      const prevSnap = state?.snapshots[state.snapshots.length - 1];

      if (state && prevSnap && prevSnap.weekKey === week && !force) return state;

      const prevPositions = prevSnap?.positions ?? [];
      const { candidates, context } = await buildCandidates(prevPositions.map((p) => p.symbol));

      // 1) คิดผลของสัปดาห์ที่ผ่านมาก่อน (พอร์ตรอบก่อน × ราคาเดี๋ยวนี้แปลงเป็นบาท — รวมผลค่าเงินด้วย)
      let nav = state ? (prevSnap?.navThb ?? INITIAL_THB) : INITIAL_THB;
      let weekReturnPct: number | null = null;
      let posReturns = "";
      if (state && prevSnap && prevPositions.length) {
        const [nowQuotes, usdThbNow] = await Promise.all([
          getQuotes(prevPositions.map((p) => p.symbol)).catch(() => ({} as Record<string, Quote>)),
          getUsdThb().catch(() => 36),
        ]);
        let r = 0;
        for (const p of prevPositions) {
          const q = nowQuotes[p.symbol];
          if (!q || !isFinite(q.price) || p.priceThb <= 0) continue;
          const priceNowThb = q.currency === "THB" ? q.price : q.price * usdThbNow;
          r += (p.weight / 100) * ((priceNowThb / p.priceThb - 1) * 100);
        }
        weekReturnPct = Math.round(r * 100) / 100;
        nav = prevSnap.navThb * (1 + r / 100);
        posReturns = `ผลสัปดาห์ที่ผ่านมา: ${weekReturnPct >= 0 ? "+" : ""}${weekReturnPct.toFixed(2)}% (NAV ตอนนี้ ~฿${Math.round(nav).toLocaleString("th-TH")})`;
      }

      // 2) ให้ AI เลือกพอร์ตใหม่ (มี rule fallback เสมอ)
      const candLines = candidates.map((c) => `${c.symbol} (${c.name}) ราคา~${Math.round(c.priceThb)}฿ วันนี้${c.changePct >= 0 ? "+" : ""}${c.changePct.toFixed(1)}% — ${c.fact}`).join("\n");
      const prevLines = prevPositions.length
        ? `พอร์ตปัจจุบัน (รอบก่อน): ${prevPositions.map((p) => `${p.symbol} ${p.weight}%`).join(", ")} · เงินสด ${prevSnap?.cashPct ?? 0}%${prevSnap?.rationale ? `\nเหตุผลรอบก่อน: ${prevSnap.rationale.slice(0, 300)}` : ""}`
        : "ยังไม่มีพอร์ต — นี่คือรอบแรก (เริ่มทุน ฿100,000)";
      const packet = `[ข้อมูล ณ วันปรับพอร์ต]\n${context}\n\n${prevLines}\n${posReturns}\n\nรายการผู้สมัคร (เลือกได้เฉพาะเหล่านี้):\n${candLines}`;

      let engine: "ai" | "rules" = "rules";
      let rationale = "";
      let chosen: { symbol: string; weight: number }[] = [];
      let cashPct = 10;

      const ai = await decideAI(packet);
      if (ai && ai.positions.length) {
        engine = "ai";
        rationale = ai.rationale;
        chosen = ai.positions;
        cashPct = ai.cashPct;
      }
      const norm = normalize(chosen, cashPct, candidates, prevPositions);
      if (engine === "rules") {
        // กฎฉุกเฉิน (ไม่มี AI/ใช้ไม่ได้): ถือ VOO+QQQ+GLD สัดส่วนคลาสสิก + เงินสด 10%
        rationale = "โหมดกฎ (AI ไม่พร้อมใช้) — จัดพอร์ตแบบคลาสสิก 70/20/10: ดัชนีสหรัฐฯ เป็นแกน + เทค + ทองกันคลื่น + เงินสด 10%";
      }
      cashPct = norm.cashPct;

      // 3) ประกอบ snapshot ใหม่ (ราคา ณ วันปรับ)
      const priceOf = new Map(candidates.map((c) => [c.symbol, c.priceThb] as const));
      const nameOf = new Map([...candidates.map((c) => [c.symbol, c.name] as const), ...prevPositions.map((p) => [p.symbol, p.name] as const)]);
      const positions: ModelPos[] = norm.positions
        .map((p) => ({ symbol: p.symbol, name: nameOf.get(p.symbol) ?? p.symbol, weight: p.weight, priceThb: priceOf.get(p.symbol) ?? 0 }))
        .filter((p) => p.priceThb > 0);

      const prevSet = new Map(prevPositions.map((p) => [p.symbol, p.weight] as const));
      const changes: string[] = [];
      for (const p of positions) {
        const old = prevSet.get(p.symbol);
        if (old === undefined) changes.push(`🆕 เพิ่ม ${p.symbol} ${p.weight}%`);
        else if (Math.abs(old - p.weight) >= 2) changes.push(`${p.weight > old ? "⬆️ เพิ่ม" : "⬇️ ลด"} ${p.symbol} ${old}%→${p.weight}%`);
      }
      for (const p of prevPositions) if (!positions.some((x) => x.symbol === p.symbol)) changes.push(`🗑 ตัด ${p.symbol} ออก`);
      if (!changes.length) changes.push("คงพอร์ตเดิมทั้งหมด (ปรับน้ำหนักเล็กน้อย)");

      const totalReturnPct = ((nav / INITIAL_THB) - 1) * 100;
      const snap: ModelSnapshot = {
        weekKey: week,
        dateTh: new Date().toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }),
        navThb: Math.round(nav),
        weekReturnPct,
        totalReturnPct: Math.round(totalReturnPct * 100) / 100,
        cashPct,
        positions,
        rationale,
        changes,
        engine,
      };

      const nextState: ModelState = {
        startedAt: state?.startedAt ?? new Date().toISOString(),
        initialThb: INITIAL_THB,
        snapshots: [...(state?.snapshots ?? []), snap],
      };
      await writeState(nextState);
      return nextState;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** อ่านพอร์ต — ถ้าเข้าสัปดาห์ใหม่ยังไม่เคยปรับ จะปรับให้เลย (ครั้งแรกของสัปดาห์ช้าหน่อย) */
export async function getModelPortfolio(): Promise<ModelState> {
  const state = await readState();
  const week = weekKeyOf();
  const last = state?.snapshots[state.snapshots.length - 1];
  if (state && last && last.weekKey === week) return state;
  return runWeeklyAdjust(false);
}

/** ราคาสดตอนนี้ → NAV สดระหว่างสัปดาห์ */
export async function liveNav(state: ModelState): Promise<{ navThb: number; liveReturnPct: number; asOf: string }> {
  const last = state.snapshots[state.snapshots.length - 1];
  if (!last) return { navThb: state.initialThb, liveReturnPct: 0, asOf: "" };
  const [quotes, usdThbNow] = await Promise.all([
    getQuotes(last.positions.map((p) => p.symbol)).catch(() => ({} as Record<string, Quote>)),
    getUsdThb().catch(() => 36),
  ]);
  let r = 0;
  for (const p of last.positions) {
    const q = quotes[p.symbol];
    if (!q || !isFinite(q.price) || p.priceThb <= 0) continue;
    const priceNowThb = q.currency === "THB" ? q.price : q.price * usdThbNow;
    r += (p.weight / 100) * ((priceNowThb / p.priceThb - 1) * 100);
  }
  const navThb = last.navThb * (1 + r / 100);
  return {
    navThb: Math.round(navThb),
    liveReturnPct: Math.round(((navThb / state.initialThb) - 1) * 10000) / 100,
    asOf: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.",
  };
}
