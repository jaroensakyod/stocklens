// ชุดทดสอบ Jev กับข่าวหุ้นไทยจริง — รัน: TS_KEY=... node scripts/test-typesafe-thai.mjs
// ดึงพาดหัวข่าวจริงจาก /api/radar ของเรา (มีทั้งไทย/อังกฤษ) → ให้ Jev ตอบ 4 คำถามต่อข่าว
// วัด: ความถูกต้อง (เทียบ label ที่ฝังไว้ในชื่อข่าวไม่ได้ — รีวิวด้วยตาหลังรัน), latency, token, ต้นทุน/เรียก
// เกณฑ์ผ่าน: รีวิวแล้ว sentiment/ticker ถูก ≥80% และยิงซ้ำคำตอบนิ่ง
import { writeFileSync } from "node:fs";

const KEY = process.env.TS_KEY;
if (!KEY) { console.error("ต้องตั้ง TS_KEY ก่อน"); process.exit(1); }

// 1) ดึงข่าวจริงจาก radar เรา
const radarRes = await fetch("http://localhost:3000/api/radar");
const radar = await radarRes.json();
const headlines = [];
for (const t of radar.themes ?? []) {
  for (const n of t.newsTop ?? []) {
    if (n.title && n.title.length > 25) headlines.push({ theme: t.id, title: n.title, source: n.source });
  }
}
// ตัดซ้ำ + เอา 30 ชิ้นแรก
const seen = new Set();
const items = headlines.filter((h) => !seen.has(h.title) && seen.add(h.title)).slice(0, 30);
console.log(`รวมข่าวสำหรับทดสอบ: ${items.length} ชิ้น (ไทย/อังกฤษปนตามจริง)\n`);

const QUESTIONS = {
  sentiment: { type: "choice", instructions: "Overall news sentiment for the stock or market mentioned", criteria: { bullish: "Positive for the stock price", neutral: "Little or no price impact", bearish: "Negative for the stock price" } },
  impact: { type: "score", instructions: "How significant this news is for the stock price short term", criteria: ["Minor noise, no real impact", "Moderate impact, may move price slightly", "Major catalyst, likely to move price significantly"] },
  is_thai: { type: "noul", instructions: "This headline is written in Thai language" },
  topic: { type: "choice", instructions: "Main topic of this news", criteria: { earnings: "Company earnings/results", macro: "Economy, rates, policy, macro", sector: "Industry or sector news", price_action: "Price movement or trading update", other: "Something else" } },
};

async function ask(state) {
  const t0 = Date.now();
  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ state, model: "jev-latest", questions: QUESTIONS }),
    signal: AbortSignal.timeout(15_000),
  });
  const ms = Date.now() - t0;
  if (!res.ok) return { error: `HTTP ${res.status}`, ms };
  const j = await res.json();
  const a = j.answers ?? {};
  return {
    ms,
    tokens: j.usage?.input_tokens ?? 0,
    sentiment: a.sentiment?.choice,
    sentConf: a.sentiment?.confidence,
    impact: a.impact?.score,
    isThai: a.is_thai?.noul,
    topic: a.topic?.choice,
    topicConf: a.topic?.confidence,
  };
}

const results = [];
let totalTokens = 0, totalMs = 0, errors = 0;
for (const [i, h] of items.entries()) {
  const r = await ask(h.title);
  if (r.error) { errors++; console.log(`[${i + 1}] ERROR ${r.error} — หยุดแล้ว (เครดิต/ลิมิต?)`); break; }
  totalTokens += r.tokens; totalMs += r.ms;
  results.push({ ...h, ...r });
  console.log(`[${String(i + 1).padStart(2)}] ${r.ms}ms ${r.tokens}t | ${r.sentiment}(c${r.sentConf}) | impact=${r.impact} | thai=${r.isThai?.toFixed(2)} | ${r.topic} | ${h.title.slice(0, 48)}`);
}

// 2) ทดสอบความนิ่ง: ยิง 5 ข่าวแรกซ้ำรอบสอง คำตอบต้องเหมือนเดิม
const stable = [];
for (const h of items.slice(0, 5)) {
  const r2 = await ask(h.title);
  const first = results.find((x) => x.title === h.title);
  if (r2.error || !first) break;
  const same = first.sentiment === r2.sentiment && first.topic === r2.topic && Math.abs((first.impact??0)-(r2.impact??0)) < 0.15;
  stable.push({ title: h.title.slice(0, 40), same, first: `${first.sentiment}/${first.impact}`, second: `${r2.sentiment}/${r2.impact}` });
  console.log(`นิ่ง? ${same ? "✓" : "✗ เปลี่ยน"} | ${h.title.slice(0, 40)}`);
}

const n = results.length;
if (n) {
  const cost = (totalTokens / 1e6) * 0.042; // $42/Btok = $0.042/Mtok
  console.log(`\n=== สรุป ===`);
  console.log(`สำเร็จ ${n} ชิ้น | เฉลี่ย ${(totalMs / n).toFixed(0)}ms/เรียก | เฉลี่ย ${(totalTokens / n).toFixed(0)} tokens/เรียก`);
  console.log(`ต้นทุนจริงรวม $${cost.toFixed(5)} → ต่อเรียก $${(cost / n).toFixed(7)} (${(cost / n * 10000).toFixed(3)} บาท/พันเรียกที่ 35 บาท/$)`);
  console.log(`นิ่งซ้ำ: ${stable.filter((s) => s.same).length}/${stable.length}`);
  console.log(`สแกนข่าว 600 ชิ้น/วัน 30 วัน จะใช้ ≈ $${(cost / n * 600 * 30).toFixed(2)}/เดือน`);
}
writeFileSync(".zcode/typesafe-thai-results.json", JSON.stringify({ items: results, stable }, null, 2));
console.log("\nบันทึกผลที่ .zcode/typesafe-thai-results.json — ใช้รีวิวความถูกต้องด้วยตาต่อ");
