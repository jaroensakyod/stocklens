import { NextRequest, NextResponse } from "next/server";
import { buildAnalysis } from "@/lib/analysis";

export const dynamic = "force-dynamic";

// GET /api/analysis?s=AAPL — ข้อมูลครบชุดสำหรับหน้าวิเคราะห์รายตัว
export async function GET(req: NextRequest) {
  const s = (req.nextUrl.searchParams.get("s") || "").toUpperCase();
  if (!s) return NextResponse.json({ error: "missing s" }, { status: 400 });
  const analysis = await buildAnalysis(s);
  return NextResponse.json(analysis);
}
