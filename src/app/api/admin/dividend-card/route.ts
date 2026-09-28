import { NextRequest, NextResponse } from "next/server";
import { adminCode } from "@/lib/admin";
import { getDividendStreak, getXdMyth, type DividendStreakData, type XdMythData } from "@/lib/dividendCard";
import { chatOnce, hasAI } from "@/lib/ai";
import { jevAsk } from "@/lib/typesafe";

// 💰 POST /api/admin/dividend-card — Content Studio การ์ด "ปันผลต่อเนื่อง" + "ตำนาน XD"
// gate x-admin-code เหมือน portfolio-card: เฉพาะเจ้าของเว็บใช้ทำคอนเทนต์จากข้อมูลจริง
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-code") !== adminCode()) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as
    | ({ action?: string; kind?: string; market?: string; symbols?: string[]; minYears?: number; symbol?: string; data?: unknown })
    | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const action = body.action ?? "compute";

  // ---------- action: compute (streak) ----------
  if (action === "compute" && body.kind === "xd") {
    try {
      const data = await getXdMyth(String(body.symbol ?? "PTT.BK"));
      return NextResponse.json({ data });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "คำนวณไม่สำเร็จ" }, { status: 400 });
    }
  }
  if (action === "compute") {
    try {
      const market = body.market === "US" || body.market === "CUSTOM" ? body.market : "TH";
      const minYears = [3, 5, 8, 10].includes(Number(body.minYears)) ? Number(body.minYears) : 10;
      const data = await getDividendStreak(market, Array.isArray(body.symbols) ? body.symbols : [], minYears);
      return NextResponse.json({ data });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "คำนวณไม่สำเร็จ" }, { status: 400 });
    }
  }

  // ---------- action: copy — Gemini ร่าง + Jev ตรวจ ----------
  if (action !== "copy") return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
  if (!hasAI()) return NextResponse.json({ error: "ยังไม่ได้ตั้ง AI_API_KEY" }, { status: 503 });

  if (body.kind === "xd") {
    const d = body.data as XdMythData | undefined;
    if (!d || !d.chart?.length) return NextResponse.json({ error: "ต้องคำนวณข้อมูลก่อน" }, { status: 400 });
    const packet = [
      `[หุ้น] ${d.symbol} (${d.name})`,
      `[วัน XD] ${d.xdTh} · ปันผล ${d.divPerShare} ฿/หุ้น`,
      `[ราคา] ปิดวันก่อน XD ${d.prevClose} ฿ · ราคาอ้างอิงวัน XD (ปิด − ปันผล, ตลาด SET ปรับอัตโนมัติ) ${d.refPrice} ฿ · เปิดจริงวัน XD ${d.xdOpen} ฿ · ปิดวัน XD ${d.xdClose} ฿ · ปิด ~5 วันหลัง XD ${d.close5d ?? "?"} ฿`,
      `[ข้อเท็จจริงกติกา] วัน XD ผู้ซื้อไม่ได้รับปันผลงวดนี้ · คนถือก่อน XD ได้ปันผลแต่ราคาอ้างอิงถูกหักพอดีจำนวนปันผล · ถ้าซื้อสดก่อน XD แล้วขายหลัง XD ส่วนใหญ่โดนภาษีหัก ณ ที่จ่าย 10% ของปันผล (เกณฑ์ถือไม่ครบ 3 เดือนก่อนวัน XD) และเสียค่าคอมซื้อ-ขาย`,
    ].join("\n");
    const SYSTEM = `คุณคือนักเขียนคอนเทนต์การลงทุนของ StockLens กำลังทำโพสต์ IG ไขตำนาน "ซื้อหุ้นก่อน XD แล้วรับปันผลฟรี จริงไหม?"
กติกาเด็ดขาด: อ้างตัวเลขจาก packet เท่านั้น ห้ามเดา · ห้าม "การันตี/แน่นอน/ควรซื้อ/ควรขาย" · สอนมือใหม่ด้วยภาษาง่าย · ประเด็นหลักคือ ปันผลที่ได้ = มูลค่าที่หายไปจากราคาหุ้น ไม่ใช่เงินฟรี + ภาษี/ค่าคอมทำให้ซื้อสดหวังปันผลเสียเปรียบ
ตอบเป็น JSON เท่านั้น: {"headline":"หัวเรื่องสั้นทรงพลัง ≤60 ตัวอักษร","sub":"คำโปรย 1 ประโยค","bullets":["อ่านตรงนี้ 4 ข้อ ข้อละ 1 ประโยค อ้างตัวเลขจริง"],"caption":"แคปชัน 2-4 ย่อหน้า จบด้วยการบอกว่าเช็คปฏิทิน XD ได้ที่ StockLens","hashtags":"#หุ้น #ปันผล #XD ..."}`;
    return finishCopy(packet, SYSTEM);
  }

  const d = body.data as DividendStreakData | undefined;
  if (!d || !d.rows?.length) return NextResponse.json({ error: "ต้องคำนวณข้อมูลก่อน" }, { status: 400 });
  const money = (n: number) => `${n} ${d.market === "US" ? "USD" : "฿"}`;
  const packet = [
    `[เกณฑ์] จ่ายปันผลต่อเนื่อง ≥ ${d.minYears} ปี · สแกน ${d.scanned} ตัว · ตลาด ${d.market === "TH" ? "ไทย" : d.market === "US" ? "อเมริกา" : "รายชื่อที่กำหนด"} · yield = ปันผล 12 เดือนล่าสุด ÷ ราคาล่าสุด`,
    `[รายชื่อที่ผ่านเกณฑ์] ${d.rows
      .map((r) => `${r.symbol} (${r.name}) จ่ายติด ${r.streakYears} ปี · ${r.paysPerYear} ครั้ง/ปี · รวม 12 ด.ล่าสุด ${money(r.ttmTotal)}/หุ้น · yield ${r.yieldPct?.toFixed(2) ?? "?"}%`)
      .join("\n")}`,
    `[ข้อควรระวังที่ต้องสื่อสาร] จ่ายต่อเนื่องมาก่อนไม่การันตีอนาคต · yield สูงผิดปกติอาจเป็นสัญญาณราคาหุ้นตก/กิจการมีปัญหา ต้องดูงบประกอบ`,
  ].join("\n");
  const SYSTEM = `คุณคือนักเขียนคอนเทนต์การลงทุนของ StockLens กำลังทำโพสต์ IG เรื่อง "หุ้นจ่ายปันผลต่อเนื่อง" จากข้อมูลจ่ายจริง (ตอบกระแฟนคลิปไวรัลแต่แบบมีข้อมูลยืนยัน)
กติกาเด็ดขาด: อ้างตัวเลขจาก packet เท่านั้น ห้ามเดา · ห้าม "การันตี/แน่นอน/ไม่ขาดทุน/ควรซื้อ" · ต้องมีโทน "ต่อเนื่อง ≠ การันตี" และเตือนเรื่อง yield สูงผิดปกติ · ภาษาเข้าใจง่ายสำหรับมือใหม่
ตอบเป็น JSON เท่านั้น: {"headline":"หัวเรื่องสั้นทรงพลัง ≤60 ตัวอักษร","sub":"คำโปรย 1 ประโยค","bullets":["อ่านตรงนี้ 4 ข้อ ข้อละ 1 ประโยค อ้างตัวเลขจริง"],"caption":"แคปชัน 2-4 ย่อหน้า จบด้วยการบอกว่าดูพอร์ต/ปฏิทินปันผลได้ที่ StockLens","hashtags":"#หุ้น #ปันผล #ลงทุน ..."}`;
  return finishCopy(packet, SYSTEM);
}

/** ส่วนกลาง: ยิง Gemini เอา JSON → ตรวจ Jev (โทนเกินจริง + ตัวเลขตรงข้อมูล) */
async function finishCopy(packet: string, SYSTEM: string): Promise<NextResponse> {
  let copy: { headline: string; sub: string; bullets: string[]; caption: string; hashtags: string } | null = null;
  try {
    const raw = await chatOnce([{ role: "system", content: SYSTEM }, { role: "user", content: packet }], 0.5);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const j = JSON.parse(cleaned.slice(start, end + 1)) as { headline?: string; sub?: string; bullets?: unknown; caption?: string; hashtags?: string };
      const bullets = Array.isArray(j.bullets) ? j.bullets.filter((b): b is string => typeof b === "string" && !!b.trim()).slice(0, 4) : [];
      if (typeof j.headline === "string" && bullets.length >= 2 && typeof j.caption === "string") {
        copy = {
          headline: j.headline.trim().slice(0, 80),
          sub: (j.sub ?? "").trim().slice(0, 140),
          bullets,
          caption: j.caption.trim().slice(0, 1500),
          hashtags: (j.hashtags ?? "").trim().slice(0, 300),
        };
      }
    }
  } catch {
    /* ตกไปโมด error */
  }
  if (!copy) return NextResponse.json({ error: "AI ร่างข้อความไม่สำเร็จ — ลองอีกครั้ง หรือพิมพ์เอง" }, { status: 502 });

  const text = `${copy.headline}\n${copy.sub}\n${copy.bullets.join("\n")}\n${copy.caption}`;
  let jevText: string | null = null;
  const a = await jevAsk(`ตัวอย่างคอนเทนต์การลงทุนจะโพสต์โซเชียล — ข้อมูลจริงที่อ้างได้: """${packet.slice(0, 1600)}"""\nข้อความที่จะโพสต์: """${text.slice(0, 1600)}"""`, {
    hype: { type: "noul", instructions: "The copy overpromises: guarantees returns, downplays risk, or sounds too good to be true for a beginner audience" },
    numbers: { type: "choice", instructions: "Do the numbers quoted in the copy match the data packet?", criteria: { match: "ตรงกับข้อมูล", minor: "เพี้ยนเล็กน้อย/ปัดตัวเลข", off: "ผิดหรืออ้างตัวเลขที่ไม่มีในข้อมูล" } },
  });
  if (a) {
    const hype = (a.hype as { noul?: number })?.noul ?? 0;
    const numbers = (a.numbers as { choice?: string })?.choice;
    const NUM_TH: Record<string, string> = { match: "ตัวเลขตรงกับข้อมูล ✓", minor: "ตัวเลขปัดเล็กน้อย — ยอมรับได้", off: "ตัวเลขไม่ตรง — ตรวจก่อนโพสต์!" };
    jevText = `🧠 Jev ตรวจข้อความ: ${hype >= 0.6 ? "โทนเกินจริงเกินหลักฐาน — หน่วงๆ ก่อนโพสต์" : hype >= 0.3 ? "โทนกำลังดี อ่านเป็นธรรมชาติ" : "โทนสมเหตุสมผล ✓"} · ${NUM_TH[numbers ?? ""] ?? "ไม่แน่ใจตัวเลข — ไล่เช็กอีกรอบ"}`;
  }

  return NextResponse.json({ copy, jevText });
}
