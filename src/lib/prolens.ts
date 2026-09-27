// ===== ProLens — วิเคราะห์ความเชื่อมโยงโลก ตามกรอบ T =====
import { getSupernova } from "./supernova";
import { jevAsk } from "./typesafe";
import { IMPACT_NODES } from "./radar";
import methodology from "@/data/prolens-methodology.json";

export interface ProlensSignal {
  id: string; emoji: string; name: string; clips: number;
  desc: string; rule: string;
  watch: string[]; up: string[]; down: string[];
  status?: "green" | "yellow" | "red"; currentValue?: string;
}

export async function getProlensDashboard() {
  const sn = await getSupernova();
  const signals: ProlensSignal[] = (methodology.signals as ProlensSignal[]).map(s => {
    // คำนวณสถานะจากข้อมูล Supernova
    const st = { ...s };
    const row = (id: string) => sn.rows.find(r => r.id === id);
    if (s.id === "gold") { const r = row("gold"); st.currentValue = r ? `$${r.price?.toFixed(0)} (${(r.chg5d ?? 0) >= 0 ? "+" : ""}${(r.chg5d ?? 0).toFixed(1)}% 5d)` : "—"; st.status = (r?.chg5d ?? 0) > 1 ? "green" : (r?.chg5d ?? 0) < -1 ? "red" : "yellow"; }
    if (s.id === "oil") { const r = row("oil"); st.currentValue = r ? `$${r.price?.toFixed(1)} (${(r?.chg5d ?? 0) >= 0 ? "+" : ""}${(r?.chg5d ?? 0).toFixed(1)}% 5d)` : "—"; st.status = (r?.chg5d ?? 0) > 2 ? "green" : "yellow"; }
    if (s.id === "dollar") { const r = row("dxy"); st.currentValue = r ? `${r.price?.toFixed(1)} (${(r?.chg5d ?? 0) >= 0 ? "+" : ""}${(r?.chg5d ?? 0).toFixed(1)}% 5d)` : "—"; st.status = (r?.chg5d ?? 0) < -0.5 ? "green" : (r?.chg5d ?? 0) > 0.5 ? "red" : "yellow"; }
    if (s.id === "inflation" || s.id === "debt") { const r = row("us30y"); st.currentValue = r ? `${r.price?.toFixed(2)}% (${(r?.chg5d ?? 0) >= 0 ? "+" : ""}${(r?.chg5d ?? 0).toFixed(1)}% 5d)` : "—"; st.status = (r?.chg5d ?? 0) > 2 ? "red" : "yellow"; }
    if (s.id === "ww3") { const r = row("vix"); st.currentValue = r ? `VIX ${r.price?.toFixed(0)} (${(r?.chg5d ?? 0) >= 0 ? "+" : ""}${(r?.chg5d ?? 0).toFixed(1)}% 5d)` : "—"; st.status = (r?.chg5d ?? 0) > 10 ? "red" : (r?.chg5d ?? 0) > 3 ? "yellow" : "green"; }
    if (s.id === "crypto") { const r = row("gold"); st.currentValue = "ดูเพิ่มเมื่อมีข่าว quantum"; st.status = "yellow"; }
    if (!st.status) st.status = "yellow";
    return st;
  });
  return { signals, predictions: methodology.predictions, framework: methodology.framework, supernova: sn, jiangSignals: (methodology as Record<string, unknown>).jiangSignals ?? [], jiangPredictions: (methodology as Record<string, unknown>).jiangPredictions ?? [], compareView: (methodology as Record<string, unknown>).compareView ?? null, jevMining: (methodology as Record<string, unknown>).jevMining ?? null };
}

export async function analyzeEventProlens(text: string): Promise<{ signals: ProlensSignal[]; chains: { name: string; stocks: string[] }[]; note: string }> {
  // 1) จับหลักการที่เกี่ยวด้วย Jev (หรือ keyword fallback)
  const sigIds = methodology.signals.map(s => s.id);
  const jevRes = await jevAsk(text, { relevant: { type: "choice", instructions: "Which macro framework signals does this event relate to? Pick the single best match", criteria: Object.fromEntries(sigIds.map(id => [id, methodology.signals.find(s => s.id === id)?.name ?? id])) } }).catch(() => null);
  let matchedIds: string[] = [];
  if (jevRes?.relevant) { const c = (jevRes.relevant as { choice?: string }).choice; if (c && sigIds.includes(c)) matchedIds = [c]; }
  if (!matchedIds.length) {
    // keyword fallback
    const lower = " " + text.toLowerCase() + " ";
    for (const s of methodology.signals) { if (s.watch.some(w => lower.includes(w.toLowerCase().split(" ")[0]))) matchedIds.push(s.id); }
    if (!matchedIds.length && /สงคราม|war|missile|ขีปนาวุธ/.test(lower)) matchedIds.push("ww3");
    if (!matchedIds.length && /ทอง|gold/.test(lower)) matchedIds.push("gold");
    if (!matchedIds.length && /น้ำมัน|oil|brent/.test(lower)) matchedIds.push("oil");
  }
  const signals = (methodology.signals as ProlensSignal[]).filter(s => matchedIds.includes(s.id));
  // 2) โยงห่วงโซ่จาก impact-map
  const chains = IMPACT_NODES.filter(n => { const nm = n.name.toLowerCase(); return matchedIds.some(id => { const sig = methodology.signals.find(s => s.id === id); if (!sig) return false; return sig.up.some(a => nm.includes(a.toLowerCase().split(".")[0])) || sig.down.some(a => nm.includes(a.toLowerCase().split(".")[0])); }); }).slice(0, 5).map(n => ({ name: n.name, stocks: n.stocks.slice(0, 4).map(s => s.ticker) }));
  return { signals, chains, note: "วิเคราะห์ตามกรอบ T — ไม่ใช่คำแนะนำการลงทุน" };
}
