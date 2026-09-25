// ===== สถานการณ์จำลอง Bull/Base/Bear — คำนวณจากงบจริง (EPS TTM × สมมติ P/E) =====
// หลักการโปร่งใส: ทุกตัวเลขคำนวณจากข้อมูล filings จริง + สมมติฐานที่เขียนกำกับชัดเจน ไม่ใช่การพยากรณ์

export interface Scenario {
  name: "bull" | "base" | "bear";
  label: string;
  targetPrice: number;
  upsidePct: number; // เทียบราคาปัจจุบัน
  assumptions: string;
}

export interface Scenarios {
  epsTtm: number;
  currentPE: number;
  horizon: string;
  scenarios: Scenario[];
  method: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function buildScenarios(
  price: number,
  epsTtm: number,
  currentPE: number,
  revenueGrowth?: number,
  earningsGrowth?: number
): Scenarios | null {
  if (!(price > 0) || !(epsTtm > 0) || !(currentPE > 0)) return null;

  // อัตราโต "ที่ใช้จริง" — เอาด้านที่อนุรักษ์นิยมกว่า (ปกติรายได้โตช้ากว่ากำไร) แล้ว clamp สมเหตุผล
  const g = clamp(revenueGrowth ?? earningsGrowth ?? 0.08, -0.2, 0.5);

  // สมมติ EPS ปีหน้า (horizon 12 เดือน) ต่อสถานการณ์
  const epsBull = epsTtm * (1 + g * 1.4 + 0.05);
  const epsBase = epsTtm * (1 + g * 0.85);
  const epsBear = epsTtm * (1 + Math.min(g, 0) - 0.12);

  // สมมติ P/E ต่อสถานการณ์ (base = คง multiple ปัจจุบัน, bull ขยายเล็กน้อย, bear หดตัว)
  const peBull = currentPE * 1.15;
  const peBase = currentPE;
  const peBear = Math.max(6, currentPE * 0.65);

  const mk = (name: Scenario["name"], label: string, eps: number, pe: number, assumptions: string): Scenario => {
    const targetPrice = eps * pe;
    return { name, label, targetPrice, upsidePct: (targetPrice / price - 1) * 100, assumptions };
  };

  return {
    epsTtm,
    currentPE,
    horizon: "12 เดือน (สมมติ)",
    scenarios: [
      mk("bull", "🐂 Bull — โตเกินคาด + multiple ขยาย", epsBull, peBull, `EPS ×${(1 + g * 1.4 + 0.05).toFixed(2)} (โต ${(clamp(g * 1.4 + 0.05, -0.3, 0.8) * 100).toFixed(0)}%) · P/E ${peBull.toFixed(1)}×`),
      mk("base", "⚖️ Base — โตตามแนวโน้มจริง", epsBase, peBase, `EPS ×${(1 + g * 0.85).toFixed(2)} (โต ${(g * 0.85 * 100).toFixed(0)}%) · P/E คงเดิม ${peBase.toFixed(1)}×`),
      mk("bear", "🐻 Bear — ชะลอ + multiple หด", epsBear, peBear, `EPS ×${(1 + Math.min(g, 0) - 0.12).toFixed(2)} (กำไรลด) · P/E ${peBear.toFixed(1)}×`),
    ],
    method: `ราคาเป้าหมาย = EPS TTM จริง $${epsTtm.toFixed(2)} × สมมติ P/E ต่อสถานการณ์ · อัตราโตอ้างอิงจากงบจริง (${(g * 100).toFixed(1)}%/ปี) · เป็นกรอบสมมติฐานเพื่อการศึกษา ไม่ใช่การพยากรณ์`,
  };
}
