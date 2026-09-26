import { NextRequest, NextResponse } from "next/server";
import { searchSymbols, getQuotes } from "@/lib/yahoo";
import { tvUniverse, toYahooSymbol } from "@/lib/tvscanner";

export const dynamic = "force-dynamic";

// GET /api/search?q=apple — ค้นหาหุ้นข้ามตลาด
// ลำดับความสำคัญ: (1) ตรงเป๊ะกับ ticker ไทยใน universe (SET+mai ~876 ตัว) (2) ผล Yahoo (3) ตรงเป๊ะ {q}.BK
// เพื่อให้ "หาเจอทุกตัว" — โดยเฉพาะหุ้น mai/ตัวเล็กที่ Yahoo search ตีความเป็นหุ้น US ก่อน
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 1) return NextResponse.json({ results: [] });
  const upper = q.toUpperCase();

  const [yahoo, thUniverse] = await Promise.all([
    searchSymbols(q).catch(() => [] as { symbol: string; name: string; exchange: string; type: string }[]),
    tvUniverse("thailand", 1000).catch(() => []),
  ]);

  const results: { symbol: string; name: string; exchange: string; type: string }[] = [];
  const seen = new Set<string>();

  // 1) ตรงเป๊ะกับ ticker ไทย (รวม mai เช่น NCL/TPOLY/QDC)
  for (const r of thUniverse) {
    if (r.symbol.toUpperCase() === upper) {
      const sym = toYahooSymbol("thailand", r.symbol);
      results.push({ symbol: sym, name: r.name, exchange: "Thailand (SET/mai)", type: "stock" });
      seen.add(sym);
      break;
    }
  }
  // 2) ผลจาก Yahoo (US/ทั่วโลก) — ตัดตัวที่ซ้ำ
  for (const r of yahoo) {
    if (seen.has(r.symbol)) continue;
    seen.add(r.symbol);
    results.push(r);
  }
  // 3) ตัวตรงเป๊ะ {q}.BK ถ้ายังไม่มี (กัน universe cache ไม่ครอบ เช่น IPO ใหม่)
  if (!seen.has(upper + ".BK")) {
    const qq = await getQuotes([upper + ".BK"]).catch(() => ({}) as Record<string, { price: number; name?: string }>);
    if (qq[upper + ".BK"] && isFinite(qq[upper + ".BK"].price)) {
      results.unshift({ symbol: upper + ".BK", name: qq[upper + ".BK"].name || upper, exchange: "Thailand (SET/mai)", type: "stock" });
    }
  }

  return NextResponse.json({ results: results.slice(0, 10) });
}
