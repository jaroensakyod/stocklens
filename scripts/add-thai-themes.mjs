// เพิ่มธีมใหม่ (AI + การเมืองไทย) และหุ้นไทยใน impact-map 13 → 30+ ตัว — รันครั้งเดียว: node scripts/add-thai-themes.mjs
// ทุกการเพิ่มเป็น curation ด้วยเหตุผลธุรกิจชัดเจน (ไม่ใช่จับคู่อัตโนมัติ) — ทับได้ถ้ารันซ้ำ (idempotent)
import { readFileSync, writeFileSync } from "node:fs";

// ---------- 1) ธีมใหม่ 2 ตัว ----------
const themesFile = "src/data/radar-themes.json";
const tj = JSON.parse(readFileSync(themesFile, "utf8"));
const NEW_THEMES = [
  {
    id: "ai",
    name: "AI & ปัญญาประดิษฐ์",
    emoji: "🤖",
    desc: "คลื่น AI โลก — ชิป/ดาต้าเซ็นเตอร์/คลาวด์ กับหุ้นที่ได้-เสียประโยชน์ รวมผลกระทบหุ้นไทย (DELTA/HANA)",
    watch: ["NVDA", "SMH", "MSFT", "VST"],
    impactIds: ["aicloud", "ai-cost-shock", "semis-shock", "chips"],
    keys: ["ai", "ปัญญาประดิษฐ์", "แอไอ", "chatgpt", "openai", "gemini", "gpu", "ชิป ai", "data center", "ดาต้าเซ็นเตอร์", "ดาต้าเซนเตอร์", "deepseek", "llm", "โมเดล ai", "ai ถูกลง", "หุ้น ai", "nvidia"],
  },
  {
    id: "thaipol",
    name: "การเมืองไทย",
    emoji: "🇹🇭",
    desc: "เสถียรภาพการเมืองไทย — เลือกตั้ง ตั้งรัฐบาล งบประมาณ ชุมนุม กด/ดันตลาดหุ้นไทยและค่าเงินบาท",
    watch: ["THB=X", "^SET.BK"],
    impactIds: ["thaipol", "travel-thai", "banking-stress"],
    keys: ["การเมืองไทย", "รัฐบาล", "เลือกตั้ง", "election", "ไม่ไว้วางใจ", "งบประมาณ", "รัฐประหาร", "ประกาศพรก.", "พรก.", "ชุมนุม", "ประท้วง", "นายกฯ", "ตั้งรัฐบาล", "ยุบสภา", "coup", "protest thailand", "set ไทย"],
  },
];
for (const t of NEW_THEMES) {
  const i = tj.themes.findIndex((x) => x.id === t.id);
  if (i >= 0) tj.themes[i] = t;
  else tj.themes.push(t);
}
writeFileSync(themesFile, JSON.stringify(tj, null, 2) + "\n");

// ---------- 2) impact-map: node ใหม่ + หุ้นไทยเพิ่ม ----------
const mapFile = "src/data/impact-map.json";
const m = JSON.parse(readFileSync(mapFile, "utf8"));

// node ใหม่: การเมืองไทย
const thaipol = {
  id: "thaipol",
  type: "macro",
  name: "การเมืองไทย",
  yahoo: "THB=X",
  upReason: "การเมืองไทยร้อนแรง (ชุมนุม/เลือกตั้ง/อภิปรายไม่ไว้วางใจ) มักกด sentiment ตลาดไทยและเงินบาท — แต่ถ้าจบด้วยงบใหญ่/มาตรการกระตุ้น กลุ่มก่อสร้าง-โครงสร้างพื้นฐานรัฐจะได้ประโยชน์ตามหลัง",
  stocks: [
    { ticker: "CK.BK", market: "TH", direction: "negative", strength: "medium", reason: "โครงสร้างพื้นฐานรัฐ — ความไม่แน่นอนทำให้งบ/โครงการล่าช้า แต่ดีดกลับแรงเมื่อมีมาตรการกระตุ้น" },
    { ticker: "STEC.BK", market: "TH", direction: "negative", strength: "medium", reason: "ผู้รับเหมาก่อสร้างภาครัฐ ผูกกับรอบงบประมาณและเสถียรภาพรัฐบาล" },
    { ticker: "ITD.BK", market: "TH", direction: "negative", strength: "medium", reason: "โครงการขนาดใหญ่ภาครัฐล่าช้าเมื่อการเมืองต้องค้าง แต่ผู้รับประโยชน์หลักถ้าคลี่คลายด้วยงบใหญ่" },
    { ticker: "KBANK.BK", market: "TH", direction: "negative", strength: "medium", reason: "ธนาคารใหญ่อ่อนไหวต่อเงินไหลออก/ความเสี่ยงเศรษฐกิจไทยจากความไม่แน่นอน" },
    { ticker: "BBL.BK", market: "TH", direction: "negative", strength: "medium", reason: "ธนาคารระบบ — ส่งผลต่อ sentiment ตลาดทุนไทยโดยรวม" },
    { ticker: "AOT.BK", market: "TH", direction: "negative", strength: "medium", reason: "หุ้นแรงส่งของ SET — โดนกดตามดัชนีทุกครั้งที่การเมืองตึงเครียด" },
  ],
};
const ti = m.nodes.findIndex((n) => n.id === "thaipol");
if (ti >= 0) m.nodes[ti] = thaipol;
else m.nodes.push(thaipol);

// หุ้นไทยเพิ่มใน node ที่มีอยู่ (ticker, direction, reason)
const ADD = {
  oil: [
    { ticker: "BANPU.BK", direction: "positive", reason: "พลังงานถ่านหิน-ก๊าซ ราคาพลังงานโลกแพง = รายได้ขึ้นตรง" },
    { ticker: "TOP.BK", direction: "negative", reason: "รีไฟเนอรี่ — น้ำมันดิบแพง = ต้นทุนดิบสูงตาม" },
    { ticker: "SPRC.BK", direction: "negative", reason: "โรงกลั่นน้ำมัน ต้นทุนดิบแพงขึ้นเมื่อราคาดิบพุ่ง" },
    { ticker: "AAV.BK", direction: "negative", reason: "สายการบินต้นทุนเชื้อเพลิง ~1 ใน 3 ของต้นทุน โดนตรงที่สุดกลุ่มบินไทย" },
  ],
  ratescycle: [
    { ticker: "AP.BK", direction: "positive", reason: "เด็กเลอร์อสังหาฯ — ดอกเบี้ยลด = ลูกบ้านกู้ง่าย ยอดขายโครงการดีขึ้น" },
    { ticker: "LH.BK", direction: "positive", reason: "เด็กเลอร์อสังหาฯรายใหญ่ ผู้รับประโยชน์ตรงจากที่ดอกเบี้ยกู้ต่ำลง" },
    { ticker: "KBANK.BK", direction: "negative", reason: "ธนาคาร — ดอกเบี้ยเงินให้กู้ลงเร็วกว่าต้นทุนเงินฝาก กด NIM" },
    { ticker: "KTB.BK", direction: "negative", reason: "ธนาคารรัฐ กำไรจากส่วนต่างดอกเบี้ยหดเมื่อทยอยลดอัตรา" },
  ],
  renewables: [
    { ticker: "GPSC.BK", direction: "positive", reason: "ผู้ผลิตไฟพลังงานสะอาด/หลากหลาย ได้ประโยชน์จากนโยบายสนับสนุน RE" },
    { ticker: "SUPER.BK", direction: "positive", reason: "โซลาร์รูฟ/ระบบไฟฟ้าพลังแสงอาทิตย์เต็มตัว" },
    { ticker: "EA.BK", direction: "positive", reason: "พลังงานลม/แบตเตอรี่/EV — เดิมพันนโยบายพลังงานสะอาด" },
  ],
  shipping: [
    { ticker: "RCL.BK", direction: "positive", reason: "สายเดินเรือระบบกำปั่น-สายบรรจุภัณฑ์เอเชีย ค่าระวางขึ้น = รายได้ตาม" },
    { ticker: "PSL.BK", direction: "positive", reason: "ธุรกิจเรือ+ให้เช่าเรือบรรจุภัณฑ์ ผูกอัตราค่าระวางโลก" },
  ],
  chinaexposed: [
    { ticker: "CPF.BK", direction: "negative", reason: "ส่งออกอาหาร/กิจการในจีนขนาดใหญ่ — เศรษฐกิจจีนอ่อนแรงกระทบตรง" },
    { ticker: "SCC.BK", direction: "negative", reason: "วัสดุ-ปิโตรเคมีผูกวัฏจักรเศรษฐกิจจีนเป็นหลัก" },
  ],
};
for (const [nodeId, stocks] of Object.entries(ADD)) {
  const node = m.nodes.find((n) => n.id === nodeId);
  if (!node) continue;
  for (const s of stocks) {
    const i = node.stocks.findIndex((x) => x.ticker === s.ticker);
    const row = { ticker: s.ticker, market: "TH", direction: s.direction, strength: "medium", reason: s.reason };
    if (i >= 0) node.stocks[i] = row;
    else node.stocks.push(row);
  }
}
writeFileSync(mapFile, JSON.stringify(m, null, 2) + "\n");

// สรุป
const thaiTickers = new Set(m.nodes.flatMap((n) => n.stocks.filter((s) => s.ticker.endsWith(".BK")).map((s) => s.ticker)));
console.log(`ธีมทั้งหมด: ${tj.themes.length} (เพิ่ม ai, thaipol)`);
console.log(`หุ้นไทยใน impact-map: ${thaiTickers.size} ตัว →`, [...thaiTickers].join(", "));
