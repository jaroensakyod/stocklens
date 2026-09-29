// ===== Push แจ้งเตือนราคาแม้ปิดเว็บ (cron ทุก 15 นาที) — สมาชิก Starter+ =====
// flow: สมาชิกที่มี push subscription + ตั้งแจ้งเตือนไว้ (sync อยู่ใน ud:{id}:alerts)
// → ดึงราคารวม batch ครั้งเดียว → เทียบเป้า → ส่ง web-push → ทำเครื่องหมาย triggered + dedupe 12 ชม.
// ต้องมี env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// ตั้งเวลา: Vercel Pro (vercel.json) หรือ pinger ภายนอก (cron-job.org) ยิง GET ?secret=CRON_SECRET ทุก 15 นาที
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { readMembers, daysLeft } from "@/lib/admin";
import { kvGet, kvSet, hasDB } from "@/lib/storage";
import { getQuotes } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Alert {
  id: string;
  ticker: string;
  direction: "above" | "below";
  target: number;
  createdAt: number;
  triggeredAt?: number;
}
interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  device?: string;
  createdAt: number;
}

function configured(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv || !hasDB()) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@stocklens.app", pub, priv);
  return true;
}

async function send(sub: PushSub, payload: Record<string, unknown>): Promise<"ok" | "gone" | "fail"> {
  try {
    await webpush.sendNotification(sub as never, JSON.stringify(payload), { TTL: 3600 });
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "fail";
  }
}

async function run(): Promise<NextResponse> {
  if (!configured()) {
    return NextResponse.json({ ok: true, skipped: "ยังไม่ตั้ง VAPID keys หรือไม่มี Redis — push ปิดอยู่ (ไม่ถือเป็น error)" });
  }
  const members = await readMembers();
  const active = members.filter((m) => m.tier && daysLeft(m.paidUntil) > -1);
  if (!active.length) return NextResponse.json({ ok: true, sent: 0, reason: "ไม่มีสมาชิก-active" });

  // รวม subscription + alerts ของทุกคนที่มีทั้งคู่
  const targets: { memberId: string; name: string; subs: PushSub[]; alerts: Alert[] }[] = [];
  for (const m of active) {
    const [subs, alerts] = await Promise.all([kvGet<PushSub[]>(`push:${m.id}`), kvGet<Alert[]>(`ud:${m.id}:alerts`)]);
    const openAlerts = (alerts ?? []).filter((a) => !a.triggeredAt);
    if (subs?.length && openAlerts.length) targets.push({ memberId: m.id, name: m.name, subs, alerts: openAlerts });
  }
  if (!targets.length) return NextResponse.json({ ok: true, sent: 0, reason: "ไม่มีใครตั้ง push+alert พร้อมกัน" });

  // ราคา batch เดียว
  const symbols = [...new Set(targets.flatMap((t) => t.alerts.map((a) => a.ticker)))];
  const quotes = await getQuotes(symbols).catch(() => ({} as Record<string, { price: number }>));

  let sent = 0;
  const cleanup: { memberId: string; endpoint: string }[] = [];
  for (const t of targets) {
    let changed = false;
    const hitMessages: string[] = [];
    for (const a of t.alerts) {
      const q = quotes[a.ticker];
      if (!q || !isFinite(q.price)) continue;
      const hit = a.direction === "above" ? q.price >= a.target : q.price <= a.target;
      if (!hit) continue;
      // dedupe ต่อ alert 12 ชม. (กัน cron รอบต่อไปยิงซ้ำ)
      const doneKey = `pushdone:${a.id}`;
      if (await kvGet(doneKey)) continue;
      hitMessages.push(`${a.ticker} ${a.direction === "above" ? "ขึ้นถึง" : "ลงถึง"} ${a.target.toFixed(2)} (ล่าสุด ${q.price.toFixed(2)})`);
      a.triggeredAt = Date.now();
      changed = true;
      await kvSet(doneKey, 1, 12 * 3600);
    }
    if (!hitMessages.length) continue;
    const payload = {
      title: `🔔 StockLens (${hitMessages.length} รายการ)`,
      body: hitMessages.slice(0, 3).join("\n") + (hitMessages.length > 3 ? `\n+อีก ${hitMessages.length - 3}` : ""),
      tag: "stocklens-alerts",
      url: "/portfolio?tab=alerts",
    };
    for (const sub of t.subs) {
      const r = await send(sub, payload);
      if (r === "ok") sent++;
      if (r === "gone") cleanup.push({ memberId: t.memberId, endpoint: sub.endpoint }); // อุปกรณ์ลบ notification ไปแล้ว
    }
    // เขียน triggeredAt กลับ (ถ้าไม่มีอุปกรณ์ gone ทั้งหมดก็ยังเขียน — สถานะ alert อัปเดตตามจริง)
    if (changed) {
      const all = (await kvGet<Alert[]>(`ud:${t.memberId}:alerts`)) ?? [];
      const hitIds = new Set(t.alerts.filter((a) => a.triggeredAt).map((a) => a.id));
      await kvSet(`ud:${t.memberId}:alerts`, all.map((a) => (hitIds.has(a.id) ? { ...a, triggeredAt: a.triggeredAt ?? Date.now() } : a)));
    }
  }

  // เก็บกวาด subscription หมดอายุ
  for (const c of cleanup) {
    const subs = (await kvGet<PushSub[]>(`push:${c.memberId}`)) ?? [];
    await kvSet(`push:${c.memberId}`, subs.filter((s) => s.endpoint !== c.endpoint));
  }

  return NextResponse.json({ ok: true, sent, targets: targets.length, cleaned: cleanup.length });
}

// Vercel cron (Bearer) หรือ pinger ภายนอก (?secret=) — auth เหมือน cron เดิมของโปรเจกต์
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const passed = (auth === `Bearer ${secret}`) || (secret && url.searchParams.get("secret") === secret);
  if (secret && !passed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return run();
}

export async function POST(req: NextRequest) {
  return GET(req);
}
