// 🧠 Jev Full Suite จุดที่ 1 — per-chunk 380 chunks: conviction / เฟสกรอบ T / คำแนะนำผู้ชม / หุ้น actionable
// (ทับซ้อนกับ progress เดิมของ jev-reextract แต่เก็บแยกไฟล์ — resume ได้)
// รัน: node scripts/jev-full-suite.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const key = readFileSync(".env.local", "utf8").match(/TYPESAFE_API_KEY=(.+)/)?.[1]?.trim();
const API = "https://api.typesafe.ai/v1/systemone";

const clips = JSON.parse(readFileSync(".zcode/prolens/all-transcripts.json", "utf8"));
const PROG = ".zcode/jev-full-suite.json";
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

// ชื่อหุ้นไทยที่พูดในคลิป → ticker (สำหรับ local extraction)
const TICKER_MAP = [
  ["PTTEP", /PTTEP|ปีทีทีอีพี|เอ็กซ์พลอ|แอกซ์พลอ/i],
  ["PTT", /PTT(?!EP)|ปีทีทีเต็ม|ปตท\.?เต็ม/i],
  ["TOP", /\bTOP\b|ทอป์ ออยล์|ท็อป ออยล์|เรฟฟาย/i],
  ["IRPC", /IRPC|ไออาร์พีซี/i],
  ["BANPU", /BANPU|บ้านปู/i],
  ["DELTA", /DELTA|เดลต้า/i],
  ["GULF", /GULF|กัล์ฟ เอ็นเนอร์จี|กัล์ฟ/],
  ["AOT", /\bAOT\b|เอโอที|ท่าอากาศยานไทย|ท่าอากาศยานภูมิภาค/i],
  ["MINT", /\bMINT\b|ไมเนอร์|เมจอร์|มินท์/i],
  ["CENTEL", /CENTEL|เซ็นทรัล|เซ็นโฮเทล/i],
  ["CPN", /\bCPN\b|ซีพีเอ็น|ศูนย์ค้าปลีก/i],
  ["CPF", /\bCPF\b|ซีพีเอฟ|เจริญโภคภัณฑ์อาหาร/i],
  ["KBANK", /KBANK|กสิกรไทย|ธนาคารกสิกร/i],
  ["BBL", /\bBBL\b|กรุงเทพ(?: แบงค์)?|ธนาคารกรุงเทพ/i],
  ["SCB", /\bSCB\b|ไทยพาณิชย์/i],
  ["KTB", /\bKTB\b|กรุงไทย/i],
  ["TISCO", /TISCO|ทิสโก้/i],
  ["MTC", /\bMTC\b|เงินด่วน|เมืองไทยแคปปิตอล/i],
  ["TIDLOR", /TIDLOR|ติดล้อ|พลัส/i],
  ["LH", /\bLH\b|แลนด์ แอนด์ เฮาส์|แลนด์แอนด์เฮาส์/i],
  ["AP", /\bAP\b|แอ๊ดวานซ์|เอเชีย แปซิฟิค/i],
  ["WHA", /\bWHA\b|ดับเบิลยูเอชเอ/i],
  ["ADVANC", /ADVANC|แอดวานซ์ อินฟอร์|เอไอเอส/i],
  ["BTS", /\bBTS\b(?:\s(?!สกาย)?วัน)?|บีทีเอส/i],
  ["PSL", /\bPSL\b|ซี ซี ซี|พีเอสแอล|เรือบรรทุก/i],
  ["RCL", /\bRCL\b|อาร์ ซี แอล|ภาษีธุรกิจ|เรือคอนเทนเนอร์/i],
  ["EA", /\bEA\b|อี เอ|เอ็นเนอร์จี อัส/i],
  ["GPSC", /GPSC|จีพีเอสซี/i],
  ["XPG", /XPG|เดลต้าโฮลดิ้ง|เอ็กซ์พีจี/i],
  ["KCE", /KCE|เคซีอี/i],
  ["NVIDIA หรือ NVDA", /NVDA|NVIDIA|เอ็นวิเดีย/i],
  ["PTG", /PTG|พีทีจี|ปตท.(?:โพรดักส์|แอนด์มาร์|โฮลซาล)|ปั๊มน้ำมัน PTG/i],
  ["IVL", /IVL|อินโดรามา/],
];
function extractTickers(text) {
  const hits = [];
  for (const [t, re] of TICKER_MAP) { re.lastIndex = 0; if (re.test(text)) hits.push(t); }
  return hits;
}

const CHUNK = 3000, OVERLAP = 200;
let done = 0, calls = 0;
const t0 = Date.now();
let totalChunks = 0;
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
    const tickers = extractTickers(chunk);
    const answers = await jevCall(
      `Transcript chunk ${i + 1}/${nChunks} ของคลิป "${clip.title}" (นักวิเคราะห์ T — การเงินมหภาค/สงคราม/ทองคำ): """${chunk.slice(0, 2600)}"""`,
      {
        conviction: { type: "score", instructions: "How strong is the speaker's conviction in this chunk overall (assertive vs hedging)?", criteria: ["พูดเลื่อนไหล", "เห็นภาพชัด", "ย้ำหนักแน่น", "ย้ำซ้ำติดชัดเจน"] },
        phase: { type: "choice", instructions: "Which phase of his macro framework does this chunk describe?", criteria: { buildup: "การสะสม/เตรียม (สะสมทอง ที่ดิน เงินสด)", war: "สงคราม/วิกฤตกำลังเกิด", reset: "การรีเซ็ต (หนี้/ระบบเงิน)", rebuild: "หลังรีเซ็ต — สร้างใหม่", none: "ไม่เกี่ยว" } },
        advice: { type: "choice", instructions: "What action does he tell viewers/listeners to take in this chunk?", criteria: { buy: "ซื้อ/สะสมสินทรัพย์", sell: "ขาย/ลด", holdcash: "ถือเงินสด/รอ", prepare: "เตรียมตัว (แผน/ความรู้/อาหาร)", debt: "ลดหนี้", diversify: "กระจาย", none: "ไม่มีคำแนะนำ" } },
        stockActionable: { type: "noul", instructions: "Does this chunk contain ACTIONABLE stock/company advice (specific name + buy/sell/hold)?" },
      }
    );
    calls++;

    // หุ้น+ราคาตอนพูด (local): หน้าต่างรอบชื่อหุ้นที่มีตัวเลขบาท
    const stockMentions = [];
    for (const [t, re] of TICKER_MAP) {
      re.lastIndex = 0;
      const m = re.exec(chunk);
      if (m && (answers?.stockActionable?.noul ?? 0) >= 0.6) {
        const s = Math.max(0, m.index - 100), e = Math.min(chunk.length, m.index + 200);
        const win = chunk.slice(s, e);
        const price = win.match(/(\d{1,3}(?:\.\d{1,2})?)\s*บาท/);
        stockMentions.push({ ticker: t, priceAt: price ? Number(price[1]) : null, context: win.slice(0, 220) });
      }
    }

    progress[pk] = {
      clip: clip.id, title: clip.title, chunkIdx: i,
      conviction: answers?.conviction?.score ?? null,
      phase: answers?.phase?.choice ?? null,
      advice: answers?.advice?.choice ?? null,
      stockActionable: answers?.stockActionable?.noul ?? null,
      tickers, stockMentions,
    };

    if (done % 20 === 0) {
      writeFileSync(PROG, JSON.stringify(progress));
      const rate = (Date.now() - t0) / 1000 / Math.max(calls, 1);
      console.log(`${done}/${totalChunks} (${(100 * done / totalChunks).toFixed(0)}%) ${(rate).toFixed(1)}s/call เหลือ ~${Math.round((totalChunks - done) * rate / 60)} นาที`);
    }
  }
}
writeFileSync(PROG, JSON.stringify(progress));
const n = Object.keys(progress).length;
console.log(`✓ จุดที่ 1 เสร็จ: ${n} chunks | เฟสบ่อยที่สุด:`, Object.entries(Object.groupBy ? {} : {}).length ? "" : "(ดูในจุดที่ 2)");
