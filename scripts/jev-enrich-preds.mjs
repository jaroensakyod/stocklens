// 🧠 ① Enrich พยากรณ์ 140 รายการด้วย Jev: ทิศทาง (bull/bear/conditional/neutral) + ความมั่นใจ ต่อรายการ
// ② สังเคราะห์ Scenario Matrix จากพยากรณ์กลุ่มใหญ่
// รัน: node scripts/jev-enrich-preds.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const key = readFileSync(".env.local", "utf8").match(/TYPESAFE_API_KEY=(.+)/)?.[1]?.trim();
const API = "https://api.typesafe.ai/v1/systemone";

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

const rx = JSON.parse(readFileSync(".zcode/jev-reextract.json", "utf8"));
const ENR = ".zcode/jev-preds-enriched.json";
const enriched = existsSync(ENR) ? JSON.parse(readFileSync(ENR, "utf8")) : {}; // idx → {direction, confidence}

let n = 0;
for (let i = 0; i < rx.predictions.length; i++) {
  if (enriched[i]) continue;
  const p = rx.predictions[i];
  const a = await jevCall(
    `คำพูดจากคลิปของนักวิเคราะห์การเงินไทย (T) เกี่ยวกับ "${p.assets ?? "ตลาด"}": """${p.quote}"""`,
    {
      direction: { type: "choice", instructions: "What is the speaker's directional stance on this asset?", criteria: { bull: "บวก/สะสม/ราคาขึ้น", bear: "ลบ/ลด/ราคาลง", conditional: "มีเงื่อนไข (ถ้า X ถึง Y)", neutral: "เป็นการบรรยายสถานะ ไม่ใช่ทิศทาง" } },
      confidence: { type: "score", instructions: "How confident does the speaker sound in THIS specific call?", criteria: ["เออออ ไม่แน่ใจ", "พอมั่นใจ", "มั่นใจ", "มั่นใจมาก ย้ำชัด"] },
    }
  );
  enriched[i] = {
    direction: a?.direction?.choice ?? null,
    confidence: a?.confidence?.score ?? null,
  };
  n++;
  if (n % 25 === 0) { writeFileSync(ENR, JSON.stringify(enriched)); console.log(`${i + 1}/${rx.predictions.length}`); }
}
writeFileSync(ENR, JSON.stringify(enriched));
console.log(`① ทิศทางครบ ${Object.keys(enriched).length}/${rx.predictions.length}`);

// ---------- ② Scenario Matrix ----------
const top = rx.predictions.slice(0, 45).map((p, i) => `[${enriched[i]?.direction ?? "?"}] (${p.assets ?? "-"}, ${p.timeframe ?? "-"}) ${p.quote.slice(0, 130)}`).join("\n");
const sc = await jevCall(
  `รวมพยากรณ์จากคลิปนักวิเคราะห์ T (bull/bear ตามวงเล็บ) — จัดกลุ่มเป็นสถานการณ์ใหญ่ของโลก 2026-2030:\n${top}`,
  {
    bestScenario: { type: "choice", instructions: "Which scenario name best fits the DOMINANT thesis across these predictions?", criteria: { warInflationReset: "สงคราม+เงินเฟ้อ+Reset หนี้ราว 2030 (ทอง/สินค้าโภคภัณฑ์/กลาโหมชนะ)", softLanding: "โลกผ่านพ้นแบบนุ่ม หุ้นโตต่อ (กรณีพยากรณ์ bull หุ้นสำเร็จ)", stagflationGrind: "เงินเฟ้อสูง+เติบโตต่ำยาว (ทองแข็ง หุ้น sideways)" } },
    evidence: { type: "score", instructions: "How strongly does the bulk of predictions support that dominant scenario? (0=สับสนสองทาน 4=หนักแน่นทางเดียว)", criteria: ["หลักฐานขัดแย้งกันเอง", "เอียงเล็กน้อย", "เอียงชัด", "หนักแน่นทางเดียว"] },
    goldMomentum: { type: "score", instructions: "Across gold-related quotes specifically, how consistent is the bullish lean?", criteria: ["ผสม/กลาง", "เอียงบวก", "บวกชัดเจน", "บวกหนักแน่นทั้งกระแส"] },
  }
);
const matrix = {
  builtAt: new Date().toISOString(),
  dominant: sc?.bestScenario?.choice ?? null,
  evidenceScore: sc?.bestScenario ? (sc.evidence?.score ?? null) : null,
  goldLean: sc?.goldMomentum?.score ?? null,
  note: "สังเคราะห์โดย Jev จากพยากรณ์ 45 อันดับแรกของคลัง T",
};
writeFileSync(".zcode/jev-scenario.json", JSON.stringify(matrix, null, 1));
console.log("② Scenario:", JSON.stringify(matrix));
