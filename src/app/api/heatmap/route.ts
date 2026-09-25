import { NextRequest, NextResponse } from "next/server";
import { TV_REGIONS, tvUniverse, toYahooSymbol } from "@/lib/tvscanner";

export const dynamic = "force-dynamic";

const SUPPORTED = ["america", "thailand", "hongkong", "japan", "korea", "vietnam", "indonesia", "taiwan"];

// GET /api/heatmap?region=america — heatmap 100 ตัว + sector strength สำหรับหน้าแรก
export async function GET(req: NextRequest) {
  const regionParam = req.nextUrl.searchParams.get("region") || "america";
  const region = TV_REGIONS.find((r) => r.id === regionParam && SUPPORTED.includes(r.id))?.id ?? "america";

  const all = await tvUniverse(region, region === "america" ? 600 : 400);
  if (!all.length) return NextResponse.json({ error: "โหลดไม่สำเร็จ" }, { status: 502 });

  // ===== Heatmap: top 80 by mcap =====
  const heat = all.slice(0, 80).filter((r) => r.price > 0).map((r) => ({
    symbol: r.symbol,
    yahoo: toYahooSymbol(region, r.symbol),
    name: r.name,
    sector: r.sector,
    price: r.price,
    changePct: Math.round(r.changePct * 100) / 100,
    mcap: r.mcap,
    // premarketPct สำหรับ US
    premarketPct: r.premarketPct !== null ? Math.round(r.premarketPct * 100) / 100 : null,
  }));

  // ===== Sector strength =====
  const sectorAgg: Record<string, { total: number; up: number; down: number; avgPct: number; sumPct: number; mcap: number }> = {};
  for (const r of all) {
    if (!r.sector || r.price <= 0) continue;
    if (!sectorAgg[r.sector]) sectorAgg[r.sector] = { total: 0, up: 0, down: 0, avgPct: 0, sumPct: 0, mcap: 0 };
    const s = sectorAgg[r.sector];
    s.total++;
    s.sumPct += r.changePct;
    s.mcap += r.mcap;
    if (r.changePct > 0) s.up++;
    else if (r.changePct < 0) s.down++;
  }
  const sectors = Object.entries(sectorAgg)
    .map(([name, s]) => ({
      sector: name,
      avgPct: Math.round((s.sumPct / s.total) * 100) / 100,
      up: s.up,
      down: s.down,
      total: s.total,
      mcap: s.mcap,
    }))
    .sort((a, b) => b.avgPct - a.avgPct);

  // Market breadth
  const upCount = all.filter((r) => r.changePct > 0).length;
  const downCount = all.filter((r) => r.changePct < 0).length;

  return NextResponse.json({
    region,
    heatmap: heat,
    sectors,
    breadth: { up: upCount, down: downCount, total: all.length, ratio: Math.round((upCount / Math.max(all.length, 1)) * 100) },
  });
}
