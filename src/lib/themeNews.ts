// ===== ข่าวประจำธีม Radar — ดึง 2 แหล่งฟรีประกอบกัน (ไม่ต้องมี API key) =====
// 1) Yahoo Finance search news (getNews ที่มีอยู่แล้ว — แคชในตัว)
// 2) Google News RSS (news.google.com/rss/search — ฟรี ไม่มี limit ที่เป็นธรรม)
// ใช้ทำ 2 อย่าง: (a) heat ธีมสูตรใหม่ (ข่าว 60% + ราคา 40%) (b) โชว์พาดหัวใต้การ์ดธีม
// หมายเหตุ: ออกแบบให้ไม่ import radar.ts (radar จะ import ไฟล์นี้ — กัน circular)

import { getNews } from "./yahoo";

export interface ThemeNewsItem {
  title: string;
  source: string;
  link: string;
  time: number; // epoch ms
}
export interface ThemeNews {
  count24h: number; // จำนวนชิ้นใน 24 ชม.จริง (โชว์ UI)
  weighted: number; // คะแนนถ่วงน้ำหนักตามความสด (≤24 ชม.=1, ≤48=0.5, ≤7 วัน=0.25)
  top: ThemeNewsItem[]; // ล่าสุดก่อน สูงสุด 3 ชิ้น
}

// คิวรีอังกฤษให้ครอบคลุมกว่า (ข่าวไทยเรื่องมหภาคใน Yahoo/Google RSS มีน้อยกว่ามาก)
// ธีมไทย (thaipol) ใช้คำค้นภาษาไทย + locale ไทย → ได้พาดหัวไทยจริง (จุดชนะฝั่งของไทย)
const THEME_QUERIES: Record<string, string | { q: string; th?: true }> = {
  war: "war missile strike geopolitical tension",
  trade: "tariff trade war sanctions export controls",
  food: "food prices crop wheat harvest shortage",
  weather: "el nino la nina storm drought crop weather",
  water: "water shortage drought reservoir crisis",
  space: "space rocket satellite launch orbit",
  defense: "defense contract weapons military spending",
  deals: "major contract deal partnership billion",
  energy: "oil supply opec production energy shortage",
  rates: "Federal Reserve interest rates inflation",
  credit: "bank failure credit crisis financial stress default",
  travel: "tourism travel airline passengers recovery",
  ai: "artificial intelligence chip data center",
  thaipol: { q: "การเมืองไทย รัฐบาล เลือกตั้ง สภา", th: true },
};

const CACHE_TTL = 15 * 60_000;
let cache: { at: number; map: Record<string, ThemeNews> } | null = null;

/** Google News RSS → ไอเทม (regex parse หัวข้อ/ลิงก์/เวลา — โครงสร้าง RSS คงที่พอ)
 *  window: "1d" = เฉพาะข่าว 24 ชม.ล่าสุด (ไว้ตีความร้อน) · "7d" = สัปดาห์ล่าสุด (context ยามไม่มีข่าวสด)
 *  th = ค้นภาษาไทยจากฉบับไทย (hl=th) — ใช้กับธีมการเมืองไทย */
async function googleNewsRss(query: string, window: "1d" | "7d", limit = 8, th = false): Promise<ThemeNewsItem[]> {
  const loc = th ? "hl=th&gl=TH&ceid=TH:th" : "hl=en-US&gl=US&ceid=US:en";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:" + window)}&${loc}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: ThemeNewsItem[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block = m[1];
      const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
      const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
      const pub = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
      const source = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() ?? "Google News";
      if (!title || !link) continue;
      const time = pub ? Date.parse(pub) : Date.now();
      if (!isFinite(time)) continue;
      items.push({ title: title.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"), source, link, time });
      if (items.length >= limit) break;
    }
    return items;
  } catch {
    return [];
  }
}

/** น้ำหนักความสดของข่าว 1 ชิ้น: ≤24 ชม.=1 · ≤48=0.5 · ≤7 วัน=0.25 · เก่ากว่านั้น=0 */
function ageWeight(time: number): number {
  const h = (Date.now() - time) / 3600e3;
  if (h <= 24) return 1;
  if (h <= 48) return 0.5;
  if (h <= 168) return 0.25;
  return 0;
}

/** ข่าวของทุกธีม (แคช 15 นาที) — คืน map ตาม theme id */
export async function getThemeNewsMap(): Promise<Record<string, ThemeNews>> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.map;
  const ids = Object.keys(THEME_QUERIES);
  const results = await Promise.allSettled(
    ids.map(async (id) => {
      const cfg = THEME_QUERIES[id];
      const q = typeof cfg === "string" ? cfg : cfg.q;
      const isTh = typeof cfg === "object" && cfg.th === true;
      // Google News: เอาข่าวสด 24 ชม.ก่อน ถ้าเงียบมากค่อยขยายเป็นสัปดาห์ (weight ต่ำลงเอง)
      let google = await googleNewsRss(q, "1d", 8, isTh);
      if (google.length < 2) google = await googleNewsRss(q, "7d", 8, isTh);
      const [yahoo] = await Promise.all([getNews(q, 10, 36 * 3600e3).catch(() => [])]);
      const merged = [
        ...yahoo.map((n) => ({ title: n.title, source: n.publisher, link: n.link, time: n.time })),
        ...google,
      ];
      // ตัดซ้ำตามหัวข้อ (คร่าวๆ) + เรียงใหม่สุดก่อน
      const seen = new Set<string>();
      const uniq = merged
        .filter((n) => n.title && !seen.has(n.title.slice(0, 60)) && seen.add(n.title.slice(0, 60)))
        .sort((a, b) => b.time - a.time);
      return [
        id,
        {
          count24h: uniq.filter((n) => Date.now() - n.time < 24 * 3600e3).length,
          weighted: uniq.reduce((a, n) => a + ageWeight(n.time), 0),
          top: uniq.slice(0, 3),
        },
      ] as const;
    })
  );
  const map: Record<string, ThemeNews> = {};
  for (const r of results) if (r.status === "fulfilled") map[r.value[0]] = r.value[1];
  cache = { at: Date.now(), map };
  return map;
}

/** คะแนนความร้อนจากข่าว 0-100: น้ำหนักสดสะสม + โบนัสถ้าชิ้นล่าสุดมาใหม่มาก */
export function newsHeat(n: ThemeNews | undefined): number {
  if (!n || n.weighted <= 0) return 0;
  const latest = n.top[0]?.time ?? 0;
  const ageH = (Date.now() - latest) / 3600e3;
  const recency = ageH <= 3 ? 15 : ageH <= 8 ? 8 : 0;
  return Math.min(100, Math.round(n.weighted) * 12 + recency);
}
