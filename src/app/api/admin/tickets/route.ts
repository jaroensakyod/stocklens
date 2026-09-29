// ===== แอดมิน: ดูตั๋วทั้งหมด + ตอบ/ปิด (guard ด้วย header x-admin-code เหมือน route แอดมินอื่น) =====
import { NextRequest, NextResponse } from "next/server";
import { adminCode } from "@/lib/admin";
import { kvGet, kvSet, hasDB } from "@/lib/storage";
import type { Ticket } from "../../tickets/route";

export const dynamic = "force-dynamic";

// GET — ตั๋วทั้งหมด (เรียงใหม่ก่อน)
export async function GET(req: NextRequest) {
  if (req.headers.get("x-admin-code") !== adminCode()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ persisted: false, tickets: [] });
  const tickets = (await kvGet<Ticket[]>("tickets:__all__")) ?? [];
  return NextResponse.json({ persisted: true, tickets: tickets.sort((a, b) => b.createdAt - a.createdAt) });
}

// PUT { ticketId, reply, close } — ตอบตั๋ว (เขียนกลับลง key ของสมาชิกด้วย) หรือปิด
export async function PUT(req: NextRequest) {
  if (req.headers.get("x-admin-code") !== adminCode()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ ok: false, persisted: false }, { status: 503 });
  const { ticketId, reply, close } = (await req.json().catch(() => ({}))) as { ticketId?: string; reply?: string; close?: boolean };
  if (!ticketId) return NextResponse.json({ error: "กรอก ticketId" }, { status: 400 });
  const all = (await kvGet<Ticket[]>("tickets:__all__")) ?? [];
  const t = all.find((x) => x.id === ticketId);
  if (!t) return NextResponse.json({ error: "ไม่พบตั๋ว" }, { status: 404 });
  if (reply && String(reply).trim()) t.replies.push({ by: "admin", at: Date.now(), text: String(reply).trim().slice(0, 2000) });
  if (close) t.status = "closed";
  else if (reply) t.status = "answered";
  await kvSet("tickets:__all__", all.map((x) => (x.id === t.id ? t : x)));
  // sync กลับไปยังกล่องตั๋วของสมาชิกคนนั้น
  const mine = (await kvGet<Ticket[]>(`tickets:${t.memberId}`)) ?? [];
  await kvSet(`tickets:${t.memberId}`, mine.map((x) => (x.id === t.id ? t : x)));
  return NextResponse.json({ ok: true, ticket: t });
}
