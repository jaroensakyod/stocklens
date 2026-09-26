import { NextRequest, NextResponse } from "next/server";
import { getTierFromRequest } from "@/lib/auth";
import { kbFundamentals } from "@/lib/kb";

export const dynamic = "force-dynamic";

// GET /api/fundamentals?s=NVDA — งบการเงินจาก filings จริง (คลัง kb:*: TTM ละเอียด + รายได้/กำไร 4 ปี + EDGAR สำหรับหุ้น US)
// Freemium: free = TTM ล่าสุด + อัตราส่วนหลัก 5 ตัว · Starter = + ประวัติ 4 ปี · Pro = + รายไตรมาส + CSV
export async function GET(req: NextRequest) {
  const sym = (req.nextUrl.searchParams.get("s") ?? "").trim().toUpperCase();
  if (!sym) return NextResponse.json({ error: "ต้องระบุ ?s=TICKER" }, { status: 400 });
  const tier = getTierFromRequest(req); // "free" | "starter" | "pro"

  const fund = await kbFundamentals(sym).catch(() => null);
  if (!fund) return NextResponse.json({ error: `ไม่พบข้อมูลงบการเงินของ ${sym}` }, { status: 404 });

  const latest = fund.annual[0];
  const annual = tier === "free" ? fund.annual.slice(0, 1) : fund.annual;
  const ratios =
    tier === "free"
      ? {
          revenueGrowth: fund.ratios.revenueGrowth,
          netMargin: latest.netMargin,
          grossMargin: latest.grossMargin,
          debtToEquity: latest.debtToEquity,
          currentRatio: latest.currentRatio,
        }
      : fund.ratios;
  const quarterly = tier === "pro" ? fund.quarterly : undefined;
  const extras = tier === "pro" ? { rd: latest.rd, buyback: latest.buyback } : undefined;

  return NextResponse.json({
    symbol: sym,
    tier,
    annual,
    quarterly,
    ratios,
    extras,
    edgarVerified: fund.edgarVerified, // true = ตัวเลขตรงกับ 10-K ของ SEC (หุ้น US)
    dividendYieldPct: fund.dividendYieldPct, // 🇹🇭 หุ้นไทย
    updatedAt: fund.updatedAt,
  });
}
