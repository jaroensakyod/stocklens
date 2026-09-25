import { NextResponse } from "next/server";
import { computeThemeHeat } from "@/lib/radar";

export const dynamic = "force-dynamic";

// GET /api/radar — ความร้อนของ 8 ธีมวันนี้
export async function GET() {
  const heat = await computeThemeHeat();
  return NextResponse.json({
    themes: heat.map((h) => ({
      id: h.theme.id, name: h.theme.name, emoji: h.theme.emoji, desc: h.theme.desc,
      heat: h.heat, avgChange: h.avgChange,
      quotes: h.quotes.map((q) => ({ symbol: q.symbol, name: q.name, price: q.price, changePct: q.changePct })),
    })),
  });
}
