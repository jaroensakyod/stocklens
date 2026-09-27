// 🧠 Jev Full Suite for J (Professor Jiang) — 30 คลิป 4.1M chars ~1,471 chunks
// รัน: node scripts/jev-jiang-suite.mjs  (resume ได้)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const key = readFileSync(".env.local", "utf8").match(/TYPESAFE_API_KEY=(.+)/)?.[1]?.trim();
const API = "https://api.typesafe.ai/v1/systemone";

const clips = JSON.parse(readFileSync(".zcode/prolens/jiang-transcripts.json", "utf8"));
const PROG = ".zcode/jev-jiang-suite.json";
const progress = existsSync(PROG) ? JSON.parse(readFileSync(PROG, "utf8")) : {};

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
      if (!res.ok) { console.error("HTTP", res.status); return null; }
      return (await res.json()).answers ?? null;
    } catch { await new Promise(r => setTimeout(r, 800)); }
  }
  return null;
}

const CHUNK = 3000, OVERLAP = 200;
let done = 0, calls = 0;
const t0 = Date.now();
let totalChunks = 0;

// นับรวมก่อน
for (const clip of clips) {
  const text = (clip.transcript || []).map(s => s.text).join(" ").replace(/&gt;&gt;?/g, " ").replace(/\s+/g, " ").trim();
  if (!text) continue;
  for (let i = 0; i * (CHUNK - OVERLAP) < text.length; i++) totalChunks++;
}

for (const clip of clips) {
  const text = (clip.transcript || []).map(s => s.text).join(" ").replace(/&gt;&gt;?/g, " ").replace(/\s+/g, " ").trim();
  if (!text) continue;
  const nChunks = Math.ceil(text.length / (CHUNK - OVERLAP));

  for (let i = 0; i * (CHUNK - OVERLAP) < text.length; i++) {
    const pk = `${clip.id}:${i}`;
    done++;
    if (progress[pk]) continue;

    const chunk = text.slice(i * (CHUNK - OVERLAP), i * (CHUNK - OVERLAP) + CHUNK);
    const answers = await jevCall(
      `Transcript chunk ${i + 1}/${nChunks} of "${clip.title?.slice(0, 60)}" (Professor Jiang — geopolitics/China/economics): """${chunk.slice(0, 2600)}"""`,
      {
        preds: { type: "score", instructions: "How many SPECIFIC predictions (with number/date/percentage) about markets/geopolitics does this chunk contain?", criteria: ["None", "1-2 vague", "3-5 specific", "6+ very specific"] },
        assets: { type: "choice", instructions: "Which asset/geopolitical topic receives the main focus?", criteria: { china: "China economy/military/policy", us: "US strategy/economy", taiwan: "Taiwan/conflict", gold: "Gold/commodities", tech: "Technology/chips/AI", energy: "Energy/oil/gas", bonds: "Bonds/debt/interest rates", supplychain: "Supply chain/trade", none: "General/other" } },
        direction: { type: "choice", instructions: "What is the speaker's directional stance on his main topic?", criteria: { bull: "Optimistic/positive outlook", bear: "Pessimistic/negative outlook", conditional: "Conditional (if X then Y)", neutral: "Descriptive/analytical only" } },
        conviction: { type: "score", instructions: "How strong is the speaker's conviction?", criteria: ["Hedging/uncertain", "Moderately confident", "Confident", "Very assertive"] },
        timeframe: { type: "choice", instructions: "What timeframe do the predictions target?", criteria: { days: "Days-weeks", months: "Quarters-months", year: "Within 1 year", years: "Multi-year/decade", none: "No prediction" } },
      }
    );
    calls++;

    // สกัด quote จริงที่มีตัวเลข+คำสำคัญ
    let quotes = [];
    if (answers && ((answers.preds?.score ?? 0) >= 2 || (answers.conviction?.score ?? 0) >= 2.5)) {
      const KEYWORD = /(China|Chinese|Taiwan|gold|dollar|oil|gas|energy|chip|semiconductor|AI|economy|GDP|inflation|interest rate|debt|bond|trade|war|military|supply chain|Belt|yuan|US|America|Trump|Biden|Xi|percent|%|\d{2,})/gi;
      let m;
      while ((m = KEYWORD.exec(chunk)) !== null && quotes.length < 4) {
        const s = Math.max(0, m.index - 130), e = Math.min(chunk.length, m.index + 220);
        let win = chunk.slice(s, e);
        if (!/\d/.test(win)) continue;
        const ls = win.indexOf(" "), le = win.lastIndexOf(" ");
        if (le > ls + 40) win = win.slice(ls + 1, le);
        if (win.length > 50 && win.length < 420) quotes.push(win);
        KEYWORD.lastIndex = m.index + 150;
      }
      quotes = [...new Set(quotes)];
    }

    progress[pk] = {
      clip: clip.id, title: clip.title, chunkIdx: i,
      preds: answers?.preds?.score ?? null,
      assets: answers?.assets?.choice ?? null,
      direction: answers?.direction?.choice ?? null,
      conviction: answers?.conviction?.score ?? null,
      timeframe: answers?.timeframe?.choice ?? null,
      quotes,
    };

    if (done % 50 === 0) {
      writeFileSync(PROG, JSON.stringify(progress));
      const rate = (Date.now() - t0) / 1000 / Math.max(calls, 1);
      console.log(`${done}/${totalChunks} (${(100 * done / totalChunks).toFixed(0)}%) ${(rate).toFixed(1)}s/call เหลือ ~${Math.round((totalChunks - done) * rate / 60)} นาที`);
    }
  }
}
writeFileSync(PROG, JSON.stringify(progress));
console.log(`✓ J suite เสร็จ: ${Object.keys(progress).length} chunks | ${calls} Jev calls`);
