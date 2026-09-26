// ===== พอร์ตของสมาชิก (ซิงก์ขึ้นบัญชี — Upstash Redis / ไม่มี DB = no-op ไม่พัง) =====
// ทำไมต้องมี: เดิมพอร์ตเก็บใน localStorage เครื่องเดียว — เปลี่ยนเครื่อง/ล้าง browser ข้อมูลหาย
// สมาชิก (Starter+) ล็อกอินอยู่ → client โหลดครั้งแรกถ้า local ว่าง + auto-save ทุกครั้งที่แก้
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AUTH_COOKIE } from "@/lib/auth";
import { kvGet, kvSet, kvDel, hasDB } from "@/lib/storage";

export const dynamic = "force-dynamic";

interface Holding {
  ticker: string;
  qty: number;
  avgCost: number;
  core?: boolean;
}

const MAX_HOLDINGS = 50;

function memberOf(req: NextRequest) {
  return verifyToken(req.cookies.get(AUTH_COOKIE)?.value);
}

function sanitize(list: unknown): Holding[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((h): h is Holding => !!h && typeof h === "object")
    .map((h) => ({
      ticker: String(h.ticker ?? "").trim().toUpperCase().slice(0, 12),
      qty: Number(h.qty),
      avgCost: Number(h.avgCost),
      ...(h.core === true ? { core: true } : {}),
    }))
    .filter((h) => /^[A-Z0-9.\-]+$/.test(h.ticker) && isFinite(h.qty) && h.qty > 0 && isFinite(h.avgCost) && h.avgCost >= 0)
    .slice(0, MAX_HOLDINGS);
}

// GET — พอร์ตล่าสุดของสมาชิกคนนี้
export async function GET(req: NextRequest) {
  const m = memberOf(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ holdings: [], persisted: false });
  const holdings = (await kvGet<Holding[]>(`portfolio:${m.id}`)) ?? [];
  return NextResponse.json({ holdings, persisted: true });
}

// PUT { holdings } — เซฟพอร์ต (client เรียกอัตโนมัติหลังแก้)
export async function PUT(req: NextRequest) {
  const m = memberOf(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ ok: false, persisted: false });
  const { holdings } = (await req.json().catch(() => ({}))) as { holdings?: Holding[] };
  const clean = sanitize(holdings);
  const ok = await kvSet(`portfolio:${m.id}`, clean);
  return NextResponse.json({ ok, persisted: ok, count: clean.length });
}

// DELETE — ล้างพอร์ตบนบัญชี
export async function DELETE(req: NextRequest) {
  const m = memberOf(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ ok: true, persisted: false });
  const ok = await kvDel(`portfolio:${m.id}`);
  return NextResponse.json({ ok, persisted: ok });
}
