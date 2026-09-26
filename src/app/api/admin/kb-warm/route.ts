// ===== KB Warm (มือ) — แอดมินสั่งอุ่นคลังความรู้ลึกกว่า cron ได้เอง =====
// POST /api/admin/kb-warm { market: "th"|"us", n: จำนวน } + header x-admin-code
// th = หุ้นไทย (Yahoo เร็ว) · us = หุ้นสหรัฐฯ (รวม EDGAR ~13 วิ/ตัว — รันทีละก้อน 4 ตัว)
import { NextRequest, NextResponse } from "next/server";
import { adminCode } from "@/lib/admin";
import { tvUniverse, toYahooSymbol } from "@/lib/tvscanner";
import { kbFundamentals } from "@/lib/kb";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-code") !== adminCode()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { market = "th", n: nRaw } = (await req.json().catch(() => ({}))) as { market?: string; n?: number };
  const isUs = market === "us";
  const n = Math.max(1, Math.min(isUs ? 40 : 100, nRaw ?? (isUs ? 15 : 50)));

  const uni = await tvUniverse(isUs ? "america" : "thailand", Math.max(n * 2, 60)).catch(() => []);
  const targets = uni
    .filter((r) => r.mcap > (isUs ? 5e10 : 1e10) && (!isUs || /^[A-Z]{1,4}$/.test(r.symbol)))
    .slice(0, n)
    .map((r) => toYahooSymbol(isUs ? "america" : "thailand", r.symbol));

  const ok: string[] = [];
  const fail: string[] = [];
  const CHUNK = isUs ? 4 : 10; // EDGAR หนัก — ทีละ 4 (กัน timeout และเผลอโดน SEC จำกัด)
  for (let i = 0; i < targets.length; i += CHUNK) {
    const batch = targets.slice(i, i + CHUNK);
    const rs = await Promise.all(batch.map((s2) => kbFundamentals(s2).then(() => s2).catch(() => null)));
    rs.forEach((s2, j) => (s2 ? ok.push(s2) : fail.push(batch[j])));
  }
  return NextResponse.json({ ok: true, market, warmed: ok.length, failed: fail.length, tickers: ok.slice(0, 50) });
}
