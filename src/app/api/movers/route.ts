import { NextRequest, NextResponse } from "next/server";
import { tvUniverse, toYahooSymbol, TV_REGIONS } from "@/lib/tvscanner";

export const dynamic = "force-dynamic";

const SUPPORTED = ["america", "thailand", "hongkong", "japan", "korea", "vietnam", "indonesia", "taiwan"];

// GET /api/movers?region=thailand — ขึ้น/ลงแรงของตลาดนั้น (จาก universe TV ที่ cache ไว้)
export async function GET(req: NextRequest) {
  const regionParam = req.nextUrl.searchParams.get("region") || "america";
  const region = TV_REGIONS.find((r) => r.id === regionParam && SUPPORTED.includes(r.id))?.id ?? "america";
  const bigOnly = region === "america";
  const all = await tvUniverse(region, region === "america" ? 600 : 400);
  // mcap บางตลาดเป็นสกุลท้องถิ่น — เอา top 60% ของ universe เป็นตัวแทน "หุ้นใหญ่ของตลาด"
  const pool = all.slice(0, Math.max(30, Math.floor(all.length * 0.6))).filter((r) => r.price > 0);
  const sorted = [...pool].sort((a, b) => b.changePct - a.changePct);
  const fmt = (r: (typeof sorted)[number]) => ({
    symbol: r.symbol,
    yahoo: toYahooSymbol(region, r.symbol),
    name: r.name,
    sector: r.sector,
    price: r.price,
    changePct: Math.round(r.changePct * 100) / 100,
    premarketPct: r.premarketPct !== null ? Math.round(r.premarketPct * 100) / 100 : null,
  });
  return NextResponse.json({
    region,
    gainers: sorted.slice(0, 6).map(fmt),
    losers: sorted.slice(-6).reverse().map(fmt),
    universeSize: bigOnly ? 1000 : 400,
  });
}
