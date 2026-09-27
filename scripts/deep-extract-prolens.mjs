// ===== Deep Extract — สกัดข้อมูลลึกจาก transcript ทวีสุข 1 ล้านตัวอักษร =====
// รัน: node scripts/deep-extract-prolens.mjs
// สกัด: พยากรณ์เชิงตัวเลข + causal chains + asset calls + timeline + allocation
// ใช้: pure NLP (regex + pattern) ถ้า Jev ไม่available / ใช้ Jev เมื่อ TYPESAFE_API_KEY ใช้ได้
import { readFileSync, writeFileSync } from "node:fs";

const clips = JSON.parse(readFileSync(".zcode/prolens/all-transcripts.json", "utf8"));

// ============ 1. สกัดพยากรณ์เชิงตัวเลข (เข้มข้นกว่าเดิม 10 เท่า) ============
const NUM_PATTERNS = [
  // ทองคำ: ราคา/เป้า
  { re: /ทอง.{0,40}(?:แตะ|ทะลุ|ถึง|จะไป|พุ่ง|ขึ้นไป|จะเห็น|เห็น).{0,25}(\d[\d,\.]+)\s*(?:บาท|ดอลลาร์|USD|บาท\/สลึง)/gi, asset: "ทองคำ", type: "price_target" },
  { re: /gold.{0,30}(?:hit|reach|target|\$)\s*\$?(\d[\d,\.]+)/gi, asset: "ทองคำ", type: "price_target" },
  // ดอกเบี้ย/ยีลด์
  { re: /(?:ดอกเบี้ย|ยีลด์|interest rate|yield).{0,30}(?:จะ|อาจ|ต้อง|ทะลุ|ถึง|สูงถึง).{0,20}(\d+\.?\d*)\s*%/gi, asset: "ดอกเบี้ย", type: "rate_prediction" },
  // น้ำมัน
  { re: /(?:น้ำมัน|oil|brent|WTI).{0,25}(?:จะ|อาจ|ทะลุ|ถึง|พุ่ง).{0,15}\$?(\d[\d,\.]+)/gi, asset: "น้ำมัน", type: "price_target" },
  // หุ้นรายตัว
  { re: /(?:ซื้อ|บอกให้ซื้อ|แนะนำ).{0,20}(?:หุ้น\s*)?([A-Z]{2,6}(?:\.BK)?).{0,20}(?:ที่|ราคา|ตอน)\s*(\d[\d,\.]+)/gi, asset: "stock_call", type: "buy_call" },
  // SET index
  { re: /SET.{0,20}(?:จะ|อาจ|ลงไปถึง|ตกไปถึง|พุ่งไปถึง).{0,15}(\d[\d,\.]+)/gi, asset: "SET", type: "price_target" },
  // ราคาหุ้นใดก็ได้
  { re: /(?:หุ้น|stock).{0,20}([A-Z]{2,6}(?:\.BK)?).{0,30}(?:จะไปถึง|จะขึ้นไป|จะลงไป|จะพุ่ง).{0,15}(\d[\d,\.]+)/gi, asset: "stock_target", type: "price_target" },
  // เวลา/ปี
  { re: /(?:ปี|ในปี|ช่วง|กลางปี|ปลายปี)\s*(25[6-9]\d|20[2-3]\d).{0,50}(?:วิกฤต|ตกต่ำ|พัง|ล่ม|แตก|Supernova|สงคราม|ฟื้น|ดี|โต)/gi, asset: "timeline", type: "event_prediction" },
  { re: /(?:ไตรมาส|Q[1-4])\s*(25[6-9]\d|20[2-3]\d).{0,50}(?:ทอง|น้ำมัน|วิกฤต|สงคราม|พุ่ง|ตก)/gi, asset: "timeline", type: "event_prediction" },
  // คำแนะนำจัดพอร์ต
  { re: /(?:จัดพอร์ต|สัดส่วน|allocation).{0,60}(?:ทอง|น้ำมัน|ที่ดิน|หุ้น|เงินสด).{0,20}(\d+)\s*%/gi, asset: "allocation", type: "allocation_advice" },
];

// ============ 2. สกัด Causal Chains ============
const CAUSAL_PATTERNS = [
  /ถ้า.{5,80}(?:เกิด|เกิดขึ้น|เป็นจริง).{0,20}(?:จะ|ต้อง|แน่นอน).{5,80}(?:เพราะ|เนื่องจาก|ทำให้).{5,80}/gi,
  /หาก.{5,80}(?:เกิด|เป็น).{0,20}(?:จะ|ต้อง).{5,80}/gi,
  /เมื่อ.{5,40}(?:เกิด|ถึง|พุ่ง|ลง).{0,30}(?:จะ|ต้อง|แน่).{5,80}/gi,
  /if.{10,80}(?:then|happens|occurs).{10,80}(?:because|due to|causes).{10,80}/gi,
];

// ============ 3. สกัด Asset Calls ============
const KNOWN_ASSETS = [
  "PTTEP","PTT","TOP","SPRC","IRPC","BANPU","GULF","GPSC","BGRIM","EA","EA.BK",
  "CPF","TUF","GFPT","KBANK","BBL","SCB","KTB","LH","AP","QH","PLUS","SC","SCC",
  "IVL","PTTGC","ADVANC","TRUE","INTUCH","CPALL","CRC","AOT","BDMS","BH","PTTGC.BK",
  "Mitsubishi Heavy","7011.T","NVDA","TSLA","AAPL","MSFT","GOOGL","META","AMZN",
  "GLD","GC=F","BZ=F","BTC","ETH","LMT","RTX","NOC","XOM","CVX",
];
const ACTION_WORDS = ["ซื้อ","ขาย","ถือ","กอด","หุ้น","แนะนำ","บอกให้","เพชร","ตัวเด็ด","ยอดนิยม","เจ๋ง","ตัวที่"];
const DIRECTION_UP = ["ซื้อ","ถือ","กอด","แนะนำ","บอกให้ซื้อ","หุ้นเด็ด","ตัวเด็ด","ได้ประโยชน์"];
const DIRECTION_DOWN = ["ขาย","เลี่ยง","เสี่ยง","อันตราย","โดนกด"];

// ============ 4. สกัด Timeline ============
const TIMELINE_PATTERNS = [
  { re: /(ปี\s*25[6-9]\d|20[2-3]\d).{0,40}(?:จะ|อาจ|ต้อง).{0,40}(พัง|ล่ม|วิกฤต|สงคราม|ฟื้น|ดี|โต|ตกต่ำ|พุ่ง|Supernova|แตก|ล้าง)/gi, type: "annual" },
  { re: /(ไตรมาส\s*[1-4]|Q[1-4]).{0,30}(?:จะ|อาจ).{0,40}(ทอง|น้ำมัน|วิกฤต|สงคราม|พุ่ง|ตก|แตะ|ทะลุ)/gi, type: "quarterly" },
  { re: /(?:เดือน|กลางปี|ปลายปี|ต้นปี)\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม).{0,40}(?:จะ|อาจ).{0,40}/gi, type: "monthly" },
];

// ============ สกัดจริง ============
const allPredictions = [];
const allCausal = [];
const allAssetCalls = [];
const allTimeline = [];
const allAllocation = [];

for (const clip of clips) {
  const text = clip.transcript.map(p => p.text).join(" ");
  const clipTitle = clip.title.slice(0, 60);
  const clipId = clip.id;
  const clipLen = clip.len;

  // พยากรณ์เชิงตัวเลข
  for (const pat of NUM_PATTERNS) {
    pat.re.lastIndex = 0;
    let m;
    while ((m = pat.re.exec(text)) !== null) {
      const match = {
        text: m[0].slice(0, 150),
        asset: pat.asset,
        type: pat.type,
        number: m[1] ?? m[2] ?? null,
        clip: clipTitle, clipId, clipLen,
        timestampSec: null, // จะเติมถ้าหา timestamp ได้
      };
      // หา timestamp ใกล้เคียง
      const paraIdx = clip.transcript.findIndex(p => text.slice(text.indexOf(m[0]) - 50, text.indexOf(m[0]) + 100).includes(p.text.slice(0, 30)));
      if (paraIdx >= 0) match.timestampSec = clip.transcript[paraIdx].t;
      allPredictions.push(match);
    }
  }

  // Causal chains
  for (const pat of CAUSAL_PATTERNS) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(text)) !== null) {
      if (m[0].length > 20) {
        allCausal.push({ text: m[0].slice(0, 250), clip: clipTitle, clipId, clipLen });
      }
    }
  }

  // Asset calls
  for (const asset of KNOWN_ASSETS) {
    const idx = text.indexOf(asset);
    if (idx < 0) continue;
    const context = text.slice(Math.max(0, idx - 80), idx + asset.length + 80);
    const hasAction = ACTION_WORDS.some(w => context.includes(w));
    if (hasAction) {
      const isUp = DIRECTION_UP.some(w => context.includes(w));
      const isDown = DIRECTION_DOWN.some(w => context.includes(w));
      if (isUp || isDown) {
        allAssetCalls.push({
          asset, direction: isUp ? "up" : "down",
          context: context.slice(0, 160), clip: clipTitle, clipId, clipLen,
        });
      }
    }
  }

  // Timeline
  for (const pat of TIMELINE_PATTERNS) {
    pat.re.lastIndex = 0;
    let m;
    while ((m = pat.re.exec(text)) !== null) {
      allTimeline.push({ text: m[0].slice(0, 200), type: pat.type, clip: clipTitle, clipId, clipLen });
    }
  }

  // Allocation advice
  const allocMatch = text.match(/(?:จัดพอร์ต|สัดส่วน|portfolio).{0,100}(?:ทอง|น้ำมัน|ที่ดิน|หุ้น|เงินสด).{0,30}(\d+)\s*%/gi);
  if (allocMatch) allAllocation.push({ text: allocMatch[0].slice(0, 200), clip: clipTitle, clipId });
}

// ตัดซ้ำ (พยากรณ์เดียวกันในหลายคลิป — เก็บไว้เพราะแสดงว่าพูดซ้ำ = high conviction)
const uniquePredictions = [...new Map(allPredictions.map(p => [p.text.slice(0, 80), p])).values()];
const uniqueCausal = [...new Map(allCausal.map(c => [c.text.slice(0, 80), c])).values()];
const uniqueAssets = [...new Map(allAssetCalls.map(a => [a.asset + a.direction, a])).values()];
const uniqueTimeline = [...new Map(allTimeline.map(t => [t.text.slice(0, 80), t])).values()];

// จัดกลุ่ม asset calls ตามความถี่ (= high conviction)
const assetFreq = {};
for (const a of allAssetCalls) {
  const key = a.asset + ":" + a.direction;
  assetFreq[key] = (assetFreq[key] ?? 0) + 1;
}

console.log("========== ผลการสกัด ==========");
console.log(`พยากรณ์เชิงตัวเลข: ${uniquePredictions.length} รายการ (จาก ${allPredictions.length} matches)`);
console.log(`Causal chains: ${uniqueCausal.length} รายการ`);
console.log(`Asset calls: ${uniqueAssets.length} ตัว (จาก ${allAssetCalls.length} mentions)`);
console.log(`Timeline: ${uniqueTimeline.length} รายการ`);
console.log(`Allocation: ${allAllocation.length} รายการ`);

console.log("\n===== Top Asset Calls (พูดซ้ำ = high conviction) =====");
const sortedFreq = Object.entries(assetFreq).sort((a, b) => b[1] - a[1]);
sortedFreq.slice(0, 20).forEach(([key, count]) => {
  const [asset, dir] = key.split(":");
  console.log(`  ${dir === "up" ? "▲" : "▼"} ${asset.padEnd(15)} ${count} ครั้ง`);
});

console.log("\n===== พยากรณ์เชิงตัวเลข (Top 20) =====");
uniquePredictions.slice(0, 20).forEach(p => {
  console.log(`  [${p.asset}] ${p.type}: "${p.text.slice(0, 80)}" (${p.clip.slice(0, 30)})`);
});

console.log("\n===== Causal Chains (Top 10) =====");
uniqueCausal.slice(0, 10).forEach(c => {
  console.log(`  "${c.text.slice(0, 100)}" (${c.clip.slice(0, 25)})`);
});

// บันทึกผล
const result = {
  detailedPredictions: uniquePredictions,
  causalChains: uniqueCausal,
  assetCalls: uniqueAssets,
  assetFrequency: assetFreq,
  timeline: uniqueTimeline,
  allocation: allAllocation,
  summary: {
    totalPredictions: uniquePredictions.length,
    totalCausal: uniqueCausal.length,
    totalAssets: uniqueAssets.length,
    totalTimeline: uniqueTimeline.length,
    sourceClips: clips.length,
    sourceCharacters: clips.reduce((a, c) => a + c.transcript.reduce((s, p) => s + p.text.length, 0), 0),
  }
};
writeFileSync(".zcode/prolens/deep-extract.json", JSON.stringify(result, null, 2));
console.log("\nบันทึก .zcode/prolens/deep-extract.json ✓");
