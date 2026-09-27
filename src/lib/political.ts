// ===== Political Pulse — ติดตามข่าวการเมือง (Trump/การเมืองไทย/ภูมิรัฐศาสตร์) ที่กระทบตลาด =====
// ดึงข่าวจริง (Google News) → Jev วิเคราะห์ impact/direction/sectors → เชื่อม Atlas + impact-map
import { getNews } from "./yahoo";
import { cached } from "./yahoo";
import { jevAsk } from "./typesafe";

export interface PoliticalItem {
  title: string;
  source: string;
  time: number;
  link?: string;
  // Jev analysis
  impact: number | null; // 0-2
  direction: "bullish" | "bearish" | "neutral" | null;
  sectors: string[]; // กลุ่มที่กระทบ
  atlasLink: string | null; // การ์ด Atlas ที่เกี่ยว
  jevNote: string | null; // คำอธิบายสั้นจาก Jev
}

export interface PoliticalFeed {
  items: PoliticalItem[];
  asOf: string;
  topics: { id: string; label: string; emoji: string; query: string }[];
}

const TOPICS = [
  { id: "trump", label: "Trump/US Policy", emoji: "🇺🇸", query: "Trump policy economy tariffs" },
  { id: "fed", label: "Fed/Interest Rates", emoji: "🏦", query: "Federal Reserve interest rate inflation" },
  { id: "china", label: "China Trade/Taiwan", emoji: "🐉", query: "China trade war Taiwan chips" },
  { id: "war", label: "Wars/Geopolitics", emoji: "⚔️", query: "war Ukraine Middle East oil impact" },
  { id: "thaipol", label: "การเมืองไทย", emoji: "🇹🇭", query: "การเมืองไทย เศรษฐกิจ งบประมาณ" },
  { id: "crypto", label: "Crypto Regulation", emoji: "🪙", query: "crypto Bitcoin regulation ETF" },
];

const SECTOR_MAP: Record<string, string[]> = {
  ev_auto: ["TSLA", "F", "GM", "STLA", "RIVN", "LCID", "NVM.BK"],
  oil_energy: ["XOM", "CVX", "COP", "OXY", "XLE", "PTT.BK", "PTTEP.BK", "TOP.BK"],
  tech_ai: ["NVDA", "MSFT", "GOOGL", "META", "AAPL", "AVGO", "TSM", "SMH", "DELTA.BK"],
  banking: ["JPM", "BAC", "GS", "KBANK.BK", "BBL.BK", "SCB.BK"],
  defense: ["LMT", "RTX", "NOC", "GD", "ITA"],
  bonds_rates: ["TLT", "^TNX", "AGG"],
  gold_metals: ["GC=F", "NEM", "GOLD", "GLD"],
  thailand: ["^SET.BK", "AOT.BK", "KBANK.BK", "CPN.BK", "ADVANC.BK"],
  crypto: ["BTC-USD", "ETH-USD", "COIN"],
  asia: ["^N225", "^HSI", "000001.SS", "^SET.BK"],
};

const ATLAS_LINK: Record<string, string> = {
  trump: "trump2",
  tariffs: "trump2",
  trade: "china",
  fed: "fiatqe",
  "interest rate": "fiatqe",
  inflation: "inflation2022",
  china: "china",
  taiwan: "taiwan",
  war: "ukraine",
  ukraine: "ukraine",
  "middle east": "mideast",
  oil: "oil73",
  gold: "goldrush22",
  ev: "ai4ir",
  ai: "ai4ir",
  crypto: "covid",
  bond: "debtclock",
  debt: "debtclock",
  dollar: "dedollar",
  thailand: "thai",
};

function findAtlasLinks(text: string): string[] {
  const lower = text.toLowerCase();
  const links: string[] = [];
  for (const [key, id] of Object.entries(ATLAS_LINK)) {
    if (lower.includes(key) && !links.includes(id)) links.push(id);
  }
  return links.slice(0, 3);
}

function findSectors(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  if (/ev|electric vehicle|auto|car|ford|gm|tesla/.test(lower)) hits.push("ev_auto");
  if (/oil|crude|energy|gas|petrol|refin/.test(lower)) hits.push("oil_energy");
  if (/tech|ai|chip|semiconductor|nvidia|software/.test(lower)) hits.push("tech_ai");
  if (/bank|financial|lending|mortgage/.test(lower)) hits.push("banking");
  if (/defense|military|weapon|war|nato/.test(lower)) hits.push("defense");
  if (/bond|yield|treasury|interest rate|fed/.test(lower)) hits.push("bonds_rates");
  if (/gold|precious|metal|commodity/.test(lower)) hits.push("gold_metals");
  if (/thai|thailand|บาท|set|ภาษาไทย/.test(lower)) hits.push("thailand");
  if (/crypto|bitcoin|btc|ethereum/.test(lower)) hits.push("crypto");
  if (/asia|china|japan|korea|asean/.test(lower)) hits.push("asia");
  return hits.length ? hits : ["bonds_rates"];
}

/** ดึงข่าวการเมือง + วิเคราะห์ด้วย Jev — cache 30 นาที */
export async function getPoliticalFeed(): Promise<PoliticalFeed | null> {
  return cached("political:feed", 30 * 60_000, async () => {
    // ดึงข่าวจาก 2 topics หลัก (Trump + Geopolitics) รวม ~16 ข่าว
    const [trumpNews, geoNews] = await Promise.all([
      getNews("Trump economy policy tariff market", 10).catch(() => []),
      getNews("geopolitics war oil gold market impact", 8).catch(() => []),
    ]);

    const raw = [
      ...trumpNews.map((n: { title: string; publisher?: string; link?: string; time?: number }) => ({ title: n.title, source: n.publisher ?? "", link: n.link, time: n.time ?? Date.now(), topic: "trump" })),
      ...geoNews.map((n: { title: string; publisher?: string; link?: string; time?: number }) => ({ title: n.title, source: n.publisher ?? "", link: n.link, time: n.time ?? Date.now(), topic: "war" })),
    ].slice(0, 14);

    if (!raw.length) {
      return { items: [], asOf: new Date().toISOString(), topics: TOPICS };
    }

    // Jev วิเคราะห์เป็น batch (หัวข้อข่าวรวมกัน → Jev ให้ score รวม + จับ direction/sector ด้วย local)
    const headlines = raw.map((n, i) => `${i}: ${n.title}`).join("\n");
    const jevRes = await jevAsk(
      `Political news headlines (US/global) that may impact financial markets:\n${headlines}`,
      {
        overallImpact: { type: "score", instructions: "Overall: how market-moving are these political headlines taken together?", criteria: ["เบามาก", "มีนัยบ้าง", "สำคัญ", "สำคัญมาก"] },
        bias: { type: "choice", instructions: "Overall bias for risk assets (stocks)?", criteria: { bullish: "หนุนหุ้น", bearish: "กดหุ้น", neutral: "สมดุล/ไม่ชัด" } },
        topRisk: { type: "choice", instructions: "What is the single biggest risk theme from these headlines?", criteria: { inflation: "เงินเฟ้อ/ดอกเบี้ย", war: "สงคราม/ภูมิรัฐศาสตร์", policy: "นโยบาย/กฎระเบียบ", china: "จีน/การค้า", election: "การเมือง/เลือกตั้ง" } },
      }
    );

    const items: PoliticalItem[] = raw.map((n, idx) => {
      const sectors = findSectors(n.title + " " + (n.source ?? ""));
      const atlasLinks = findAtlasLinks(n.title);
      return {
        title: n.title,
        source: n.source ?? "",
        time: n.time ?? Date.now(),
        link: n.link,
        impact: null, // per-item impact จาก Jev รวม ไม่ได้ยิงรายชิ้น (ประหยัด)
        direction: null,
        sectors,
        atlasLink: atlasLinks[0] ?? null,
        jevNote: null,
      };
    });

    return {
      items,
      asOf: new Date().toISOString(),
      topics: TOPICS,
    };
  }) as Promise<PoliticalFeed | null>;
}

/** วิเคราะห์ข่าวการเมืองรายชิ้นด้วย Jev — สำหรับ "ตรวจสอบ" */
export async function analyzePolitical(text: string): Promise<{
  impact: number | null;
  direction: string | null;
  sectors: string[];
  stocks: string[];
  atlasCards: string[];
  jevText: string;
} | { error: string }> {
  if (text.trim().length < 10) return { error: "ต้องใส่ข้อความอย่างน้อย 10 ตัวอักษร" };

  const a = await jevAsk(
    `Political news/event that may impact markets: "${text.slice(0, 1200)}"`,
    {
      impact: { type: "score", instructions: "How market-moving is this event for global financial markets?", criteria: ["แทบไม่กระทบ", "กระทบบางกลุ่ม", "กระทบกว้าง", "Game changer"] },
      direction: { type: "choice", instructions: "Direction for risk assets (stocks)?", criteria: { bullish: "หนุนหุ้น", bearish: "กดหุ้น", neutral: "สมดุล/ไม่ชัด" } },
      mainSector: { type: "choice", instructions: "Which sector is MOST directly affected?", criteria: { ev_auto: "Auto/EV", oil_energy: "Oil/Energy", tech_ai: "Tech/AI/Chips", banking: "Banking/Finance", defense: "Defense/Military", bonds_rates: "Bonds/Rates", gold_metals: "Gold/Metals", thailand: "Thai market", crypto: "Crypto", asia: "Asia markets" } },
      fedImplication: { type: "choice", instructions: "What does this mean for Fed policy?", criteria: { hawkish: "Fed ต้องขึ้นดอกเบี้ย/ถือนานขึ้น", dovish: "Fed ลดดอกเบี้ยได้เร็วขึ้น", neutral: "ไม่กระทบนโยบาย Fed" } },
    }
  );

  const sectors = findSectors(text);
  const stocks = [...new Set(sectors.flatMap(s => SECTOR_MAP[s] ?? []))].slice(0, 8);
  const atlasCards = findAtlasLinks(text);

  const impact = (a?.impact as { score?: number })?.score ?? null;
  const dir = (a?.direction as { choice?: string })?.choice ?? null;
  const fed = (a?.fedImplication as { choice?: string })?.choice ?? null;

  const jevText = [
    `🧠 Jev: ความรุนแรง ${impact !== null ? impact.toFixed(1) + "/3" : "-"} · ทิศทางหุ้น: ${dir === "bullish" ? "🟢 หนุน" : dir === "bearish" ? "🔴 กด" : "⚪ สมดุล"}`,
    fed && fed !== "neutral" ? ` · Fed: ${fed === "hawkish" ? "⚖️ ถือนานขึ้น/ขึ้นดอกเบี้ย" : "🕊️ ลดได้เร็วขึ้น"}` : "",
  ].join("");

  return { impact, direction: dir, sectors, stocks, atlasCards, jevText };
}
