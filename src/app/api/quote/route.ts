import { NextRequest, NextResponse } from "next/server";
import { getQuotes } from "@/lib/yahoo";
import { getUsdThb } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

// GET /api/quote?s=AAPL,PTT.BK — ราคาหุ้น (+ อัตรา THB สำหรับหุ้นสหรัฐฯ)
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get("s") || "";
  const symbols = s.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean).slice(0, 30);
  if (!symbols.length) return NextResponse.json({ error: "missing s" }, { status: 400 });
  const quotes = await getQuotes(symbols);
  const needFx = symbols.some((x) => !x.includes("."));
  const fx = needFx ? await getUsdThb() : null;
  return NextResponse.json({ quotes: Object.values(quotes), usdThb: fx });
}
