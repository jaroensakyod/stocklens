// ===== KB Prewarm — อุ่นคลังความรู้รายวัน (cron) ให้สมาชิกคนแรกของวันไม่ต้องรอ =====
// อุ่นเฉพาะหุ้นไทย top 25 (Yahoo เท่านั้น เร็ว ~1-2 วิ/ตัว อยู่ในลิมิต 60 วิของ Vercel Hobby)
// หุ้น US (EDGAR ~13 วิ/ตัว) ใช้ /api/admin/kb-warm รันมือแทน
import { NextRequest, NextResponse } from "next/server";
import { tvUniverse, toYahooSymbol } from "@/lib/tvscanner";
import { kbFundamentals } from "@/lib/kb";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/kb — Vercel Cron รายวัน (ตั้งใน vercel.json) แนบ Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const th = await tvUniverse("thailand", 60).catch(() => []);
  const targets = th
    .filter((r) => r.mcap > 1e10)
    .slice(0, 25)
    .map((r) => toYahooSymbol("thailand", r.symbol));
  let ok = 0;
  for (const sym of targets) {
    const r = await kbFundamentals(sym).catch(() => null);
    if (r) ok++;
  }
  return NextResponse.json({ ok: true, market: "thailand", warmed: ok, total: targets.length, tickers: targets });
}
