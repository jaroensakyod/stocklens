import { NextResponse } from "next/server";
import { getLiveGurus } from "@/lib/gurus13f";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/gurus — พอร์ต 13F สดจาก SEC EDGAR + snapshot + ราคาปัจจุบัน
export async function GET() {
  try {
    const gurus = await getLiveGurus();
    return NextResponse.json({ gurus, source: "SEC EDGAR 13F-HR (live)" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 150) }, { status: 500 });
  }
}
