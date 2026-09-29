// ธีมลงทุนสำหรับ /screener — map จาก radar-themes (25 ธีม) + impact-map (โหนด→หุ้น)
// ใช้ร่วมกับความร้อนธีม (heat) จาก /api/radar เพื่อเรียงว่าธีมไหน "กำลังฮอต" จริง
import themesJson from "@/data/radar-themes.json";
import impactJson from "@/data/impact-map.json";

interface ImpactStock { ticker: string; market: string; direction: string; strength: string; reason: string }
interface ImpactNode { id: string; name: string; stocks: ImpactStock[] }
interface RadarTheme { id: string; name: string; emoji: string; desc: string; impactIds: string[] }

const radarThemes = (themesJson as { themes: RadarTheme[] }).themes;
const nodes = (impactJson as { nodes: ImpactNode[] }).nodes;
const nodeById = new Map(nodes.map((n) => [n.id, n]));

export interface ScreenerTheme {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  /** ทุกหุ้นในธีม (ticker เต็ม เช่น XOM / PTT.BK) */
  tickers: string[];
  /** ticker แบบไม่มี suffix สำหรับ match กับ symbol ใน universe ของแต่ละตลาด */
  bases: Set<string>;
}

function buildThemes(): ScreenerTheme[] {
  const out: ScreenerTheme[] = [];
  for (const t of radarThemes) {
    const tickers = new Set<string>();
    for (const nid of t.impactIds ?? []) {
      const node = nodeById.get(nid);
      if (!node) continue;
      for (const st of node.stocks ?? []) tickers.add(st.ticker.toUpperCase());
    }
    if (!tickers.size) continue;
    out.push({
      id: t.id,
      emoji: t.emoji,
      name: t.name,
      desc: t.desc,
      tickers: [...tickers],
      bases: new Set([...tickers].map((x) => x.replace(/\.[A-Z]{2}$/, ""))),
    });
  }
  // เรียงชื่อไทยอ่านง่ายๆ — UI จะเรียงตาม heat จริงเมื่อดึง /api/radar ได้
  return out.sort((a, b) => a.name.localeCompare(b.name, "th"));
}

export const SCREENER_THEMES: ScreenerTheme[] = buildThemes();

/** หา theme จาก id */
export function themeById(id: string): ScreenerTheme | undefined {
  return SCREENER_THEMES.find((t) => t.id === id);
}
