// ทดสอบ AI ปรับพอร์ต: login ด้วยรหัส Pro → POST /api/ai/portfolio-advisor ด้วยพอร์ตจงใจให้เสี่ยง (NVDA หนัก 40%+)
// ใช้: node scripts/test-portfolio-advisor.mjs
const BASE = process.env.BASE_URL || "http://localhost:3000";
const CODE = process.argv[2] || "SL-4DM82T";

const login = await fetch(BASE + "/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: CODE }),
});
if (!login.ok) {
  console.error("login ไม่สำเร็จ:", login.status, await login.text());
  process.exit(1);
}
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
console.log("✅ login สำเร็จในนาม", CODE);

// พอร์ตทดสอบ: จงใจให้ NVDA หนัก ~45% + กระจุก sector เทค + ผสมหุ้นไทย + ทดสอบ 📌หุ้นแกน (NVDA)
const holdings = [
  { ticker: "NVDA", qty: 120, avgCost: 110, core: true }, // ~45% กำไรสูง + ตั้งเป็นหุ้นแกน → กฎต้องไม่สั่งตัด
  { ticker: "AAPL", qty: 40, avgCost: 190 },
  { ticker: "MSFT", qty: 25, avgCost: 380 },
  { ticker: "PTT.BK", qty: 2000, avgCost: 34 }, // หุ้นไทย ปันผล
  { ticker: "DELTA.BK", qty: 100, avgCost: 150 },
];

const t0 = Date.now();
const res = await fetch(BASE + "/api/ai/portfolio-advisor", {
  method: "POST",
  headers: { "Content-Type": "application/json", cookie },
  body: JSON.stringify({ holdings }),
});
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const text = await res.text();
console.log(`\nHTTP ${res.status} · ${secs}s`);
try {
  const j = JSON.parse(text);
  console.log("─".repeat(70));
  console.log("โหมด AI:", j.aiMode, "| มูลค่าพอร์ต: $" + (j.totalValue / 1000).toFixed(1) + "K");
  console.log(`หุ้นใหญ่สุด: ${j.topHolding} ${j.topHoldingPct}% | Sector ใหญ่สุด: ${j.topSector} ${j.topSectorPct}%`);
  console.log("ปัจจัยเฉลี่ย:", JSON.stringify(j.avgFactors), `| เทคนิค: บวก ${j.bullishCount} ลบ ${j.bearishCount} จาก ${j.count} ตัว`);
  console.log("Radar ร้อน:", (j.radarTop ?? []).map((t) => `${t.emoji}${t.name}(${t.heat})`).join(", "));
  console.log("─".repeat(70));
  console.log("คำแนะนำเชิงกฎ (demoAdvice):");
  for (const a of j.demoAdvice ?? []) console.log(`  [${a.tone}] ${a.title}\n      ${a.detail}`);
  console.log("─".repeat(70));
  console.log("AI วิเคราะห์ (aiText):\n" + (j.aiText || "(ว่าง)"));
  if (j.failed?.length) console.log("⚠️ ดึงไม่ได้:", j.failed.join(", "));
} catch {
  console.log(text);
}
