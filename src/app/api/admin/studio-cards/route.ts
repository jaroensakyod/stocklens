import { NextRequest, NextResponse } from "next/server";
import { adminCode } from "@/lib/admin";
import { getDailyRecap, getDcaCard, getXdCalendar, getGuruCard, getMacroCard, type RecapData, type DcaData, type XdCalData, type GuruCardData, type MacroCardData } from "@/lib/contentCards2";
import { chatOnce, hasAI } from "@/lib/ai";
import { jevAsk } from "@/lib/typesafe";

// 🎨 POST /api/admin/studio-cards — Content Studio ชุด 2: สรุปตลาด/DCA/ปฏิทิน XD/กูรู 13F/ห่วงโซ่มหภาค
// gate x-admin-code เหมือนชุดอื่น + action "copy" → Gemini ร่างข้อความ + Jev ตรวจ
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Kind = "recap" | "dca" | "calendar" | "gurus" | "macro";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-code") !== adminCode()) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as
    | { action?: string; kind?: Kind; symbol?: string; years?: number; monthlyThb?: number; monthsAhead?: number; guruId?: string; text?: string; data?: unknown }
    | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const kind = (body.kind ?? "recap") as Kind;
  const action = body.action ?? "compute";

  // ---------- compute ----------
  if (action === "compute") {
    try {
      if (kind === "dca") return NextResponse.json({ data: await getDcaCard(String(body.symbol || "VOO"), Number(body.years) || 5, Number(body.monthlyThb) || 1000) });
      if (kind === "calendar") return NextResponse.json({ data: await getXdCalendar(Number(body.monthsAhead) || 1) });
      if (kind === "gurus") return NextResponse.json({ data: await getGuruCard(body.guruId) });
      if (kind === "macro") return NextResponse.json({ data: await getMacroCard(String(body.text ?? "")) });
      return NextResponse.json({ data: await getDailyRecap() });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "คำนวณไม่สำเร็จ" }, { status: 400 });
    }
  }
  if (action !== "copy") return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
  if (!hasAI()) return NextResponse.json({ error: "ยังไม่ได้ตั้ง AI_API_KEY" }, { status: 503 });

  // ---------- copy: packet + SYSTEM ตามชนิดการ์ด ----------
  let packet = "";
  let SYSTEM = "";
  const COMMON = `คุณคือนักเขียนคอนเทนต์การลงทุนของ StockLens กำลังทำโพสต์ IG แนวตั้ง
กติกาเด็ดขาด: อ้างตัวเลขจาก packet เท่านั้น ห้ามเดา · ห้าม "การันตี/แน่นอน/ไม่ขาดทุน/ควรซื้อ/ควรขาย" · ภาษาเข้าใจง่ายสำหรับมือใหม่ · จบแคปชันด้วยการชวนมาดูข้อมูลจริงที่ StockLens
ตอบเป็น JSON เท่านั้น: {"headline":"หัวเรื่อง ≤60 ตัวอักษร","sub":"คำโปรย 1 ประโยค","bullets":["อ่านตรงนี้ 4 ข้อ ข้อละ 1 ประโยค อ้างตัวเลขจริง"],"caption":"แคปชัน 2-4 ย่อหน้า","hashtags":"#หุ้น #ลงทุน ..."}`;

  if (kind === "dca") {
    const d = body.data as DcaData | undefined;
    if (!d?.curve?.length) return NextResponse.json({ error: "ต้องคำนวณข้อมูลก่อน" }, { status: 400 });
    packet = `[สินทรัพย์] ${d.symbol} (${d.name})\n[สมมติ] ลงเดือนละ ฿${d.monthlyThb.toLocaleString()} เป็นเวลา ${d.years} ปี (${d.startTh} → ${d.endTh})\n[ผล] ลงเงินรวม ฿${d.investedThb.toLocaleString()} → มูลค่าวันนี้ ฿${d.finalThb.toLocaleString()} (โตเพิ่ม +${d.growthPct.toFixed(1)}% · ผลตอบแทนเฉลี่ย ${d.xirrPct?.toFixed(1) ?? "?"}%/ปี)\n[ข้อควรระวัง] ผลย้อนหลังไม่รับประกันอนาคต · ไม่นับค่าธรรมเนียม/ภาษี`;
    SYSTEM = COMMON + `\nหัวข้อ: "ถ้าลงเดือนละ X บาท ตอนนี้มีเท่าไหร่" — โฟกัสตัวเลขเปรียบเทียบเงินลงกับมูลค่าวันนี้ และต้องมีข้อเตือนว่าผลอดีตไม่รับประกันอนาคต`;
  } else if (kind === "calendar") {
    const d = body.data as XdCalData | undefined;
    if (!d?.rows?.length) return NextResponse.json({ error: "ต้องคำนวณข้อมูลก่อน" }, { status: 400 });
    packet = `[เดือนเป้าหมาย] ${d.monthTh}\n[รายชื่อ] ${d.rows.map((r) => `${r.symbol} (${r.name}) XD ~${r.dateTh} · ปันผล ~${r.amount} ${r.currency === "THB" ? "฿" : "$"} · ${r.freq}${r.yieldPct != null ? ` · yield ~${r.yieldPct}%` : ""}`).join("\n")}\n[สำคัญ] วันที่เป็นคาดการณ์จากรอบจ่ายปีก่อน — ต้องบอกผู้อ่านเสมอว่า "ตรวจประกาศจริงก่อน"`;
    SYSTEM = COMMON + `\nหัวข้อ: ปฏิทินหุ้นขึ้น XD ประจำเดือน — เน้นวันที่+ปันผลต่อหุ้น และย้ำว่าเป็นคาดการณ์ ต้องเช็คประกาศบริษัทจริงก่อน`;
  } else if (kind === "gurus") {
    const d = body.data as GuruCardData | undefined;
    if (!d?.top?.length) return NextResponse.json({ error: "ต้องคำนวณข้อมูลก่อน" }, { status: 400 });
    packet = `[กูรู] ${d.guru.emoji} ${d.guru.name} — ${d.guru.firm} (13F งวด ${d.guru.asOf} · พอร์ตหุ้นรวม ~$${d.totalValueUsdB}B)\n[ถือครั้ง] ${d.top.map((h) => `${h.ticker} (${h.issuer}) ${h.pct.toFixed(1)}% ~$${h.valueUsdB}B ${h.change ?? ""}`).join(" · ")}\n[สไตล์] ${d.guru.style}\n[ข้อควรระวังเรามีให้] ${d.guru.caution}`;
    SYSTEM = COMMON + `\nหัวข้อ: "กูรูถืออะไร" จาก 13F จริง — ห้ามชี้นำให้ตามซื้อ ต้องมีข้อเตือนว่า 13F เห็นเฉพาะฝั่ง long ณ สิ้นไตรมาส และกูรูอาจขายไปแล้ว`;
  } else if (kind === "macro") {
    const d = body.data as MacroCardData | undefined;
    if (!d?.chains?.length) return NextResponse.json({ error: "ต้องคำนวณข้อมูลก่อน" }, { status: 400 });
    packet = `[เหตุการณ์] "${d.input}"\n${d.chains.map((c) => `[ห่วงโซ่: ${c.name}] ${c.reason}\nได้ประโยชน์: ${c.stocks.filter((s) => s.direction === "positive").map((s) => s.ticker).join(", ") || "-"} · เสียประโยชน์: ${c.stocks.filter((s) => s.direction === "negative").map((s) => s.ticker).join(", ") || "-"}`).join("\n")}\n[สำคัญ] เป็นกรอบวิเคราะห์เชิงตรรกะ ไม่ใช่คำทำนาย`;
    SYSTEM = COMMON + `\nหัวข้อ: "เหตุการณ์นี้ทำให้ใครได้/เสียประโยชน์" — อธิบายห่วงโซ่เหตุผลสั้นๆ ตาม packet ห้ามทำนายราคา`;
  } else {
    const d = body.data as RecapData | undefined;
    if (!d?.indices?.length) return NextResponse.json({ error: "ต้องคำนวณข้อมูลก่อน" }, { status: 400 });
    packet = `[วันที่] ${d.asOfTh}\n[ดัชนี] ${d.indices.map((i) => `${i.label} ${i.changePct >= 0 ? "+" : ""}${i.changePct.toFixed(2)}%`).join(" · ")}\n[สินทรัพย์] ${d.assets.map((a) => `${a.label} ${a.changePct >= 0 ? "+" : ""}${a.changePct.toFixed(2)}%`).join(" · ")} · USD/THB ${d.usdThb.toFixed(2)}\n[ขึ้นแรง] ${d.gainers.map((g) => `${g.symbol} +${g.changePct.toFixed(1)}%`).join(", ")}\n[ลงแรง] ${d.losers.map((g) => `${g.symbol} ${g.changePct.toFixed(1)}%`).join(", ")}\n[ข่าวเด่น+Jev] ${d.news.map((n) => `${n.sentiment === "bullish" ? "บวก" : n.sentiment === "bearish" ? "ลบ" : "กลาง"}: ${n.title.slice(0, 70)}`).join("\n")}`;
    SYSTEM = COMMON + `\nหัวข้อ: สรุปตลาดวันนี้ — ภาพรวมดัชนี+ข่าวเด่น กระชับ เป็นกลาง ไม่ชี้นำ`;
  }

  // ---------- Gemini → Jev (แพตเทิร์นเดียวกับ dividend-card) ----------
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
