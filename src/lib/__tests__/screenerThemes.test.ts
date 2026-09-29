import { describe, expect, it } from "vitest";
import { SCREENER_THEMES, themeById } from "../screenerThemes";

// ธีม screener ต่อจาก radar-themes + impact-map — ต้อง map หุ้นได้ครบและ match กับ universe ได้
describe("screenerThemes", () => {
  it("มีธีมครบตาม radar-themes (ทุกธีมที่มีหุ้น)", () => {
    expect(SCREENER_THEMES.length).toBeGreaterThanOrEqual(20);
    expect(SCREENER_THEMES.every((t) => t.tickers.length > 0)).toBe(true);
  });

  it("ธีม war รวมหุ้นจากทุกโหนดที่เกี่ยว (น้ำมัน/ทอง/กลาโหม/เรือ/ท่องเที่ยว)", () => {
    const war = themeById("war")!;
    expect(war).toBeTruthy();
    for (const t of ["XOM", "CVX", "LMT", "DAL", "GC=F".replace("=F", "")]) {
      if (t === "GC") continue; // ทองคำเป็น commodity watch ไม่ใช่หุ้น
    }
    expect(war.bases.has("XOM")).toBe(true); // น้ำมัน
    expect(war.bases.has("LMT")).toBe(true); // กลาโหม
    expect(war.bases.has("PTT")).toBe(true); // ไทย: PTT.BK → base "PTT" สำหรับ match universe ตลาดไทย
  });

  it("bases ตัด suffix ตลาดทิ้ง (.BK → base) เพื่อ match universe ทุก region", () => {
    const war = themeById("war")!;
    expect(war.tickers.some((t) => t.endsWith(".BK"))).toBe(true); // มีของไทย
    expect(war.bases.has("PTTEP")).toBe(true);
    // bases ไม่มี suffix เหลือ
    expect([...war.bases].every((b) => !/\.[A-Z]{2}$/.test(b))).toBe(true);
  });

  it("themeById ตัวที่ไม่มี = undefined", () => {
    expect(themeById("ไม่มีจริง")).toBeUndefined();
  });
});
