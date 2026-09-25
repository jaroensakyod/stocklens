import { NextRequest, NextResponse } from "next/server";
import { adminCode, daysLeft, readMembers, writeMembers } from "@/lib/admin";
import { hasDB } from "@/lib/storage";
import type { Member } from "@/lib/types";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  return req.headers.get("x-admin-code") === adminCode();
}

// GET /api/admin/members — รายชื่อสมาชิก + วันคงเหลือ
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const members = await readMembers();
  return NextResponse.json({
    members: members.map((m) => ({ ...m, daysLeft: daysLeft(m.paidUntil) })),
    storage: hasDB() ? "db" : "file",
  });
}

// POST — เพิ่มสมาชิกใหม่
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Partial<Member>;
  if (!b.name || !b.tier) return NextResponse.json({ error: "ต้องมีชื่อและระดับสมาชิก" }, { status: 400 });
  const members = await readMembers();
  const member: Member = {
    id: "M" + Date.now().toString(36),
    name: b.name,
    contact: b.contact ?? "",
    tier: b.tier === "pro" ? "pro" : "starter",
    startedAt: b.startedAt || new Date().toISOString().slice(0, 10),
    paidUntil: b.paidUntil || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    note: b.note ?? "",
    lineUserId: b.lineUserId?.trim() || undefined,
    watch: Array.isArray(b.watch) ? b.watch.filter(Boolean).slice(0, 15) : undefined,
  };
  members.push(member);
  await writeMembers(members);
  return NextResponse.json({ ok: true, member });
}

// PUT — แก้ไข/ต่ออายุ
export async function PUT(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Partial<Member> & { id?: string };
  if (!b.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const members = await readMembers();
  const i = members.findIndex((m) => m.id === b.id);
  if (i < 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  members[i] = { ...members[i], ...b, id: members[i].id };
  await writeMembers(members);
  return NextResponse.json({ ok: true, member: members[i] });
}

// DELETE ?id=
export async function DELETE(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const members = await readMembers();
  await writeMembers(members.filter((m) => m.id !== id));
  return NextResponse.json({ ok: true });
}
