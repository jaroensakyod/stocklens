import { NextRequest, NextResponse } from "next/server";
import { getPicks } from "@/lib/picks";
import { buildAnalysis } from "@/lib/analysis";
import { computeThemeHeat } from "@/lib/radar";
import { getQuotes } from "@/lib/yahoo";
import { tvUniverse, toYahooSymbol } from "@/lib/tvscanner";
import { getLiveGurus } from "@/lib/gurus13f";
import { chatOnce, hasAI } from "@/lib/ai";
import calendarJson from "@/data/calendar.json";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 📋 "วันนี้ควรรู้อะไร" — ตอบคำถามเดียวที่คนเปิดเว็บมาอยากรู้:
// วันนี้น่าสนใจอะไร · มีแรงกดดันตรงไหน · ต้องระวังอะไร · โอกาสอยู่ที่ไหน (+พอร์ตตัวเองเป็นไงบ้าง)
// ทุกอย่างประกอบจากข้อมูลจริงที่มี cache อยู่แล้ว · ภาษาใช้กรอบ "สื่อวิเคราะห์" ไม่ใช่คำสั่งซื้อ-ขาย

interface TodayItem {
  ticker: string;
  headline: string; // บรรทัดแรกสั้นๆ
  reason: string; // เพราะอะไร (ตัวเลขจริง)
}

interface TodayResult {
  asOf: string;
  summary: string; // AI 1-2 ประโยค (หรือเทมเพลตถ้าไม่มี AI)
  watch: TodayItem[]; // 🟢 น่าสนใจ
  pressure: TodayItem[]; // 🔴 มีแรงกดดัน
  caution: { icon: string; text: string }[]; // ⚠️ ระวัง
  opportunity: { icon: string; title: string; text: string; link?: string }[]; // 💎 โอกาส
  portfolio: { ticker: string; flag: "warn" | "good"; text: string }[]; // 🫵 พอร์ตคุณ
}

let cached: { at: number; data: TodayResult } | null = null;
const TTL = 15 * 60_000;

async function buildToday(holdings: string[]): Promise<TodayResult> {
  // ===== ส่วนประกอบขนาน (ทุกตัวมี cache ของตัวเอง) =====
  const [picks, heat, macro] = await Promise.all([
    getPicks().catch(() => ({ picks: [] as { ticker: string; tag: string; tagEmoji: string; reason: string; changePct: number }[] })),
    computeThemeHeat(),
    getQuotes(["^VIX", "CL=F"]).catch(() => ({}) as Record<string, never>),
  ]);

  // 🟢 น่าสนใจ — 3 ตัวแรกจาก Daily Picks (ขยับแรง + งบผ่านเกณฑ์)
  const watch: TodayItem[] = picks.picks.slice(0, 3).map((p) => ({
    ticker: p.ticker,
    headline: `${p.tagEmoji} ${p.ticker} ${p.changePct >= 0 ? "+" : ""}${p.changePct}% — ${p.tag}`,
    reason: p.reason,
  }));

  // 🔴 มีแรงกดดัน — หุ้นลงแรงวันนี้ (≥2%) แล้วยืนยันด้วยสัญญาณเทคนิคเอียงลบ + คะแนนปัจจัยไม่แข็ง
  const pressure: TodayItem[] = [];
  try {
    const [us, th] = await Promise.all([tvUniverse("america", 600), tvUniverse("thailand", 400)]);
    const losers = [
      ...us.filter((r) => r.symbol.length <= 4 && r.mcap >= 5e9 && r.changePct <= -2 && r.changePct >= -12),
      ...th.slice(0, 200).filter((r) => r.mcap >= 3e8 && r.changePct <= -2 && r.changePct >= -12),
    ]
      .sort((a, b) => a.changePct - b.changePct)
      .slice(0, 8);
    const checked = await Promise.all(
      losers.map(async (r) => {
        const yahoo = toYahooSymbol(r.country === "Thailand" ? "thailand" : "america", r.symbol);
        const a = await buildAnalysis(yahoo).catch(() => null);
        return a && isFinite(a.quote.price) ? { a, raw: r } : null;
      })
    );
    pressure.push(
      ...checked
        .filter((x): x is NonNullable<typeof x> => !!x)
        .filter((x) => x.a.technicals?.signal === "bearish")
        .sort((x, y) => (x.a.factors?.overall ?? 50) - (y.a.factors?.overall ?? 50))
        .slice(0, 3)
        .map((x) => ({
          ticker: x.a.quote.symbol,
          headline: `🔻 ${x.a.quote.symbol} ${x.raw.changePct.toFixed(1)}% — สัญญาณเอียงลบ`,
          reason: `${x.a.technicals?.reasons.slice(0, 2).join(" · ") ?? "ราคาอ่อนแรง"}${x.a.factors ? ` · คะแนนรวม ${x.a.factors.overall}/100` : ""}`,
        }))
    );
  } catch {}

  // ⚠️ ระวัง — ความเสี่ยงที่จับต้องได้วันนี้
  const caution: { icon: string; text: string }[] = [];
  const vix = (macro as Record<string, { price: number; changePct: number }>)["^VIX"];
  if (vix && isFinite(vix.changePct) && vix.changePct >= 4) caution.push({ icon: "🌪️", text: `VIX พุ่ง +${vix.changePct.toFixed(1)}% (ระดับ ${vix.price.toFixed(1)}) — ความกลัวขึ้นเร็ว ลดขนาด position ใหม่ลง` });
  const oil = (macro as Record<string, { price: number; changePct: number }>)["CL=F"];
  if (oil && isFinite(oil.changePct) && oil.changePct >= 3) caution.push({ icon: "🛢️", text: `น้ำมันขึ้นแรง +${oil.changePct.toFixed(1)}% — กดดันเงินเฟ้อ/ต้นทุน โดยเฉพาะขนส่ง-การบิน` });
  const hotTheme = heat[0];
  if (hotTheme && hotTheme.heat >= 70) caution.push({ icon: hotTheme.theme.emoji, text: `ธีม "${hotTheme.theme.name}" ร้อน ${hotTheme.heat}/100 — ราคาในกลุ่มนี้อาจ overheat แล้ว ระวังได้กำไรไม่ปล่อย` });
  const today = new Date().toISOString().slice(0, 10);
  const soon = (calendarJson as { events: { date: string; label: string; star: number }[] }).events.find((e) => e.date >= today && e.date <= new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10) && e.star >= 3);
  if (soon) caution.push({ icon: "🗓️", text: `${soon.date}: ${soon.label} — เหตุการณ์ระดับ ★★★ ความผันผวนช่วงก่อน-หลังประกาศสูง` });
  const hotRSI = picks.picks.find((p) => /RSI (7[5-9]|[89]\d|100)/.test(p.reason));
  if (hotRSI) caution.push({ icon: "🌡️", text: `${hotRSI.ticker} RSI สูงผิดปกติ (${(hotRSI.reason.match(/RSI (\d+)/) ?? [])[1]}) — ราคาร้อนแรง ไล่ตามตอนนี้เสี่ยงถูกเก็บกำไร` });

  // 💎 โอกาส — ธีมที่กำลังร้อน + กูรูเพิ่งขยับ
  const opportunity: { icon: string; title: string; text: string; link?: string }[] = [];
  if (hotTheme) {
    const wq = await getQuotes(hotTheme.theme.watch.slice(0, 4)).catch(() => ({}) as Record<string, never>);
    const movers = hotTheme.theme.watch.map((w) => (wq as Record<string, { symbol: string; changePct: number }>)[w]).filter((q) => q && isFinite(q.changePct));
    const best = movers.sort((a, b) => b.changePct - a.changePct)[0];
    opportunity.push({
      icon: hotTheme.theme.emoji,
      title: `ธีมร้อนสุดวันนี้: ${hotTheme.theme.name} (${hotTheme.heat}/100)`,
      text: best ? `ตัวนำขบวน: ${best.symbol} ${best.changePct >= 0 ? "+" : ""}${best.changePct.toFixed(1)}% — ${hotTheme.theme.desc}` : hotTheme.theme.desc,
      link: "/radar",
    });
  }
  try {
    const gurus = await getLiveGurus();
    const mover = gurus
      .filter((g) => g.qoq && g.qoq.newCount > 0)
      .sort((a, b) => (b.qoq?.newCount ?? 0) - (a.qoq?.newCount ?? 0))[0];
    if (mover?.qoq) {
      const newTickers = mover.holdings.filter((h) => h.change?.type === "new").slice(0, 3).map((h) => h.ticker || h.issuer).filter(Boolean);
      opportunity.push({
        icon: "🐋",
        title: `${mover.emoji} ${mover.name.split(" ")[0]} เปิดพอร์ตใหม่ ${mover.qoq.newCount} ตัว`,
        text: newTickers.length ? `ตำแหน่งใหม่ล่าสุด: ${newTickers.join(", ")} — จาก 13F ที่ SEC รับไว้จริง` : "ดูรายชื่อทั้งหมดในหน้าพอร์ตกูรู",
        link: "/gurus",
      });
    }
  } catch {}

  // 🫵 พอร์ตคุณ — เช็ค holdings ที่ส่งมา (ถ้ามี)
  const portfolio: { ticker: string; flag: "warn" | "good"; text: string }[] = [];
  if (holdings.length) {
    const results = await Promise.all(holdings.slice(0, 8).map(async (t) => ({ t, a: await buildAnalysis(t).catch(() => null) })));
    for (const { t, a } of results) {
      if (!a || !isFinite(a.quote.price)) continue;
      const rsi = a.technicals?.rsi14;
      if (a.technicals?.signal === "bearish") portfolio.push({ ticker: a.quote.symbol, flag: "warn", text: `สัญญาณเอียงลบ — ${a.technicals.reasons[0] ?? "ราคาอ่อนแรง"}${rsi ? ` (RSI ${rsi.toFixed(0)})` : ""}` });
      else if (rsi && rsi >= 75) portfolio.push({ ticker: a.quote.symbol, flag: "warn", text: `RSI ${rsi.toFixed(0)} ร้อนแรง — พิจารณาเก็บกำไรบางส่วนลดความเสี่ยง` });
      else if (a.technicals?.signal === "bullish") portfolio.push({ ticker: a.quote.symbol, flag: "good", text: `สัญญาณยังเอียงบวก — ${a.technicals.reasons[0] ?? "แนวโน้มหนุน"}` });
    }
  }

  // สรุป 1 บรรทัด (AI ถ้ามี key — ไม่มีก็เทมเพลตจากข้อมูลจริง)
  const facts = `VIX ${vix && isFinite(vix.changePct) ? (vix.changePct >= 0 ? "+" : "") + vix.changePct.toFixed(1) + "%" : "-"} · ธีมร้อนสุด ${hotTheme ? hotTheme.theme.name + " " + hotTheme.heat + "/100" : "-"} · น่าสนใจ: ${watch.map((w) => w.ticker).join(", ") || "-"} · แรงกดดัน: ${pressure.map((p) => p.ticker).join(", ") || "-"}${portfolio.some((p) => p.flag === "warn") ? " · พอร์ตผู้ใช้มีสัญญาณเตือน" : ""}`;
  let summary = `วันนี้: ${facts}`;
  if (hasAI()) {
    summary =
      (await chatOnce(
        [
          { role: "system", content: "คุณเป็นบรรณาธิการสรุปตลาดรายวันภาษาไทย เขียน 2 ประโยคตอบคำถาม 'วันนี้ควรรู้อะไร' ใช้เฉพาะข้อเท็จจริงที่ให้ ห้ามแนะนำซื้อขายตรงๆ ใช้คำ 'น่าสนใจ/มีแรงกดดัน/ควรระวัง'" },
          { role: "user", content: facts },
        ],
        0.4
      ).catch(() => "")) || summary;
  }

  return {
    asOf: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.",
    summary,
    watch,
    pressure,
    caution: caution.slice(0, 4),
    opportunity: opportunity.slice(0, 3),
    portfolio,
  };
}

export async function GET(req: NextRequest) {
  const holdings = (req.nextUrl.searchParams.get("holdings") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 8);
  if (cached && Date.now() - cached.at < TTL && holdings.length === 0) return NextResponse.json(cached.data);
  try {
    const data = await buildToday(holdings);
    if (holdings.length === 0) cached = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 150) }, { status: 500 });
  }
}
