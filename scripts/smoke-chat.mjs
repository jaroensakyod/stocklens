// Smoke test แชท AI — ยิงคำถามจริงผ่าน /api/chat แล้วดู intent/ticker ที่ router ตีความ (headers X-Intents/X-Tickers)
// ใช้: node scripts/smoke-chat.mjs [รหัสสมาชิก] เช่น node scripts/smoke-chat.mjs SL-4DM82T
// ระวัง rate-limit AI 20 ครั้ง/5 นาที (ตัวนี้ยิง 12 คำถาม)
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
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");

const tests = [
  ["ชื่อบริษัทอังกฤษ", "Apple ตอนนี้เป็นยังไง"],
  ["ชื่อบริษัทไทย", "ปตท. น่าดูไหม"],
  ["PTT ไม่มี .BK (retry)", "PTT น่าดูไหม"],
  ["เทียบ 2 ตัว", "NVDA กับ AMD ตัวไหนดีกว่า"],
  ["ตลาดวันนี้", "วันนี้มีอะไรน่าสนใจ"],
  ["กูรู 13F", "บัฟเฟต์ถืออะไรอยู่"],
  ["backtest", "NVDA ถ้าใช้กลยุทธ์ RSI ย้อนหลัง 5 ปี ได้ผลไง"],
  ["หุ้นซิ่ง", "หุ้นซิ่งวันนี้มีตัวไหน"],
  ["ปันผล/ระยะยาว", "หุ้นปันผลต่างชาติตัวไหนน่าสนใจ"],
  ["เหตุการณ์→ห่วงโซ่", "ฝนตกหนักที่แอฟริกา กระทบหุ้นอะไร"],
  ["โบรก", "TSM ซื้อผ่านที่ไหนได้"],
  ["ทั่วไป (ไม่ต้องมีข้อมูล)", "P/E คืออะไร อธิบายง่ายๆ"],
  ["พอร์ต (ส่ง holdings)", "วิเคราะห์พอร์ตฉันหน่อย", [{ ticker: "NVDA", qty: 10, avgCost: 150 }, { ticker: "PTT.BK", qty: 1000, avgCost: 30 }]],
  ["watchlist (ส่งรายการ)", "วอตช์ลิสต์ฉันเป็นไงบ้าง", null, ["NVDA", "AAPL", "PTT.BK"]],
  ["มือใหม่ขอพอร์ต", "มือใหม่ครับ มีเงิน 1 หมื่นบาท จัดพอร์ตให้หน่อย"],
];

const which = process.argv[3] ? process.argv[3].split(",").map(Number) : tests.map((_, i) => i);
for (const i of which) {
  const [label, q, portfolio, watchlist] = tests[i];
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ messages: [{ role: "user", content: q }], ...(portfolio ? { portfolio } : {}), ...(watchlist ? { watchlist } : {}) }),
    });
    const text = await res.text();
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n[${i} ${label}] HTTP ${res.status} · ${secs}s · intents=${res.headers.get("x-intents") ?? "?"} · tickers=${res.headers.get("x-tickers") ?? "-"} · mode=${res.headers.get("x-ai-mode") ?? "?"}`);
    console.log("   " + text.slice(0, 160).replace(/\n/g, " ⏎ "));
  } catch (e) {
    console.log(`\n[${i} ${label}] ERROR: ${e.message}`);
  }
}
