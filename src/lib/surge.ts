import { tvUniverse, toYahooSymbol } from "@/lib/tvscanner";
import { getChart, getUsdThb } from "@/lib/yahoo";

// 🚀 เรดาร์หุ้นซิ่ง — หุ้นที่ขยับแรงวันนี้ พร้อมหลักฐานจากข้อมูลจริง 3 ชั้น:
// 1) ราคาขยับ ≥3% (จาก universe ที่กรองสภาพคล่องแล้ว)
// 2) วอลุ่มวันนี้ vs เฉลี่ย 20 วันก่อนหน้า (x กี่เท่า = มีเงินจริงเข้า)
// 3) ระยะจากจุดสูงสุด 52 สัปดาห์ (ใกล้/ทะลุ = breakout ไม่ใช่เด้ง dead cat)
// สำหรับสื่อวิเคราะห์เชิงข้อมูล — หุ้นซิ่งเสี่ยงสูง ไม่ใช่คำแนะนำการลงทุน

interface SurgeRow {
  ticker: string;
  name: string;
  sector: string;
  market: string;
  price: number;
  currency: string;
  changePct: number;
  volRatio: number | null;
  pctFrom52wHigh: number | null;
  premarketPct: number | null;
  marketCapB: number;
  flags: string[];
  surgeScore: number;
  dime: string | null;
}

export let cached: { at: number; data: { rows: SurgeRow[]; asOf: string } } | null = null;
const TTL = 10 * 60 * 1000;

// ตลาดที่สแกนหุ้นซิ่ง — เดิมมีแค่ US+ไทย ตอนนี้ครอบเอเชียหลัก (mcapMin แปลงเป็น "เทียบเท่า USD หยาบๆ" ตามสกุลท้องถิ่น)
const SURGE_REGIONS: { id: string; flag: string; currency: string; univ: number; mcapMin: number; usOnly?: boolean }[] = [
  { id: "america", flag: "🇺🇸", currency: "USD", univ: 600, mcapMin: 3e8, usOnly: true },
  { id: "thailand", flag: "🇹🇭", currency: "THB", univ: 400, mcapMin: 1e10 }, // ~300M USD
  { id: "hongkong", flag: "🇭🇰", currency: "HKD", univ: 400, mcapMin: 2.3e9 },
  { id: "japan", flag: "🇯🇵", currency: "JPY", univ: 400, mcapMin: 4.5e10 },
  { id: "korea", flag: "🇰🇷", currency: "KRW", univ: 300, mcapMin: 4e11 },
  { id: "taiwan", flag: "🇹🇼", currency: "TWD", univ: 300, mcapMin: 9e9 },
  { id: "china", flag: "🇨🇳", currency: "CNY", univ: 300, mcapMin: 2e9 },
];

async function scan(region: (typeof SURGE_REGIONS)[number], out: SurgeRow[], usdThb: number) {
  const all = await tvUniverse(region.id, region.univ);
  const cands = all
    .filter(
      (r) =>
        r.price > 1 &&
        r.mcap >= region.mcapMin && // สภาพคล่องขั้นต่ำ ~300M USD เทียบเท่า (คร่าวๆ ตามสกุลท้องถิ่น)
        r.changePct >= 3 &&
        r.changePct <= 25 && // เกิน 25% มักเป็น halts/circuit หรือหุ้นปั๊ม
        (!region.usOnly || (r.symbol.length <= 4 && /^[A-Z]+$/.test(r.symbol)))
    )
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 10);

  for (const c of cands) {
    const yahoo = toYahooSymbol(region.id, c.symbol);
    try {
      const candles = await getChart(yahoo, "1Y");
      if (candles.length < 25) continue;
      const last = candles[candles.length - 1];
      const prev20 = candles.slice(-21, -1);
      const volAvg = prev20.reduce((a, k) => a + k.volume, 0) / 20;
      const volRatio = volAvg > 0 ? last.volume / volAvg : null;
      const high52 = Math.max(...candles.map((k) => k.high));
      const pctFromHigh = ((c.price - high52) / high52) * 100;

      const flags: string[] = [];
      if (volRatio && volRatio >= 3) flags.push(`💨 วอลุ่ม x${volRatio.toFixed(1)}`);
      else if (volRatio && volRatio >= 1.5) flags.push(`วอลุ่ม x${volRatio.toFixed(1)}`);
      if (pctFromHigh >= -1) flags.push("🏆 ทะลุจุดสูงสุด 52 สัปดาห์");
      else if (pctFromHigh >= -5) flags.push("ใกล้จุดสูงสุด 52 สัปดาห์");
      if (c.premarketPct !== null && c.premarketPct >= 3) flags.push(`🌅 premaket +${c.premarketPct.toFixed(1)}%`);
      if (c.changePct >= 10) flags.push("⚡ ขยับเกิน 10% ในวันเดียว");

      const surgeScore =
        c.changePct * 1.1 +
        Math.min(volRatio ?? 1, 6) * 4 +
        (pctFromHigh >= -5 ? 10 : 0) +
        (c.premarketPct !== null && c.premarketPct >= 3 ? 5 : 0);

      out.push({
        ticker: yahoo,
        name: c.name.includes("_") ? c.name.split("_").pop()! : c.name,
        sector: c.sector || "—",
        market: region.flag,
        price: c.price,
        currency: region.currency,
        changePct: Math.round(c.changePct * 100) / 100,
        volRatio: volRatio ? Math.round(volRatio * 10) / 10 : null,
        pctFrom52wHigh: Math.round(pctFromHigh * 10) / 10,
        premarketPct: c.premarketPct,
        marketCapB: Math.round(c.mcap / 1e9 * 10) / 10,
        flags,
        surgeScore: Math.round(surgeScore),
        dime: region.id === "america" ? `ซื้อได้ใน Dime ≈ ${(c.price * usdThb).toFixed(0)}฿` : null,
      });
    } catch {
      // ตัวไหนดึงกราฟไม่ได้ข้ามไป
    }
  }
}

async function build(): Promise<{ rows: SurgeRow[]; asOf: string }> {
  const usdThb = await getUsdThb().catch(() => 33);
  const rows: SurgeRow[] = [];
  // ทยอยเป็นกลุ่มๆ กันยิงพร้อมกันทีเดียวเต็มที่ (7 ตลาด × universe + chart ต่อตัว)
  for (let i = 0; i < SURGE_REGIONS.length; i += 3) {
    await Promise.all(SURGE_REGIONS.slice(i, i + 3).map((r) => scan(r, rows, usdThb)));
  }
  rows.sort((a, b) => b.surgeScore - a.surgeScore);
  return { rows: rows.slice(0, 15), asOf: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น." };
}

export async function getSurge(): Promise<{ rows: SurgeRow[]; asOf: string }> {
  if (cached && Date.now() - cached.at < TTL) return cached.data;
  const data = await build();
  cached = { at: Date.now(), data };
  return data;
}
