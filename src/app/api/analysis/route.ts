import { NextRequest, NextResponse } from "next/server";
import { buildAnalysis } from "@/lib/analysis";

export const dynamic = "force-dynamic";

// GET /api/analysis?s=AAPL — ข้อมูลครบชุดสำหรับหน้าวิเคราะห์รายตัว
export async function GET(req: NextRequest) {
  const s = (req.nextUrl.searchParams.get("s") || "").toUpperCase();
  if (!s) return NextResponse.json({ error: "missing s" }, { status: 400 });
  const analysis = await buildAnalysis(s);
  // ไม่พบหุ้นจริง (เช่น พิมพ์ผิด BML/PL) → 404 พร้อมคำใบ้ แทนที่จะคืน price:null ให้หน้าเว็บ render พัง
  if (typeof analysis.quote.price !== "number" || !isFinite(analysis.quote.price)) {
    return NextResponse.json(
      { error: `ไม่พบหุ้น "${s}" — ตรวจสัญลักษณ์อีกครั้ง เช่น AAPL (สหรัฐฯ), PTT.BK (ไทย), 0700.HK (ฮ่องกง), แล้วลองค้นหาจากชื่อบริษัทที่ช่องค้นหาด้านบน` },
      { status: 404 }
    );
  }
  return NextResponse.json(analysis);
}
