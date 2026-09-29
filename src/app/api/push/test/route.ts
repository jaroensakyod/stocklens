// ===== ทดสอบส่ง push หาอุปกรณ์ของตัวเอง (หลังกดเปิด) — ยืนยันว่าคู่ VAPID+subscription ใช้ได้จริง =====
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { verifyToken, AUTH_COOKIE } from "@/lib/auth";
import { kvGet, hasDB } from "@/lib/storage";

export const dynamic = "force-dynamic";

interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function POST(req: NextRequest) {
  const m = verifyToken(req.cookies.get(AUTH_COOKIE)?.value);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subs = hasDB() ? (await kvGet<PushSub[]>(`push:${m.id}`)) ?? [] : [];
  if (!pub || !priv || !subs.length) return NextResponse.json({ ok: false, hint: "ยังไม่เปิด push หรือยังไม่ตั้ง keys" }, { status: 400 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@stocklens.app", pub, priv);
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        sub as never,
        JSON.stringify({ title: "✅ StockLens push ใช้ได้แล้ว", body: "แจ้งเตือนราคาจะส่งถึงอุปกรณ์นี้แม้ปิดเว็บ", tag: "stocklens-test", url: "/portfolio?tab=alerts" }),
        { TTL: 60 }
      );
      sent++;
    } catch {}
  }
  return NextResponse.json({ ok: sent > 0, sent });
}
