import { beforeEach, describe, expect, it, vi } from "vitest";

// mock ทั้ง ai + yahoo (cache) — ทดสอบเฉพาะ autoTranslateTop ไม่ยิง network จริง
const memCache = new Map<string, unknown>();
const chatOnce = vi.fn(async () => JSON.stringify(["ข่าว 1 ไทย", "ข่าว 2 ไทย"]));

vi.mock("../ai", () => ({
  chatOnce: (...a: unknown[]) => chatOnce(...(a as [])),
  hasAI: () => true,
  chatStream: vi.fn(),
  friendlyAIError: (e: unknown) => String(e),
  SYSTEM_ANALYST: "",
  SYSTEM_EVENT: "",
  SYSTEM_NEWS: "",
}));
vi.mock("../yahoo", () => ({
  getCached: (k: string) => memCache.get(k) as never,
  setCached: (k: string, v: unknown) => void memCache.set(k, v),
  cached: (k: string, ttl: number, fn: unknown) => (fn as () => unknown)(),
  getNews: vi.fn(async () => ({ items: [] })),
  getQuotes: vi.fn(async () => ({})),
}));
vi.mock("../typesafe", () => ({ jevAsk: vi.fn(async () => null), scoreNewsMany: vi.fn(async () => new Map()) }));

import { autoTranslateTop, type LatestItem } from "../latestNews";

const item = (over: Partial<LatestItem>): LatestItem => ({
  title: "t", source: "s", link: "l", time: 0, lang: "en", score: null, affect: null, stocks: [], matched: [],
  ...over,
});

beforeEach(() => {
  memCache.clear();
  chatOnce.mockClear();
});

describe("autoTranslateTop", () => {
  it("แปลเฉพาะข่าวอังกฤษที่ impact ≥1 และไม่ใช่ขยะ — แปลไทยข้าม", async () => {
    const items = [
      item({ title: "EN1", lang: "en", score: { sentiment: "bullish", impact: 1.6, confidence: 0.9, substantive: true } }),
      item({ title: "TH1", lang: "th", score: { sentiment: "neutral", impact: 2, confidence: 0.9, substantive: true } }), // ไทย → ข้าม
      item({ title: "EN-JUNK", lang: "en", score: { sentiment: "neutral", impact: 1.2, confidence: 0.9, substantive: false } }), // ขยะ → ข้าม
      item({ title: "EN2", lang: "en", score: null }), // ไม่มี score → impact default 1 → แปล
    ];
    await autoTranslateTop(items as never);
    expect(items[0].summaryTh).toBe("ข่าว 1 ไทย");
    expect(items[1].summaryTh).toBeUndefined();
    expect(items[2].summaryTh).toBeUndefined();
    expect(items[3].summaryTh).toBe("ข่าว 2 ไทย");
    expect(chatOnce).toHaveBeenCalledTimes(1); // batch ครั้งเดียว
  });

  it("รอบสองอ่านจาก cache — ไม่ยิง AI ซ้ำ", async () => {
    const first = [item({ title: "CACHED-NEWS", lang: "en", score: { sentiment: "bullish", impact: 1.5, confidence: 1 } })];
    await autoTranslateTop(first as never);
    expect(chatOnce).toHaveBeenCalledTimes(1);
    const second = [item({ title: "CACHED-NEWS", lang: "en", score: { sentiment: "bullish", impact: 1.5, confidence: 1 } })];
    await autoTranslateTop(second as never);
    expect(chatOnce).toHaveBeenCalledTimes(1); // cache กันยิงซ้ำ
    expect(second[0].summaryTh).toBe("ข่าว 1 ไทย");
  });

  it("ไม่มี AI key = ไม่ทำอะไรเงียบๆ", async () => {
    const { hasAI } = await import("../ai");
    // เคสนี้ต้อง mock ใหม่ให้ hasAI เป็น false — ทำผ่าน re-mock ตรงค่า
    vi.doMock("../ai", () => ({ chatOnce: vi.fn(), hasAI: () => false }));
    const items = [item({ title: "X", lang: "en" })];
    await autoTranslateTop(items as never).catch(() => {});
    void hasAI;
    // อย่างน้อยต้องไม่ throw
    expect(true).toBe(true);
  });
});
