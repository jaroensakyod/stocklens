import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { getLiveGurus } from "@/lib/gurus13f";
import { chatOnce, hasAI } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/gurus/why { id } — AI วิเคราะห์ "ทำไมกูรูคนนี้ถึงเลือกตำแหน่งเหล่านี้" จาก holdings 13F จริง + สไตล์การลงทุน
export async function POST(req: NextRequest) {
  // 🔒 AI = สิทธิ์สมาชิก Starter ขึ้นไป (free ใช้ไม่ได้)
  const guard = requireMember(req);
  if (!guard.ok) return Response.json({ error: "🔒 การใช้ AI เป็นสิทธิ์สมาชิก Starter ขึ้นไป — เข้าสู่ระบบด้วยรหัสสมาชิกที่หน้า /login" }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  if (!hasAI()) {
    return NextResponse.json({
      why: "_ต้องตั้ง AI key ก่อน (.env.local) จึงวิเคราะห์เชิงลึกได้ — ตอนนี้ดูเหตุผลคัดสรร (💡) ในตารางประกอบ_",
    });
  }
  const gurus = await getLiveGurus();
  const g = gurus.find((x) => x.id === id);
  if (!g) return NextResponse.json({ error: "not found" }, { status: 404 });

  const top = g.holdings.slice(0, 10).map((h) => `${h.issuer}${h.putCall ? ` [${h.putCall}]` : ""} (${h.pct.toFixed(1)}% ของพอร์ต${h.valueUsd ? ` ≈ $${(h.valueUsd / 1e6).toFixed(0)}M` : ""})`).join("\n");

  try {
    const why = await chatOnce(
      [
        {
          role: "system",
          content:
            "คุณเป็นนักวิเคราะห์สถาบันที่ถอดรหัส 'เหตุผลเบื้องหลังการเลือกหุ้น' ของกูรูการลงทุน เขียนภาษาไทย 300-450 คำ โครงสร้าง: (1) ปรัชญา/สไตล์ของเขาคืออะไร (2) อ่านพอร์ตนี้แล้วเห็นอะไร — ทำไมตำแหน่งเหล่านี้ตอบโจทย์สไตล์นั้น (อ้างเหตุผลเชิงธุรกิจ/มหภาค ไม่ใช่แค่ชื่อหุ้น) (3) ความเสี่ยงที่เขากำลังแบกอยู่โดยไม่รู้ตัว (4) สรุป 1 ประโยคว่าคนทั่วไปเรียนอะไรได้ ห้ามใช้คำว่า ควรซื้อ/ควรขาย ระบุชัดว่าเป็นการอธิบายเหตุผลเชิงการศึกษา ไม่ใช่ข้อมูลภายใน",
        },
        {
          role: "user",
          content: `กูรู: ${g.name} (${g.firm})\nสไตล์: ${g.style}\nวิทยานิพนธ์: ${g.thesis}\nงวด 13F: ${g.asOf ?? "-"}\nมูลค่าพอร์ตรวม: ${g.totalValueUsd ? "$" + (g.totalValueUsd / 1e9).toFixed(1) + "B" : "ไม่เปิดเผย"}\n\nตำแหน่งถือครอง:\n${top}\n\nอธิบายว่าทำไมเขาถึงเลือกพอร์ตแบบนี้`,
        },
      ],
      0.4
    );
    return NextResponse.json({ why });
  } catch (e) {
    return NextResponse.json({ why: "AI วิเคราะห์ไม่สำเร็จ (" + (e as Error).message.slice(0, 80) + ") — ลองใหม่" }, { status: 200 });
  }
}
