import { NextRequest, NextResponse } from "next/server";
import { adminCode } from "@/lib/admin";
import { getPortfolioCard, type CardInput, type PortfolioCardData } from "@/lib/portfolioCard";
import { chatOnce, hasAI } from "@/lib/ai";
import { jevAsk } from "@/lib/typesafe";

// 🎨 POST /api/admin/portfolio-card — Content Studio: คำนวณข้อมูลการ์ด "จัดพอร์ต" + ให้ Gemini ร่างข้อความ + Jev ตรวจ
// gate ด้วย x-admin-code เหมือน route admin อื่นๆ — เฉพาะเจ้าของเว็บใช้ทำคอนเทนต์
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-code") !== adminCode()) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as (CardInput & { action?: string; data?: unknown }) | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  // ---------- action: compute — คำนวณจากราคาจริง ----------
  if (body.action !== "copy") {
    try {
      const data = await getPortfolioCard({
        oldPositions: Array.isArray(body.oldPositions) ? body.oldPositions : [],
        newPositions: Array.isArray(body.newPositions) ? body.newPositions : [],
        years: Number(body.years) || 5,
        initialThb: Number(body.initialThb) || 100000,
        dcaThb: Number(body.dcaThb) || 0,
      });
      return NextResponse.json({ data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "คำนวณไม่สำเร็จ";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  // ---------- action: copy — Gemini ร่างข้อความ + Jev ตรวจ ----------
  const d = body.data as PortfolioCardData | undefined;
  if (!d || !d.oldP || !d.newP) return NextResponse.json({ error: "ต้องคำนวณข้อมูลก่อน" }, { status: 400 });
  if (!hasAI()) return NextResponse.json({ error: "ยังไม่ได้ตั้ง AI_API_KEY" }, { status: 503 });

  const baht = (n: number) => Math.round(n).toLocaleString("th-TH");
  const packet = [
    `[สมมติฐาน] เงินต้น ฿${baht(d.initialThb)} + DCA ฿${baht(d.dcaThb)}/เดือน นาน ${d.years} ปี (${d.startTh} → ${d.endTh})`,
    `[พอร์ตเดิม] ${d.oldP.positions.map((p) => `${p.symbol} ${p.weight}%`).join(", ")}`,
    `[พอร์ตจัดใหม่] ${d.newP.positions.map((p) => `${p.symbol} ${p.weight}%`).join(", ")}`,
    `[ผลการจำลอง] เดิม: มูลค่าสุดท้าย ฿${baht(d.oldP.finalThb)} (ลงทุนรวม ฿${baht(d.oldP.investedThb)}) · ผลตอบแทนเฉลี่ย ${d.oldP.xirrPct?.toFixed(1) ?? "?"}%/ปี · ความผันผวน ${d.oldP.volPct?.toFixed(1) ?? "?"}% · จุดต่ำสุด ${d.oldP.mddPct?.toFixed(1) ?? "?"}%`,
    `[ผลการจำลอง] ใหม่: มูลค่าสุดท้าย ฿${baht(d.newP.finalThb)} (ลงทุนรวม ฿${baht(d.newP.investedThb)}) · ผลตอบแทนเฉลี่ย ${d.newP.xirrPct?.toFixed(1) ?? "?"}%/ปี · ความผันผวน ${d.newP.volPct?.toFixed(1) ?? "?"}% · จุดต่ำสุด ${d.newP.mddPct?.toFixed(1) ?? "?"}%`,
    `[สถิติสินทรัพย์ในพอร์ตใหม่] ${d.newP.positions.map((p) => { const a = d.assets.find((x) => x.symbol === p.symbol); return `${p.symbol} (${p.name}): ผลตอบแทนเฉลี่ย ${a?.cagrPct?.toFixed(1) ?? "?"}%/ปี ความผันผวน ${a?.volPct?.toFixed(1) ?? "?"}%`; }).join(" · ")}`,
  ].join("\n");

  const SYSTEM = `คุณคือนักเขียนคอนเทนต์การลงทุนของ StockLens (เว็บวิเคราะห์หุ้นภาษาไทย) กำลังทำโพสต์ IG แนวตั้งเรื่อง "จัดพอร์ตใหม่"
กติกาเด็ดขาด: อ้างตัวเลขจาก packet เท่านั้น ห้ามเดา · ห้ามคำว่า "การันตี/แน่นอน/ไม่ขาดทุน/ควรซื้อ" · ภาษาเข้าใจง่ายสำหรับคนเริ่มลงทุน · ไม่ต้องใส่ดิสเคลมเมอร์ในทุกช่อง (ฟุตเตอร์การ์ดมีแล้ว)
ตอบเป็น JSON เท่านั้น: {"headline":"หัวเรื่องสั้นทรงพลัง ≤60 ตัวอักษร","sub":"คำโปรย 1 ประโยค","bullets":["อ่านตรงนี้ 4 ข้อ ข้อละ 1 ประโยค อ้างตัวเลขจริง"],"caption":"แคปชันโพสต์ 2-4 ย่อหน้าสั้นๆ เล่าเรื่องจัดพอร์ต + บอกว่าดูรายละเอียดเพิ่มที่ StockLens","hashtags":"#หุ้น #ลงทุน #จัดพอร์ต ..."}`;

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

  // Jev ตรวจโทน + ความสอดคล้องของตัวเลข ก่อนนำไปโพสต์
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
