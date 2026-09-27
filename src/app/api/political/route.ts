import { NextRequest, NextResponse } from "next/server";
import { getPoliticalFeed, analyzePolitical, getTrumpPulse } from "@/lib/political";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/political — feed ข่าวการเมืองที่กระทบตลาด
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode");
  if (mode === "trump") {
    const items = await getTrumpPulse();
    return NextResponse.json({ items });
  }
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const data = await getPoliticalFeed(refresh);
  if (!data) return NextResponse.json({ error: "ดึงข่าวไม่สำเร็จ" }, { status: 502 });
  return NextResponse.json(data);
}

// POST /api/political { text } — วิเคราะห์ข่าว/เหตุการณ์การเมืองรายชิ้น
export async function POST(req: NextRequest) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text) return NextResponse.json({ error: "ต้องใส่ข้อความ" }, { status: 400 });
  const result = await analyzePolitical(text);
  return NextResponse.json(result);
}
