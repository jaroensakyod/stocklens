import { NextRequest, NextResponse } from "next/server";
import { getTierFromRequest } from "@/lib/auth";
import { computeScore } from "@/lib/score";
import { kvGet } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/score?s=PTT.BK — StockLens Score
// freemium: free = คะแนนรวม + confidence · Starter ขึ้นไป = 6 เสา + เหตุผล/ความเสี่ยง + ประวัติย้อนหลัง
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get("s")?.trim().toUpperCase();
  if (!s) return NextResponse.json({ error: "missing s" }, { status: 400 });
  const tier = getTierFromRequest(req);
  const score = await computeScore(s);
  if (!score) return NextResponse.json({ available: false }, { status: 404 });
  const base = {
    available: true,
    symbol: score.symbol,
    total: score.total,
    grade: score.grade,
    confidence: score.confidence,
    updatedAt: score.updatedAt,
  };
  if (tier === "free") return NextResponse.json({ ...base, locked: true });
  const hist = await kvGet<{ d: string; t: number }[]>(`score:hist:${s}`).catch(() => null);
  return NextResponse.json({ ...base, pillars: score.pillars, reasons: score.reasons, risks: score.risks, history: hist ?? [], locked: false });
}
