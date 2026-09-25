import { NextRequest, NextResponse } from "next/server";
import { runGuruBacktest } from "@/lib/guruBacktest";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET /api/guru-backtest?guru=buffett — จำลองตามกูรู top-10 ย้อนหลัง ~3 ปี เทียบ SPY
export async function GET(req: NextRequest) {
  const guru = (req.nextUrl.searchParams.get("guru") || "").trim();
  if (!guru) return NextResponse.json({ error: "missing guru" }, { status: 400 });
  try {
    return NextResponse.json(await runGuruBacktest(guru));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 400 });
  }
}
