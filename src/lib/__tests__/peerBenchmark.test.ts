import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TvRow } from "../../lib/tvscanner";

// mock ทั้ง tvscanner — peerBenchmark ต้องไม่ยิง network เด็ดขาดตอนทดสอบ
vi.mock("../../lib/tvscanner", () => {
  const state: { me: TvRow | null; universe: TvRow[] } = { me: null, universe: [] };
  const row = (over: Partial<TvRow>): TvRow => ({
    symbol: "X", name: "X", price: 100, changePct: 0, mcap: 1e10, sector: "Tech", industry: "Chips",
    exchange: "TEST", ipoDate: null, premarketPct: null, dividendYield: null, country: "US",
    ...over,
  } as TvRow);
  return {
    TV_REGIONS: [{ id: "america", label: "US", flag: "🇺🇸", minCap: 0 }],
    findTvRow: vi.fn(async () => (state.me ? { row: state.me, region: "america" } : null)),
    tvUniverse: vi.fn(async () => state.universe),
    __setState: (s: typeof state) => Object.assign(state, s),
    __row: row,
  };
});

import { peerBenchmark } from "../peerBenchmark";
// ต้อง import หลัง vi.mock
const mocked = await import("../../lib/tvscanner") as unknown as {
  __setState: (s: { me: TvRow | null; universe: TvRow[] }) => void;
  __row: (over: Partial<TvRow>) => TvRow;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("peerBenchmark (scope=market)", () => {
  it("คำนวณ median/percentile ถูก + จัดเกรดได้", async () => {
    // ME: pe 10 (ถูกกว่ากลุ่ว), roe 50 (สูงกว่าทุกตัว)
    const me = mocked.__row({ symbol: "ME", pe: 10, roe: 50, perfY: 10 });
    // peers 10 ตัว: pe 20..29 (ค่ากลาง 24.5), roe 10..19 (ค่ากลาง 14.5)
    const peers = Array.from({ length: 10 }, (_, i) =>
      mocked.__row({ symbol: `P${i}`, pe: 20 + i, roe: 10 + i, perfY: 5 + i })
    );
    mocked.__setState({ me, universe: peers });
    const r = await peerBenchmark("ME", "market");
    if (!r || "error" in r) throw new Error("ไม่ควร error");
    expect(r.peerCount).toBe(10);
    expect(r.matchLevel).toBe("industry");
    const pe = r.groups.find((g) => g.id === "valuation")!.metrics.find((m) => m.key === "pe")!;
    expect(pe.median).toBe(24.5);
    expect(pe.better).toBe(true); // 10 < 24.5 = ถูกกว่ากลุ่ม
    const roe = r.groups.find((g) => g.id === "profitability")!.metrics.find((m) => m.key === "roe")!;
    expect(roe.percentile).toBe(100); // 50 สูงกว่า peers ทุกตัว
    expect(r.overall).not.toBeNull();
    expect(["S", "A", "B", "C", "D"]).toContain(r.grade);
  });

  it("peers ใน industry น้อย (<8) → fallback ไป sector เดียวกัน", async () => {
    const me = mocked.__row({ symbol: "ME", sector: "Energy", industry: "Rare-Sub", pe: 10, roe: 20 });
    const sameIndustry = [mocked.__row({ symbol: "I1", sector: "Energy", industry: "Rare-Sub", pe: 20, roe: 10 })];
    const sameSector = Array.from({ length: 9 }, (_, i) => mocked.__row({ symbol: `S${i}`, sector: "Energy", industry: `Other-${i}`, pe: 15 + i, roe: 8 + i }));
    mocked.__setState({ me, universe: [...sameIndustry, ...sameSector] });
    const r = await peerBenchmark("ME", "market");
    if (!r || "error" in r) throw new Error("ไม่ควร error");
    expect(r.matchLevel).toBe("sector");
    expect(r.peerCount).toBe(10); // I1 + sameSector 9 ตัว (นับทั้ง industry เดิมที่อยู่ใน sector เดียวกัน)
  });

  it("peers ไม่ถึง 3 ตัว = คืน error แบบสุภาพ (ไม่ throw)", async () => {
    const me = mocked.__row({ symbol: "ME", industry: "Lonely" });
    mocked.__setState({ me, universe: [mocked.__row({ symbol: "A", industry: "Lonely" }), mocked.__row({ symbol: "B", industry: "Lonely" })] });
    const r = await peerBenchmark("ME", "market");
    expect(r && "error" in r).toBe(true);
  });

  it("ไม่เจอหุ้นใน universe = error", async () => {
    mocked.__setState({ me: null, universe: [] });
    const r = await peerBenchmark("GHOST", "market");
    expect(r && "error" in r).toBe(true);
  });
});
