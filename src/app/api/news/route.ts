import { NextRequest, NextResponse } from "next/server";
import { getNews } from "@/lib/yahoo";
import { hasAI } from "@/lib/ai";

export const dynamic = "force-dynamic";

// GET /api/news?q=stock market&count=12
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "stock market";
  const count = Math.min(20, Number(req.nextUrl.searchParams.get("count")) || 12);
  const news = await getNews(q, count);
  return NextResponse.json({ news, aiAvailable: hasAI() });
}
