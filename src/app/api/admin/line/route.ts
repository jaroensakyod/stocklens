import { NextRequest, NextResponse } from "next/server";
import { adminCode } from "@/lib/admin";

export const dynamic = "force-dynamic";

// POST /api/admin/line { message } — ส่ง LINE Broadcast หาผู้ติดตามทุกคน (ต้องมี LINE_CHANNEL_ACCESS_TOKEN)
// ผูกบอทกับ LINE Official Account → เอา token จาก console.developers.line.biz → ใส่ .env.local
export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-code") !== adminCode()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const { message } = (await req.json().catch(() => ({}))) as { message?: string };
  if (!message?.trim()) return NextResponse.json({ error: "ต้องมีข้อความ" }, { status: 400 });
  if (!token) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN ใน .env.local — สร้าง LINE Official Account (Messaging API) ที่ console.developers.line.biz แล้วนำ Channel access token มาใส่" },
      { status: 400 }
    );
  }
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: [{ type: "text", text: message.slice(0, 4000) }] }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return NextResponse.json({ error: `LINE ${res.status}: ${t.slice(0, 200)}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 150) }, { status: 502 });
  }
}
