// ขยาย impact-map.json อัตโนมัติ — เพิ่มหุ้น US รายใหญ่เข้า node ที่ "ทิศทางอธิบายได้ด้วยอุตสาหกรรม" จาก TradingView
// ใช้: node scripts/expand-impact-map.mjs [--dry]
// หลักการความซื่อสัตย์: ขยายเฉพาะ node ที่อุตสาหกรรมบอกทิศทางได้ชัด (เช่น ผู้ผลิตน้ำมัน=บวกเมื่อน้ำมันแพง, รีไฟเนอรี่/สายการบิน=ลบ)
// ไม่แตะ node กำกวม (insurers ตอนพายุ มีทั้งค่าเสียหายกับราคาประกันที่ขึ้น) — คน curate ต่อเอง
// ทุกตัวที่เพิ่มจะติด reason ว่า "จับคู่อัตโนมัติ" เพื่อรีวิวย้อนหลังได้
import { readFileSync, writeFileSync } from "node:fs";

const DRY = process.argv.includes("--dry");
const FILE = "src/data/impact-map.json";

// กฎ: nodeId → { pos: [ชื่ออุตสาหกรรม(บางส่วน, พิมพ์เล็ก-ใหญ่ไม่สำคัญ)], neg: [...], max: ต่อทิศ }
const RULES = {
  oil: { pos: ["integrated oil", "oil & gas production", "oil & gas exploration", "contract drilling", "oil field machinery"], neg: ["oil refining/marketing", "airlines"], max: 5 },
  gas: { pos: ["gas distributors"], neg: [], max: 4 },
  gold: { pos: ["precious metals"], neg: [], max: 4 },
  fertilizer: { pos: ["chemicals: agricultural"], neg: [], max: 4 },
  defense: { pos: ["aerospace & defense"], neg: [], max: 4 },
  steel: { pos: ["/ steel"], neg: [], max: 4 },
  water: { pos: ["water utilities"], neg: [], max: 3 },
  chips: { pos: [], neg: ["semiconductors"], max: 5 },
};

const res = await fetch("https://scanner.tradingview.com/america/scan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    filter: [{ left: "type", operation: "equal", right: "stock" }],
    columns: ["name", "sector", "industry", "market_cap_basic"],
    sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
    range: [0, 800],
  }),
});
const j = await res.json();
const universe = (j.data ?? [])
  .map((r) => ({ sym: String(r.s.split(":").pop()).toUpperCase(), name: String(r.d[0]), sector: String(r.d[1] ?? ""), industry: String(r.d[2] ?? ""), mcap: Number(r.d[3] ?? 0) }))
  .filter((r) => /^[A-Z]{1,4}$/.test(r.sym) && r.mcap >= 5e9); // หุ้นสหรัฐขนาดใหญ่น่าเชื่อถือเท่านั้น

const map = JSON.parse(readFileSync(FILE, "utf8"));
const added = [];
for (const [nodeId, rule] of Object.entries(RULES)) {
  const node = map.nodes.find((n) => n.id === nodeId);
  if (!node) continue;
  const existing = new Set(node.stocks.map((s) => s.ticker.toUpperCase()));
  for (const [dir, inds] of [["positive", rule.pos], ["negative", rule.neg]]) {
    let count = 0;
    for (const u of universe) {
      if (count >= rule.max) break;
      const key = (u.sector + " / " + u.industry).toLowerCase();
      if (!inds.some((k) => key.includes(k))) continue;
      if (existing.has(u.sym)) continue;
      node.stocks.push({
        ticker: u.sym,
        market: "US",
        direction: dir,
        strength: "medium",
        reason: `อุตสาหกรรม "${u.industry}" จับคู่อัตโนมัติจากชื่ออุตสาหกรรม — รีวิวความถูกต้องได้เสมอ`,
      });
      existing.add(u.sym);
      added.push(`${nodeId}: ${u.sym} (${dir}) — ${u.industry}`);
      count++;
    }
  }
}

console.log(`เพิ่ม ${added.length} รายการ:`);
for (const a of added) console.log("  " + a);
const totalStocks = new Set(map.nodes.flatMap((n) => n.stocks.map((s) => s.ticker))).size;
console.log(`รวมหุ้นใน impact-map หลังขยาย: ${totalStocks} ตัว`);
if (!DRY) {
  writeFileSync(FILE, JSON.stringify(map, null, 2) + "\n");
  console.log("✅ เขียนลง", FILE);
} else {
  console.log("(โหมด dry-run ไม่เขียนไฟล์)");
}
