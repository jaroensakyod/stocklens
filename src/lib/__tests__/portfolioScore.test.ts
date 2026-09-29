import { describe, expect, it } from "vitest";
import { balanceScore, rebalancePlan, type ScoreHolding } from "../portfolioScore";

const h = (ticker: string, value: number, extra: Partial<ScoreHolding> = {}): ScoreHolding => ({
  ticker, value, sector: "Tech", quality: 70, beta: 1, ...extra,
});

describe("balanceScore", () => {
  it("พอร์ตว่าง = 0 คะแนน เกรด D", () => {
    const r = balanceScore({ holdings: [] });
    expect(r.score).toBe(0);
    expect(r.grade).toBe("D");
    expect(r.totalValue).toBe(0);
  });

  it("กระจุก 1 ตัว 100% = คะแนนต่ำ + ปัญหาจำนวนหุ้น + ล้นเพดานตัว", () => {
    const r = balanceScore({ holdings: [h("NVDA", 100_000)] });
    expect(r.score).toBeLessThan(40);
    expect(r.singles[0].over).toBe(true); // 100% > เพดาน 20%
    expect(r.issues.some((i) => i.text.includes("น้อยกว่าเกณฑ์กระจาย 8 ตัว"))).toBe(true);
    expect(r.effectiveN).toBeLessThan(2);
  });

  it("กระจาย 10 ตัว 5 กลุ่ม = คะแนนสูง (≥70)", () => {
    const sectors = ["Tech", "Finance", "Energy", "Health", "Consumer"];
    const holdings = Array.from({ length: 10 }, (_, i) =>
      h(`S${i}`, 10_000, { sector: sectors[i % 5], quality: 80, beta: 1 })
    );
    const r = balanceScore({ holdings });
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.grade === "S" || r.grade === "A").toBe(true);
    expect(r.groups).toHaveLength(5);
    expect(r.groups.every((g) => !g.over)).toBe(true); // 20% ต่อกลุ่ม < เพดาน 35%
  });

  it("เพดาน: ตัวเดียว 30% โดนทำเครื่องหมาย over + ปัญหาเตือน", () => {
    const holdings = [h("BIG", 30_000), h("A", 10_000), h("B", 10_000), h("C", 10_000), h("D", 10_000), h("E", 10_000), h("F", 10_000), h("G", 10_000)];
    const r = balanceScore({ holdings, singleCeiling: 20 });
    expect(r.singles[0].ticker).toBe("BIG");
    expect(r.singles[0].over).toBe(true);
    expect(r.issues.some((i) => i.text.includes("BIG"))).toBe(true);
  });

  it("เงินสดกิน >40% = ปัญหา idle cash", () => {
    const holdings = Array.from({ length: 9 }, (_, i) => h(`S${i}`, 10_000));
    const r = balanceScore({ holdings, cash: 100_000 }); // หุ้น 90k vs เงินสด 100k ≈ 52.6%
    expect(r.cashPct).toBeGreaterThan(40);
    expect(r.issues.some((i) => i.text.includes("เงินสด"))).toBe(true);
  });

  it("มิติคุณภาพ: beta สูงจัดถูกหักคะแนน", () => {
    const calm = balanceScore({ holdings: Array.from({ length: 9 }, (_, i) => h(`S${i}`, 10_000, { beta: 0.8 })) });
    const wild = balanceScore({ holdings: Array.from({ length: 9 }, (_, i) => h(`S${i}`, 10_000, { beta: 2.2 })) });
    const dim = (r: ReturnType<typeof balanceScore>) => r.dimensions.find((d) => d.id === "quality")!.score;
    expect(dim(wild)).toBeLessThan(dim(calm));
    expect(wild.issues.some((i) => i.text.includes("beta"))).toBe(true);
  });
});

describe("rebalancePlan", () => {
  it("โหมดเท่ากัน: delta รวม ≈ 0 + projectedScore คำนวณได้", () => {
    const holdings = [h("A", 50_000, { sector: "Tech" }), h("B", 30_000, { sector: "Finance" }), h("C", 10_000, { sector: "Energy" }), h("D", 10_000, { sector: "Health" })];
    const plan = rebalancePlan({ holdings, mode: "equal" });
    const sum = plan.rows.reduce((a, r) => a + r.deltaUsd, 0);
    expect(Math.abs(sum)).toBeLessThan(1); // ซื้อเท่าขาย
    expect(plan.projectedScore).toBeGreaterThan(0);
    expect(plan.projectedGrade).toBeTruthy();
  });

  it("โหมด mcap: หุ้น mcap ใหญ่ได้เป้ามากกว่า", () => {
    const holdings = [h("SMALL", 10_000), h("BIG", 10_000)];
    const plan = rebalancePlan({ holdings, mode: "mcap", mcaps: { SMALL: 1e9, BIG: 100e9 } });
    const big = plan.rows.find((r) => r.ticker === "BIG")!;
    const small = plan.rows.find((r) => r.ticker === "SMALL")!;
    expect(big.targetPct).toBeGreaterThan(small.targetPct);
  });

  it("เพดานต่อตัว: หุ้นแกน (core) ยืดได้ 1.5 เท่าของเพดานปกติ + ตัวอื่นรับน้ำหนักส่วนเกิน", () => {
    // 7 ตัว (ปกติ 6 + แกน 1) → เพดานรวม 6×20+30=130% เป็นไปได้ → water-filling ทำงาน
    const holdings = [
      h("CORE", 10_000, { core: true }),
      ...["A", "B", "C", "D", "E", "F"].map((t) => h(t, 10_000)),
    ];
    const plan = rebalancePlan({ holdings, mode: "mcap", mcaps: { CORE: 100e9, A: 1e9, B: 1e9, C: 1e9, D: 1e9, E: 1e9, F: 1e9 }, singleCeiling: 20 });
    const core = plan.rows.find((r) => r.ticker === "CORE")!;
    expect(core.targetPct).toBeLessThanOrEqual(20 * 1.5 + 0.01); // CORE ถูกตรึง ≤30%
    expect(core.targetPct).toBeGreaterThanOrEqual(20 * 1.5 - 2); // และถึงเพดานจริง (~30)
    // ส่วนเกินกระจายไปตัวอื่น (สัดส่วนเท่ากัน ≈ (100-30)/6 ≈ 11.7)
    const others = plan.rows.filter((r) => r.ticker !== "CORE");
    others.forEach((r) => {
      expect(r.targetPct).toBeGreaterThan(5);
      expect(r.targetPct).toBeLessThanOrEqual(20 + 0.01);
    });
    // เป้ารวมยังเป็น 100 (แผนไม่รั่ว)
    const sum = plan.rows.reduce((a, r) => a + r.targetPct, 0);
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.5);
  });
});
