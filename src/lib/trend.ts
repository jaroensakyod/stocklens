// ===== 📈 แนวโน้มวันนี้ — รวมสัญญาณทั้งเว็บไว้หน้าเดียว =====
// ภาพใหญ่มหภาค (supernova) + ธีมข่าวที่ตลาดพูดถึง (radar heat) + หุ้นใต้น้ำ/แพงเกินตัว (value)
// + คะแนนเด่นวันนี้ (score league) — ทุกก้อนมาจากเครื่องยนต์เดิม (cache ของตัวเอง) เพียงประกอบใหม่
import { getSupernova } from "./supernova";
import { computeThemeHeat } from "./radar";
import { getValueScan, type ValueRow } from "./valueScan";
import { kvGet } from "./storage";

export interface TrendResult {
  asOf: string;
  dateTh: string;
  macro: {
    regime: string;
    regimeDetail: string;
    rows: { id: string; label: string; changePct: number | null; chg5d: number | null }[];
  };
  themes: { name: string; emoji: string; heat: number; avgChange: number; newsCount: number }[];
  undervalued: ValueRow[];
  overpriced: ValueRow[];
  scores: { top: { sym: string; t: number }[]; bottom: { sym: string; t: number }[]; count: number } | null;
  note: string;
}

let cached: { at: number; data: TrendResult } | null = null;
const TTL = 30 * 60_000;

async function build(): Promise<TrendResult> {
  const [macro, heat, value, league] = await Promise.all([
    getSupernova().catch(() => null),
    computeThemeHeat().catch(() => []),
    getValueScan().catch(() => null),
    kvGet<{ at: number; list: { sym: string; t: number }[] }>("score:latest").catch(() => null),
  ]);

  const themes = heat.slice(0, 4).map((h) => ({
    name: h.theme.name,
    emoji: h.theme.emoji,
    heat: h.heat,
    avgChange: Math.round((h.avgChange ?? 0) * 10) / 10,
    newsCount: h.newsCount,
  }));

  const list = league?.list ?? [];
  const scores = list.length
    ? { top: list.slice(0, 3), bottom: [...list].slice(-3).reverse(), count: list.length }
    : null;

  return {
    asOf: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.",
    dateTh: new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", weekday: "long" }),
    macro: macro
      ? {
          regime: macro.regime,
          regimeDetail: macro.regimeDetail,
          rows: macro.rows.map((r) => ({ id: r.id, label: r.label, changePct: r.changePct, chg5d: r.chg5d })),
        }
      : { regime: "—", regimeDetail: "ดึงข้อมูลมหภาคไม่สำเร็จชั่วคราว", rows: [] },
    themes,
    undervalued: (value?.undervalued ?? []).slice(0, 4),
    overpriced: (value?.overpriced ?? []).slice(0, 3),
    scores,
    note: "หน้านี้ประกอบสัญญาณจากเครื่องยนต์จริงของเว็บ (มหภาค · ธีมข่าว · สแกนมูลค่า · คะแนน) — เป็นข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน กดดูรายละเอียดได้ทุกก้อน",
  };
}

export async function getTrend(): Promise<TrendResult> {
  if (cached && Date.now() - cached.at < TTL) return cached.data;
  const data = await build();
  cached = { at: Date.now(), data };
  return data;
}
