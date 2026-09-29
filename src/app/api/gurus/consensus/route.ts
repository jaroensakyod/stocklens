import { NextResponse } from "next/server";
import { getLiveGurus } from "@/lib/gurus13f";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/gurus/consensus — หุ้นที่นักลงทุนระดับโลกถือร่วมกัน (จาก 13F LIVE ของ SEC)
// เห็นเฉพาะ top-20 holdings ต่อกูรู (เกณฑ์เดียวกันทุกคน โปร่งใส) + QoQ net ต่อหุ้น
export async function GET() {
  try {
    const gurus = await getLiveGurus();
    const map = new Map<string, { ticker: string; issuer: string; investors: { id: string; name: string; emoji: string; pct: number; valueUsd: number; rank: number; changeType?: string }[] }>();

    for (const g of gurus) {
      g.holdings.forEach((h, idx) => {
        if (!h.ticker) return; // ข้ามหุ้นเอกชน/ที่ map ไม่ได้
        const cur = map.get(h.ticker) ?? { ticker: h.ticker, issuer: h.issuer, investors: [] };
        cur.investors.push({
          id: g.id, name: g.name, emoji: g.emoji, pct: h.pct, valueUsd: h.valueUsd, rank: idx + 1,
          changeType: h.change?.type,
        });
        map.set(h.ticker, cur);
      });
    }

    const rows = [...map.values()]
      .filter((r) => r.investors.length >= 2)
      .map((r) => ({
        ticker: r.ticker,
        issuer: r.issuer,
        count: r.investors.length,
        totalValueUsd: r.investors.reduce((a, x) => a + x.valueUsd, 0),
        avgPct: r.investors.reduce((a, x) => a + x.pct, 0) / r.investors.length,
        maxPct: Math.max(...r.investors.map((x) => x.pct)),
        increasing: r.investors.filter((x) => x.changeType === "increased" || x.changeType === "new").length,
        decreasing: r.investors.filter((x) => x.changeType === "decreased").length,
        investors: r.investors.sort((a, b) => b.pct - a.pct),
      }))
      .sort((a, b) => b.count - a.count || b.totalValueUsd - a.totalValueUsd);

    return NextResponse.json({
      rows,
      guruCount: gurus.length,
      asOf: gurus.map((g) => g.asOf).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? "")).sort().pop() ?? null,
      source: "SEC EDGAR 13F-HR (live) — นับจาก top-20 holdings ต่อกูรู (เกณฑ์เดียวกันทุกคน)",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 150) }, { status: 500 });
  }
}
