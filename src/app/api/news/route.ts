import { NextRequest, NextResponse } from "next/server";
import { getNews } from "@/lib/yahoo";
import { hasAI } from "@/lib/ai";

export const dynamic = "force-dynamic";

// GET /api/news?q=stock market&count=12&fresh=43200000 (fresh = กรองเฉพาะใหม่กว่า N ms — ถ้ากรองแล้วว่างจะคืนตัวล่าสุดแทน)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "stock market";
  const count = Math.min(20, Number(req.nextUrl.searchParams.get("count")) || 12);
  const fresh = Number(req.nextUrl.searchParams.get("fresh")) || undefined;
  let news = await getNews(q, count, fresh);
  if (!news.length && fresh) news = await getNews(q, count); // ช่วงเงียบๆ ไม่มีข่าวสด แสดงล่าสุดแทนไม่ต้องว่างเปล่า
  return NextResponse.json({ news, aiAvailable: hasAI() });
}
