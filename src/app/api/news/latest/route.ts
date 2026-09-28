import { NextResponse } from "next/server";
import { getLatestNews } from "@/lib/latestNews";
import { hasAI } from "@/lib/ai";

export const dynamic = "force-dynamic";

// GET /api/news/latest — ฟีดข่าวล่าสุด ไทย+โลก + อัปเดตหุ้น พร้อมคะแนน Jev (cache server 5 นาที)
export async function GET() {
  const feed = await getLatestNews();
  return NextResponse.json({ ...feed, aiAvailable: hasAI() });
}
