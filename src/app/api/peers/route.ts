import { NextResponse } from "next/server";
import { peerBenchmark } from "@/lib/peerBenchmark";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET /api/peers?s=NVDA&scope=market|global — เทียบหุ้นกับค่ากลางอุตสาหกรรมเดียวกัน (percentile + เกรดรวม)
// ตรรกะอยู่ที่ src/lib/peerBenchmark.ts (ใช้ร่วมกับแชท AI / LINE digest)
// scope=market = ในตลาดเดียวกัน / global = รวมตลาดหลักทั่วโลก (ครั้งแรกโหลดช้า ~30-60วิ หลังจากนั้น cache)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const s = (url.searchParams.get("s") ?? "").trim().toUpperCase();
    const scope = url.searchParams.get("scope") === "global" ? "global" : "market";
    if (!s) return NextResponse.json({ error: "กรอก ?s=SYMBOL" }, { status: 400 });
    const result = await peerBenchmark(s, scope);
    if (!result) return NextResponse.json({ error: `ไม่พบ ${s}` }, { status: 404 });
    if ("error" in result) return NextResponse.json({ error: result.error, symbol: s }, { status: 404 });
    return NextResponse.json({
      ...result,
      asOf: new Date().toISOString().slice(0, 10),
      source: "TradingView universe (คัดเฉพาะหุ้น ตัด ETF) — เทียบค่ากลาง (median) ของกลุ่ม",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 150) }, { status: 500 });
  }
}
