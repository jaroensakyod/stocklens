import { beforeEach, describe, expect, it, vi } from "vitest";

// mock localStorage + window แบบมี EventTarget จริง (dispatch ต้องเด้งถึง listener)
const store = new Map<string, string>();
const listeners = new Set<(e: Event) => void>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
});
vi.stubGlobal("window", {
  addEventListener: (_: string, h: (e: Event) => void) => listeners.add(h),
  removeEventListener: (_: string, h: (e: Event) => void) => listeners.delete(h),
  dispatchEvent: (e: Event) => {
    listeners.forEach((h) => h(e));
    return true;
  },
});

import { addToBasket, removeFromBasket, getBasket, clearBasket, BASKET_MAX, onBasketChange } from "../compareBasket";

beforeEach(() => {
  store.clear();
});

describe("compareBasket", () => {
  it("เพิ่มได้ + ตัวพิมพ์ใหญ่เสมอ + ซ้ำไม่เพิ่ม", () => {
    expect(addToBasket("nvda")).toBe("added");
    expect(getBasket()).toEqual(["NVDA"]);
    expect(addToBasket("NVDA")).toBe("exists");
    expect(getBasket()).toHaveLength(1);
  });

  it(`เต็ม ${BASKET_MAX} ตัวแล้วปฏิเสธ`, () => {
    ["A", "B", "C", "D"].forEach((t) => expect(addToBasket(t)).toBe("added"));
    expect(addToBasket("E")).toBe("full");
    expect(getBasket()).toHaveLength(BASKET_MAX);
  });

  it("ลบตัว + clear + subscribe ผ่าน onBasketChange", () => {
    addToBasket("AAPL");
    addToBasket("MSFT");
    const seen: string[][] = [];
    const off = onBasketChange((l) => seen.push([...l]));
    removeFromBasket("AAPL");
    expect(getBasket()).toEqual(["MSFT"]);
    clearBasket();
    expect(getBasket()).toEqual([]);
    expect(seen.length).toBeGreaterThan(0);
    off();
  });

  it("ตัวอักษรแปลกๆ ถูกตัดออกตอนอ่านกลับ (กันของเสียใน localStorage)", () => {
    store.set("sl-compare-basket", JSON.stringify(["OK1", "!!bad!!", "TSM.BK"]));
    expect(getBasket()).toEqual(["OK1", "TSM.BK"]);
  });
});
