// ===== Balance Score — คะแนนสมดุลพอร์ต 5 มิติ + แผนปรับสมดุล (pure function ใช้ได้ทั้ง client/server) =====
// เทียบแนวคิด "Balance Score" ของคู่แข่ง แต่ของเรารองรับหุ้นไทย+ข้ามตลาด+เงินสด และต่อยอดแผน rebalance ได้จริง

export interface ScoreHolding {
  ticker: string;
  /** มูลค่าตำแหน่ง (สกุลเงินพอร์ต — USD) */
  value: number;
  sector?: string;
  /** คะแนนคุณภาพ 0-100 (จาก factor/buildAnalysis ถ้ามี) */
  quality?: number | null;
  beta?: number | null;
  core?: boolean;
}

export interface ScoreInput {
  holdings: ScoreHolding[];
  /** เงินสดในพอร์ต (USD) */
  cash?: number;
  /** เพดานน้ำหนักต่อกลุ่มอุตสาหกรรม (%) */
  groupCeiling?: number;
  /** เพดานน้ำหนักต่อตัว (%) */
  singleCeiling?: number;
  /** เป้าหมายน้ำหนักต่อตัว (%) — ถ้าผู้ใช้ตั้งไว้ (ใช้ในมิติ "ใกล้เป้า") */
  targets?: Record<string, number>;
}

export interface Dimension { id: string; label: string; score: number; max: number; detail: string }
export interface GroupInfo { name: string; weightPct: number; over: boolean }
export interface Issue { severity: "high" | "mid" | "low"; text: string }

export interface BalanceResult {
  totalValue: number;
  cashPct: number;
  score: number; // 0-100
  grade: "S" | "A" | "B" | "C" | "D";
  dimensions: Dimension[];
  groups: GroupInfo[];
  singles: { ticker: string; weightPct: number; over: boolean; core: boolean }[];
  issues: Issue[];
  effectiveN: number; // จำนวนหุ้นที่ "เทียบเท่า" จาก HHI
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** คำนวณ Balance Score — ทุกมิติผูกน้ำหนักสัมพัทธ์ต่อมูลค่าพอร์ตรวมเงินสด */
export function balanceScore(input: ScoreInput): BalanceResult {
  const groupCeil = input.groupCeiling ?? 35;
  const singleCeil = input.singleCeiling ?? 20;
  const cash = Math.max(0, input.cash ?? 0);
  const holdings = input.holdings.filter((h) => h.value > 0);
  const stockValue = holdings.reduce((a, h) => a + h.value, 0);
  const total = stockValue + cash;
  if (total <= 0) {
    return {
      totalValue: 0, cashPct: 0, score: 0, grade: "D",
      dimensions: [], groups: [], singles: [], issues: [], effectiveN: 0,
    };
  }

  const weights = holdings.map((h) => h.value / total); // รวมเงินสดในฐาน — กระจุกตัวจริงต้องนับเงินสดด้วย
  const n = holdings.length;
  const cashPct = (cash / total) * 100;

  // HHI รายตัว (รวมเงินสดเป็น 1 ตำแหน่ง)
  const hhi = weights.reduce((a, w) => a + w * w, 0) + Math.pow(cash / total, 2);
  const effN = 1 / Math.max(hhi, 1e-9);

  // มิติ 1: การกระจายรายตัว (25) — effN ≥ 10 = เต็ม
  const d1 = clamp((effN / 10) * 25, 0, 25);

  // มิติ 2: การกระจายกลุ่มอุตสาหกรรม (25) — กลุ่มที่มีข้อมูล ≥5 กลุ่มกระจายสม่ำเสมอ = เต็ม
  const groupMap = new Map<string, number>();
  for (const h of holdings) {
    const g = h.sector || "อื่นๆ";
    groupMap.set(g, (groupMap.get(g) ?? 0) + h.value);
  }
  const groupWeights = [...groupMap.values()].map((v) => v / total);
  const hhiG = groupWeights.reduce((a, w) => a + w * w, 0) + Math.pow(cash / total, 2);
  const effG = 1 / Math.max(hhiG, 1e-9);
  const d2 = clamp((effG / 5) * 25, 0, 25);

  // มิติ 3: จำนวนหุ้น (15) — ≥8 ตัว = เต็ม (เกณฑ์เดียวกันทุกตลาด)
  const d3 = clamp((n / 8) * 15, 0, 15);

  // มิติ 4: น้ำหนักใกล้เป้า/ไม่ล้นเพดาน (20)
  let d4: number;
  if (input.targets && Object.keys(input.targets).length >= 2) {
    // มีเป้า: วัดระยะเฉลี่ยจากเป้า (ค่าเต็ม = เฉลี่ยห่าง ≤2%)
    const tks = holdings.map((h) => h.ticker);
    const diffs = tks.map((t) => {
      const cur = (input.targets![t] ?? 0);
      const w = holdings.find((h) => h.ticker === t)!.value / total * 100;
      return Math.abs(cur - w);
    });
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    d4 = clamp(20 - avgDiff * 4, 0, 20);
  } else {
    // ไม่มีเป้า: วัดจากการล้นเพดาน (ตัวเดี่ยว/กลุ่ม) — ยิ่งล้นเยอะยิ่งหัก
    const overSingle = holdings.filter((h) => (h.value / total) * 100 > singleCeil).length;
    const overGroup = [...groupMap.entries()].filter(([, v]) => (v / total) * 100 > groupCeil).length;
    d4 = clamp(20 - overSingle * 5 - overGroup * 4, 0, 20);
  }

  // มิติ 5: คุณภาพและความเสี่ยง (15) — คะแนนคุณภาพเฉลี่ยถ่วงน้ำหนัก + ลงโทษ beta สูงจัด
  const scored = holdings.filter((h) => typeof h.quality === "number");
  const avgQ = scored.length ? scored.reduce((a, h) => a + h.quality! * h.value, 0) / scored.reduce((a, h) => a + h.value, 0) : 50;
  const betas = holdings.filter((h) => typeof h.beta === "number" && h.beta > 0);
  const avgBeta = betas.length ? betas.reduce((a, h) => a + h.beta! * h.value, 0) / betas.reduce((a, h) => a + h.value, 0) : 1;
  const betaPenalty = avgBeta > 1.6 ? 4 : avgBeta > 1.3 ? 2 : 0;
  const d5 = clamp((avgQ / 100) * 15 - betaPenalty, 0, 15);

  const score = Math.round(d1 + d2 + d3 + d4 + d5);
  const grade = score >= 85 ? "S" : score >= 70 ? "A" : score >= 55 ? "B" : score >= 40 ? "C" : "D";

  const groups: GroupInfo[] = [...groupMap.entries()]
    .map(([name, v]) => ({ name, weightPct: (v / total) * 100, over: (v / total) * 100 > groupCeil }))
    .sort((a, b) => b.weightPct - a.weightPct);
  const singles = holdings
    .map((h) => ({ ticker: h.ticker, weightPct: (h.value / total) * 100, over: (h.value / total) * 100 > singleCeil, core: !!h.core }))
    .sort((a, b) => b.weightPct - a.weightPct);

  // ประเด็นที่ควรแก้
  const issues: Issue[] = [];
  for (const g of groups.filter((x) => x.over).slice(0, 3)) {
    issues.push({ severity: "high", text: `กลุ่ม "${g.name}" น้ำหนัก ${g.weightPct.toFixed(1)}% เกินเพดาน ${groupCeil}% — ลดหรือเพิ่มกลุ่มอื่นถ่วง` });
  }
  for (const s of singles.filter((x) => x.over).slice(0, 3)) {
    issues.push({ severity: s.core ? "mid" : "high", text: `${s.ticker} น้ำหนัก ${s.weightPct.toFixed(1)}% เกินเพดาน ${singleCeil}%${s.core ? " (หุ้นแกน — ลดได้น้อยกว่า)" : ""}` });
  }
  if (n < 8) issues.push({ severity: n < 4 ? "high" : "mid", text: `ถือ ${n} ตัว — น้อยกว่าเกณฑ์กระจาย 8 ตัว (ความเสี่ยงกระจุกตัวสูง)` });
  if (cashPct > 40) issues.push({ severity: "low", text: `เงินสดกินพื้นที่ ${cashPct.toFixed(0)}% ของพอร์ต — idle cash ทับถมโอกาสระยะยาว` });
  if (avgBeta > 1.6) issues.push({ severity: "mid", text: `พอร์ตผันผวนแรงกว่าตลาด (beta ~${avgBeta.toFixed(2)}) — เหมาะสายรับความเสี่ยงสูงเท่านั้น` });
  if (!issues.length) issues.push({ severity: "low", text: "ผ่านทุกเกณฑ์ — ไม่พบจุดเกินเพดานที่ตั้งไว้" });

  return {
    totalValue: total,
    cashPct,
    score,
    grade,
    dimensions: [
      { id: "single", label: "การกระจายรายตัว", score: d1, max: 25, detail: `จำนวนหุ้นเทียบเท่า ${effN.toFixed(1)} ตัว (HHI ${hhi.toFixed(3)}) — เต็มที่ 10 ตัวเทียบเท่า` },
      { id: "group", label: "การกระจายกลุ่มอุตสาหกรรม", score: d2, max: 25, detail: `กระจายอยู่ใน ${groupMap.size} กลุ่ม (เทียบเท่า ${effG.toFixed(1)} กลุ่ม) — เต็มที่ 5 กลุ่มเทียบเท่า` },
      { id: "count", label: "จำนวนหุ้นในพอร์ต", score: d3, max: 15, detail: `ถือ ${n} ตัว จากเป้าอย่างน้อย 8 ตัว` },
      { id: "target", label: "น้ำหนักใกล้เป้า/เพดาน", score: d4, max: 20, detail: input.targets ? "วัดระยะจากเป้าหมายที่ตั้งไว้" : `วัดจากการล้นเพดาน ตัว ${singleCeil}% / กลุ่ม ${groupCeil}%` },
      { id: "quality", label: "คุณภาพและความเสี่ยง", score: d5, max: 15, detail: `คุณภาพเฉลี่ยถ่วงน้ำหนัก ${avgQ.toFixed(0)}/100${avgBeta > 1.3 ? ` · beta ${avgBeta.toFixed(2)}` : ""}` },
    ],
    groups,
    singles,
    issues,
    effectiveN: effN,
  };
}

// ===== แผนปรับสมดุล =====
export type TargetMode = "equal" | "mcap" | "custom";

export interface PlanRow {
  ticker: string;
  currentPct: number;
  targetPct: number;
  /** + = ซื้อเพิ่ม (USD), - = ขายออก */
  deltaUsd: number;
  reason: string;
}

export interface RebalancePlan {
  rows: PlanRow[];
  /** คะแนนสมดุลหลังจำลองปรับตามแผน */
  projectedScore: number;
  projectedGrade: string;
  projectedGroups: GroupInfo[];
}

/** สร้างแผนปรับสมดุล: target = equal/mcap/custom(targets) → บังคับเพดานตัว → คำนวณเงินซื้อ-ขาย */
export function rebalancePlan(input: ScoreInput & { mode: TargetMode; mcaps?: Record<string, number> }): RebalancePlan {
  const cash = Math.max(0, input.cash ?? 0);
  const holdings = input.holdings.filter((h) => h.value > 0);
  const total = holdings.reduce((a, h) => a + h.value, 0) + cash;
  const singleCeil = input.singleCeiling ?? 20;
  const groupCeil = input.groupCeiling ?? 35;
  const n = holdings.length;
  if (!n || total <= 0) return { rows: [], projectedScore: 0, projectedGrade: "D", projectedGroups: [] };

  // 1) เป้าหมายดิบ
  let targetPct: Record<string, number> = {};
  if (input.mode === "equal") {
    const t = 100 / n;
    for (const h of holdings) targetPct[h.ticker] = t;
  } else if (input.mode === "mcap" && input.mcaps) {
    let sum = 0;
    const m: Record<string, number> = {};
    for (const h of holdings) {
      const mc = input.mcaps[h.ticker] ?? 0;
      m[h.ticker] = mc;
      sum += mc;
    }
    if (sum > 0) for (const h of holdings) targetPct[h.ticker] = (m[h.ticker] / sum) * 100;
    else {
      const t = 100 / n;
      for (const h of holdings) targetPct[h.ticker] = t;
    }
  } else if (input.mode === "custom" && input.targets) {
    targetPct = { ...input.targets };
  } else {
    const t = 100 / n;
    for (const h of holdings) targetPct[h.ticker] = t;
  }

  // 2) บังคับเพดานต่อตัว (หุ้นแกนยืดหยุ่น +50% ของเพดาน) แล้ว normalize
  for (let iter = 0; iter < 3; iter++) {
    for (const h of holdings) {
      const cap = h.core ? singleCeil * 1.5 : singleCeil;
      if (targetPct[h.ticker] > cap) targetPct[h.ticker] = cap;
    }
    const sum = holdings.reduce((a, h) => a + targetPct[h.ticker], 0);
    if (sum <= 0) break;
    for (const h of holdings) targetPct[h.ticker] = (targetPct[h.ticker] / sum) * 100;
  }

  // 3) แผนซื้อ-ขาย (เทียบกับฐานหุ้นอย่างเดียว เงินสดคงไว้)
  const rows: PlanRow[] = holdings
    .map((h) => {
      const cur = (h.value / total) * 100;
      const tgt = targetPct[h.ticker];
      const deltaUsd = ((tgt - cur) / 100) * total;
      return {
        ticker: h.ticker,
        currentPct: cur,
        targetPct: tgt,
        deltaUsd,
        reason: deltaUsd > 0 ? "ซื้อเพิ่มตามสัดส่วนเป้าหมาย" : deltaUsd < 0 ? "ลดน้ำหนักลงสัดส่วนเป้าหมาย" : "คงสัดส่วน",
      };
    })
    .filter((r) => Math.abs(r.deltaUsd) > 1)
    .sort((a, b) => b.deltaUsd - a.deltaUsd);

  // 4) จำลองคะแนนหลังปรับ
  const after = holdings.map((h) => ({ ...h, value: h.value + (targetPct[h.ticker] - (h.value / total) * 100) / 100 * total })).filter((h) => h.value > 0);
  const proj = balanceScore({ ...input, holdings: after });
  return { rows, projectedScore: proj.score, projectedGrade: proj.grade, projectedGroups: proj.groups };
}
