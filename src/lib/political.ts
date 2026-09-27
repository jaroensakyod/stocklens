// ===== Political Pulse — ข่าวการเมืองที่กระทบตลาด: auto-fetch + Jev + ผลกระทบหุ้นรายตัว =====
import { cached, getQuotes } from "./yahoo";
import { jevAsk } from "./typesafe";

export interface PoliticalItem {
  title: string;
  source: string;
  time: number;
  link?: string;
  topic: string;
  // Jev รายชิ้น
  direction: string | null; // bullish / bearish / neutral
  impact: number | null; // 0-3
  fedImplication: string | null; // hawkish / dovish / neutral
  // หุ้นที่กระทบ
  stocks: { t: string; price: number | null; chgPct: number | null; why: string }[];
  atlasCard: string | null;
}

export interface PoliticalFeed {
  items: PoliticalItem[];
  asOf: string;
  overall: { impact: number | null; direction: string | null; topRisk: string | null } | null;
}

// ---------- RSS fetch ตรง (ไม่ผ่าน getNews — ทำงานแน่นอนกว่า) ----------
async function fetchRSS(query: string, lang: string, max: number): Promise<{ title: string; source: string; link: string; time: number }[]> {
  try {
    const locale = lang === "th" ? "hl=th&gl=TH&ceid=TH:th" : "hl=en-US&gl=US&ceid=US:en";
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${locale}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
    return items.slice(0, max).map(item => {
      const title = (item.match(/<title>(.*?)<\/title>/)?.[1] ?? "").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
      const source = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] ?? "";
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] ?? "";
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";
      const time = pubDate ? new Date(pubDate).getTime() : Date.now();
      return { title, source, link, time };
    }).filter(x => x.title.length > 10);
  } catch { return []; }
}

// ---------- Sector → Stocks mapping ----------
const SECTOR_STOCKS: Record<string, { label: string; tickers: string[] }> = {
  ev_auto: { label: "🚗 Auto/EV", tickers: ["TSLA", "F", "GM", "RIVN"] },
  oil_energy: { label: "🛢️ น้ำมัน/พลังงาน", tickers: ["XOM", "CVX", "XLE", "CL=F"] },
  tech_ai: { label: "💻 Tech/AI", tickers: ["NVDA", "MSFT", "GOOGL", "SMH"] },
  banking: { label: "🏦 ธนาคาร", tickers: ["JPM", "BAC", "GS"] },
  defense: { label: "🛡️ กลาโหม", tickers: ["LMT", "RTX", "ITA"] },
  bonds: { label: "🏛️ พันธบัตร/ดอกเบี้ย", tickers: ["TLT", "^TNX"] },
  gold: { label: "🥇 ทอง", tickers: ["GC=F", "NEM", "GLD"] },
  thailand: { label: "🇹🇭 ไทย", tickers: ["^SET.BK", "AOT.BK", "KBANK.BK"] },
  crypto: { label: "🪙 Crypto", tickers: ["BTC-USD", "COIN"] },
  asia: { label: "🌏 เอเชีย", tickers: ["^N225", "^HSI"] },
};

const SECTOR_KEYS: Record<string, string> = {
  ev: "ev_auto", electric: "ev_auto", auto: "ev_auto", car: "ev_auto", tesla: "ev_auto", vehicle: "ev_auto",
  oil: "oil_energy", crude: "oil_energy", energy: "oil_energy", gas: "oil_energy", petrol: "oil_energy", opec: "oil_energy",
  chip: "tech_ai", semiconductor: "tech_ai", ai: "tech_ai", tech: "tech_ai", nvidia: "tech_ai", software: "tech_ai",
  bank: "banking", financial: "banking", fed: "banking", rate: "banking", yield: "banking",
  defense: "defense", military: "defense", weapon: "defense", war: "defense", nato: "defense",
  bond: "bonds", treasury: "bonds", debt: "bonds", inflation: "bonds", cpi: "bonds",
  gold: "gold", precious: "gold", commodity: "gold", metal: "gold",
  thailand: "thailand", thai: "thailand", ไทย: "thailand", set: "thailand", baht: "thailand",
  crypto: "crypto", bitcoin: "crypto", btc: "crypto", ethereum: "crypto",
  china: "asia", japan: "asia", asia: "asia", taiwan: "asia", korea: "asia",
};

const ATLAS_MAP: Record<string, string> = {
  trump: "trump2", tariff: "trump2", trade: "china", china: "china", taiwan: "taiwan",
  fed: "fiatqe", inflation: "inflation2022", war: "ukraine", ukraine: "ukraine",
  "middle east": "mideast", oil: "oil73", gold: "goldrush22", ai: "ai4ir",
  crypto: "covid", debt: "debtclock", dollar: "dedollar", thailand: "thai",
};

function matchSectors(text: string): string[] {
  const lower = " " + text.toLowerCase() + " ";
  const hits: string[] = [];
  for (const [key, sector] of Object.entries(SECTOR_KEYS)) {
    if (lower.includes(key) && !hits.includes(sector)) hits.push(sector);
  }
  return hits.length ? hits.slice(0, 3) : ["bonds"];
}

function matchAtlas(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [key, id] of Object.entries(ATLAS_MAP)) {
    if (lower.includes(key)) return id;
  }
  return null;
}

// ---------- Main: feed + Jev รายชิ้น + ราคาหุ้น ----------
export async function getPoliticalFeed(refresh = false): Promise<PoliticalFeed | null> {
  if (refresh) {
    // ข้าม cache — ยิงตรง (ใช้ครั้งเดียว)
  }
  return cached("political:v2", refresh ? 1 : 20 * 60_000, async () => {
    // 1) Fetch RSS — หลาย query เพื่อกระจายความเสี่ยง
    const [enTrump, enGeo, thNews] = await Promise.all([
      fetchRSS("Trump tariff policy economy stock market", "en", 8),
      fetchRSS("geopolitics war oil gold market impact", "en", 6),
      fetchRSS("การเมืองไทย เศรษฐกิจ หุ้น", "th", 4),
    ]);
    const raw = [
      ...enTrump.map(n => ({ ...n, topic: "🇺🇸" })),
      ...enGeo.map(n => ({ ...n, topic: "🌍" })),
      ...thNews.map(n => ({ ...n, topic: "🇹🇭" })),
    ].sort((a, b) => b.time - a.time).slice(0, 12);

    if (!raw.length) return { items: [], asOf: new Date().toISOString(), overall: null };

    // 2) Jev วิเคราะห์รายชิ้น — top 6 ข่าวล่าสุด (ประหยัด calls)
    const top6 = raw.slice(0, 6);
    const analyzed: PoliticalItem[] = [];

    for (const n of top6) {
      const sectors = matchSectors(n.title);
      const stockTickers = sectors.flatMap(s => SECTOR_STOCKS[s]?.tickers ?? []).slice(0, 4);
      const atlas = matchAtlas(n.title);

      // Jev รายชิ้น
      const a = await jevAsk(
        `Political/market news: "${n.title}" (source: ${n.source})`,
        {
          direction: { type: "choice", instructions: "Direction for stocks?", criteria: { bullish: "หนุน", bearish: "กด", neutral: "สมดุล/ไม่ชัด" } },
          impact: { type: "score", instructions: "How market-moving? (0=เบา 3=game changer)", criteria: ["เบา", "มีนัย", "สำคัญ", "Game changer"] },
          fed: { type: "choice", instructions: "Fed implication?", criteria: { hawkish: "ถือนาน/ขึ้นดอกเบี้ย", dovish: "ลดได้เร็วขึ้น", neutral: "ไม่กระทบ" } },
        }
      ).catch(() => null);

      analyzed.push({
        ...n,
        direction: (a?.direction as { choice?: string })?.choice ?? null,
        impact: (a?.impact as { score?: number })?.score ?? null,
        fedImplication: (a?.fed as { choice?: string })?.choice ?? null,
        stocks: [], // เติมราคาด้านล่าง
        atlasCard: atlas,
      });
    }

    // ข่าวที่เหลือ (ไม่ยิง Jev — ประหยัด) ใส่ sector matching อย่างเดียว
    for (const n of raw.slice(6)) {
      analyzed.push({
        ...n,
        direction: null, impact: null, fedImplication: null,
        stocks: [],
        atlasCard: matchAtlas(n.title),
      });
    }

    // 3) ดึงราคาหุ้นที่กระทบ (batch เดียว)
    const allTickers = [...new Set(analyzed.flatMap(n => matchSectors(n.title).flatMap(s => SECTOR_STOCKS[s]?.tickers ?? [])))].slice(0, 20);
    const quotes = await getQuotes(allTickers).catch(() => ({} as Record<string, { price: number; changePct: number }>));

    for (const item of analyzed) {
      const sectors = matchSectors(item.title);
      const tickers = sectors.flatMap(s => SECTOR_STOCKS[s]?.tickers ?? []).slice(0, 4);
      item.stocks = tickers.map(t => ({
        t,
        price: quotes[t]?.price ?? null,
        chgPct: quotes[t]?.changePct ?? null,
        why: SECTOR_STOCKS[matchSectors(item.title)[0]]?.label ?? "",
      }));
    }

    // 4) Jev สรุปภาพรวม
    const headlines = top6.map((n, i) => `${i + 1}. ${n.title.slice(0, 70)}`).join("\n");
    const overallRes = await jevAsk(
      `Political news roundup:\n${headlines}`,
      {
        overallImpact: { type: "score", instructions: "Overall market impact of these headlines together?", criteria: ["เบา", "มีนัย", "สำคัญ", "สำคัญมาก"] },
        overallDir: { type: "choice", instructions: "Overall direction for stocks?", criteria: { bullish: "หนุน", bearish: "กด", neutral: "สมดุล" } },
        topRisk: { type: "choice", instructions: "Single biggest risk theme?", criteria: { inflation: "เงินเฟ้อ/ดอกเบี้ย", war: "สงคราม", policy: "นโยบาย/กฎระเบียบ", china: "จีน/การค้า", election: "การเมือง" } },
      }
    ).catch(() => null);

    return {
      items: analyzed,
      asOf: new Date().toISOString(),
      overall: {
        impact: (overallRes?.overallImpact as { score?: number })?.score ?? null,
        direction: (overallRes?.overallDir as { choice?: string })?.choice ?? null,
        topRisk: (overallRes?.topRisk as { choice?: string })?.choice ?? null,
      },
    };
  }) as Promise<PoliticalFeed | null>;
}

/** วิเคราะห์ข่าวรายชิ้นด้วย Jev (สำหรับช่องพิมพ์เอง) */
export async function analyzePolitical(text: string): Promise<{
  impact: number | null; direction: string | null; fed: string | null;
  sectors: string[]; stocks: { t: string; price: number | null; chgPct: number | null }[];
  atlasCards: string[]; jevText: string;
} | { error: string }> {
  if (text.trim().length < 10) return { error: "ต้องใส่ข้อความอย่างน้อย 10 ตัวอักษร" };
  const a = await jevAsk(
    `Political/economic event: "${text.slice(0, 1200)}"`,
    {
      direction: { type: "choice", instructions: "Direction for stocks?", criteria: { bullish: "หนุน", bearish: "กด", neutral: "สมดุล" } },
      impact: { type: "score", instructions: "How market-moving?", criteria: ["เบา", "มีนัย", "สำคัญ", "Game changer"] },
      fed: { type: "choice", instructions: "Fed implication?", criteria: { hawkish: "ถือนาน/ขึ้น", dovish: "ลดได้เร็ว", neutral: "ไม่กระทบ" } },
    }
  );
  const sectors = matchSectors(text);
  const tickers = sectors.flatMap(s => SECTOR_STOCKS[s]?.tickers ?? []).slice(0, 6);
  const quotes = await getQuotes(tickers).catch(() => ({} as Record<string, { price: number; changePct: number }>));
  const dir = (a?.direction as { choice?: string })?.choice ?? null;
  const imp = (a?.impact as { score?: number })?.score ?? null;
  const fed = (a?.fed as { choice?: string })?.choice ?? null;
  const lower = text.toLowerCase();
  const atlasCards: string[] = [];
  for (const [k, id] of Object.entries(ATLAS_MAP)) { if (lower.includes(k) && !atlasCards.includes(id)) atlasCards.push(id); }
  const jevText = `🧠 Jev: รุนแรง ${imp !== null ? imp.toFixed(0) + "/3" : "-"} · ${dir === "bullish" ? "🟢 หนุนหุ้น" : dir === "bearish" ? "🔴 กดหุ้น" : "⚪ สมดุล"}${fed && fed !== "neutral" ? ` · Fed: ${fed === "hawkish" ? "⚖️ ถือนาน" : "🕊️ ลดได้"}` : ""}`;
  return { impact: imp, direction: dir, fed, sectors, stocks: tickers.map(t => ({ t, price: quotes[t]?.price ?? null, chgPct: quotes[t]?.changePct ?? null })), atlasCards: atlasCards.slice(0, 3), jevText };
}


// ---------- Trump Pulse: โพสต์/แถลงการณ์ล่าสุด (mainstream + non-mainstream) ----------
export interface TrumpPulseItem {
  title: string; source: string; time: number;
  direction: string | null; impact: number | null;
  stocks: { t: string; chgPct: number | null }[];
}

export async function getTrumpPulse(): Promise<TrumpPulseItem[]> {
  return cached("trump:pulse", 15 * 60_000, async () => {
    // queries หลากหลาย: จับทั้งโพสต์ Truth Social/X + แถลงการณ์ + นโยบาย
    const [social, policy, econ] = await Promise.all([
      fetchRSS("Trump Truth Social post statement", "en", 5),
      fetchRSS("Trump executive order tariff policy", "en", 5),
      fetchRSS("Trump says economy market Fed", "en", 5),
    ]);
    const raw = [...social, ...policy, ...econ]
      .filter((x, i, arr) => arr.findIndex(y => y.title.slice(0, 40) === x.title.slice(0, 40)) === i)
      .sort((a, b) => b.time - a.time)
      .slice(0, 6);

    if (!raw.length) return [];

    // Jev วิเคราะห์ 4 ข่าวแรก
    const out: TrumpPulseItem[] = [];
    for (let i = 0; i < raw.length; i++) {
      const n = raw[i];
      const a = i < 4 ? await jevAsk(
        `Trump news: "${n.title.slice(0, 120)}" (source: ${n.source})`,
        {
          direction: { type: "choice", instructions: "Direction for stocks?", criteria: { bullish: "หนุน", bearish: "กด", neutral: "สมดุล" } },
          impact: { type: "score", instructions: "Market impact (0-3)?", criteria: ["เบา", "มีนัย", "สำคัญ", "Game changer"] },
        }
      ).catch(() => null) : null;

      const sectors = matchSectors(n.title);
      const tickers = sectors.flatMap(s => SECTOR_STOCKS[s]?.tickers ?? []).slice(0, 3);
      out.push({
        title: n.title, source: n.source, time: n.time,
        direction: (a?.direction as { choice?: string })?.choice ?? null,
        impact: (a?.impact as { score?: number })?.score ?? null,
        stocks: tickers.map(t => ({ t, chgPct: null })), // เติมราคาใน batch ด้านล่าง
      });
    }

    // ราคาหุ้น batch เดียว
    const allT = [...new Set(out.flatMap(x => x.stocks.map(s => s.t)))].slice(0, 15);
    if (allT.length) {
      const quotes = await getQuotes(allT).catch(() => ({} as Record<string, { changePct: number }>));
      for (const item of out) {
        for (const s of item.stocks) s.chgPct = quotes[s.t]?.changePct ?? null;
      }
    }

    return out;
  }) as Promise<TrumpPulseItem[]>;
}
