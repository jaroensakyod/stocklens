import { NextRequest, NextResponse } from "next/server";
import { getChart } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

const RANGES = ["1D", "5D", "1M", "6M", "1Y", "5Y"];

// GET /api/chart?s=AAPL&range=1Y
export async function GET(req: NextRequest) {
  const s = (req.nextUrl.searchParams.get("s") || "").toUpperCase();
  const range = req.nextUrl.searchParams.get("range") || "1Y";
  if (!s) return NextResponse.json({ error: "missing s" }, { status: 400 });
  const candles = await getChart(s, RANGES.includes(range) ? range : "1Y");
  return NextResponse.json({ symbol: s, range, candles });
}
