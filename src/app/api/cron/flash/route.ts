// ===== Flash Report อัตโนมัติ (cron รายชั่วโมง) =====
// ตรวจความร้อนธีม (ข่าว+ราคา สูตรใหม่) → ธีมที่ร้อนเกิน 75 และยังไม่เตือนในรอบ 6 ชม.
// → ส่ง LINE multicast หาสมาชิก Pro ที่กรอก lineUserId (ระบบเดียวกับ /admin)
// ต้องมี env: LINE_CHANNEL_ACCESS_TOKEN (ตัวเดียวกับที่ใช้ใน /admin) + CRON_SECRET (กันคนแปลกหน้า)
// ตั้งเวลาอัตโนมัติ: vercel.json → รายชั่วโมง (Vercel แนบ Bearer CRON_SECRET ให้เอง)
// ทดสอบเอง: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/flash
import { NextRequest, NextResponse } from "next/server";
import { computeThemeHeat } from "@/lib/radar";
import { readMembers, daysLeft } from "@/lib/admin";
import { kvGet, kvSet } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HEAT_THRESHOLD = 75;
const QUIET_MS = 6 * 3600e3; // ธีมเดียว เตือนซ้ำได้เมื่อพ้น 6 ชม.

async function lineMulticast(token: string, tos: string[], text: string): Promise<{ ok: boolean; sent: number; error?: string }> {
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/multicast", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: tos, messages: [{ type: "text", text }] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, sent: 0, error: `LINE ${res.status}: ${t.slice(0, 160)}` };
    }
    return { ok: true, sent: tos.length };
  } catch (e) {
    return { ok: false, sent: 0, error: (e as Error).message };
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const members = (await readMembers()).filter((m) => daysLeft(m.paidUntil) >= 0 && m.tier === "pro" && m.lineUserId);
  const tos = members.map((m) => m.lineUserId!);

  const heat = await computeThemeHeat();
  const sent: { theme: string; heat: number; line: boolean; audience: number }[] = [];
  for (const h of heat) {
    if (h.heat < HEAT_THRESHOLD) continue;
    const key = `flash:${h.theme.id}`;
    const last = await kvGet<number>(key);
    if (last && Date.now() - last < QUIET_MS) continue;

    const news = (h.newsTop ?? []).slice(0, 3).map((n) => `• ${n.title}`).join("\n");
    const text = `🚨 StockLens Flash Report (Pro)\n${h.theme.emoji} ${h.theme.name} ร้อนแรง ${h.heat}/100 — ข่าวรอบ 24 ชม. ${h.newsCount} ชิ้น\n\n${news}\n\nวิเคราะห์ห่วงโซ่หุ้นที่ได้/เสียประโยชน์ → StockLens หน้า Radar\n_การวิเคราะห์เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน_`;

    let line = false;
    if (token && tos.length) line = (await lineMulticast(token, tos, text)).ok;
    await kvSet(key, Date.now());
    sent.push({ theme: h.theme.id, heat: h.heat, line, audience: tos.length });
  }

  return NextResponse.json({
    ok: true,
    checked: heat.length,
    threshold: HEAT_THRESHOLD,
    sent,
    lineConfigured: !!token,
    audience: tos.length,
  });
}
