// ===== Global Radar: โหลดธีม + impact map + วิเคราะห์เหตุการณ์ (AI / คีย์เวิร์ด) =====
import themesJson from "@/data/radar-themes.json";
import impactJson from "@/data/impact-map.json";
import examplesJson from "@/data/examples.json";
import { getQuotes } from "./yahoo";
import type { ChainResult, EventAnalysis, ImpactNode, Quote, RadarTheme } from "./types";

export const THEMES = (themesJson as { themes: RadarTheme[] }).themes;
export const IMPACT_NODES = (impactJson as { nodes: ImpactNode[] }).nodes;
export const EXAMPLES = (examplesJson as { examples: string[] }).examples;

export function getTheme(id: string) {
  return THEMES.find((t) => t.id === id);
}
export function getNode(id: string) {
  return IMPACT_NODES.find((n) => n.id === id);
}

/** ความร้อนของแต่ละธีม: เฉลี่ย |%เปลี่ยนแปลง| ของตัวชี้วัดที่ติดตาม */
export async function computeThemeHeat() {
  const all = [...new Set(THEMES.flatMap((t) => t.watch))];
  const quotes = await getQuotes(all);
  return THEMES.map((t) => {
    const qs = t.watch.map((w) => quotes[w]).filter((q): q is Quote => !!q && isFinite(q.price));
    const moves = qs.map((q) => q.changePct);
    const heat = moves.length
      ? Math.round(Math.min(100, (moves.reduce((a, b) => a + Math.abs(b), 0) / moves.length) * 14 + Math.abs(Math.max(...moves.map(Math.abs), 0)) * 6))
      : 0;
    const up = moves.length ? moves.reduce((a, b) => a + b, 0) / moves.length : 0;
    return { theme: t, heat, avgChange: up, quotes: qs };
  }).sort((a, b) => b.heat - a.heat);
}

/** โหมดไม่มี AI: จับคู่คีย์เวิร์ดไทย/อังกฤษ → ธีม (รวมชื่อสินค้าใน impact map) → ห่วงโซ่ */
function matchThemesByText(text: string): RadarTheme[] {
  const lower = " " + text.toLowerCase() + " ";
  const scored = THEMES.map((t) => {
    let score = 0;
    // 1) คีย์เวิร์ดของธีมเอง
    for (const k of t.keys) if (lower.includes(k.toLowerCase())) score += 1;
    // 2) ชื่อสินค้า/อุตสาหกรรมในห่วงโซ่ของธีมนี้ (เช่น "โกโก้", "น้ำมันดิบ", "ทองคำ")
    for (const id of t.impactIds) {
      const node = getNode(id);
      if (!node) continue;
      const names = [node.name];
      for (const alias of node.name.split("/")) names.push(alias.trim());
      for (const n of names) {
        if (n.length >= 3 && lower.includes(n.toLowerCase())) score += 1;
      }
    }
    return { t, score };
  }).filter((x) => x.score > 0);
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).map((x) => x.t);
}

export async function keywordAnalyze(text: string, focusTickers: string[] = []): Promise<EventAnalysis> {
  const themes = matchThemesByText(text);
  const lower = " " + text.toLowerCase() + " ";
  const focus = new Set(focusTickers.map((t) => t.toUpperCase()));
  // ให้คะแนนโหนด: ชื่อสินค้าโผล่ในข้อความ = ตรงเป้าสุด, มีตราสารที่สนใจอยู่ใน chain = โฟกัส
  const nodeIds = [...new Set(themes.flatMap((t) => t.impactIds))];
  const scored = nodeIds
    .map((id) => {
      const node = getNode(id);
      if (!node) return { id, score: 0 };
      let score = 0;
      const names = [node.name];
      for (const alias of node.name.split("/")) names.push(alias.trim());
      if (names.some((n) => n.length >= 3 && lower.includes(n.toLowerCase()))) score += 2;
      if (focus.size && (focus.has((node.yahoo ?? "").toUpperCase()) || node.stocks.some((s) => focus.has(s.ticker.toUpperCase())))) score += 1.5;
      return { id, score };
    })
    .sort((a, b) => b.score - a.score);
  // chain ตรงเป้า/โฟกัสมาก่อน แล้วเติม chain ของธีมตามลำดับ — สูงสุด 5
  const ordered = [...scored.filter((s) => s.score > 0).map((s) => s.id), ...scored.filter((s) => s.score === 0).map((s) => s.id)];
  const chosen = [...new Set(ordered)].slice(0, 5);

  const chains = await buildChainsForNodeIds(chosen);
  const headline = themes.length
    ? `ตรวจพบความเชื่อมโยงกับธีม: ${themes.map((t) => t.emoji + " " + t.name).join(", ")}`
    : "ไม่พบคีย์เวิร์ดที่ตรงกับธีมในฐานความรู้ — ลองเพิ่มรายละเอียด (ชื่อสินค้า/ประเทศ/บริษัท) หรือเสียบ AI key เพื่อวิเคราะห์อิสระ";
  return {
    input: text,
    engine: "keyword",
    headline,
    chains,
    note: "ผลจากระบบคีย์เวิร์ด + ฐานความรู้ (โหมดไม่ใช้ AI) — เป็นกรอบการวิเคราะห์เชิงตรรกะ ไม่ใช่คำแนะนำการลงทุน",
  };
}

/** ใช้ผล keyword เป็นฐาน แล้วให้ AI เขียนบทวิเคราะห์ทับ (เรียกจาก api/radar/analyze) */
export async function buildChainsForNodeIds(nodeIds: string[]): Promise<ChainResult[]> {
  const chains: ChainResult[] = [];
  for (const id of nodeIds) {
    const node = getNode(id);
    if (!node) continue;
    const tickers = node.stocks.map((s) => s.ticker);
    const quotes = await getQuotes(tickers);
    let nodeQuote: Quote | undefined;
    if (node.yahoo) {
      const nq = await getQuotes([node.yahoo]);
      nodeQuote = nq[node.yahoo];
    }
    const c: ChainResult & { quote?: Quote } = {
      eventId: node.id,
      name: node.name,
      yahoo: node.yahoo,
      reason: node.upReason,
      stocks: node.stocks.map((s) => ({ ...s, quote: quotes[s.ticker] })),
    };
    if (nodeQuote) c.quote = nodeQuote;
    chains.push(c);
  }
  return chains;
}
