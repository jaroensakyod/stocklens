// 🧠 Jev Re-Extract — ขุดคลัง AT 27 คลิป (1M chars) ด้วย Jev จริง (ตอน deep-extract ครั้งแล้ว Jev 402 เลยใช้ regex)
// วิธี: chunk 3,000 ตัวอักษร (overlap 200) → Jev ต่อ chunk 4 คำถาม (พยากรณ์/สินทรัพย์/causal/timeframe)
//       → chunk ที่ Jev บอกว่า "มีของ" → สกัดประโยคจริงด้วย local regex → เขียน .zcode/jev-reextract.json
// รัน: node scripts/jev-reextract.mjs  (resume ได้ — เก็บ progress ทุก chunk)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const key = readFileSync(".env.local", "utf8").match(/TYPESAFE_API_KEY=(.+)/)?.[1]?.trim();
if (!key) { console.error("ไม่มี TYPESAFE_API_KEY"); process.exit(1); }
const API = "https://api.typesafe.ai/v1/systemone";

const clips = JSON.parse(readFileSync(".zcode/prolens/all-transcripts.json", "utf8"));
const PROG = ".zcode/jev-reextract-progress.json";
const OUT = ".zcode/jev-reextract.json";
const progress = existsSync(PROG) ? JSON.parse(readFileSync(PROG, "utf8")) : {}; // key = clipId:chunkIdx

async function jevCall(state, questions) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ state, model: "jev-latest", questions }),
        signal: AbortSignal.timeout(25_000),
      });
      if (res.status === 429 || res.status === 529) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
      if (!res.ok) { console.error("HTTP", res.status, (await res.text()).slice(0, 120)); return null; }
      return (await res.json()).answers ?? null;
    } catch (e) { await new Promise(r => setTimeout(r, 800)); }
  }
  return null;
}

const CHUNK = 3000, OVERLAP = 200;
let done = 0, total = 0, calls = 0, hotChunks = 0;
const t0 = Date.now();

for (const clip of clips) {
  const text = (clip.transcript || []).map(s => s.text).join(" ").replace(/&gt;&gt;?/g, " ").replace(/\s+/g, " ").trim();
  if (!text) continue;
  const nChunks = Math.ceil(text.length / (CHUNK - OVERLAP));
  for (let i = 0; i * (CHUNK - OVERLAP) < text.length; i++) {
    total++;
    const pk = `${clip.id}:${i}`;
    if (progress[pk]) { done++; continue; }

    const chunk = text.slice(i * (CHUNK - OVERLAP), i * (CHUNK - OVERLAP) + CHUNK);
    const answers = await jevCall(
      `Transcript chunk ${i + 1}/${nChunks} ของคลิป "${clip.title}" (อ.ทวีสุข/รายการการเงินไทย ปี 2019-2026) — เนื้อหา: """${chunk}"""`,
      {
        preds: { type: "score", instructions: "How many SPECIFIC investment predictions (with number/price/percent/date) does this chunk contain?", criteria: ["None", "1-2 vague", "3-5 specific", "6+ very specific"] },
        assets: { type: "choice", instructions: "Which asset class receives explicit buy/sell/price advice in this chunk?", criteria: { gold: "ทองคำ/กระดาษทอง", oil: "น้ำมัน/พลังงาน", thb: "ค่าเงินบาท/เงินบาท", set: "หุ้นไทย/SET", bonds: "พันธบัตร/ดอกเบี้ย/ตราสารหนี้", land: "ที่ดิน/อสังหาฯ", usd: "ดอลลาร์/เงินตราสากล", defense: "กลาโหม/อาวุธ", none: "ไม่มี" } },
        causal: { type: "noul", instructions: "Does this chunk contain an explicit 'ถ้า X เกิด → Y ตามมา เพราะ Z' causal chain about markets/geopolitics?" },
        timeframe: { type: "choice", instructions: "What timeframe do the predictions in this chunk target?", criteria: { days: "วัน-สัปดาห์", months: "ไตรมาส-ไม่กี่เดือน", year: "ภายในปีเดียว", years: "หลายปี-2030+", none: "ไม่มีพยากรณ์" } },
      }
    );
    calls++;

    let local = null;
    if (answers && ((answers.preds?.score ?? 0) >= 2 || (answers.causal?.noul ?? 0) >= 0.7)) {
      hotChunks++;
      // สกัดประโยคจริงที่มีตัวเลข+สินทรัพย์ (Jev gate → local extract)
      const sentences = chunk.split(/(?<=[!.?])\s+|(?<=\s)\s(?=[ก-ฮ]{2,})/);
      const hits = sentences.filter(s =>
        /\d/.test(s) && /(ทอง|บาททอง|เหรียญ|น้ำมัน|ดอกเบี้ย|ดอกบี้ย|เงินเฟ้อ|SET|หุ้น|พันธบัตร|บาท\/|บาทต่อ|ดอลลาร์|ดีอาร์|DR |%|เดือนหน้า|ปีหน้า|ไตรมาส|Q[1-4]|ปี\s?2[05-6]\d|25[6-9]\d)/.test(s) && s.length > 25 && s.length < 400
      ).slice(0, 6);
      local = { sentences: hits };
    }

    progress[pk] = {
      clip: clip.id, title: clip.title, chunkIdx: i,
      preds: answers?.preds ?? null, assets: answers?.assets?.choice ?? null,
      causal: answers?.causal?.noul ?? null, timeframe: answers?.timeframe?.choice ?? null,
      local: local?.sentences ?? [],
    };
    done++;

    if (done % 10 === 0) {
      writeFileSync(PROG, JSON.stringify(progress));
      const rate = (Date.now() - t0) / 1000 / Math.max(calls, 1);
      console.log(`${done}/${total} (${(100 * done / total).toFixed(0)}%) hot=${hotChunks} ${(rate).toFixed(1)}s/call เหลือ ~${Math.round((total - done) * rate / 60)} นาที`);
    }
  }
}

writeFileSync(PROG, JSON.stringify(progress));

// ---------- รวมผล ----------
const all = Object.values(progress);
const byAsset = {};
for (const c of all) { const a = c.assets ?? "none"; byAsset[a] = (byAsset[a] ?? 0) + 1; }
const predictions = all
  .filter(c => (c.preds?.score ?? 0) >= 2 && c.local?.length)
  .flatMap(c => c.local.map(s => ({ clip: c.clip, title: c.title, quote: s, assets: c.assets, timeframe: c.timeframe, predScore: c.preds.score, causal: c.causal })));
const causals = all.filter(c => (c.causal ?? 0) >= 0.7 && c.local?.length)
  .flatMap(c => c.local.map(s => ({ clip: c.clip, quote: s, causal: c.causal })));

// ตัดซ้ำ (ประโยคคล้ายกัน >70%)
const seen = [];
const dedup = arr => arr.filter(x => {
  const k = x.quote.slice(20, 120);
  if (seen.some(s => s.length === k.length && (s.filter(ch => k.includes(ch)).length / Math.max(k.length, 1)) > 0.8)) return false;
  seen.push(k); return true;
});

const out = {
  ranAt: new Date().toISOString(), calls,
  summary: { chunks: all.length, hotChunks, predictionsFound: dedup(predictions).length, causalChunks: causals.length, byAsset },
  predictions: dedup(predictions).sort((a, b) => b.predScore - a.predScore),
  causalSentences: dedup(causals),
};
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`\n✓ เสร็จ: ${calls} Jev calls | hot chunks ${hotChunks}/${all.length} | พยากรณ์+ตัวเลข ${out.predictions.length} ประโยค | บันทึกที่ ${OUT}`);
