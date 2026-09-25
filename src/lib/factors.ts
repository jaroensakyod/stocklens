// ===== คำนวณคะแนนปัจจัย 5 มิติ (0-100) จากข้อมูลจริงของ Yahoo =====
import type { Candle, FactorDetail, FactorScores } from "./types";

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}
/** แปลงค่า "ยิ่งน้อยยิ่งดี" (เช่น P/E) เป็นคะแนน 0-100 โดยมีเพดาน */
function lowerBetter(v: number, cap: number): number {
  if (!isFinite(v) || v <= 0) return 50; // ค่าติดลบ/ไม่มี = ไม่ช่วยไม่ลงโทษ
  return clamp(100 - (v / cap) * 100);
}
/** แปลงค่า growth/margin (ทศนิยม เช่น 0.15 = 15%) เป็นคะแนน */
function growthScore(v: number, lo = -0.2, hi = 0.5): number {
  if (!isFinite(v)) return 50;
  return clamp(((v - lo) / (hi - lo)) * 100);
}

export function computeFactors(
  p: Record<string, unknown>, // profile (quoteSummary รวม)
  candles: Candle[]
): FactorScores {
  const gaps: string[] = [];
  const details: FactorDetail[] = [];

  const num = (...keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = p[k];
      if (typeof v === "number" && isFinite(v)) return v;
    }
    return undefined;
  };

  // ---------- 1) Valuation ----------
  const parts: number[] = [];
  const pe = num("trailingPE");
  if (pe !== undefined) { parts.push(lowerBetter(pe, 45)); details.push({ label: "P/E (trailing)", value: pe.toFixed(1), score: lowerBetter(pe, 45) }); }
  else gaps.push("P/E");
  const pb = num("priceToBook");
  if (pb !== undefined) { parts.push(lowerBetter(pb, 12)); details.push({ label: "P/B", value: pb.toFixed(1), score: lowerBetter(pb, 12) }); }
  const ps = num("priceToSalesTrailing12Months");
  if (ps !== undefined) { parts.push(lowerBetter(ps, 15)); details.push({ label: "P/S", value: ps.toFixed(1), score: lowerBetter(ps, 15) }); }
  const ev = num("evToEbitda");
  if (ev !== undefined && ev > 0) { parts.push(lowerBetter(ev, 30)); details.push({ label: "EV/EBITDA", value: ev.toFixed(1), score: lowerBetter(ev, 30) }); }
  const valuation = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 50;

  // ---------- 2) Growth ----------
  const g: number[] = [];
  const rg = num("revenueGrowth");
  if (rg !== undefined) { g.push(growthScore(rg)); details.push({ label: "รายได้โต (YoY)", value: (rg * 100).toFixed(1) + "%", score: growthScore(rg) }); }
  else gaps.push("การเติบโตรายได้");
  const eg = num("earningsGrowth");
  if (eg !== undefined) { g.push(growthScore(eg, -0.5, 1)); details.push({ label: "กำไรโต (YoY)", value: (eg * 100).toFixed(1) + "%", score: growthScore(eg, -0.5, 1) }); }
  const growth = g.length ? Math.round(g.reduce((a, b) => a + b, 0) / g.length) : 50;

  // ---------- 3) Profitability ----------
  const pr: number[] = [];
  const margins: [string, number | undefined][] = [
    ["อัตรากำไรขั้นต้น", num("grossMargins")],
    ["อัตรากำไรจากการดำเนินงาน", num("operatingMargins")],
    ["อัตรากำไรสุทธิ", num("profitMargins")],
  ];
  for (const [label, v] of margins) {
    if (v !== undefined) { pr.push(growthScore(v, -0.1, 0.5)); details.push({ label, value: (v * 100).toFixed(1) + "%", score: growthScore(v, -0.1, 0.5) }); }
  }
  const roe = num("returnOnEquity");
  if (roe !== undefined) { pr.push(growthScore(roe, -0.1, 0.4)); details.push({ label: "ROE", value: (roe * 100).toFixed(1) + "%", score: growthScore(roe, -0.1, 0.4) }); }
  else gaps.push("ROE");
  const roa = num("returnOnAssets");
  if (roa !== undefined) { pr.push(growthScore(roa, -0.05, 0.2)); }
  const profitability = pr.length ? Math.round(pr.reduce((a, b) => a + b, 0) / pr.length) : 50;

  // ---------- 4) Momentum (จากกราฟราคาจริง) ----------
  const closes = candles.map((c) => c.close).filter((v) => isFinite(v));
  const m: number[] = [];
  const last = closes[closes.length - 1];
  if (closes.length > 66) {
    const r3m = (last / closes[closes.length - 63] - 1) * 100;
    m.push(growthScore(r3m / 100, -0.3, 0.6)); details.push({ label: "ผลตอบแทน 3 เดือน", value: r3m.toFixed(1) + "%", score: growthScore(r3m / 100, -0.3, 0.6) });
  }
  if (closes.length > 130) {
    const r6m = (last / closes[closes.length - 126] - 1) * 100;
    m.push(growthScore(r6m / 100, -0.3, 0.6)); details.push({ label: "ผลตอบแทน 6 เดือน", value: r6m.toFixed(1) + "%", score: growthScore(r6m / 100, -0.3, 0.6) });
  }
  if (closes.length > 250) {
    const r12m = (last / closes[closes.length - 252] - 1) * 100;
    m.push(growthScore(r12m / 100, -0.3, 0.8)); details.push({ label: "ผลตอบแทน 12 เดือน", value: r12m.toFixed(1) + "%", score: growthScore(r12m / 100, -0.3, 0.8) });
  } else gaps.push("ข้อมูลราคา 12 เดือน");
  const momentum = m.length ? Math.round(m.reduce((a, b) => a + b, 0) / m.length) : 50;

  // ---------- 5) Financial Health ----------
  const h: number[] = [];
  const dte = num("debtToEquity");
  if (dte !== undefined) {
    const sc = clamp(100 - (dte / 200) * 100); // dte มาจาก Yahoo เป็น % (เช่น 150 = 150%)
    h.push(sc); details.push({ label: "หนี้สิน/ส่วนของผู้ถือหุ้น", value: dte.toFixed(0) + "%", score: sc });
  } else gaps.push("Debt/Equity");
  const cr = num("currentRatio");
  if (cr !== undefined) { const sc = clamp((cr / 3) * 100); h.push(sc); details.push({ label: "Current Ratio", value: cr.toFixed(2), score: sc }); }
  const fcf = num("freeCashflow");
  if (fcf !== undefined) {
    const sc = fcf > 0 ? clamp(60 + (Math.log10(Math.max(fcf, 1)) / 11) * 40) : 15;
    h.push(sc); details.push({ label: "กระแสเงินสดอิสระ", value: fcf > 0 ? "+" + formatBig(fcf) : formatBig(fcf), score: sc });
  }
  const cash = num("totalCash"), debt = num("totalDebt");
  if (cash !== undefined && debt !== undefined) {
    const sc = cash > debt ? 85 : 45; h.push(sc);
    details.push({ label: "เงินสด vs หนี้สิน", value: `${formatBig(cash)} / ${formatBig(debt)}`, score: sc });
  }
  const health = h.length ? Math.round(h.reduce((a, b) => a + b, 0) / h.length) : 50;

  const overall = Math.round((valuation + growth + profitability + momentum + health) / 5);

  return { valuation, growth, profitability, momentum, health, overall, details, gaps };
}

export function formatBig(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(2) + " ล้านล้าน";
  if (a >= 1e9) return (v / 1e9).toFixed(2) + " พันล้าน";
  if (a >= 1e6) return (v / 1e6).toFixed(1) + " ล้าน";
  if (a >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toFixed(0);
}
