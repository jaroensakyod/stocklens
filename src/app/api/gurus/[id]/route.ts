import { NextResponse } from "next/server";
import { getGuruDetail } from "@/lib/gurus13f";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/gurus/[id]?q=0..3 — พอร์ตเต็มของกูรูรายคน (เลือกไตรมาสย้อนหลังได้ + QoQ + ความกระจุกตัว)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(req.url);
    const offset = Math.max(0, Math.min(3, Number(url.searchParams.get("q")) || 0));
    const detail = await getGuruDetail(params.id, offset);
    if (!detail) return NextResponse.json({ error: "ไม่พบกูรูนี้หรือยังดึงข้อมูลไม่สำเร็จ" }, { status: 404 });
    return NextResponse.json({ guru: detail, offset });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 150) }, { status: 500 });
  }
}
