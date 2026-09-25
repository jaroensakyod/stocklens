// Snapshot พอร์ตกูรูที่ไม่มี 13F สดแล้ว (Scion เลิกยื่น พ.ย. 2025) — รวบรวมจาก 13F ล่าสุด/สื่อสาธารณะ
import { getQuotes } from "./yahoo";
import type { GuruHolding13f, LiveGuru } from "./gurus13f";
import { GURU_CONFIG } from "./gurus13f";

const SNAPSHOT: Record<string, { asOf: string; holdings: [string, string, "long" | "put", number][] }> = {
  burry: {
    asOf: "Q3/2025 13F + รายงานสื่อปี 2026 (ตรวจ ก.ย. 2026)",
    holdings: [
      ["LULU", "Lululemon", "long", 12],
      ["MELI", "MercadoLibre", "long", 10],
      ["MOH", "Molina Healthcare", "long", 9],
      ["UNH", "UnitedHealth", "long", 8],
      ["REGN", "Regeneron", "long", 8],
      ["PLTR", "Palantir", "put", 18],
      ["NVDA", "NVIDIA", "put", 12],
      ["MU", "Micron", "put", 10],
      ["NBIS", "Nebius", "put", 9],
      ["SMH", "Semiconductor ETF", "put", 8],
    ],
  },
  ark: {
    asOf: "การเปิดเผยล่าสุดของ ARK (โดยประมาณ ปี 2026 — ARK เปิด holdings รายวันที่ ark-funds.com)",
    holdings: [
      ["TSLA", "Tesla", "long", 9],
      ["ROKU", "Roku", "long", 8],
      ["COIN", "Coinbase", "long", 7.5],
      ["SHOP", "Shopify", "long", 7],
      ["RKLB", "Rocket Lab", "long", 6],
      ["PLTR", "Palantir", "long", 5],
    ],
  },
};
export async function SNAPSHOT_HOLDINGS(id: string): Promise<GuruHolding13f[]> {
  const snap = SNAPSHOT[id];
  if (!snap) return [];
  const quotes = await getQuotes(snap.holdings.map((h) => h[0]));
  return snap.holdings.map(([ticker, name, action, pct]) => ({
    issuer: name.toUpperCase() + " (" + ticker + ")",
    ticker,
    valueUsd: 0,
    pct,
    shares: 0,
    putCall: action === "put" ? ("PUT" as const) : undefined,
    quote: quotes[ticker],
  }));
}

export async function snapshotGuru(cfg: (typeof GURU_CONFIG)[number]): Promise<LiveGuru> {
  return { ...cfg, source: "snapshot", asOf: SNAPSHOT[cfg.id]?.asOf, holdings: await SNAPSHOT_HOLDINGS(cfg.id) };
}
