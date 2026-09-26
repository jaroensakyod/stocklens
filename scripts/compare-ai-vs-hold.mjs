// เทียบ backtest: "ทำตามกฎ AI Advisor ของเรา" vs "ถือเฉยๆ" vs SPY
// ครอบคลุม: หลายพอร์ต + 📌หุ้นแกน + walk-forward หลายหน้าต่างเวลา (ค่าธรรมเนียมหักแล้วในตัว engine)
// ใช้: node scripts/compare-ai-vs-hold.mjs
const BASE = process.env.BASE_URL || "http://localhost:3000";

const PORTFOLIOS = [
  { name: "พอร์ตจริงของสมาชิก (NVDA+PTT+DELTA)", tickers: ["NVDA", "PTT.BK", "DELTA.BK"] },
  { name: "พอร์ตจริง + NVDA เป็น📌หุ้นแกน", tickers: ["NVDA", "PTT.BK", "DELTA.BK"], cores: ["NVDA"] },
  { name: "พอร์ตปกติ mega-cap ผสม", preset: "normal" },
  { name: "พอร์ตซิ่ง โมเมนตัม/ผันผวนสูง", preset: "surge" },
  { name: "พอร์ตปันผลไทย", tickers: ["PTT.BK", "KBANK.BK", "SCC.BK", "AOT.BK", "DELTA.BK"] },
  { name: "พอร์ตหุ้นตกกระแทก (ทดสอบ stop-loss)", tickers: ["INTC", "WBD", "PYPL", "NKE", "BABA"] },
];

// walk-forward: หน้าต่าง 3 ปี จบที่วันนี้ / 1 ปีก่อน / 2 ปีก่อน
const WINDOWS = [
  { label: "3 ปีล่าสุด", endDate: undefined },
  { label: "ย้อนหลังถึง -1 ปี", endDate: new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10) },
  { label: "ย้อนหลังถึง -2 ปี", endDate: new Date(Date.now() - 2 * 365 * 864e5).toISOString().slice(0, 10) },
];

async function run(body) {
  const res = await fetch(BASE + "/api/advisor-backtest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
  return j;
}

console.log("════ 1) หน้าต่างล่าสุด (3 ปี) — ทุกพอร์ต ════\n");
for (const p of PORTFOLIOS) {
  try {
    const j = await run(p.preset ? { preset: p.preset } : { tickers: p.tickers, ...(p.cores ? { cores: p.cores } : {}) });
    console.log(
      `${p.name}\n   ${j.startDate} → ${j.endDate} | 🤖กฎ ${(j.advisor.totalPct).toFixed(1)}% (ค่าธรรมเนียมสะสม ${j.totalFeesPct}%) vs 😴ถือ ${(j.hold.totalPct).toFixed(1)}% vs SPY ${(j.spy.totalPct).toFixed(1)}%` +
      ` | MDD ${j.advisor.maxDrawdownPct}% vs ${j.hold.maxDrawdownPct}% | grade=${j.grade} | ไม้=${j.actionCount}${j.coreTickers?.length ? " | 📌" + j.coreTickers.join(",") : ""}`
    );
  } catch (e) {
    console.log(`${p.name}\n   ✗ ${e.message}`);
  }
}

console.log("\n════ 2) walk-forward พอร์ตจริง (ทุกหน้าต่างเวลา) ════\n");
const memberP = PORTFOLIOS[0];
const coreP = PORTFOLIOS[1];
for (const w of WINDOWS) {
  for (const p of [memberP, coreP]) {
    try {
      const j = await run({ tickers: p.tickers, ...(p.cores ? { cores: p.cores } : {}), ...(w.endDate ? { endDate: w.endDate } : {}) });
      console.log(
        `[${w.label}] ${p.name.includes("หุ้นแกน") ? "📌แกน" : "ปกติ"}: ${j.startDate} → ${j.endDate} | 🤖${(j.advisor.totalPct).toFixed(1)}% vs 😴${(j.hold.totalPct).toFixed(1)}% vs SPY ${(j.spy.totalPct).toFixed(1)}% | fee ${j.totalFeesPct}%`
      );
    } catch (e) {
      console.log(`[${w.label}] ${p.name}: ✗ ${e.message}`);
    }
  }
}
