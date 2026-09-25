// ===== ไทม์แมชชีน: ย้อนเวลาไปทำนายเหตุการณ์จริง แล้วเทียบกับราคาจริงที่เกิดขึ้น =====
import eventsJson from "@/data/historical-events.json";
import { getChart } from "./yahoo";
import { keywordAnalyze } from "./radar";

export interface HistEvent {
  id: string;
  date: string;
  horizonDays: number;
  title: string;
  context: string;
  instruments: { symbol: string; name: string }[];
}

export const HIST_EVENTS = (eventsJson as { events: HistEvent[] }).events;

export type Direction = "up" | "down" | "flat";

export interface ActualResult {
  pct: number;
  direction: Direction;
  fromPrice: number;
  toPrice: number;
}

/** ผลจริง: ราคาปิดวันเหตุการณ์ → ราคาปิดหลัง horizon วัน (จากกราฟราคาจริงรายวัน) */
export async function computeActual(symbol: string, date: string, horizonDays: number): Promise<ActualResult | null> {
  const candles = await getChart(symbol, "5YD");
  if (!candles.length) return null;
  const startTs = new Date(date + "T00:00:00Z").getTime() / 1000;
  const endTs = startTs + horizonDays * 86400;
  let i0 = candles.findIndex((c) => c.time >= startTs);
  if (i0 < 0) return null;
  // ปรับ i0 ไปวันซื้อขายถัดไปถ้าหากันเกิน 5 วัน (วันหยุดยาว)
  let i1 = -1;
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].time <= endTs) { i1 = i; break; }
  }
  if (i1 < 0 || i1 <= i0) {
    // เหตุการณ์ใกล้ปัจจุบันเกิน — ใช้วันสุดท้าย
    i1 = candles.length - 1;
    if (i1 <= i0) return null;
  }
  const from = candles[i0].close, to = candles[i1].close;
  const pct = (to / from - 1) * 100;
  return { pct, direction: pct > 3 ? "up" : pct < -3 ? "down" : "flat", fromPrice: from, toPrice: to };
}

export interface RadarPrediction {
  direction: Direction;
  magnitude: "weak" | "medium" | "strong";
  viaNode: string;
}

/** ทำนายด้วย "Radar บริสุทธิ์" — จับคีย์เวิร์ดจากบริบท as-of → ห่วงโซ่ impact-map (ไม่มีทางรู้อนาคต) */
export async function radarPredict(event: HistEvent): Promise<Map<string, RadarPrediction>> {
  const out = new Map<string, RadarPrediction>();
  // โฟกัส: chain ที่เกี่ยวข้องกับตราสารที่จะทำนายมาก่อน (ใช้เฉพาะชื่อตราสาร ไม่ใช่ผลลัพธ์)
  const analysis = await keywordAnalyze(event.context, event.instruments.map((i) => i.symbol));
  for (const chain of analysis.chains) {
    for (const s of chain.stocks) {
      const dir: Direction = s.direction === "positive" ? "up" : "down";
      const mag = s.strength === "strong" ? "strong" : s.strength === "medium" ? "medium" : "weak";
      // ถ้าหุ้นโผล่หลาย chain — เอาอันแรงสุด
      const prev = out.get(s.ticker);
      if (!prev || (mag === "strong" && prev.magnitude !== "strong")) {
        out.set(s.ticker, { direction: dir, magnitude: mag, viaNode: chain.name });
      }
    }
    // สินค้าโภคภัณฑ์ของ chain เอง (เช่น CC=F, CL=F) — ทิศ "ขึ้น" ตามสมมติฐาน upReason
    if (chain.yahoo && !out.has(chain.yahoo)) {
      out.set(chain.yahoo, { direction: "up", magnitude: "strong", viaNode: chain.name + " (ตัวสินค้าเอง)" });
    }
  }
  return out;
}

export function scorePrediction(pred: { direction: Direction }, actual: { direction: Direction; pct: number }): number {
  if (pred.direction === actual.direction) return 1;
  const sign = (d: Direction) => (d === "down" ? -1 : d === "up" ? 1 : 0);
  // ผลจริงอยู่ในแถบ noise (±3%) — ทิศถูกแต่แรงไม่พอ = ครึ่งคะแนน
  if (actual.direction === "flat") return sign(pred.direction) === Math.sign(actual.pct) && sign(pred.direction) !== 0 ? 0.5 : 0.25;
  if (pred.direction === "flat") return 0;
  return 0;
}

export function gradeOf(accuracyPct: number): { grade: string; label: string; tone: string } {
  if (accuracyPct >= 90) return { grade: "S", label: "ระดับเซียน — แม่นยำมาก", tone: "text-emerald-400" };
  if (accuracyPct >= 80) return { grade: "A", label: "ผ่านเกณฑ์มาตรฐาน (80%+)", tone: "text-emerald-400" };
  if (accuracyPct >= 70) return { grade: "B", label: "ดี — ใกล้เกณฑ์", tone: "text-yellow-400" };
  if (accuracyPct >= 60) return { grade: "C", label: "พอใช้ — ควรปรับฐานความรู้", tone: "text-orange-400" };
  return { grade: "D", label: "ต่ำกว่าเกณฑ์ — ต้องปรับปรุง", tone: "text-rose-400" };
}
