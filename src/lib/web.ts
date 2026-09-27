// ===== News Web — แผนผังข่าวเชื่อมโยงแบบหนัง + Dual-Lens AI แชท =====
// สองส่วน: (1) SVG node graph แสดง "ข่าวนี้ → เกิดนี้ → กระทบนี้" (2) แชทที่ตอบตามมุมมอง AT + Prof.Jiang
import { computeThemeHeat, IMPACT_NODES } from "./radar";
import { jevAsk, scoreNews } from "./typesafe";
import { getNews } from "./yahoo";
import methodology from "@/data/prolens-methodology.json";

export interface WebNode {
  id: string; label: string; type: "event" | "asset" | "stock" | "theme";
  emoji?: string; price?: number; changePct?: number; x?: number; y?: number;
}
export interface WebEdge { from: string; to: string; label: string; direction: "up" | "down" | "neutral" }
export interface NewsWeb {
  nodes: WebNode[]; edges: WebEdge[];
  hotNews: { title: string; source: string; time: number; sentiment?: string; impact?: number }[];
}

/** สร้าง graph จากข่าวร้อนวันนี้ + impact-map chains */
export async function getNewsWeb(): Promise<NewsWeb> {
  const heat = await computeThemeHeat();
  const nodes: WebNode[] = [];
  const edges: WebEdge[] = [];

  // 1) ธีมร้อน 3 อันดับ = จุดศูนย์กลาง
  const top = heat.slice(0, 3);
  for (const h of top) {
    const nodeId = `theme:${h.theme.id}`;
    nodes.push({ id: nodeId, label: h.theme.name, type: "theme", emoji: h.theme.emoji, x: 0, y: 0 });
    // เชื่อมไปยัง impact chains
    for (const id of h.theme.impactIds.slice(0, 2)) {
      const node = IMPACT_NODES.find(n => n.id === id);
      if (!node) continue;
      const chainId = `chain:${node.id}`;
      if (!nodes.find(n => n.id === chainId)) {
        nodes.push({ id: chainId, label: node.name, type: "asset", emoji: "📦" });
      }
      edges.push({ from: nodeId, to: chainId, label: h.mood?.dir === "bullish" ? "หนุน" : h.mood?.dir === "bearish" ? "กด" : "เกี่ยว", direction: h.mood?.dir === "bullish" ? "up" : h.mood?.dir === "bearish" ? "down" : "neutral" });
      // เชื่อมจาก chain ไปหุ้น
      for (const s of node.stocks.slice(0, 3)) {
        const stockId = `stock:${s.ticker}`;
        if (!nodes.find(n => n.id === stockId)) {
          nodes.push({ id: stockId, label: s.ticker, type: "stock" });
        }
        edges.push({ from: chainId, to: stockId, label: s.direction === "positive" ? "▲" : "▼", direction: s.direction === "positive" ? "up" : "down" });
      }
    }
  }

  // 2) ข่าวร้อนประกอบ
  const hotNews: NewsWeb["hotNews"] = [];
  for (const h of top) {
    for (const n of (h.newsTop ?? []).slice(0, 2)) {
      hotNews.push({ title: n.title, source: n.source, time: n.time, sentiment: (n as { score?: { sentiment?: string } }).score?.sentiment, impact: (n as { score?: { impact?: number } }).score?.impact });
    }
  }

  // 3) คำนวณตำแหน่ง (วงกลมซ้อน 3 ชั้น: theme → asset → stock)
  const themes = nodes.filter(n => n.type === "theme");
  const assets = nodes.filter(n => n.type === "asset");
  const stocks = nodes.filter(n => n.type === "stock");
  themes.forEach((n, i) => { n.x = 400 + Math.cos((i / themes.length) * Math.PI * 2) * 120; n.y = 250 + Math.sin((i / themes.length) * Math.PI * 2) * 120; });
  assets.forEach((n, i) => { n.x = 400 + Math.cos((i / Math.max(assets.length, 1)) * Math.PI * 2) * 240; n.y = 250 + Math.sin((i / Math.max(assets.length, 1)) * Math.PI * 2) * 240; });
  stocks.forEach((n, i) => { n.x = 400 + Math.cos((i / Math.max(stocks.length, 1)) * Math.PI * 2) * 350; n.y = 250 + Math.sin((i / Math.max(stocks.length, 1)) * Math.PI * 2) * 350; });

  return { nodes, edges, hotNews };
}

export interface DualLensAnalysis {
  event: string;
  thaweesakh: { signal: string; view: string; assets: string[] };
  jiang: { signal: string; view: string; assets: string[] };
  jevSentiment?: { sentiment: string; impact: number; confidence: number };
  chains: { name: string; stocks: string[] }[];
}

/** วิเคราะห์เหตุการณ์/ข่าวผ่านกรอบทั้ง 2 เลนส์ + Jev */
export async function analyzeDualLens(text: string): Promise<DualLensAnalysis> {
  // Jev ให้คะแนนข่าว
  const jevScore = await scoreNews(text).catch(() => null);

  // จับหลักการ ทวีสุข
  const tSignals = (methodology.signals as { id: string; name: string; desc: string; rule: string; up: string[]; watch: string[] }[]);
  const tMatched = matchSignals(text, tSignals);

  // จับหลักการ Jiang
  const jSignals = ((methodology as Record<string, unknown>).jiangSignals as { id: string; name: string; desc: string; rule: string; up: string[] }[]) ?? [];
  const jMatched = matchSignals(text, jSignals);

  // ห่วงโซ่จาก impact-map
  const chains = IMPACT_NODES.filter(n => {
    const nm = n.name.toLowerCase();
    return [...tMatched, ...jMatched].some(sig => sig.up.some(a => nm.includes(a.toLowerCase().split(".")[0].split(" ")[0])));
  }).slice(0, 4).map(n => ({ name: n.name, stocks: n.stocks.slice(0, 4).map(s => s.ticker) }));

  return {
    event: text.slice(0, 200),
    thaweesakh: tMatched.length ? { signal: tMatched[0].name, view: `${tMatched[0].desc} — ${tMatched[0].rule}`, assets: tMatched[0].up.slice(0, 5) } : { signal: "ไม่พบหลักการที่ตรง", view: "ลองใส่รายละเอียดเพิ่ม", assets: [] },
    jiang: jMatched.length ? { signal: jMatched[0].name, view: `${jMatched[0].desc} — ${jMatched[0].rule}`, assets: jMatched[0].up.slice(0, 5) } : { signal: "ไม่พบหลักการที่ตรง", view: "ลองใส่รายละเอียดเพิ่ม", assets: [] },
    jevSentiment: jevScore ? { sentiment: jevScore.sentiment, impact: jevScore.impact, confidence: jevScore.confidence } : undefined,
    chains,
  };
}

function matchSignals(text: string, signals: { id: string; name: string; desc: string; rule: string; up: string[]; watch?: string[] }[]) {
  const lower = " " + text.toLowerCase() + " ";
  const scored = signals.map(s => {
    let score = 0;
    const words = [...(s.up ?? []), ...(s.watch ?? []), s.name];
    for (const w of words) {
      const kw = w.toLowerCase().split(".")[0].split(" ")[0];
      if (kw.length > 2 && lower.includes(kw)) score++;
    }
    return { s, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.map(x => x.s).slice(0, 2);
}
