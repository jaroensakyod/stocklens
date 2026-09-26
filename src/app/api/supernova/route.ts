import { NextResponse } from "next/server";
import { getHolders } from "@/lib/yahoo";
import { getSupernova } from "@/lib/supernova";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 🛰️ Supernova Monitor — logic หลักอยู่ที่ lib/supernova (ใช้ร่วมกับ /trend) · route เพิ่ม insider summary
export async function GET() {
  const base = await getSupernova();

  // Insider summary: หุ้น US ใหญ่ 8 ตัว (แคชรายตัวใน getHolders 24 ชม.)
  const INSIDER_SYMS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "JPM"];
  const insiders = await Promise.allSettled(INSIDER_SYMS.map((s) => getHolders(s)));
  const insiderRows = insiders
    .map((r, i) => {
      const sym = INSIDER_SYMS[i];
      if (r.status !== "fulfilled" || !r.value) return null;
      const a = r.value.insiderActivity;
      if (!a || (!a.buyCount && !a.sellCount)) return null;
      return { symbol: sym, netShares: a.netShares, buyCount: a.buyCount, sellCount: a.sellCount };
    })
    .filter((x): x is { symbol: string; netShares: number; buyCount: number; sellCount: number } => !!x);
  const netBuyers = insiderRows.filter((x) => x.netShares > 0).length;

  return NextResponse.json({ ...base, insider: { netBuyers, n: insiderRows.length, rows: insiderRows } });
}
