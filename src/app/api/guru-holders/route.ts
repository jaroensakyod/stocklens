import { NextResponse } from "next/server";
import { getLiveGurus } from "@/lib/gurus13f";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/guru-holders?s=NVDA — กูรู/นักลงทุนระดับโลกคนไหนถือหุ้นตัวนี้ (ย้อนจาก 13F LIVE ของ SEC EDGAR)
// หมายเหตุ: เห็นเฉพาะ top-20 holdings ต่อกูรู (หุ้นเล็กในพอร์ตอาจไม่ติด) + 13F ล่าช้า ≤45 วัน
export async function GET(req: Request) {
  try {
    const s = (new URL(req.url).searchParams.get("s") ?? "").trim().toUpperCase();
    if (!s) return NextResponse.json({ error: "กรอก ?s=SYMBOL" }, { status: 400 });
    // 13F ครอบเฉพาะหุ้นจดทะเบียนสหรัฐฯ (รวม ADR เช่น TSM) — หุ้นมี suffix ตลาดอื่นไม่ต้องเรียก
    if (/\.[A-Z]{2}$/.test(s)) return NextResponse.json({ holders: [], symbol: s, skipped: true });

    const gurus = await getLiveGurus();
    const holders = [] as {
      id: string; name: string; firm: string; emoji: string; source: string;
      pct: number; valueUsd: number; shares: number; rank: number; ofCount: number;
      change?: { type: string; deltaPct?: number }; putCall?: string; asOf?: string;
    }[];
    for (const g of gurus) {
      const idx = g.holdings.findIndex((h) => h.ticker === s);
      if (idx < 0) continue;
      const h = g.holdings[idx];
      holders.push({
        id: g.id, name: g.name, firm: g.firm, emoji: g.emoji, source: g.source,
        pct: h.pct, valueUsd: h.valueUsd, shares: h.shares, rank: idx + 1, ofCount: g.holdings.length,
        change: h.change, putCall: h.putCall, asOf: g.asOf,
      });
    }
    holders.sort((a, b) => b.pct - a.pct);

    const summary = holders.length
      ? {
          count: holders.length,
          totalValueUsd: holders.reduce((a, h) => a + h.valueUsd, 0),
          totalShares: holders.reduce((a, h) => a + h.shares, 0),
          maxPct: holders[0].pct,
          increasing: holders.filter((h) => h.change?.type === "increased" || h.change?.type === "new").length,
          decreasing: holders.filter((h) => h.change?.type === "decreased").length,
          asOf: holders.map((h) => h.asOf).filter(Boolean).sort().pop() ?? null,
          source: "SEC EDGAR 13F-HR (live) — top holdings ต่อกูรู",
        }
      : null;

    return NextResponse.json({ symbol: s, holders, summary });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 150) }, { status: 500 });
  }
}
