import { NextRequest, NextResponse } from "next/server";
import { jevAsk } from "@/lib/typesafe";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/ai/jev-check { ticker, text } — Jev ตรวจบทวิเคราะห์ AI เป็น "มุมมองที่สอง"
export async function POST(req: NextRequest) {
  const { ticker, text } = (await req.json().catch(() => ({}))) as { ticker?: string; text?: string };
  if (!ticker || !text || text.length < 50) return NextResponse.json({ error: "ต้องมี ticker และบทวิเคราะห์" }, { status: 400 });

  const a = await jevAsk(
    `บทวิเคราะห์หุ้น ${ticker} โดย AI ตัวหลัก (Gemini) — สรุปส่วนหลัก: """${text.slice(0, 2200)}"""`,
    {
      verdict: { type: "choice", instructions: "As a second opinion: does this analysis look reasonable for a retail investor to rely on?", criteria: { solid: "เห็นด้วย — เหตุผลแน่นพอ", ok_but: "พอใช้ แต่มีข้อควรระวัง", thin: "บางเกินไป — อย่าพึ่งอย่างเดียว", hype: "เอียงไปทางบวกเกินหลักฐาน" } },
      blindSpot: { type: "choice", instructions: "What is the biggest blind spot of this analysis?", criteria: { valuation: "ตีค่าหุ้น/ราคาที่เหมาะสม", macro: "ความเสี่ยงมหภาค (ดอกเบี้ย/เงินเฟ้อ/สงคราม)", debt: "หนี้/กระแสเงินสด", crowding: "ความแออัดของ position/ความคาดหวังตลาด", news: "ความเสี่ยงข่าว/เหตุการณ์", none: "ไม่มีจุดบอดชัดเจน" } },
      stance: { type: "score", instructions: "How bullish/positive does the overall tone lean?", criteria: ["ลบชัด", "เอียงลบ", "สมดุล", "เอียงบวก", "บวกจัด"] },
    }
  );
  if (!a) return NextResponse.json({ error: "Jev ไม่ตอบตอนนี้" }, { status: 503 });

  const v = (a.verdict as { choice?: string }).choice;
  const b = (a.blindSpot as { choice?: string }).choice;
  const st = (a.stance as { score?: number }).score ?? null;
  const VERDICT_TH: Record<string, { label: string; cls: string }> = {
    solid: { label: "✅ เห็นด้วย — เหตุผลแน่น", cls: "text-up" },
    ok_but: { label: "⚠️ พอใช้ แต่มีข้อควรระวัง", cls: "text-amber-400" },
    thin: { label: "🔎 บางเกินไป — อย่าพึ่งบทนี้อย่างเดียว", cls: "text-amber-400" },
    hype: { label: "🔥 เอียงบวกเกินหลักฐาน", cls: "text-down" },
  };
  const BLIND_TH: Record<string, string> = { valuation: "ตีค่าราคา", macro: "มหภาค (ดอกเบี้ย/เงินเฟ้อ/สงคราม)", debt: "หนี้/กระแสเงินสด", crowding: "ความแออัดของ position", news: "ความเสี่ยงข่าว", none: "ไม่มีจุดบอดชัด" };
  return NextResponse.json({
    verdict: v, verdictTh: VERDICT_TH[v ?? ""]?.label ?? v ?? null, verdictCls: VERDICT_TH[v ?? ""]?.cls ?? "",
    blindSpot: b, blindSpotTh: BLIND_TH[b ?? ""] ?? b ?? null,
    stance: st,
    text: `🧠 Jev ตรวจ: ${VERDICT_TH[v ?? ""]?.label ?? v} · จุดที่ควรเช็กเพิ่ม: ${BLIND_TH[b ?? ""] ?? b}${st !== null ? ` · โทนบทวิเคราะห์เอียง ${st >= 3.5 ? "บวก" : st <= 1.5 ? "ลบ" : "กลาง"} (${st.toFixed(1)}/4)` : ""}`,
  });
}
