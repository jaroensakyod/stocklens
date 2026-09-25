// ===== ประวัติแชทตามสมาชิก (Upstash Redis / ไม่มี DB = no-op ไม่พัง) =====
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AUTH_COOKIE } from "@/lib/auth";
import { kvGet, kvSet, kvDel, hasDB } from "@/lib/storage";

export const dynamic = "force-dynamic";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const MAX_KEEP = 40; // เก็บ 40 ข้อความล่าสุด (เศษค่าใช้จ่าย Redis ฟรี)
const MAX_LEN = 4000; // ต่อข้อความ

function memberOf(req: NextRequest): { id: string } | null {
  return verifyToken(req.cookies.get(AUTH_COOKIE)?.value);
}

// GET — โหลดประวัติของสมาชิกคนนี้
export async function GET(req: NextRequest) {
  const m = memberOf(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ messages: [], persisted: false });
  const messages = (await kvGet<ChatMsg[]>(`chat:${m.id}`)) ?? [];
  return NextResponse.json({ messages, persisted: true });
}

// PUT { messages } — เซฟประวัติ (client เรียกหลังตอบจบ)
export async function PUT(req: NextRequest) {
  const m = memberOf(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ ok: false, persisted: false });
  const { messages } = (await req.json().catch(() => ({}))) as { messages?: ChatMsg[] };
  const clean = (messages ?? [])
    .filter((x) => x && (x.role === "user" || x.role === "assistant") && typeof x.content === "string")
    .slice(-MAX_KEEP)
    .map((x) => ({ role: x.role, content: x.content.slice(0, MAX_LEN) }));
  const ok = await kvSet(`chat:${m.id}`, clean);
  return NextResponse.json({ ok, persisted: ok });
}

// DELETE — ล้างประวัติ
export async function DELETE(req: NextRequest) {
  const m = memberOf(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ ok: true, persisted: false });
  const ok = await kvDel(`chat:${m.id}`);
  return NextResponse.json({ ok, persisted: ok });
}
