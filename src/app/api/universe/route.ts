import { NextRequest, NextResponse } from "next/server";
import { TV_REGIONS, tvUniverse } from "@/lib/tvscanner";

export const dynamic = "force-dynamic";

// GET /api/universe?region=america&limit=200&sector=&industry=&ipo=1&pm=1&q=
// universe ทั้งตลาด 30+ ประเทศ (TradingView) + sector/industry จริง + IPO + premarket
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const region = TV_REGIONS.find((r) => r.id === (sp.get("region") || "america"))?.id ?? "america";
  const limit = Math.min(Number(sp.get("limit")) || 300, 1000);
  const sector = sp.get("sector") || "";
  const industry = sp.get("industry") || "";
  const ipoOnly = sp.get("ipo") === "1";
  const pmOnly = sp.get("pm") === "1";
  const q = (sp.get("q") || "").toLowerCase();

  const all = await tvUniverse(region, region === "america" || region === "thailand" ? 1000 : 400);
  if (!all.length) {
    return NextResponse.json({ error: "โหลด universe ไม่สำเร็จ (TradingView scanner) — ลองใหม่อีกครั้ง" }, { status: 502 });
  }

  const now = Date.now();
  const isIpo = (r: { ipoDate: string | null }) => !!r.ipoDate && now - new Date(r.ipoDate + "T00:00:00Z").getTime() < 365 * 864e5;

  let rows = all;
  if (sector) rows = rows.filter((r) => r.sector === sector);
  const sectorPool = sector ? rows : all;
  if (industry) rows = rows.filter((r) => r.industry === industry);
  if (ipoOnly) rows = rows.filter(isIpo);
  if (pmOnly) rows = rows.filter((r) => r.premarketPct !== null && Math.abs(r.premarketPct) >= 3).sort((a, b) => Math.abs(b.premarketPct ?? 0) - Math.abs(a.premarketPct ?? 0));
  if (q) rows = rows.filter((r) => r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));

  const sectors = [...new Set(all.map((r) => r.sector).filter(Boolean))].sort();
  const industries = [...new Set(sectorPool.map((r) => r.industry).filter(Boolean))].sort();

  return NextResponse.json({
    region,
    total: all.length,
    filtered: rows.length,
    ipoCount: all.filter(isIpo).length,
    sectors,
    industries,
    rows: rows.slice(0, limit).map((r) => ({
      symbol: r.symbol, name: r.name, price: r.price, changePct: r.changePct, mcap: r.mcap,
      sector: r.sector, industry: r.industry, exchange: r.exchange, ipoDate: r.ipoDate,
      premarketPct: r.premarketPct, divYield: r.dividendYield, country: r.country,
    })),
  });
}
