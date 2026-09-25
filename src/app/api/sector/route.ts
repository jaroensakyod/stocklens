import { NextRequest, NextResponse } from "next/server";
import { findSectorInfo } from "@/lib/tvscanner";

export const dynamic = "force-dynamic";

// GET /api/sector?s=NVDA หรือ PTT.BK — หมวดหมู่จริง/อุตสาหกรรมย่อยจากตลาด
export async function GET(req: NextRequest) {
  const s = (req.nextUrl.searchParams.get("s") || "").toUpperCase();
  if (!s) return NextResponse.json({ error: "missing s" }, { status: 400 });
  const info = await findSectorInfo(s);
  return NextResponse.json(info ?? { sector: null, industry: null });
}
