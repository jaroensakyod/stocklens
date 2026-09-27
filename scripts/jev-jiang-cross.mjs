// 🧠 J Cross-Analysis — รวมผลจาก jev-jiang-suite.json + สังเคราะห์ข้ามคลิปของ J
import { readFileSync, writeFileSync } from "node:fs";

const key = readFileSync(".env.local", "utf8").match(/TYPESAFE_API_KEY=(.+)/)?.[1]?.trim();
const API = "https://api.typesafe.ai/v1/systemone";
async function jevCall(state, questions) {
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch(API, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ state, model: "jev-latest", questions }), signal: AbortSignal.timeout(25_000) });
      if (res.status === 429 || res.status === 529) { await new Promise(r => setTimeout(r, 1500 * (a + 1))); continue; }
      if (!res.ok) return null;
      return (await res.json()).answers ?? null;
    } catch { await new Promise(r => setTimeout(r, 800)); }
  }
  return null;
}

const suite = Object.values(JSON.parse(readFileSync(".zcode/jev-jiang-suite.json", "utf8")));

// สถิติรวม
const assetsCount = {}, directionCount = {}, timeframeCount = {};
let convictionSum = 0, convictionN = 0, predChunks = 0;
const allQuotes = [];
for (const c of suite) {
  if (c.assets && c.assets !== "none") assetsCount[c.assets] = (assetsCount[c.assets] ?? 0) + 1;
  if (c.direction && c.direction !== "neutral") directionCount[c.direction] = (directionCount[c.direction] ?? 0) + 1;
  if (c.timeframe && c.timeframe !== "none") timeframeCount[c.timeframe] = (timeframeCount[c.timeframe] ?? 0) + 1;
  if (c.conviction !== null) { convictionSum += c.conviction; convictionN++; }
  if ((c.preds ?? 0) >= 2) predChunks++;
  if (c.quotes?.length) allQuotes.push(...c.quotes.map(q => ({ quote: q, clip: c.clip, assets: c.assets, direction: c.direction, timeframe: c.timeframe, conviction: c.conviction, predScore: c.preds })));
}

// ตัดซ้ำ
const dedupQuotes = [];
const seen = new Set();
for (const q of allQuotes) {
  const k = q.quote.slice(20, 100);
  if (seen.has(k)) continue;
  seen.add(k);
  dedupQuotes.push(q);
}

// High-conviction: ทิศทางเดียวกัน ≥3 คลิป
const byAssetDir = {};
for (const q of dedupQuotes) {
  if (!q.direction || q.direction === "neutral" || !q.assets || q.assets === "none") continue;
  const k = `${q.assets}:${q.direction}`;
  (byAssetDir[k] ??= { asset: q.assets, direction: q.direction, clips: new Set(), quotes: [], avgConv: 0, n: 0 }).clips.add(q.clip);
  byAssetDir[k].quotes.push(q.quote.slice(0, 140));
  byAssetDir[k].avgConv += q.conviction ?? 1.5; byAssetDir[k].n++;
}
const highConviction = Object.values(byAssetDir)
  .filter(g => g.clips.size >= 3)
  .map(g => ({ asset: g.asset, direction: g.direction, clipCount: g.clips.size, quoteCount: g.n, avgConviction: +(g.avgConv / g.n).toFixed(2), sample: g.quotes.slice(0, 2) }))
  .sort((a, b) => b.clipCount - a.clipCount);

// Jev สังเคราะห์ worldview
const top30 = dedupQuotes.filter(q => q.predScore >= 2).slice(0, 30).map(q => `[${q.direction ?? "?"}] (${q.assets ?? "-"}, ${q.timeframe ?? "-"}) ${q.quote.slice(0, 120)}`).join("\n");
const worldview = await jevCall(
  `30 predictions from Professor Jiang (geopolitics/China):\n${top30}\n\nAssets focus: ${JSON.stringify(assetsCount)} | Directions: ${JSON.stringify(directionCount)} | Timeframes: ${JSON.stringify(timeframeCount)}`,
  {
    dominantThesis: { type: "choice", instructions: "What is Professor Jiang's DOMINANT thesis?", criteria: { chinaRise: "China rise / multipolar world / de-dollarization", usDecline: "US decline / hegemon fade / internal division", techWar: "Tech war / chip supremacy / AI race", warRisk: "War risk (Taiwan/Middle East) / military conflict", cycle: "Economic cycle / debt crisis / currency crisis" } },
    evidence: { type: "score", instructions: "How consistent is his worldview across these predictions?", criteria: ["ขัดแย้งกันเอง", "เอียงเล็กน้อย", "สอดคล้องดี", "หนักแน่นทางเดียวชัดเจน"] },
    investable: { type: "choice", instructions: "For a Thai retail investor, what is the most actionable takeaway from his analysis?", criteria: { goldCommodities: "ทอง/สินค้าโภคภัณฑ์ (สงคราม+de-dollar)", chinaSupply: "หุ้นจีน/supply chain จีน (เมื่อจีนฟื้น)", asiaBenefit: "หุ้นเอเชีย/อาเซียนรับการย้ายฐาน", defenseTech: "กลาโหม/เทคโนโลยี (สงคราม+ชิป)", cashWait: "ถือเงินสดรอความชัดเจน" } },
  }
);

const out = {
  ranAt: new Date().toISOString(), chunks: suite.length,
  summary: {
    totalQuotes: dedupQuotes.length,
    predChunks,
    assetsCount, directionCount, timeframeCount,
    convictionAvg: convictionN ? +(convictionSum / convictionN).toFixed(2) : null,
  },
  worldview: {
    dominant: worldview?.dominantThesis?.choice ?? null,
    evidence: worldview?.evidence?.score ?? null,
    investable: worldview?.investable?.choice ?? null,
  },
  highConviction,
  predictions: dedupQuotes.filter(q => q.predScore >= 2).sort((a, b) => b.predScore - a.predScore).slice(0, 40),
};

writeFileSync(".zcode/jev-jiang-cross.json", JSON.stringify(out, null, 1));
console.log(`✓ J cross: ${dedupQuotes.length} quotes | high-conv ${highConviction.length} | thesis: ${out.worldview.dominant} | investable: ${out.worldview.investable}`);
