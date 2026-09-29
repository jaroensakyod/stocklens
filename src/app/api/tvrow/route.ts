import { NextResponse } from "next/server";
import { findTvRow } from "@/lib/tvscanner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/tvrow?s=NVDA — แถว universe (พร้อมเมตริกเต็ม perf/SMA/RSI/margins/ราคาเป้าหมาย) ของหุ้น 1 ตัว
export async function GET(req: Request) {
  try {
    const s = (new URL(req.url).searchParams.get("s") ?? "").trim().toUpperCase();
    if (!s) return NextResponse.json({ error: "กรอก ?s=SYMBOL" }, { status: 400 });
    const hit = await findTvRow(s);
    if (!hit) return NextResponse.json({ error: `ไม่พบ ${s} ใน universe` }, { status: 404 });
    return NextResponse.json({ row: hit.row, region: hit.region });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 150) }, { status: 500 });
  }
}
