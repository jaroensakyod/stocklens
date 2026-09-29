// ===== ตั๋วแจ้งปัญหา/สอบถามของสมาชิก (Redis list ต่อคน · แอดมินตอบผ่าน /api/admin/tickets) =====
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AUTH_COOKIE } from "@/lib/auth";
import { kvGet, kvSet, hasDB } from "@/lib/storage";

export const dynamic = "force-dynamic";

export interface Ticket {
  id: string;
  memberId: string;
  memberName: string;
  subject: string;
  detail: string;
  createdAt: number;
  status: "open" | "answered" | "closed";
  replies: { by: "member" | "admin"; at: number; text: string }[];
}

const MAX_TICKETS = 20;

function memberOf(req: NextRequest) {
  return verifyToken(req.cookies.get(AUTH_COOKIE)?.value);
}

async function loadTickets(key: string): Promise<Ticket[]> {
  return (await kvGet<Ticket[]>(key)) ?? [];
}

// GET — ตั๋วของฉัน
export async function GET(req: NextRequest) {
  const m = memberOf(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ persisted: false, tickets: [] });
  const tickets = await loadTickets(`tickets:${m.id}`);
  return NextResponse.json({ persisted: true, tickets });
}

// POST { subject, detail } — เปิดตั๋วใหม่ (แนบ reply แรกเป็นข้อความของสมาชิก)
export async function POST(req: NextRequest) {
  const m = memberOf(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ ok: false, persisted: false, hint: "ระบบตั๋วออนไลน์ใช้ได้หลังต่อ Redis (ดู SETUP-EXTERNALS.md) — ชั่วคราวทักได้ทางช่องทางในหน้าติดต่อ" }, { status: 503 });
  const { subject, detail } = (await req.json().catch(() => ({}))) as { subject?: string; detail?: string };
  const s = String(subject ?? "").trim().slice(0, 120);
  const d = String(detail ?? "").trim().slice(0, 2000);
  if (s.length < 3 || d.length < 5) return NextResponse.json({ error: "กรอกหัวข้อ (≥3 ตัว) และรายละเอียด (≥5 ตัว)" }, { status: 400 });
  const tickets = await loadTickets(`tickets:${m.id}`);
  const t: Ticket = {
    id: "T" + Date.now().toString(36),
    memberId: m.id,
    memberName: m.name,
    subject: s,
    detail: d,
    createdAt: Date.now(),
    status: "open",
    replies: [{ by: "member", at: Date.now(), text: d }],
  };
  const next = [t, ...tickets].slice(0, MAX_TICKETS);
  const ok = await kvSet(`tickets:${m.id}`, next);
  // ทำซ้ำไว้ใน key รวมของแอดมิน (list ตั๋วทั้งหมด — ใช้ SET append เองเพราะไม่มี RPUSH ผ่าน REST path นี้)
  const all = (await kvGet<Ticket[]>("tickets:__all__")) ?? [];
  await kvSet("tickets:__all__", [t, ...all.filter((x) => x.id !== t.id)].slice(0, 200));
  return NextResponse.json({ ok, persisted: ok, ticket: t });
}

// PUT { ticketId, text } — สมาชิกตอบเพิ่มในตั๋วตัวเอง
export async function PUT(req: NextRequest) {
  const m = memberOf(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ ok: false, persisted: false }, { status: 503 });
  const { ticketId, text } = (await req.json().catch(() => ({}))) as { ticketId?: string; text?: string };
  const d = String(text ?? "").trim().slice(0, 2000);
  if (!ticketId || d.length < 1) return NextResponse.json({ error: "กรอกข้อความ" }, { status: 400 });
  const tickets = await loadTickets(`tickets:${m.id}`);
  const t = tickets.find((x) => x.id === ticketId);
  if (!t) return NextResponse.json({ error: "ไม่พบตั๋ว" }, { status: 404 });
  t.replies.push({ by: "member", at: Date.now(), text: d });
  t.status = "open";
  const ok = await kvSet(`tickets:${m.id}`, tickets);
  const all = (await kvGet<Ticket[]>("tickets:__all__")) ?? [];
  await kvSet("tickets:__all__", all.map((x) => (x.id === t.id ? t : x)));
  return NextResponse.json({ ok, persisted: ok });
}
