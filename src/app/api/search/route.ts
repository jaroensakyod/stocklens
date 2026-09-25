import { NextRequest, NextResponse } from "next/server";
import { searchSymbols } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

// GET /api/search?q=apple — ค้นหาหุ้นข้ามตลาด
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 1) return NextResponse.json({ results: [] });
  const results = await searchSymbols(q);
  return NextResponse.json({ results });
}
