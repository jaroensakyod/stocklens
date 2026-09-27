// 🧠 Post-process Jev re-extraction — ใช้คำตอบ Jev จาก progress (ไม่ยิงใหม่) + สกัด quote จาก chunk ต้นทางแบบถูกต้อง
// รัน: node scripts/jev-postprocess.mjs
import { readFileSync, writeFileSync } from "node:fs";

const clips = JSON.parse(readFileSync(".zcode/prolens/all-transcripts.json", "utf8"));
const progress = JSON.parse(readFileSync(".zcode/jev-reextract-progress.json", "utf8"));

const CHUNK = 3000, OVERLAP = 200;
// สร้าง chunk text ใหม่แบบ deterministic (สูตรเดิม) เก็บ map clip:idx → text
const chunkText = new Map();
for (const clip of clips) {
  const text = (clip.transcript || []).map(s => s.text).join(" ").replace(/&gt;&gt;?/g, " ").replace(/\s+/g, " ").trim();
  if (!text) continue;
  for (let i = 0; i * (CHUNK - OVERLAP) < text.length; i++) {
    chunkText.set(`${clip.id}:${i}`, text.slice(i * (CHUNK - OVERLAP), i * (CHUNK - OVERLAP) + CHUNK));
  }
}

const KEY = /(ทองคำ|บาททอง|ทองคำหนึ่ง|ทอง|กระดาษทอง|เหรียญ|น้ำมัน|ดอกเบี้ย|ดอกบี้ย|เงินเฟ้อ|SET|ตลาดหุ้นไทย|พันธบัตร|ตราสารหนี้|ดอลลาร์|เงินบาท|บาท\/|ดีอาร์|DR |ไตรมาส|Q[1-4]|กลาโหม|ที่ดิน)/g;

function extractQuotes(text) {
  // หาทุกจุดที่ keyword สินทรัพย์ปรากฏ แล้วกวาดหน้าต่าง ±180/220 ตัวอักษร ที่มีตัวเลขด้วย
  const out = [];
  let m;
  KEY.lastIndex = 0;
  while ((m = KEY.exec(text)) !== null) {
    const i = m.index;
    const s = Math.max(0, i - 160), e = Math.min(text.length, i + 240);
    let win = text.slice(s, e);
    if (!/\d/.test(win)) continue;
    // ปัดขอบเป็นช่องว่าง
    const ls = win.indexOf(" "), le = win.lastIndexOf(" ");
    if (le > ls + 40) win = win.slice(ls + 1, le);
    if (win.length < 40 || win.length > 420) continue;
    // ต้องมีเครื่องหมายพยากรณ์/ตัวเลขอย่างน้อย 1
    if (!/(\d{2,}|%|บาท|เหรียญ|เดือน|ปี)/.test(win)) continue;
    out.push(win);
    KEY.lastIndex = i + 100; // กันหน้าต่างซ้อนกันหนัก
  }
  return [...new Set(out)].slice(0, 5);
}

const all = Object.values(progress);
const predsRaw = [], causalsRaw = [];
for (const c of all) {
  const text = chunkText.get(`${c.clip}:${c.chunkIdx}`);
  if (!text) continue;
  const quotes = extractQuotes(text);
  if ((c.preds?.score ?? 0) >= 2 && quotes.length) {
    for (const q of quotes) predsRaw.push({ clip: c.clip, title: c.title, quote: q, assets: c.assets, timeframe: c.timeframe, predScore: c.preds.score, causal: c.causal });
  }
  if ((c.causal ?? 0) >= 0.7 && quotes.length) {
    for (const q of quotes) causalsRaw.push({ clip: c.clip, quote: q, causal: c.causal });
  }
}

// ตัดซ้ำง่ายๆ (substring ซ้อน >60%)
const overlapRatio = (a, b) => {
  const [sh, lo] = a.length < b.length ? [a, b] : [b, a];
  if (lo.includes(sh.slice(0, Math.min(80, sh.length)))) return true;
  let hit = 0; for (const ch of new Set(sh)) if (lo.includes(ch)) hit++;
  return hit / Math.max(new Set(sh).size, 1) > 0.95 && Math.abs(sh.length - lo.length) < 50;
};
const dedup = arr => { const kept = []; for (const x of arr) { if (!kept.some(k => overlapRatio(k.quote, x.quote))) kept.push(x); } return kept; };

const predictions = dedup(predsRaw).sort((a, b) => b.predScore - a.predScore);
const causalSentences = dedup(causalsRaw);

const byAsset = {};
for (const c of all) { const a = c.assets ?? "none"; byAsset[a] = (byAsset[a] ?? 0) + 1; }

const out = {
  ranAt: new Date().toISOString(), calls: all.length,
  summary: { chunks: all.length, hotChunks: all.filter(c => (c.preds?.score ?? 0) >= 2 || (c.causal ?? 0) >= 0.7).length, predictionsFound: predictions.length, causalChunks: causalSentences.length, byAsset },
  predictions, causalSentences,
};
writeFileSync(".zcode/jev-reextract.json", JSON.stringify(out, null, 1));
console.log(`✓ พยากรณ์+ตัวเลข: ${predictions.length} | causal: ${causalSentences.length} | byAsset:`, byAsset);
console.log("\nตัวอย่าง 5 อันดับแรก:");
for (const p of predictions.slice(0, 5)) console.log(` [${p.predScore}|${p.assets}|${p.timeframe}] ${p.quote.slice(0, 110)}…`);
