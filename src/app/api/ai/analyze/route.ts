import { NextRequest } from "next/server";
import { buildAnalysis } from "@/lib/analysis";
import { findSectorInfo } from "@/lib/tvscanner";
import { chatStream, hasAI, SYSTEM_ANALYST, friendlyAIError } from "@/lib/ai";
import { getUsdThb } from "@/lib/yahoo";
import { formatBig } from "@/lib/factors";

export const dynamic = "force-dynamic";

// persona มุมมองนักลงทุน (ไอเดียจาก ai-hedge-fund — ให้ AI สวมบทบาทสไตล์นักลงทุนดัง)
const PERSONAS: Record<string, { name: string; style: string; demoFocus: string }> = {
  burry: {
    name: "Michael Burry",
    style: "ตอบในสไตล์ Michael Burry: สาย contrarian value เกลียดหุ้นแพงโมเมนตัมสูง เน้นความเสี่ยงการเสียเงินก่อนเสมอ ชอบเทียบ valuation กับ growth ที่จ่ายแพงเกิน ถ้า Valuation ต่ำ+Health ดี จะชอบ ถ้า Momentum สูง+Valuation ต่ำ(แพง) จะมองเป็นฟองสบู่ พูดตรงๆ ไม่เกรงใจ",
    demoFocus: "มุมมอง Burry: มอง valuation เป็นหลัก — ถ้าแพงเขาคงเรียก 'รอจังหวะ' ไม่ใช่ 'รีบเข้า'",
  },
  buffett: {
    name: "Warren Buffett",
    style: "ตอบในสไตล์ Warren Buffett: พูดง่าย เปรียบเทียบชีวิตจริง เน้น ROE/กำไรแข็งแรง/ธุรกิจเข้าใจง่าย/ถือยาว ถ้า Profitability สูง+FCF ดี จะชอบ แต่จะบ่นเรื่องราคาที่จ่ายแพง (Margin of Safety) ปิดท้ายมักมีมุกสั้นๆ",
    demoFocus: "มุมมอง Buffett: 'ราคาที่จ่ายคือทุกอย่าง ธุรกิดีีที่แพงเกินก็ไม่ใช่ของถูก'",
  },
  lynch: {
    name: "Peter Lynch",
    style: "ตอบในสไตล์ Peter Lynch: หา 'ธุรกิจที่เข้าใจได้ก่อนคนอื่น' เน้น Growth สมเหตุผลที่ยังไม่แพง (GARP — เทียบ P/E กับ growth/PEG) ชอบเล่าว่าสิ่งรอบตัวบอกอะไร ถ้า Growth สูง+Valuation ไม่แพงเกินจะตื่นเต้น",
    demoFocus: "มุมมอง Lynch: GARP — growth ดีที่ราคายังไม่แพงคือจุดหวาน",
  },
  geo: {
    name: "นักภูมิรัฐศาสตร์การเงิน",
    style: `ตอบในมุมมอง "นักภูมิรัฐศาสตร์การเงิน" สังเคราะห์จากตำราระดับโลก:
- Zeihan: ภูมิศาสตร์+ประชากรศาสตร์กำหนดชะตา (demographics is destiny), ช่องแคบ/เส้นทางเดินเรือ, กระแส reshoring
- Friedman/STRATFOR: แยก "ผลประโยชน์ชาติ" ออกจากคำพูดผู้นำ — ชาติทำตาม constraint ไม่ใช่อุดมการณ์
- Brzezinski (Grand Chessboard): ยูเรเชียคือกระดานหลัก ใครคุมยูเรเชียคุมโลก
- Marshall (Prisoners of Geography): ภูมิศาสตร์กักขังตัวเลือกของชาติ (ฮอร์มุซ/มะละกา/ไต้หวัน)
- Bremmer (Eurasia Group): กลั่นความเสี่ยงการเมือง (political risk) แยกจาก fundamental
- Dalio (Changing World Order): วัฏจักรหนี้ระยะยาว+สกุลเงินสำรองโลกกำลังเปลี่ยนมือ — โยงดอลลาร์/ดอกเบี้ย/ทองคำ
- อ.ทวีสุข ธรรมศักดิ์ (ภูมิรัฐศาสตร์การเงิน): โครงสร้างอำนาจการเงินโลก (EuroDollar/ธนาคารกลาง/จักรวรรดิการเงิน), ทองคำเป็นสินทรัพย์ป้องกันความเสี่ยง, เล่าประวัติศาสตร์เชื่อมโยงถึงปัจจุบัน
โครงสร้างคำตอบ: (1) เปิดด้วยภาพใหญ่เชิงโครงสร้าง/ประวัติศาสตร์ที่หุ้นนี้ฝังตัวอยู่ (2) วิเคราะห์ 5 ชั้น: ห่วงโซ่อุปทาน/ช่องแคบที่พึ่งพา · ความเข้มข้นการผลิตตามภูมิศาสตร์ · ความเสี่ยงระเบียบ/คว่ำบัตร/ภาษี · ผลประโยชน์ชาติมหาอำนาจที่ชนกันบนตัวบริษัทนี้ · นัยต่อระบบการเงินโลก (ดอลลาร์/ดอกเบี้ย/ทอง) (3) จบด้วย "เหตุการณ์ที่ต้องเฝ้าระวัง" 3 อย่างแบบเจาะจง + สินทรัพย์เกราะป้องกันตามแนวคิด (ทอง/พลังงาน/กลาโหม) — ใช้ตัวเลขจริงจากข้อมูลที่ให้ ห้ามเดา`,
    demoFocus: "มุมมองภูมิรัฐศาสตร์: หุ้นอยู่ตรงไหนของกระดานหมากรุกโลก — ช่องแคบ ห่วงโซ่อุปทาน ผลประโยชน์ชาติที่ชนกัน",
  },
};

// GET /api/ai/analyze?s=AAPL&persona=burry — สตรีมบทวิเคราะห์ภาษาไทย (AI ถ้ามี key / โหมดตัวอย่างถ้าไม่มี)
export async function GET(req: NextRequest) {
  const s = (req.nextUrl.searchParams.get("s") || "").toUpperCase();
  const personaId = (req.nextUrl.searchParams.get("persona") || "").toLowerCase();
  const persona = PERSONAS[personaId];
  if (!s) return new Response("missing s", { status: 400 });

  const a = await buildAnalysis(s);

  if (!hasAI()) {
    const demo = demoAnalysis(a, persona);
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // ค่อยๆ ปล่อยข้อความเหมือน AI เขียนจริง
        for (const chunk of demo.match(/[\s\S]{1,18}/g) ?? []) {
          controller.enqueue(enc.encode(chunk));
          await new Promise((r) => setTimeout(r, 12));
        }
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-AI-Mode": "demo" } });
  }

  const usdThb = await getUsdThb();
  // หมวดหมู่/อุตสาหกรรมจริงจากตลาด (TV) — ให้ AI รู้บริบทธุรกิจ
  const sectorInfo = await findSectorInfo(s);
  const payload = {
    ticker: a.quote.symbol,
    name: a.quote.name,
    price: a.quote.price,
    currency: a.quote.currency,
    changePctToday: a.quote.changePct,
    usdThb,
    profile: a.profile,
    financials: a.financials,
    factors: a.factors,
    technicals: a.technicals ? { ...a.technicals, reasons: a.technicals.reasons } : undefined,
    newsHeadlines: a.news.slice(0, 4).map((n) => n.title),
    scenarios: a.scenarios,
    marketSector: sectorInfo ?? undefined,
  };

  try {
    const stream = await chatStream([
      { role: "system", content: SYSTEM_ANALYST + (persona ? `\n\nสวมบทบาทพิเศษ: ${persona.style}` : "") },
      {
        role: "user",
        content: `วิเคราะห์หุ้นนี้จากข้อมูลจริงต่อไปนี้ (JSON):\n${JSON.stringify(payload, null, 1)}\n\nเขียนบทวิเคราะห์ภาษาไทยตามโครงสร้างที่กำหนด ยาวประมาณ 500-800 คำ${persona ? ` เขียนในนาม "${persona.name}"` : ""}`,
      },
    ], 0.55);
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-AI-Mode": "live" } });
  } catch (e) {
    const msg = `⚠️ ${friendlyAIError(e)} — แสดงข้อมูลจริงแทน\n\n` + demoAnalysis(a, persona);
    return new Response(msg, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-AI-Mode": "demo" } });
  }
}

// ===== โหมดตัวอย่าง: สร้างบทวิเคราะห์จากคะแนนปัจจัย/เทคนิคที่คำนวณได้จริง =====
function demoAnalysis(a: Awaited<ReturnType<typeof buildAnalysis>>, persona?: { name: string; demoFocus: string }): string {
  const f = a.factors;
  const t = a.technicals;
  const q = a.quote;
  const p = a.profile;
  const L: string[] = [];

  L.push(`## 🤖 โหมดตัวอย่าง (ยังไม่ได้ตั้งค่า AI key)`);
  L.push(`บทวิเคราะห์นี้ประกอบจาก**คะแนนปัจจัยและสัญญาณเทคนิคที่คำนวณจากข้อมูลจริง**อัตโนมัติ เสียบ AI key ที่ \`.env.local\` เพื่อรับบทวิเคราะห์ฉบับเต็ม\n`);

  L.push(`## ภาพรวม ${q.symbol} — ${q.name}`);
  const parts: string[] = [];
  parts.push(`ราคาปัจจุบัน ${q.price.toFixed(2)} ${q.currency} (${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}% วันนี้)`);
  if (p?.sector) parts.push(`อุตสาหกรรม ${p.sector}${p.industry ? " / " + p.industry : ""}`);
  if (p?.marketCap) parts.push(`มูลค่าตลาด ${formatBig(p.marketCap)} USD`);
  L.push(parts.join(" · ") + "\n");

  if (f) {
    L.push(`## คะแนนปัจจัย 5 มิติ (0-100)`);
    L.push(`- Valuation: **${f.valuation}** · Growth: **${f.growth}** · Profitability: **${f.profitability}** · Momentum: **${f.momentum}** · Financial Health: **${f.health}**`);
    L.push(`- คะแนนรวม: **${f.overall}/100**`);
    if (f.details.length) {
      const top = f.details.slice(0, 6).map((d) => `${d.label} ${d.value}`).join(" · ");
      L.push(`- ตัวชี้วัดเด่น: ${top}`);
    }
    if (f.gaps.length) L.push(`- ⚠️ ข้อมูลที่ยังขาด: ${f.gaps.join(", ")} (Yahoo ไม่ให้สำหรับหุ้นตลาดนี้)`);
    L.push("");
  }

  if (t) {
    const label = t.signal === "bullish" ? "เอียงบวก 📈" : t.signal === "bearish" ? "เอียงลบ 📉" : "เป็นกลาง ⚖️";
    L.push(`## สัญญาณเทคนิค: ${label}`);
    for (const r of t.reasons.slice(0, 5)) L.push(`- ${r}`);
    L.push("");
  }

  const fin = a.financials;
  if (fin && Object.values(fin).some((v) => v !== undefined)) {
    L.push(`## ไฮไลต์งบการเงิน`);
    const fl: string[] = [];
    if (fin.revenueGrowth !== undefined) fl.push(`รายได้โต ${(fin.revenueGrowth * 100).toFixed(1)}% YoY`);
    if (fin.profitMargins !== undefined) fl.push(`มาร์จิ้นสุทธิ ${(fin.profitMargins * 100).toFixed(1)}%`);
    if (fin.returnOnEquity !== undefined) fl.push(`ROE ${(fin.returnOnEquity * 100).toFixed(1)}%`);
    if (fin.debtToEquity !== undefined) fl.push(`หนี้/ทุน ${fin.debtToEquity.toFixed(0)}%`);
    if (fl.length) L.push(fl.join(" · "));
    L.push("");
  }

  L.push(`## สรุป`);
  if (persona) {
    L.push(`_(${persona.demoFocus})_`);
    L.push("");
  }
  if (f && t) {
    const combo = f.overall + (t.signal === "bullish" ? 12 : t.signal === "bearish" ? -12 : 0);
    if (combo >= 62) L.push(`ปัจจัยพื้นฐานและสัญญาณเทคนิคน่าติดตามในเชิงบวก แต่ควรตรวจสอบความเสี่ยงและวอลุ่มเทรดประกอบ`);
    else if (combo <= 45) L.push(`มีแรงกดดันจากปัจจัยพื้นฐานและ/หรือเทคนิค ควรศึกษาปัจจัยลบเพิ่มก่อนพิจารณา`);
    else L.push(`ภาพรวมอยู่ในเขตกลาง — จุดชี้ขาดคือ catalysts รายบริษัทและสภาพมหภาค ควรติดตามต่อ`);
  } else {
    L.push(`ข้อมูลพื้นฐานของหุ้นตลาดนี้จำกัด — ใช้กราฟราคา/สัญญาณเทคนิคเป็นหลัก และตรวจสองข้อมูลจากแหล่งทางการของตลาดนั้นๆ`);
  }
  L.push("");
  L.push(`⚠️ บทวิเคราะห์เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน การลงทุนมีความเสี่ยง`);
  return L.join("\n");
}
