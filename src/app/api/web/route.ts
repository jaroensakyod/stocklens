import { NextRequest, NextResponse } from "next/server";
import { getNewsWeb, analyzeDualLens } from "@/lib/web";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/web — แผนผังข่าวเชื่อมโยง (nodes + edges + hot news)
export async function GET() {
  const data = await getNewsWeb();
  return NextResponse.json(data);
}

// POST /api/web { text } — วิเคราะห์ผ่าน Dual Lens (T + J + Jev)
export async function POST(req: NextRequest) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || text.length < 5) return NextResponse.json({ error: "ต้องใส่ข้อความอย่างน้อย 5 ตัวอักษร" }, { status: 400 });
  const result = await analyzeDualLens(text);
  return NextResponse.json(result);
}
