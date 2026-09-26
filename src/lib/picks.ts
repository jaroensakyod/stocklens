import { tvUniverse, toYahooSymbol } from "@/lib/tvscanner";
import { buildAnalysis } from "@/lib/analysis";
import { getUsdThb } from "@/lib/yahoo";

// 🎯 Daily Picks — "หุ้นน่าสนใจวันนี้" ตอบคำถามแรกของคนเข้าใหม่
// คัดจากข้อมูลจริงล้วน: หุ้นที่ขยับแรงวันนี้ (TV universe) → ไล่คะแนนปัจจัย 5 มิติจากงบจริง (buildAnalysis)
// → จัดอันดับด้วยคะแนนรวม กระจายหมวดอุตสาหกรรม ไม่ใช่คำแนะนำการลงทุน

interface Pick {
  ticker: string; // yahoo symbol (เช่น MU, PTT.BK)
  name: string;
  sector: string;
  price: number;
  currency: string;
  changePct: number;
  marketCapB: number | null;
  score: number; // คะแนนรวมปัจจัย
  tag: string;
  tagEmoji: string;
  reason: string;
  dime: string | null; // บรรทัดช่องทางซื้อ (สหรัฐฯ)
}

interface PicksResult {
  date: string;
  picks: Pick[];
  note: string;
}

export let cached: { at: number; data: PicksResult } | null = null;
const TTL = 30 * 60 * 1000; // คำนวณใหม่ทุก 30 นาที (ข้อมูลพื้นฐาน cache อยู่แล้ว)

function tagOf(overall: number, dims: { valuation: number; growth: number; profitability: number; momentum: number }, changePct: number, pe: number | undefined): { tag: string; tagEmoji: string } {
  if (changePct <= -2 && overall >= 60) return { tag: "ลงแรงแต่งบแข็ง", tagEmoji: "🔄" };
  const entries = Object.entries(dims).sort((a, b) => b[1] - a[1]);
  const [top, v] = entries[0];
  if (top === "valuation" && v >= 65) return { tag: "ราคายังไม่แพง", tagEmoji: "💰" };
  if (top === "profitability" && v >= 75) return { tag: "กำไรแข็งแรง", tagEmoji: "💎" };
  if (top === "growth" && v >= 70) return { tag: "เติบโตโดด", tagEmoji: "🌱" };
  return { tag: "โมเมนตัมแรง", tagEmoji: "🔥" };
}

async function buildPicks(): Promise<PicksResult> {
  const [usAll, thAll, usdThb] = await Promise.all([tvUniverse("america", 600), tvUniverse("thailand", 900), getUsdThb()]);

  // สหรัฐฯ: หุ้นใหญ่พอ (mcap USD ปกติใน universe america) ขยับพอสมควรแต่ไม่ใช่ปั๊มน้ำมัน
  // กรอง ticker ยาวเกิน 4 ตัวอักษร (เช่น OVCHF, MRAAF = OTC foreign ordinary ไม่มีสภาพคล่อง หาซื้อยากใน Dime)
  const usOk = usAll.filter(
    (r) => r.price >= 2 && r.mcap >= 5e9 && r.symbol.length <= 4 && /^[A-Z]+$/.test(r.symbol) && Math.abs(r.changePct) >= 1.5 && Math.abs(r.changePct) <= 12
  );
  const gainers = [...usOk].sort((a, b) => b.changePct - a.changePct).slice(0, 8);
  const losers = [...usOk].sort((a, b) => a.changePct - b.changePct).slice(0, 4);

  // ไทย: เอาหุ้นใหญ่ของตลาด (top 40% ของ universe ที่เรียงตาม size แล้ว) ที่ขยับแรง
  const thPool = thAll.slice(0, Math.max(30, Math.floor(thAll.length * 0.4)));
  const thOk = thPool.filter((r) => r.price > 0 && r.changePct >= 1 && r.changePct <= 12).sort((a, b) => b.changePct - a.changePct).slice(0, 3);

  const cands: { yahoo: string; name: string; sector: string; changePct: number }[] = [
    ...gainers.map((r) => ({ yahoo: toYahooSymbol("america", r.symbol), name: r.name, sector: r.sector || "—", changePct: r.changePct })),
    ...losers.map((r) => ({ yahoo: toYahooSymbol("america", r.symbol), name: r.name, sector: r.sector || "—", changePct: r.changePct })),
    ...thOk.map((r) => ({ yahoo: toYahooSymbol("thailand", r.symbol), name: r.name, sector: r.sector || "—", changePct: r.changePct })),
  ];

  const scored: (Pick & { rankScore: number })[] = [];
  for (const c of cands) {
    try {
      const a = await buildAnalysis(c.yahoo);
      if (!a.factors || !isFinite(a.quote.price) || a.quote.price <= 0) continue;
      const f = a.factors;
      if (f.overall < 55) continue; // ตัดคะแนนรวมต่ำ
      const pe = a.profile?.trailingPE;
      const bullish = a.technicals?.signal === "bullish" ? 14 : a.technicals?.signal === "bearish" ? -10 : 0;
      const rankScore = f.overall * 0.5 + f.momentum * 0.2 + bullish + Math.min(Math.abs(c.changePct), 8) * 1.5 + (c.yahoo.endsWith(".BK") ? 6 : 0); // โบนัสเล็กให้หุ้นไทยเข้าชุดได้บ้าง
      const { tag, tagEmoji } = tagOf(f.overall, { valuation: f.valuation, growth: f.growth, profitability: f.profitability, momentum: f.momentum }, c.changePct, pe);
      const pct = (x?: number) => (x !== undefined ? `${(x * 100).toFixed(1)}%` : "—");
      const topDim = Object.entries({ Valuation: f.valuation, Growth: f.growth, Profitability: f.profitability, Momentum: f.momentum, Health: f.health }).sort((x, y) => y[1] - x[1])[0];
      const reasonParts = [
        `${c.changePct >= 0 ? "ขึ้น" : "ลง"} ${Math.abs(c.changePct).toFixed(1)}% วันนี้`,
        `คะแนนรวม ${f.overall}/100`,
        `จุดเด่น ${topDim[0]} ${topDim[1]}`,
      ];
      if (a.financials?.returnOnEquity !== undefined) reasonParts.push(`ROE ${pct(a.financials.returnOnEquity)}`);
      if (pe) reasonParts.push(`P/E ${pe.toFixed(1)}`);
      if (a.technicals?.rsi14) reasonParts.push(`RSI ${a.technicals.rsi14.toFixed(0)}`);
      scored.push({
        ticker: a.quote.symbol,
        name: a.quote.name.includes("_") ? a.quote.name.split("_").pop()! : a.quote.name, // ชื่อไทยจาก Yahoo มักติด prefix "GUNKUL_…"
        sector: a.profile?.sector || c.sector,
        price: a.quote.price,
        currency: a.quote.currency,
        changePct: Math.round(c.changePct * 100) / 100,
        marketCapB: a.profile?.marketCap ? a.profile.marketCap / 1e9 : null,
        score: f.overall,
        tag,
        tagEmoji,
        reason: reasonParts.join(" · "),
        dime: a.quote.currency === "USD" ? `ซื้อได้ใน Dime ≈ ${(a.quote.price * usdThb).toFixed(0)}฿/หุ้น (เศษหุ้นเริ่ม 50฿)` : null,
        rankScore,
      });
    } catch {
      // หุ้นตัวไหนดึงข้อมูลไม่ได้ก็ข้าม
    }
  }

  // เรียงตามคะแนน + จำกัดหมวดซ้ำ (สูงสุด 2 ตัว/หมวด) + อย่าให้ชื่อซ้ำ
  scored.sort((a, b) => b.rankScore - a.rankScore);
  const sectorCount = new Map<string, number>();
  const picks: Pick[] = [];
  for (const p of scored) {
    const key = p.sector || "—";
    if ((sectorCount.get(key) ?? 0) >= 2) continue;
    sectorCount.set(key, (sectorCount.get(key) ?? 0) + 1);
    const { rankScore: _drop, ...rest } = p;
    picks.push(rest);
    if (picks.length >= 5) break;
  }

  const date = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  return {
    date,
    picks,
    note: "คัดจากหุ้นที่ขยับแรงวันนี้ + คะแนนปัจจัย 5 มิติจากงบการเงินจริง — เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน",
  };
}

export async function getPicks(): Promise<PicksResult> {
  if (cached && Date.now() - cached.at < TTL) return cached.data;
  const data = await buildPicks();
  cached = { at: Date.now(), data };
  return data;
}
