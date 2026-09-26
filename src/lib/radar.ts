// ===== Global Radar: โหลดธีม + impact map + วิเคราะห์เหตุการณ์ (AI / คีย์เวิร์ด) =====
import themesJson from "@/data/radar-themes.json";
import impactJson from "@/data/impact-map.json";
import examplesJson from "@/data/examples.json";
import { getQuotes, getChart } from "./yahoo";
import { getThemeNewsMap, newsHeat, type ThemeNews } from "./themeNews";
import { jevChoiceProbabilities } from "./typesafe";
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

/**
 * % เปลี่ยนแปลง 5 วันของตัวชี้วัด — ใช้แทน "วันเดียว" ในสูตร heat เพื่อลด noise
 * (VIX เด้งวันเดียวจาก noise ไม่ควรทำให้ธีม credit ร้อน 100 — แนวโน้ม 5 วันสะท้อนเหตุการณ์จริงกว่า)
 * แคช 30 นาที: computeThemeHeat ถูกเรียกจากหลายที่ (radar/advisor/chat) กันยิงกราฟซ้ำ
 */
let chg5dCache: { at: number; map: Record<string, number> } | null = null;
async function changes5d(symbols: string[]): Promise<Record<string, number>> {
  const cache = chg5dCache;
  const cacheFresh = cache && Date.now() - cache.at < 30 * 60_000;
  if (cacheFresh && symbols.every((s) => s in cache.map)) return cache.map;
  const map: Record<string, number> = { ...(cache?.map ?? {}) };
  const toFetch = symbols.filter((s) => !(cacheFresh && s in map));
  await Promise.all(
    toFetch.map(async (s) => {
      try {
        const c = await getChart(s, "5D");
        if (c.length > 2) {
          const first = c.find((k) => isFinite(k.close) && k.close > 0);
          const last = c[c.length - 1];
          if (first && isFinite(last.close) && first.close > 0) map[s] = (last.close / first.close - 1) * 100;
        }
      } catch {
        // ตัวไหนไม่มีกราฟ (เช่น index แปลก) ข้ามไปใช้เฉพาะ quote วันเดียว
      }
    })
  );
  chg5dCache = { at: Date.now(), map };
  return map;
}

/**
 * ความร้อนของธีม (สูตรใหม่): ข่าวจริง 24 ชม. 60% + แนวโน้มราคา 5 วัน 40%
 * ทำไม: สูตรเดิมดูราคาวันเดียวเท่านั้น ธีมที่ watch แค่ 1 ตัว (เช่น credit = VIX) จะ heat พุ่ง 100
 * จากแค่ noise รายวันทั้งที่ไม่มีเหตุการณ์จริง — ปนข่าวเข้ามา + ดูแนวโน้ม 5 วัน = สะท้อนเหตุการณ์จริง
 */
export async function computeThemeHeat() {
  const all = [...new Set(THEMES.flatMap((t) => t.watch))];
  const [quotes, newsMap, chg5] = await Promise.all([getQuotes(all), getThemeNewsMap(), changes5d(all)]);
  return THEMES.map((t) => {
    const qs = t.watch.map((w) => quotes[w]).filter((q): q is Quote => !!q && isFinite(q.price));
    // แนวโน้ม 5 วันของตัวชี้วัดธีมนี้ (fallback เป็น % วันนี้ถ้ายังไม่มีกราฟ)
    const moves = t.watch.map((w) => chg5[w] ?? quotes[w]?.changePct).filter((m): m is number => m !== undefined && isFinite(m));
    const priceHeat = moves.length
      ? Math.min(100, (moves.reduce((a, b) => a + Math.abs(b), 0) / moves.length) * 5 + Math.abs(Math.max(...moves.map(Math.abs), 0)) * 2.5)
      : 0;
    const nHeat = newsHeat(newsMap[t.id]);
    const heat = Math.round(Math.min(100, priceHeat * 0.4 + nHeat * 0.6));
    const up = moves.length ? moves.reduce((a, b) => a + b, 0) / moves.length : 0;
    const news = newsMap[t.id] as ThemeNews | undefined;
    return { theme: t, heat, avgChange: up, quotes: qs, newsCount: news?.count24h ?? 0, newsTop: news?.top ?? [], mood: news?.mood };
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

/** จับธีมด้วย Jev ก่อน (เข้าใจบริบท เช่น "ปิดช่องแคบฮอร์มุซ" → สงคราม+พลังงาน) — ไม่มี key/พัง = keyword เดิม */
async function matchThemes(text: string): Promise<RadarTheme[]> {
  try {
    const options: Record<string, string> = {};
    for (const t of THEMES) options[t.id] = t.desc.slice(0, 90);
    const probs = await jevChoiceProbabilities(text, "Which investment theme does this event or news relate to? Pick the closest match", options);
    if (probs) {
      const top = Object.entries(probs)
        .filter(([id, p]) => p >= 0.1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => THEMES.find((t) => t.id === id))
        .filter((t): t is RadarTheme => !!t);
      if (top.length) return top;
    }
  } catch {
    // ไป keyword
  }
  return matchThemesByText(text);
}

export async function keywordAnalyze(text: string, focusTickers: string[] = []): Promise<EventAnalysis> {
  const themes = await matchThemes(text);
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
