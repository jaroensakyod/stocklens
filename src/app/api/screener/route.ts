import { NextRequest, NextResponse } from "next/server";
import universe from "@/data/universe.json";
import setWatch from "@/data/set-watchlist.json";
import { getQuotes } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

interface ScreenerFilters {
  market?: "US" | "TH";
  sector?: string;
  minCap?: number; // ล้าน USD (สำหรับ US) — SET ข้าม
  maxPe?: number;
  minDiv?: number; // % (0-100)
  theme?: string;
  search?: string;
  limit?: number;
}

const THEME_TICKERS: Record<string, string[]> = {
  space: ["RKLB", "ASTS", "LUNR", "RDW", "IRDM", "VSAT", "GSAT", "SPIR", "PLANET", "BKSY", "LMT", "SAT.BK"],
  defense: ["LMT", "RTX", "NOC", "GD", "LHX", "HWM", "LDOS", "CACI", "SAIC", "AVAV", "KTOS", "RCAT"],
  water: ["AWK", "WTRG", "XYL", "VMI"],
  gold: ["NEM", "GOLD", "AEM"],
  oil: ["XOM", "CVX", "COP", "OXY", "SLB", "EOG", "MPC", "VLO", "PSX", "PTT.BK", "PTTEP.BK"],
  agri: ["ADM", "BG", "NTR", "MOS", "CF", "DE", "CPF.BK", "TUF.BK"],
  ai: ["NVDA", "MSFT", "GOOGL", "META", "ORCL", "CRWV", "NBIS", "SMCI", "DELL", "ANET", "PLTR"],
  value: ["LULU", "MELI", "MOH", "UNH", "REGN", "NKE", "PYPL", "ADBE", "SBUX", "MDLZ", "HSY"],
};

// POST /api/screener — กรองหุ้นจาก universe ด้วยข้อมูลจริง
export async function POST(req: NextRequest) {
  const f = (await req.json().catch(() => ({}))) as ScreenerFilters;
  const market = f.market ?? "US";

  let list: { t: string; n: string; s: string }[] =
    market === "TH"
      ? (setWatch as { tickers: { t: string; n: string; s: string }[] }).tickers
      : (universe as { tickers: { t: string; n: string; s: string }[] }).tickers;

  if (f.theme && THEME_TICKERS[f.theme]) {
    const set = new Set(THEME_TICKERS[f.theme]);
    list = list.filter((x) => set.has(x.t));
    // ธีมอาจมีหุ้น SET ปน
    if (market === "US") {
      const extra = (setWatch as { tickers: { t: string; n: string; s: string }[] }).tickers.filter((x) => set.has(x.t));
      list = [...list, ...extra];
    }
  }
  if (f.sector && f.sector !== "all") list = list.filter((x) => x.s === f.sector);
  if (f.search) {
    const q = f.search.toLowerCase();
    list = list.filter((x) => x.t.toLowerCase().includes(q) || x.n.toLowerCase().includes(q));
  }

  const limit = Math.min(f.limit ?? 120, 200);
  const slice = list.slice(0, limit);
  const quotes = await getQuotes(slice.map((x) => x.t));

  const rows = slice
    .map((x) => {
      const q = quotes[x.t];
      if (!q || !isFinite(q.price)) return null;
      return { ticker: x.t, name: x.n, sector: x.s, price: q.price, changePct: q.changePct, currency: q.currency };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const sectors = [...new Set(list.map((x) => x.s))].sort();
  return NextResponse.json({ rows, count: rows.length, total: list.length, sectors });
}
