import { NextRequest, NextResponse } from "next/server";
import { getProlensDashboard, analyzeEventProlens } from "@/lib/prolens";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/prolens — dashboard ครบ (สัญญาณ 14 ตัว + พยากรณ์ + framework + supernova)
export async function GET() {
  const data = await getProlensDashboard();
  return NextResponse.json(data);
}

// POST /api/prolens { text } — วิเคราะห์เหตุการณ์ผ่านกรอบ อ.ทวีสุข
export async function POST(req: NextRequest) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || text.length < 5) return NextResponse.json({ error: "ต้องใส่ข้อความอย่างน้อย 5 ตัวอักษร" }, { status: 400 });
  const result = await analyzeEventProlens(text);
  return NextResponse.json(result);
}
