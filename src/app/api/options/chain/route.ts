import { NextResponse } from "next/server";
import { getExpiries, getChain } from "@/lib/optionChain";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/options/chain?s=NVDA                        → รายการ expiries + ราคา underlying
// GET /api/options/chain?s=NVDA&expiry=2026-10-16      → chain เต็ม (calls+puts+greeks+IV context)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const s = (url.searchParams.get("s") ?? "").trim().toUpperCase();
    const expiry = url.searchParams.get("expiry") ?? "";
    if (!s) return NextResponse.json({ error: "กรอก ?s=SYMBOL" }, { status: 400 });
    if (s.includes(".")) return NextResponse.json({ error: "Options รองรับหุ้นสหรัฐฯ เท่านั้น (ไม่มี suffix เช่น .BK)" }, { status: 400 });

    if (!expiry) {
      const idx = await getExpiries(s);
      if (!idx) return NextResponse.json({ error: `ไม่พบ options chain สำหรับ ${s} (อาจเป็น ETF/ดัชนี/หุ้นนอกสหรัฐฯ)` }, { status: 404 });
      return NextResponse.json(idx);
    }

    const chain = await getChain(s, expiry);
    if (!chain) return NextResponse.json({ error: `ไม่พบ chain วันที่ ${expiry}` }, { status: 404 });
    return NextResponse.json(chain);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 140) }, { status: 500 });
  }
}
