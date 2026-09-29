import { describe, expect, it } from "vitest";
import { blackScholes, impliedVol } from "../optionChain";

// ค่ามาตรฐาน — คำนวณจากสูตร BS โดยตรงและยืนยันด้วย put-call parity (self-consistent golden test)
// S=100, K=100, T=0.5, r=5%, σ=20%: d1=0.2475, d2=0.1061
// N(d1)=0.5977, N(d2)=0.5422 → C=100×0.5977−100×e^(−0.025)×0.5422 ≈ 6.890
describe("blackScholes", () => {
  const S = 100, K = 100, T = 0.5, r = 0.05, sigma = 0.2;

  it("call price ≈ 6.890 (S=100,K=100,T=0.5,r=5%,σ=20%)", () => {
    const bs = blackScholes("call", S, K, T, r, sigma);
    expect(bs.price).toBeCloseTo(6.890, 2);
  });

  it("put price ≈ 4.420 (put-call parity: P = C - S + Ke^(-rT))", () => {
    const bs = blackScholes("put", S, K, T, r, sigma);
    expect(bs.price).toBeCloseTo(4.420, 1);
  });

  it("delta call ≈ 0.598 · delta put ≈ -0.402 (delta_put = delta_call - 1)", () => {
    const c = blackScholes("call", S, K, T, r, sigma);
    const p = blackScholes("put", S, K, T, r, sigma);
    expect(c.delta).toBeCloseTo(0.598, 2);
    expect(p.delta).toBeCloseTo(-0.402, 2);
  });

  it("put-call parity: C - P = S - K·e^(-rT)", () => {
    const c = blackScholes("call", S, K, T, r, sigma);
    const p = blackScholes("put", S, K, T, r, sigma);
    expect(c.price - p.price).toBeCloseTo(S - K * Math.exp(-r * T), 2);
  });

  it("deep ITM call delta → 1, deep OTM → 0", () => {
    expect(blackScholes("call", 100, 50, 0.5, 0.05, 0.3).delta).toBeGreaterThan(0.95);
    expect(blackScholes("call", 100, 200, 0.5, 0.05, 0.3).delta).toBeLessThan(0.05);
  });

  it("หมดอายุ/σ=0 → คืน intrinsic", () => {
    expect(blackScholes("call", 120, 100, 0, 0.05, 0.2).price).toBe(20);
    expect(blackScholes("put", 90, 100, 0, 0.05, 0.2).price).toBe(10);
    expect(blackScholes("call", 90, 100, 0.5, 0.05, 0).price).toBe(0);
  });
});

describe("impliedVol (Newton-Raphson ถอยกลับ)", () => {
  it("สร้างราคาด้วย σ=0.35 → ถอยกลับได้ ≈ 0.35", () => {
    const S = 100, K = 105, T = 0.1, r = 0.045;
    const target = blackScholes("call", S, K, T, r, 0.35).price;
    const iv = impliedVol("call", S, K, T, r, target);
    expect(iv).not.toBeNull();
    expect(iv!).toBeCloseTo(0.35, 1); // แม่น ±0.05
  });

  it("สร้างราคาด้วย σ=0.80 (IV สูงจัด) → ถอยกลับได้ ≈ 0.80", () => {
    const S = 50, K = 50, T = 0.05, r = 0.045;
    const target = blackScholes("put", S, K, T, r, 0.8).price;
    const iv = impliedVol("put", S, K, T, r, target);
    expect(iv).not.toBeNull();
    expect(iv!).toBeGreaterThan(0.6);
    expect(iv!).toBeLessThan(1.0);
  });

  it("ราคาต่ำกว่า intrinsic = ข้อมูลเสีย → null", () => {
    expect(impliedVol("call", 100, 90, 0.1, 0.045, 5)).toBeNull(); // intrinsic ≈ 10 → ราคา 5 เสีย
  });
});
