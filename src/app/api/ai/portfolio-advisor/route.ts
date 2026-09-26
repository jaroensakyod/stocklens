import { NextRequest, NextResponse } from "next/server";
import { requirePro } from "@/lib/auth";
import { buildAnalysis } from "@/lib/analysis";
import { chatOnce, hasAI, friendlyAIError } from "@/lib/ai";
import { findSectorInfo, tvUniverse } from "@/lib/tvscanner";
import { computeThemeHeat } from "@/lib/radar";
import { getQuotes, getUsdThb } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Holding {
  ticker: string;
  qty: number;
  avgCost: number;
  /** 📌 หุ้นแกน — เจ้าของเลือกถือระยะยาว: ไม่แนะนำตัดเพราะน้ำหนักใหญ่/ราคาร้อนเพียงอย่างเดียว */
  core?: boolean;
}

// POST /api/ai/portfolio-advisor { holdings: [{ticker, qty, avgCost, core?}] }
// ดึงข้อมูลจริงทั้งหมด (sector/factors/technicals/radar) → วิเคราะห์ 4 มิติ → AI แนะนำปรับพอร์ตเป็นข้อๆ
export async function POST(req: NextRequest) {
  // 🔒 AI ปรับพอร์ตส่วนตัว = สิทธิ์สมาชิก 🥇 Pro
  const guard = requirePro(req);
  if (!guard.ok)
    return Response.json(
      { error: "🔒 AI ปรับพอร์ตส่วนตัวเป็นสิทธิ์สมาชิก 🥇 Pro — อัปเกรดที่หน้า /pricing (ถ้ายังไม่ได้เข้าสู่ระบบ ที่หน้า /login)" },
      { status: 403 }
    );
  const { holdings } = (await req.json().catch(() => ({}))) as { holdings?: Holding[] };
  if (!holdings?.length || holdings.length < 2) {
    return NextResponse.json({ error: "ต้องมี holdings อย่างน้อย 2 ตัว (ใส่ที่หน้าพอร์ต)" }, { status: 400 });
  }
  const MAX_H = 8; // วิเคราะห์ได้สูงสุด 8 ตัวต่อรอบ (buildAnalysis หนัก) — เกินต้องบอกผู้ใช้ ไม่ตัดเงียบ
  const truncated = Math.max(0, holdings.length - MAX_H);

  // ===== 1) ดึงข้อมูลจริงทุกตัว (ขนานกัน + แยก isolation ต่อขั้น เพื่อ sector lookup ล่มไม่พังทั้งแถว) =====
  // อัตราแลกเปลี่ยน USD/THB — หุ้นไทย (.BK) ราคาเป็นบาท ต้องแปลงเป็น USD ก่อนคิดน้ำหนักพอร์ต (ไม่งั้นน้ำหนักเพี้ยน ~36 เท่า)
  const usdThb = await getUsdThb();
  const rows: {
    ticker: string; qty: number; avgCost: number; core: boolean;
    price: number; value: number; currency: string; pl: number; plPct: number;
    sector?: string; industry?: string;
    factors?: { valuation: number; growth: number; profitability: number; momentum: number; health: number; overall: number };
    signal?: string;
    signalLabel?: string;
  }[] = [];
  const failed: string[] = [];

  const results = await Promise.allSettled(
    holdings.slice(0, MAX_H).map(async (h) => {
      // พิมพ์ไม่มี suffix แล้วดึงไม่ได้ → ลองเป็นหุ้นไทย .BK อีกรอบ (เช่น "PTT" → "PTT.BK")
      let a = await buildAnalysis(h.ticker).catch(() => null);
      if (!a || !isFinite(a.quote.price)) {
        const bk = h.ticker.includes(".") ? null : `${h.ticker}.BK`;
        if (bk) a = await buildAnalysis(bk).catch(() => null);
      }
      if (!a || !isFinite(a.quote.price)) throw new Error("no-data");
      // sector แยก try — TV ล่มไม่ต้องเสียทั้งตัว (fallback: sector จาก Yahoo profile)
      let sec: { sector?: string; industry?: string } | null = null;
      try {
        sec = await findSectorInfo(a.quote.symbol);
      } catch {
        sec = a.profile ? { sector: a.profile.sector, industry: a.profile.industry } : null;
      }
      return {
        ticker: a.quote.symbol, qty: h.qty, avgCost: h.avgCost, core: h.core === true,
        price: a.quote.price,
        value: (a.quote.price * h.qty) / (a.quote.currency === "THB" ? usdThb : 1), // มูลค่ารวมเป็น USD เพื่อคิดน้ำหนัก/sector ให้ถูกต้อง
        currency: a.quote.currency,
        pl: (a.quote.price - h.avgCost) * h.qty, // P/L คิดในสกุลของหุ้นนั้น (ใช้เฉพาะ plPct ต่อ)
        plPct: h.avgCost > 0 ? ((a.quote.price - h.avgCost) / h.avgCost) * 100 : 0,
        sector: sec?.sector || a.profile?.sector, industry: sec?.industry || a.profile?.industry,
        factors: a.factors ? { valuation: a.factors.valuation, growth: a.factors.growth, profitability: a.factors.profitability, momentum: a.factors.momentum, health: a.factors.health, overall: a.factors.overall } : undefined,
        signal: a.technicals?.signal,
        signalLabel: a.technicals?.signal === "bullish" ? "เอียงบวก" : a.technicals?.signal === "bearish" ? "เอียงลบ" : "กลาง",
      };
    })
  );
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") rows.push(r.value);
    else failed.push(holdings[i].ticker);
  }

  if (rows.length < 2) {
    const hint = failed.length
      ? ` ตัวที่ดึงไม่ได้: ${failed.join(", ")} — เช็คว่าสัญลักษณ์ถูกต้อง (หุ้นไทยใส่ .BK เช่น PTT.BK) แล้วลองใหม่`
      : " — อาจเป็นข้อมูลตลาดหน่วงชั่วคราว ลองใหม่อีกครั้ง";
    return NextResponse.json({ error: "ดึงข้อมูล holdings ไม่ได้" + hint, failed }, { status: 500 });
  }

  // ===== 2) วิเคราะห์ 4 มิติ =====
  const totalValue = rows.reduce((a, r) => a + r.value, 0);
  const sectorCount: Record<string, number> = {};
  for (const r of rows) {
    const s = r.sector || "อื่นๆ";
    sectorCount[s] = (sectorCount[s] ?? 0) + r.value;
  }
  const topSector = Object.entries(sectorCount).sort((a, b) => b[1] - a[1])[0];
  const topSectorPct = (topSector[1] / totalValue) * 100;
  const topHolding = [...rows].sort((a, b) => b.value - a.value)[0];
  const topHoldingPct = (topHolding.value / totalValue) * 100;
  const avgFactors = {
    valuation: Math.round(rows.reduce((a, r) => a + (r.factors?.valuation ?? 50), 0) / rows.length),
    growth: Math.round(rows.reduce((a, r) => a + (r.factors?.growth ?? 50), 0) / rows.length),
    profitability: Math.round(rows.reduce((a, r) => a + (r.factors?.profitability ?? 50), 0) / rows.length),
    momentum: Math.round(rows.reduce((a, r) => a + (r.factors?.momentum ?? 50), 0) / rows.length),
    health: Math.round(rows.reduce((a, r) => a + (r.factors?.health ?? 50), 0) / rows.length),
  };
  const bearishCount = rows.filter((r) => r.signal === "bearish").length;
  const bullishCount = rows.filter((r) => r.signal === "bullish").length;

  // Radar ที่กระทบพอร์ต (เรียงตามความร้อน)
  const heat = await computeThemeHeat();
  const radarTop = heat.slice(0, 4).map((h) => ({ name: h.theme.name, emoji: h.theme.emoji, heat: h.heat }));

  // ===== 3) สร้าง truth packet =====
  const holdingsText = rows
    .map((r) => `${r.ticker}: ${((r.value / totalValue) * 100).toFixed(1)}% of portfolio, $${(r.value / 1000).toFixed(1)}K (แปลงจาก ${r.currency} เรียบร้อย), P/L ${(r.plPct >= 0 ? "+" : "") + r.plPct.toFixed(1)}%, sector=${r.sector || "?"}${r.factors ? `, factors V${r.factors.valuation}/G${r.factors.growth}/P${r.factors.profitability}/M${r.factors.momentum}/H${r.factors.health} (รวม${r.factors.overall})` : ""}, tech=${r.signalLabel}${r.core ? ", 📌หุ้นแกน (เจ้าของตั้งใจถือระยะยาว)" : ""}`)
    .join("\n");

  const metricsText = `มูลค่าพอร์ต: $${(totalValue / 1000).toFixed(1)}K (รวมทุกสกุลเงินเป็น USD แล้ว)${truncated ? `\nหมายเหตุ: สมาชิกส่งมา ${holdings.length} ตัว วิเคราะห์ได้ 8 ตัวแรก (${rows.map((r) => r.ticker).join(", ")}) ตัวที่เหลือยังไม่ได้นับ` : ""}
หุ้นใหญ่สุด: ${topHolding.ticker} (${topHoldingPct.toFixed(1)}%) ${topHoldingPct > 30 ? "⚠️ เข้มข้นเกิน" : ""}
Sector ใหญ่สุด: ${topSector[0]} (${topSectorPct.toFixed(1)}%) ${topSectorPct > 60 ? "⚠️ กระจุกเกิน" : ""}
จำนวนหุ้น: ${rows.length} ตัว
คะแนนปัจจัยเฉลี่ย: Valuation ${avgFactors.valuation}/100 · Growth ${avgFactors.growth} · Profitability ${avgFactors.profitability} · Momentum ${avgFactors.momentum} · Health ${avgFactors.health}
สัญญาณเทคนิค: บวก ${bullishCount} · กลาง ${rows.length - bullishCount - bearishCount} · ลบ ${bearishCount}
ธีม Radar ร้อนสุด: ${radarTop.map((t) => `${t.emoji}${t.name}(${t.heat})`).join(", ")}`;

  const packet = `[ข้อมูลจริงของพอร์ต]\n${metricsText}\n\nตำแหน่ง:\n${holdingsText}`;

  // ===== 4) โหมด demo (ไม่มี AI key) — วิเคราะห์เชิงกฎ =====
  const demoAdvice: { action: string; title: string; detail: string; tone: "warn" | "info" | "good" }[] = [];
  if (topHoldingPct > 30 && topHolding.core) {
    demoAdvice.push({ action: "หุ้นแกน", title: `📌 ${topHolding.ticker} ${topHoldingPct.toFixed(0)}% — เจ้าของเลือกเป็นหุ้นแกน`, detail: `ไม่แนะนำตัดเพียงเพราะน้ำหนักใหญ่ (นี่คือทางเลือกของเจ้าของพอร์ต) — แต่จำไว้ว่าครึ่งพอร์ตขึ้นลงอยู่ตัวเดียว ถ้าพื้นฐานเปลี่ยนจะเจ็บหนัก ติดตาม factors ทุกไตรมาส`, tone: "info" });
  } else if (topHoldingPct > 30) {
    demoAdvice.push({ action: "ลด", title: `⚠️ ${topHolding.ticker} ใหญ่เกิน (${topHoldingPct.toFixed(0)}%)`, detail: `พิจารณา trim ลงเหลือไม่เกิน 25% แล้วย้ายไปหุ้น sector อื่น เพื่อลด single-stock risk — หรือกด 📌 ตั้งเป็นหุ้นแกนถ้าตั้งใจถือระยะยาว`, tone: "warn" });
  }
  if (topSectorPct > 60) {
    demoAdvice.push({ action: "กระจาย", title: `⚠️ Sector "${topSector[0]}" กิน ${topSectorPct.toFixed(0)}% ของพอร์ต`, detail: `กระจายออกไปอย่างน้อย 3 sector เพื่อลดความเสี่ยงเชิงวัฏจักร`, tone: "warn" });
  }
  if (bearishCount >= Math.ceil(rows.length / 2)) {
    demoAdvice.push({ action: "เฝ้าระวัง", title: `📉 ${bearishCount}/${rows.length} ตัวสัญญาณเทคนิคเป็นลบ`, detail: `พอร์ตกำลังเสี่ยงโมเมนตัม — พิจารณา hedge (ทอง/ETF) หรือลดขนาด position ตัวที่อ่อนแรงสุด`, tone: "warn" });
  }
  if (avgFactors.momentum > 65 && avgFactors.valuation < 35) {
    demoAdvice.push({ action: "สมดุล", title: `⚖️ พอร์ตเอนไปทางโมเมนตัมสูง/แพง`, detail: `คะแนน Momentum ${avgFactors.momentum} สูง แต่ Valuation ${avgFactors.valuation} ต่ำ — เสี่ยงตอนตลาดหมุน ควรเพิ่มหุ้น value/defensive`, tone: "info" });
  }
  if (avgFactors.health > 70) {
    demoAdvice.push({ action: "จุดแข็ง", title: `💪 Financial Health เฉลี่ย ${avgFactors.health}/100 — พื้นฐานแข็ง`, detail: `พอร์ตทนแรงกดดันได้ดี ไม่ต้องรีบปรับมาก`, tone: "good" });
  }
  if (rows.length < 4) {
    demoAdvice.push({ action: "เพิ่มจำนวน", title: `📌 มีแค่ ${rows.length} ตัว — เพิ่มเป็นอย่างน้อย 5-8 ตัว`, detail: `ลด single-stock risk โดยเพิ่มหุ้นจาก sector ที่ยังไม่มีในพอร์ต`, tone: "info" });
  }

  // ===== 5) AI แนะนำแบบเต็ม =====
  let aiText = "";
  if (hasAI()) {
    try {
      aiText = await chatOnce(
        [
          {
            role: "system",
            content: `คุณเป็นที่ปรึกษาพอร์ต (portfolio advisor) ของ StockLens — วิเคราะห์พอร์ตจริงจากข้อมูลที่ให้ แล้วแนะนำ "การปรับพอร์ต" 4-6 ข้อ ภาษาไทย กระชับ รูปแบบ:
**[ปรับอะไร] — [ทำไม]**
เช่น "ลด NVDA จาก 35% เหลือ 25% — Momentum สูงแต่ Valuation 11/100 เสี่ยงตอนตลาดหมุน"
รวม: (1) ความเสี่ยงที่ต้องจัดการทันที (2) สมดุล sector/factor (3) สิ่งที่ทำได้ดีอยู่แล้ว (4) ข้อเสนอ 1 อย่างที่ควรเพิ่ม (พร้อมเหตุผลเชิงปัจจัย)
กติกาสำคัญ:
- ตัวที่ระบุ "📌หุ้นแกน" = เจ้าของตั้งใจถือระยะยาว — ห้ามแนะนำลดสัดส่วนด้วยเหตุผล "น้ำหนักใหญ่/ราคาวิ่งแรง/Valuation แพง" เพียงอย่างเดียว ให้วิเคราะห์เฉพาะคุณภาพธุรกิจและความเสี่ยงพื้นฐานที่เปลี่ยนแปลง
- อ้างอิงตัวเลข (มูลค่าพอร์ต/%/P/L/factors) จากข้อมูลที่ให้ไว้ตรงๆ เท่านั้น ห้ามคำนวณหรือสรุปยอดรวมเพิ่มเอง
ห้ามใช้คำ "ควรซื้อ/ควรขาย" ตรงๆ ใช้ "พิจารณา/อาจลด/น่าเพิ่ม" + ระบุเสมอว่าเป็นการวิเคราะห์เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน`,
          },
          { role: "user", content: packet },
        ],
        0.4
      );
    } catch (e) {
      aiText = friendlyAIError(e);
    }
  }

  return NextResponse.json({
    totalValue,
    truncated,
    topHoldingPct: Math.round(topHoldingPct),
    topHolding: topHolding.ticker,
    topSector: topSector[0],
    topSectorPct: Math.round(topSectorPct),
    avgFactors,
    bullishCount,
    bearishCount,
    count: rows.length,
    radarTop,
    demoAdvice: demoAdvice.length ? demoAdvice : [{ action: "OK", title: "✅ พอร์ตสมดุลดี (ตามเกณฑ์พื้นฐาน)", detail: "ไม่พบความเสี่ยงรุนแรงจากกฎพื้นฐาน — เปิด AI เพื่อวิเคราะห์เชิงลึก (ต้องมี AI key)", tone: "good" as const }],
    aiText,
    aiMode: hasAI() ? (aiText && !aiText.includes("⚠️") ? "live" : "error") : "demo",
  });
}
