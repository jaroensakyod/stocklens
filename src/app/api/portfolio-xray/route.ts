import { NextRequest, NextResponse } from "next/server";
import { runXray, type XrayHolding } from "@/lib/xray";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/portfolio-xray { holdings: [{ticker, qty, avgCost?, core?}] } — ส่องพอร์ตลึกทุกมิติ (ไม่ต้อง login)
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { holdings?: XrayHolding[] };
  const holdings = (body.holdings ?? []).filter((h) => h && typeof h.ticker === "string" && Number(h.qty) > 0).slice(0, 20);
  if (!holdings.length) return NextResponse.json({ error: "ต้องมีหุ้นอย่างน้อย 1 ตัว (ใส่พอร์ตที่หน้านี้ก่อน)" }, { status: 400 });
  const out = await runXray(holdings);
  if (!out) return NextResponse.json({ error: "ดึงราคาไม่สำเร็จ ลองใหม่" }, { status: 502 });
  return NextResponse.json(out);
}
