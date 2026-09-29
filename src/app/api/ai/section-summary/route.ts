import { NextResponse } from "next/server";
import { chatOnce, hasAI, SYSTEM_ANALYST } from "@/lib/ai";
import { jevAsk } from "@/lib/typesafe";
import { getCached, setCached } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/ai/section-summary — สรุปไทยสั้น 2-3 ประโยคของ "section ตัวเลข" บนหน้าหุ้น/เปรียบเทียบ
// โครงสร้าง 2 ชั้นตามมาตรฐานทั้งเว็บ: Gemini เขียนบท → Jev (TypeSafe) ตรวจเป็นมุมมองที่สอง
// body: { section, ticker, lines, rule } — ถ้าไม่มี AI key → คืน rule-based ของ client เสมอ
const SECTION_HINT: Record<string, string> = {
  peers: "เทียบหุ้นกับค่ากลางกลุ่มอุตสาหกรรมเดียวกัน — ชี้ว่าแพง/ถูกกว่ากลุ่มตรงไหน แข็ง/อ่อนกว่ากลุ่มตรงไหน",
  financials: "งบการเงิน/ผลประกอบการ — เติบโตหรือชะลอ กำไรแข็งแรงไหม หนี้/สภาพคล่องเป็นอย่างไร",
  technical: "สัญญาณทางเทคนิค — แนวโน้มขาขึ้น/ลง โซนซื้อขายเกิน RSI ตำแหน่งเทียบเส้นค่าเฉลี่ย",
  score: "คะแนนรวม StockLens Score — เสาไหนแข็ง เสาไหนฉุดรั้ง",
  analyst: "คอนเซนซัสนักวิเคราะห์ — มุมมองเอียงทางไหน ราคาเป้าหมายสูง/ต่ำกว่าราคาปัจจุบันเท่าไหร่",
  compare: "การเปรียบเทียบหุ้นหลายตัว — สรุปว่าแต่ละตัวแข็ง/อ่อนตรงไหน เหมาะกับสไตล์การลงทุนแบบไหน โดยไม่ชี้ว่าตัวไหน 'ควรซื้อ'",
  "guru-holders": "สถาบัน/เซียนระดับโลกที่ถือหุ้นตัวนี้ (13F) — สรุปท่าทีรวมของเซียนต่อหุ้น (กี่รายถือ ใครเพิ่ม-ลด น้ำหนักเท่าไหร่) พร้อมเตือนว่า 13F ล่าช้า 45 วัน",
  balance: "คะแนนสมดุลพอร์ต 5 มิติ + แผนปรับสมดุล — จุดที่กระจุกตัว สิ่งที่ควรแก้ แผนบอกซื้อ/ขายอะไร โดยไม่ใช่คำแนะนำซื้อขาย",
};

// Jev ตรวจบทสรุปแบบ structured (เหมือน /api/ai/jev-check) — ถูกมาก เร็ว และมี cache 24 ชม. ในตัว
async function jevCheck(ticker: string, section: string, summary: string): Promise<{ verdict: string; verdictTh: string; cls: string; stance: number | null } | null> {
  const a = await jevAsk(
    `สรุปสั้น section "${section}" ของหุ้น ${ticker} ที่ AI หลัก (Gemini) เขียนจากตัวเลขจริง: """${summary.slice(0, 600)}"""`,
    {
      verdict: {
        type: "choice",
        instructions: "As a second opinion: is this summary faithful to the numbers (no exaggeration, no advice)?",
        criteria: {
          solid: "ตรงตัวเลข สมเหตุสมผล",
          ok_but: "พอใช้ แต่ควรอ่านต่อในตาราง",
          hype: "เอียงบวกเกินหลักฐาน",
          alarmist: "ซ่อนเงื่อนงำเตือนภัยเกินจริง",
        },
      },
      stance: {
        type: "score",
        instructions: "How bullish is the overall tone of this summary?",
        criteria: ["ลบชัด", "เอียงลบ", "สมดุล", "เอียงบวก", "บวกจัด"],
      },
    }
  );
  if (!a) return null;
  const v = (a.verdict as { choice?: string }).choice ?? "ok_but";
  const st = (a.stance as { score?: number }).score ?? null;
  const MAP: Record<string, { th: string; cls: string }> = {
    solid: { th: "✅ ตรงตัวเลข สมเหตุสมผล", cls: "text-up" },
    ok_but: { th: "⚠️ พอใช้ — อ่านต่อในตารางประกอบ", cls: "text-amber-400" },
    hype: { th: "🔥 เอียงบวกเกินหลักฐาน", cls: "text-down" },
    alarmist: { th: "❄️ เตือนเกินจริงเกินตัวเลข", cls: "text-amber-400" },
  };
  return { verdict: v, verdictTh: MAP[v]?.th ?? v, cls: MAP[v]?.cls ?? "", stance: st };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { section?: string; ticker?: string; lines?: string[]; rule?: string };
    const section = String(body.section ?? "").slice(0, 30);
    const ticker = String(body.ticker ?? "").slice(0, 24).toUpperCase();
    const lines = (body.lines ?? []).filter((l) => typeof l === "string").slice(0, 40).map((l) => l.slice(0, 220));
    if (!section || !ticker || !lines.length) return NextResponse.json({ error: "กรอก section, ticker และ lines ให้ครบ" }, { status: 400 });

    const cacheKey = `aisec:${section}:${ticker}:${lines.length}:${lines[0]}:${lines[lines.length - 1]}`;
    const hit = getCached<{ text: string; mode: string; jev?: { verdictTh: string; cls: string; stance: number | null } }>(cacheKey, 12 * 3600_000);
    if (hit) return NextResponse.json(hit);

    // ไม่มี AI key → rule-based (client สร้างจากตัวเลขจริง) — ไม่มี Jev ด้วยเพราะไม่มีบทให้ตรวจ
    if (!hasAI()) {
      const out = body.rule ? { text: body.rule, mode: "rule" } : { text: lines.slice(0, 3).join(" · "), mode: "rule" };
      setCached(cacheKey, out);
      return NextResponse.json(out);
    }

    // 1) Gemini เขียนสรุปจากตัวเลขจริง
    const text = await chatOnce(
      [
        {
          role: "system",
          content: `${SYSTEM_ANALYST}\n\nหน้าที่พิเศษ: เขียนสรุปภาษาไทย 2-3 ประโยคสั้น อ่านง่าย จากบรรทัดข้อมูลจริงที่ให้มา (${SECTION_HINT[section] ?? section}) — ห้าม markdown ห้ามหัวข้อ ห้ามคำแนะนำซื้อขาย ใช้ตัวเลขกำกับ ปิดท้ายด้วยวลี "อ่านเป็นข้อมูลประกอบการพิจารณา" ไม่ต้องใส่ ⚠️`,
        },
        { role: "user", content: `หุ้น ${ticker}\nข้อมูล:\n- ${lines.join("\n- ")}` },
      ],
      0.25
    ).then((t) => t.trim().slice(0, 900));

    // 2) Jev ตรวจเป็นมุมมองที่สอง (ถูก/เร็ว/มี cache) — พังหรือไม่มี key = แสดงเฉพาะบท Gemini
    const jev = await jevCheck(ticker, section, text);

    const out = {
      text,
      mode: "ai",
      ...(jev ? { jev: { verdictTh: jev.verdictTh, cls: jev.cls, stance: jev.stance } } : {}),
    };
    setCached(cacheKey, out);
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 140) }, { status: 500 });
  }
}
