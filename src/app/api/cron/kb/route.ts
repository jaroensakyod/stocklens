// ===== KB Prewarm + Snapshot รายวัน (cron) — "ข้อมูลของเรา" สะสมทีละวัน =====
// 1) อุ่น kb หุ้นไทย top 25 (Yahoo ~1-2 วิ/ตัว อยู่ในลิมิต 60 วิของ Vercel Hobby)
// 2) Snapshot ราคาปิดรายวัน snap:q:{YYYY-MM-DD} (ไทย top100 + US top60) — ฐานข้อมูลย้อนหลังของเราเอง
// 3) คำนวณ + บันทึก StockLens Score รายวัน (score:hist:{sym}) และ league (score:latest)
// หุ้น US งบลึก (EDGAR ~13 วิ/ตัว) ใช้ /api/admin/kb-warm รันมือแทน
import { NextRequest, NextResponse } from "next/server";
import { tvUniverse, toYahooSymbol } from "@/lib/tvscanner";
import { kbFundamentals } from "@/lib/kb";
import { computeScore, recordScoreHistory } from "@/lib/score";
import { getQuotes } from "@/lib/yahoo";
import { kvGet, kvSet } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SCORE_TH = 12; // จำนวนหุ้นไทยที่คำนวณ Score ต่อรอบ cron (กันเกิน 60 วิ — ทยอยครบ universe ใน admin warm)

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ---- 1) อุ่น kb ไทย ----
  const th = await tvUniverse("thailand", 120).catch(() => []);
  const targets = th.filter((r) => r.mcap > 1e10).slice(0, 25).map((r) => toYahooSymbol("thailand", r.symbol));
  let ok = 0;
  for (const sym of targets) {
    const r = await kbFundamentals(sym).catch(() => null);
    if (r) ok++;
  }

  // ---- 2) Snapshot ราคาปิดรายวัน (ไทย 100 + US 60) ----
  const us = await tvUniverse("america", 80).catch(() => []);
  const snapSymbols = [
    ...th.slice(0, 100).map((r) => toYahooSymbol("thailand", r.symbol)),
    ...us.filter((r) => r.mcap > 2e10).slice(0, 60).map((r) => toYahooSymbol("america", r.symbol)),
  ];
  const quotes = await getQuotes(snapSymbols).catch(() => ({}));
  const today = new Date().toISOString().slice(0, 10);
  const snap: Record<string, number> = {};
  for (const [k, q] of Object.entries(quotes)) if (isFinite(q.price)) snap[k] = q.price;
  await kvSet(`snap:q:${today}`, { at: Date.now(), prices: snap }, 800 * 86_400).catch(() => {});

  // ---- 3) Score รายวัน + league ----
  let scored = 0;
  for (const sym of targets.slice(0, SCORE_TH)) {
    const s = await computeScore(sym).catch(() => null);
    if (s) {
      await recordScoreHistory(sym);
      scored++;
    }
  }
  // league: รวมจาก history ล่าสุดของทุกตัวที่เคยบันทึก (สะสมไปเรื่อยๆ)
  const league = await buildLeague(targets);

  return NextResponse.json({ ok: true, market: "thailand", warmed: ok, total: targets.length, snapCount: Object.keys(snap).length, scored, league: league.length });
}

async function buildLeague(symbols: string[]): Promise<{ sym: string; t: number }[]> {
  const list: { sym: string; t: number; d: string }[] = [];
  for (const sym of symbols) {
    const h = await kvGet<{ d: string; t: number }[]>(`score:hist:${sym}`).catch(() => null);
    const last = h && h.length ? h[h.length - 1] : null;
    if (last) list.push({ sym, t: last.t, d: last.d });
  }
  const sorted = list.sort((a, b) => b.t - a.t).map((x) => ({ sym: x.sym, t: x.t }));
  const prev = await kvGet<{ at: number; list: { sym: string; t: number }[] }>("score:latest").catch(() => null);
  const mergedMap = new Map<string, { sym: string; t: number }>();
  for (const x of prev?.list ?? []) mergedMap.set(x.sym, x);
  for (const x of sorted) mergedMap.set(x.sym, x);
  const merged = [...mergedMap.values()].sort((a, b) => b.t - a.t).slice(0, 120);
  await kvSet("score:latest", { at: Date.now(), list: merged }).catch(() => {});
  return merged;
}
