// ===== Push Subscription (สมาชิก Starter+) — เก็บอุปกรณ์ไว้ส่งแจ้งเตือนแม้ปิดเว็บ =====
// flow: client ขอ permission → subscribe ด้วย public key (GET) → POST subscription มาเก็บ
// เก็บใน Redis `push:{memberId}` (array ของ subscription สูงสุด 5 อุปกรณ์ — มือถือ/แท็บเล็ต/คอม)
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AUTH_COOKIE } from "@/lib/auth";
import { kvGet, kvSet, hasDB } from "@/lib/storage";

export const dynamic = "force-dynamic";

interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  device?: string; // ชื่ออุปกรณ์ (navigator.userAgent ย่อ) ให้ผู้ใช้จัดการในหน้าแจ้งเตือน
  createdAt: number;
}

const memberOf = (req: NextRequest) => verifyToken(req.cookies.get(AUTH_COOKIE)?.value);

// GET — public key สำหรับ subscribe (ไม่มี key = push ปิดใช้งาน ให้ UI ซ่อนปุ่ม)
export async function GET(req: NextRequest) {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const m = memberOf(req);
  const subs = m && hasDB() ? (await kvGet<PushSub[]>(`push:${m.id}`)) ?? [] : [];
  return NextResponse.json({
    publicKey,
    enabled: !!publicKey,
    persisted: hasDB(),
    devices: subs.map((s) => ({ endpoint: s.endpoint, device: s.device ?? "", createdAt: s.createdAt })),
  });
}

// POST { subscription, device } — สมัครอุปกรณ์เครื่องนี้
export async function POST(req: NextRequest) {
  const m = memberOf(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ error: "กรุณาต่อ Redis ก่อน (ดู SETUP-EXTERNALS.md)" }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; device?: string };
  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
    return NextResponse.json({ error: "รูปแบบ subscription ไม่ถูกต้อง" }, { status: 400 });
  }
  const cur = (await kvGet<PushSub[]>(`push:${m.id}`)) ?? [];
  // ทดสอบส่งจริง 1 ครั้งตอนสมัคร — รู้ทันทีว่าคู่ key ถูกไหม
  const next: PushSub[] = [
    ...cur.filter((s) => s.endpoint !== sub.endpoint),
    { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, device: String(body.device ?? "").slice(0, 120), createdAt: Date.now() },
  ].slice(-5); // สูงสุด 5 อุปกรณ์ (ตัดของเก่าสุดออก)
  await kvSet(`push:${m.id}`, next);
  return NextResponse.json({ ok: true, devices: next.length });
}

// DELETE { endpoint } — เลิกอุปกรณ์เครื่องนี้
export async function DELETE(req: NextRequest) {
  const m = memberOf(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ ok: false }, { status: 503 });
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: "กรอก endpoint" }, { status: 400 });
  const cur = (await kvGet<PushSub[]>(`push:${m.id}`)) ?? [];
  await kvSet(`push:${m.id}`, cur.filter((s) => s.endpoint !== endpoint));
  return NextResponse.json({ ok: true });
}
