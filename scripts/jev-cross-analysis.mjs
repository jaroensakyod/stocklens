// 🧠 Jev Full Suite จุดที่ 2 — วิเคราะห์ข้ามคลิป:
//    high-conviction (ซ้ำ 3+ คลิป) / จุดเปลี่ยนความเห็น (Jev ตรวจคู่ขัดแย้ง) / หุ้นที่พูดถึง+ราคา / allocation สังเคราะห์
// รัน: node scripts/jev-cross-analysis.mjs
import { readFileSync, writeFileSync } from "node:fs";

const key = readFileSync(".env.local", "utf8").match(/TYPESAFE_API_KEY=(.+)/)?.[1]?.trim();
const API = "https://api.typesafe.ai/v1/systemone";
async function jevCall(state, questions) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(API, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ state, model: "jev-latest", questions }), signal: AbortSignal.timeout(25_000) });
      if (res.status === 429 || res.status === 529) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
      if (!res.ok) return null;
      return (await res.json()).answers ?? null;
    } catch { await new Promise(r => setTimeout(r, 800)); }
  }
  return null;
}

const suite = Object.values(JSON.parse(readFileSync(".zcode/jev-full-suite.json", "utf8")));
const rx = JSON.parse(readFileSync(".zcode/jev-reextract.json", "utf8"));
const enriched = JSON.parse(readFileSync(".zcode/jev-preds-enriched.json", "utf8"));
const preds = rx.predictions.map((p, i) => ({ ...p, direction: enriched[i]?.direction ?? null, confidence: enriched[i]?.confidence ?? null }));
const clips = JSON.parse(readFileSync(".zcode/prolens/all-transcripts.json", "utf8"));
const clipTitle = Object.fromEntries(clips.map(c => [c.id, c.title]));

// ---------- A. สถิติเฟส/คำแนะนำ ----------
const phaseCount = {}, adviceCount = {}, convictionAvg = (() => { let s = 0, n = 0; for (const c of suite) if (c.conviction !== null) { s += c.conviction; n++; } return n ? +(s / n).toFixed(2) : null; })();
for (const c of suite) {
  if (c.phase && c.phase !== "none") phaseCount[c.phase] = (phaseCount[c.phase] ?? 0) + 1;
  if (c.advice && c.advice !== "none") adviceCount[c.advice] = (adviceCount[c.advice] ?? 0) + 1;
}

// ---------- B. High-conviction: พยากรณ์ทิศทางเดียวกันซ้ำ 3+ คลิป ----------
const byAssetDir = {};
for (const p of preds) {
  if (!p.direction || p.direction === "neutral" || !p.assets || p.assets === "none") continue;
  const k = `${p.assets}:${p.direction}`;
  (byAssetDir[k] ??= { asset: p.assets, direction: p.direction, clips: new Set(), quotes: [], avgConf: 0, n: 0 }).clips.add(p.clip);
  byAssetDir[k].quotes.push(p.quote.slice(0, 150));
  byAssetDir[k].avgConf += p.confidence ?? 1.5; byAssetDir[k].n++;
}
const highConviction = Object.values(byAssetDir)
  .filter(g => g.clips.size >= 3)
  .map(g => ({ asset: g.asset, direction: g.direction, clipCount: g.clips.size, quoteCount: g.n, avgConfidence: +(g.avgConf / g.n).toFixed(2), sample: g.quotes.slice(0, 2) }))
  .sort((a, b) => b.clipCount - a.clipCount);

// ---------- C. จุดเปลี่ยนความเห็น: คู่ bull↔bear ของสินทรัพย์เดียวกัน → Jev ตัดสิน ----------
const pairs = [];
for (const asset of new Set(preds.filter(p => p.direction === "bull" || p.direction === "bear").map(p => p.assets))) {
  if (!asset || asset === "none") continue;
  const bulls = preds.filter(p => p.assets === asset && p.direction === "bull").slice(0, 3);
  const bears = preds.filter(p => p.assets === asset && p.direction === "bear").slice(0, 2);
  for (const b of bears.slice(0, 1)) {
    const bull = bulls[0];
    if (!bull) continue;
    pairs.push({ asset, bear: { quote: b.quote.slice(0, 200), clip: b.clip }, bull: { quote: bull.quote.slice(0, 200), clip: bull.clip } });
  }
}
const contradictions = [];
for (const pr of pairs.slice(0, 8)) {
  const a = await jevCall(
    `สองคำพูดของนักวิเคราะห์ T เรื่อง "${pr.asset}" จากคลิปต่างกัน:
     (1) "${pr.bear.quote}" — คลิป ${clipTitle[pr.bear.clip]?.slice(0, 50)}
     (2) "${pr.bull.quote}" — คลิป ${clipTitle[pr.bull.clip]?.slice(0, 50)}`,
    {
      verdict: { type: "choice", instructions: "Is this a genuine change of view (contradiction) or consistent (different timeframe/condition)?", criteria: { changed: "เปลี่ยนความเห็นจริง", timeframe: "ไม่ขัดกัน — timeframe/เงื่อนไขต่างกัน", differentAsset: "คนละประเด็นในสินทรัพย์เดียวกัน" } },
      lean: { type: "score", instructions: "Which stance does his overall body of work support more for this asset?", criteria: ["เอียงฝั่งลบชัด", "เอียงลบ", "สมดุล", "เอียงบวก", "เอียงบวกชัด"] },
    }
  );
  contradictions.push({ asset: pr.asset, bear: pr.bear, bull: pr.bull, verdict: a?.verdict?.choice ?? null, lean: a?.lean?.score ?? null });
  console.log(`  คู่ขัดแย้ง ${pr.asset}: ${a?.verdict?.choice ?? "?"} (lean ${a?.lean?.score ?? "?"})`);
}

// ---------- D. หุ้นที่พูดถึง + ราคาตอนพูด ----------
const stockAgg = {};
for (const c of suite) {
  for (const m of c.stockMentions ?? []) {
    (stockAgg[m.ticker] ??= { ticker: m.ticker, mentionChunks: 0, withPrice: [], contexts: [] });
    stockAgg[m.ticker].mentionChunks++;
    if (m.priceAt) stockAgg[m.ticker].withPrice.push(m.priceAt);
    if (stockAgg[m.ticker].contexts.length < 3) stockAgg[m.ticker].contexts.push({ clip: c.clip, ctx: m.context });
  }
}
const stockCalls = Object.values(stockAgg).sort((a, b) => b.mentionChunks - a.mentionChunks).slice(0, 20).map(s => ({
  ticker: s.ticker, chunks: s.mentionChunks,
  priceRange: s.withPrice.length ? { min: Math.min(...s.withPrice), max: Math.max(...s.withPrice), n: s.withPrice.length } : null,
  sample: s.contexts[0] ?? null,
}));

// ---------- E. Allocation สังเคราะห์ (จากคำแนะนำผู้ชมรวม) ----------
const alloc = await jevCall(
  `คลัง 27 คลิปนักวิเคราะห์ T — ความถี่คำแนะนำที่บอกผู้ชม: ${JSON.stringify(adviceCount)} · เฟสที่พูดถึง: ${JSON.stringify(phaseCount)} · conviction เฉลี่ย ${convictionAvg}/3 · พยากรณ์ 140 รายการ (บวก 44 ลบ 35 เงื่อนไข 15) · สถานการณ์เด่น: สงคราม+เงินเฟ้อ+Reset ราว 2030`,
  {
    allocation: { type: "noul", instructions: "Based on this pattern, what portfolio posture does his advice imply for a Thai retail investor today?" },
    posture: { type: "choice", instructions: "Best single label for the implied posture?", criteria: { maxCashGold: "เงินสดสูง+ทองหนัก รอซื้อวิกฤต", barbell: "บาร์เบล: ทอง/สินค้าโภคภัณฑ์ + หุ้นคุณภาพนิดหน่อย", allIn: "ลงหุ้นเต็มตัว", diversified: "กระจายทุกสินทรัพย์เท่ากัน" } },
    cashRole: { type: "score", instructions: "How important is holding cash (to buy crisis) in his implied advice?", criteria: ["ไม่เน้น", "พูดบ้าง", "สำคัญ", "แกนหลักชัดเจน"] },
  }
);
const allocation = {
  posture: alloc?.posture?.choice ?? null,
  cashRole: alloc?.cashRole?.score ?? null,
  note: "สังเคราะห์โดย Jev จากความถี่คำแนะนำทั้งคลัง — เป็น 'posture ที่คำแนะนำสื่อ' ไม่ใช่คำแนะนำของ StockLens",
};

const out = {
  ranAt: new Date().toISOString(),
  phaseCount, adviceCount, convictionAvg, highConviction, contradictions, stockCalls, allocation,
};
writeFileSync(".zcode/jev-cross.json", JSON.stringify(out, null, 1));
console.log(`✓ จุดที่ 2 เสร็จ: เฟส=${JSON.stringify(phaseCount)} | advice=${JSON.stringify(adviceCount)}`);
console.log(`high-conviction ${highConviction.length} กลุ่ม | คู่ตรวจ ${contradictions.length} | หุ้น ${stockCalls.length} | posture: ${allocation.posture}`);
