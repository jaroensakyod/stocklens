// ===== Political Pulse v3 — ข่าวการเมืองที่กระทบตลาด =====
// ไปป์ไลน์: RSS หลายแหล่ง (th+en, กรองเฉพาะข่าวสด ≤72 ชม.) → Jev จัดหัวข้อข่าว + ทิศทาง/ระดับกระทบรายชิ้น
// → รวมเป็น "หัวข้อ" (Trump/ภาษี/เฟด/จีน/สงคราม/การเมืองไทย ฯลฯ) → Gemini เขียนสรุปไทย 1-2 ประโยคต่อหัวข้อ
// (แคชตาม hash ของพาดหัว 24 ชม. — ข่าวไม่เปลี่ยนก็ไม่ยิงซ้ำ) + ราคาหุ้นที่โดนกระทบแบบ batch
import { createHash } from "crypto";
import { cached, getQuotes } from "./yahoo";
import { jevAsk } from "./typesafe";
import { chatOnce, hasAI } from "./ai";

export interface PoliticalItem {
  title: string;
  source: string;
  time: number;
  link?: string;
  topic: string; // topic key (trump/tariff/fed/china/war/oil/thai/market)
  direction: string | null; // bullish / bearish / neutral (Jev)
  impact: number | null; // 0-3 (Jev)
  stocks: { t: string; chgPct: number | null }[];
}

export interface TopicSection {
  key: string;
  label: string;
  items: PoliticalItem[];
  summary: string | null; // Gemini เขียนจากพาดหัวจริง
}

export interface PoliticalFeed {
  asOf: string;
  topics: TopicSection[]; // เรียงตามความสำคัญ (จำนวนข่าว + impact)
  items: PoliticalItem[]; // flat ใหม่สุดก่อน
  overall: { impact: number | null; direction: string | null; topRisk: string | null } | null;
  aiSummaries: boolean;
}

export const TOPIC_LABELS: Record<string, string> = {
  trump: "🇺🇸 Trump/ทำเนียบขาว",
  tariff: "🧾 ภาษี/สงครามการค้า",
  fed: "🏛️ เฟด/ดอกเบี้ย/เงินเฟ้อ",
  china: "🇨🇳 จีน",
  war: "⚔️ สงคราม/ภูมิรัฐศาสตร์",
  oil: "🛢️ น้ำมัน/พลังงาน",
  thai: "🇹🇭 การเมืองไทย",
  market: "📈 ตลาดหุ้น/เศรษฐกิจ",
};

// หุ้นตัวแทนของแต่ละหัวข้อ (โชว์ราคาเปลี่ยนแปลงใต้ข่าว)
const TOPIC_STOCKS: Record<string, string[]> = {
  trump: ["SPY", "QQQ"],
  tariff: ["SPY", "XLE"],
  fed: ["TLT", "^TNX"],
  china: ["FXI", "BABA"],
  war: ["XLE", "LMT", "GC=F"],
  oil: ["XOM", "PTT.BK", "CL=F"],
  thai: ["^SET.BK", "AOT.BK", "KBANK.BK"],
  market: ["SPY", "^SET.BK"],
};

// ทายหัวข้อแบบ keyword ก่อน (ถ้า Jev ไม่ตอบ/ไม่มี key ได้ใช้) — อังกฤษ+ไทย
const TOPIC_KEYWORDS: [RegExp, string][] = [
  [/tariff|ภาษีนำเข้า|สงครามการค้า|trade war|export control/i, "tariff"],
  [/fed|fomc|ดอกเบี้ย|interest rate|inflation|เงินเฟ้อ|powell|แฝง/i, "fed"],
  [/china|จีน|beijing|xi/i, "china"],
  [/war|สงคราม|missile|strike|ukraine|russia|iran|israel|ขีด|กลางตะวันออก/i, "war"],
  [/oil|น้ำมัน|opec|crude|พลังงาน|ก๊าซ/i, "oil"],
  [/ไทย|thai|รัฐบาล|สภา|เลือกตั้ง|พรรค|กษัตริย์|ประยุทธ์|แพทองธาร|set index|กสทช/i, "thai"],
  [/trump|ทรัมป์|white house|ทำเนียบขาว|executive order/i, "trump"],
  [/market|หุ้น|stock|s&p|nasdaq|ดัชนี|recession|เศรษฐกิจ/i, "market"],
];

function guessTopic(title: string): string {
  for (const [re, t] of TOPIC_KEYWORDS) if (re.test(title)) return t;
  return "market";
}

// ---------- RSS fetch (พร้อมกรองความสดตั้งแต่ค้น: when:Xd) ----------
async function fetchRSS(query: string, lang: "th" | "en", max: number, window: "1d" | "2d" | "7d" = "2d"): Promise<PoliticalItem[]> {
  try {
    const locale = lang === "th" ? "hl=th&gl=TH&ceid=TH:th" : "hl=en-US&gl=US&ceid=US:en";
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:" + window)}&${locale}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const out: PoliticalItem[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block = m[1];
      let title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "";
      const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? "";
      const pub = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
      const source = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() ?? "Google News";
      if (!title || !link) continue;
      const time = pub ? Date.parse(pub) : Date.now();
      if (!isFinite(time)) continue;
      title = title.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      if (title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
      out.push({ title, source, link, time, topic: "market", direction: null, impact: null, stocks: [] });
      if (out.length >= max) break;
    }
    return out;
  } catch {
    return [];
  }
}

const djb2 = (s: string) => {
  let h = 5381;
  for (let k = 0; k < s.length; k++) h = ((h << 5) + h + s.charCodeAt(k)) >>> 0;
  return h.toString(36);
};

// ---------- Gemini เขียนสรุปหัวข้อ (แคชตามพาดหัว 24 ชม. — ข่าวไม่เปลี่ยนไม่ยิงซ้ำ) ----------
async function geminiTopicSummary(label: string, titles: string[]): Promise<string | null> {
  if (!hasAI() || !titles.length) return null;
  const key = `poltopic:${djb2(label + "|" + titles.join("|"))}`;
  return cached<string>(key, 24 * 3600_000, async () => {
    try {
      const raw = await chatOnce(
        [
          {
            role: "system",
            content:
              "คุณเป็นนักเขียนข่าวการเงินภาษาไทย เขียนสรุปกระชับ 1-2 ประโยคจากพาดหัวข่าวจริงที่ให้เท่านั้น บอกว่าเกิดอะไรและกระทบตลาด/หุ้นทิศไหน (ถ้าพาดหัวบอก) ภาษาเข้าใจง่ายสำหรับคนไทย ห้ามเดาข้อมูลที่ไม่มีในพาดหัว ห้ามคำแนะนำซื้อขาย ห้ามคำว่าการันตี/แน่นอน",
          },
          { role: "user", content: `หัวข้อข่าว: ${label}\nพาดหัวล่าสุด:\n${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}` },
        ],
        0.3
      );
      const clean = raw?.trim().replace(/^["'"]|["'"]$/g, "");
      return clean && clean.length > 10 ? clean.slice(0, 280) : null;
    } catch {
      return null;
    }
  });
}

// ---------- Main feed ----------
export async function getPoliticalFeed(refresh = false): Promise<PoliticalFeed | null> {
  return cached("political:v3", refresh ? 1 : 20 * 60_000, async () => {
    // 1) ข่าวหลากหลากแหล่ง — กรองเฉพาะข่าวสด (when:2d) ถ้าแหล่งไหนเงียบขยายเป็น 7 วัน
    const sources: [string, "th" | "en", number][] = [
      ["Trump statement executive order post", "en", 8],
      ["Trump tariff trade war China", "en", 8],
      ["Federal Reserve interest rates inflation", "en", 6],
      ["geopolitics war oil gold market impact", "en", 6],
      ["stock market policy regulation today", "en", 5],
      ["การเมืองไทย รัฐบาล เศรษฐกิจ", "th", 6],
      ["นโยบายรัฐบาล หุ้น ลงทุน", "th", 5],
    ];
    const fetched = await Promise.all(
      sources.map(async ([q, lang, max]) => {
        let items = await fetchRSS(q, lang, max, "2d");
        if (items.length < 2) items = await fetchRSS(q, lang, max, "7d");
        return items;
      })
    );

    // 2) รวม + ตัดซ้ำ + โกรฒเฉพาะ ≤72 ชม. + ใหม่สุดก่อน
    const seen = new Set<string>();
    const all = fetched
      .flat()
      .filter((n) => n.title.length > 15 && Date.now() - n.time <= 72 * 3600e3)
      .filter((n) => {
        const k = n.title.slice(0, 55);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => b.time - a.time)
      .slice(0, 16);
    if (!all.length) return null; // ว่าง = ให้ cached() เสิร์ฟของเก่าแทน (กันหน้าโชว์ 0)

    // 3) Jev รายชิ้น: จัดหัวข้อ + ทิศทาง + ระดับกระทบ (คำถามเดียวต่อชิ้น — แคชตามพาดหัว)
    const pool = all.slice(0, 10);
    for (const n of pool) {
      const a = await jevAsk(`Political/market news: "${n.title}" (source: ${n.source})`, {
        topic: {
          type: "choice",
          instructions: "Which topic does this news belong to?",
          criteria: {
            trump: "ทรัมป์/ทำเนียบขาว/คำสั่งฝ่ายบริหาร",
            tariff: "ภาษีนำเข้า/สงครามการค้า",
            fed: "เฟด/ดอกเบี้ย/เงินเฟ้อ",
            china: "จีน",
            war: "สงคราม/ภูมิรัฐศาสตร์",
            oil: "น้ำมัน/พลังงาน",
            thai: "การเมืองไทย/เศรษฐกิจไทย",
            market: "ตลาดหุ้น/เศรษฐกิจโลก",
          },
        },
        direction: { type: "choice", instructions: "Direction for stocks?", criteria: { bullish: "หนุน", bearish: "กด", neutral: "สมดุล/ไม่ชัด" } },
        impact: { type: "score", instructions: "How market-moving? (0=เบา 3=game changer)", criteria: ["เบา", "มีนัย", "สำคัญ", "Game changer"] },
      }).catch(() => null);
      n.topic = (a?.topic as { choice?: string })?.choice ?? guessTopic(n.title);
      n.direction = (a?.direction as { choice?: string })?.choice ?? null;
      n.impact = (a?.impact as { score?: number })?.score ?? null;
    }
    for (const n of all.slice(10)) n.topic = guessTopic(n.title);

    // 4) ราคาหุ้นตัวแทน batch เดียว
    const allT = [...new Set(all.flatMap((n) => TOPIC_STOCKS[n.topic] ?? []))].slice(0, 20);
    const quotes = allT.length ? await getQuotes(allT).catch(() => ({} as Record<string, { changePct: number }>)) : {};
    for (const n of all) n.stocks = (TOPIC_STOCKS[n.topic] ?? []).map((t) => ({ t, chgPct: quotes[t]?.changePct ?? null }));

    // 5) จัดกลุ่มเป็นหัวข้อ + Gemini เขียนสรุป (เฉพาะหัวข้อที่มีข่าวจริง เรียงตามความสำคัญ)
    const byTopic = new Map<string, PoliticalItem[]>();
    for (const n of all) {
      const arr = byTopic.get(n.topic) ?? [];
      arr.push(n);
      byTopic.set(n.topic, arr);
    }
    const topics: (TopicSection & { weight: number })[] = [];
    for (const [key, items] of byTopic) {
      const weight = items.reduce((a, n) => a + 1 + (n.impact ?? 0), 0);
      topics.push({ key, label: TOPIC_LABELS[key] ?? key, items, summary: null, weight });
    }
    topics.sort((a, b) => b.weight - a.weight);
    const aiOn = hasAI();
    for (const t of topics.slice(0, 6)) {
      t.summary = await geminiTopicSummary(t.label, t.items.slice(0, 3).map((n) => n.title));
    }

    // 6) Jev สรุปภาพรวม
    const headlines = pool.slice(0, 6).map((n, i) => `${i + 1}. ${n.title.slice(0, 70)}`).join("\n");
    const overallRes = await jevAsk(`Political news roundup:\n${headlines}`, {
      overallImpact: { type: "score", instructions: "Overall market impact of these headlines together?", criteria: ["เบา", "มีนัย", "สำคัญ", "สำคัญมาก"] },
      overallDir: { type: "choice", instructions: "Overall direction for stocks?", criteria: { bullish: "หนุน", bearish: "กด", neutral: "สมดุล" } },
      topRisk: { type: "choice", instructions: "Single biggest risk theme?", criteria: { inflation: "เงินเฟ้อ/ดอกเบี้ย", war: "สงคราม", policy: "นโยบาย/กฎระเบียบ", china: "จีน/การค้า", election: "การเมือง" } },
    }).catch(() => null);

    const topicsClean: TopicSection[] = topics.map(({ key, label, items, summary }) => ({ key, label, items, summary }));
    return {
      asOf: new Date().toISOString(),
      topics: topicsClean,
      items: all,
      overall: {
        impact: (overallRes?.overallImpact as { score?: number })?.score ?? null,
        direction: (overallRes?.overallDir as { choice?: string })?.choice ?? null,
        topRisk: (overallRes?.topRisk as { choice?: string })?.choice ?? null,
      },
      aiSummaries: aiOn,
    } as PoliticalFeed;
  }) as Promise<PoliticalFeed | null>;
}

/** วิเคราะห์ข่าวรายชิ้นด้วย Jev (สำหรับช่องพิมพ์เอง) */
export async function analyzePolitical(text: string): Promise<{
  impact: number | null; direction: string | null; topic: string | null;
  stocks: { t: string; price: number | null; chgPct: number | null }[];
  jevText: string;
} | { error: string }> {
  if (text.trim().length < 10) return { error: "ต้องใส่ข้อความอย่างน้อย 10 ตัวอักษร" };
  const a = await jevAsk(`Political/economic event: "${text.slice(0, 1200)}"`, {
    topic: {
      type: "choice",
      instructions: "Which topic does this news belong to?",
      criteria: {
        trump: "ทรัมป์/ทำเนียบขาว", tariff: "ภาษี/สงครามการค้า", fed: "เฟด/ดอกเบี้ย", china: "จีน",
        war: "สงคราม/ภูมิรัฐศาสตร์", oil: "น้ำมัน/พลังงาน", thai: "การเมืองไทย", market: "ตลาดหุ้น/เศรษฐกิจ",
      },
    },
    direction: { type: "choice", instructions: "Direction for stocks?", criteria: { bullish: "หนุน", bearish: "กด", neutral: "สมดุล" } },
    impact: { type: "score", instructions: "How market-moving?", criteria: ["เบา", "มีนัย", "สำคัญ", "Game changer"] },
  });
  const topic = (a?.topic as { choice?: string })?.choice ?? null;
  const dir = (a?.direction as { choice?: string })?.choice ?? null;
  const imp = (a?.impact as { score?: number })?.score ?? null;
  const tickers = (TOPIC_STOCKS[topic ?? "market"] ?? TOPIC_STOCKS.market).slice(0, 4);
  const quotes = await getQuotes(tickers).catch(() => ({} as Record<string, { price: number; changePct: number }>));
  const jevText = `🧠 Jev: หัวข้อ ${TOPIC_LABELS[topic ?? "market"] ?? "-"} · รุนแรง ${imp !== null ? imp.toFixed(0) + "/3" : "-"} · ${dir === "bullish" ? "🟢 หนุนหุ้น" : dir === "bearish" ? "🔴 กดหุ้น" : "⚪ สมดุล"}`;
  return { impact: imp, direction: dir, topic, stocks: tickers.map((t) => ({ t, price: quotes[t]?.price ?? null, chgPct: quotes[t]?.changePct ?? null })), jevText };
}

// ---------- Trump Pulse: โพสต์/แถลงการณ์ล่าสุด (เฉพาะข่าวสด ≤36 ชม.) ----------
export interface TrumpPulseItem {
  title: string; source: string; time: number;
  direction: string | null; impact: number | null;
  stocks: { t: string; chgPct: number | null }[];
}

export async function getTrumpPulse(): Promise<TrumpPulseItem[]> {
  return cached("trump:pulse:v2", 10 * 60_000, async () => {
    const fetched = await Promise.all([
      fetchRSS("Trump Truth Social post statement", "en", 5, "1d"),
      fetchRSS("Trump executive order tariff policy", "en", 5, "1d"),
      fetchRSS("Trump says economy market Fed", "en", 5, "1d"),
    ]);
    const raw = fetched
      .flat()
      .filter((x, i, arr) => arr.findIndex((y) => y.title.slice(0, 40) === x.title.slice(0, 40)) === i)
      .filter((x) => Date.now() - x.time <= 36 * 3600e3)
      .sort((a, b) => b.time - a.time)
      .slice(0, 6);
    if (!raw.length) return null; // ว่าง = เสิร์ฟของเก่าแทน

    const out: TrumpPulseItem[] = [];
    for (let i = 0; i < raw.length; i++) {
      const n = raw[i];
      const a = i < 4 ? await jevAsk(`Trump news: "${n.title.slice(0, 120)}" (source: ${n.source})`, {
        direction: { type: "choice", instructions: "Direction for stocks?", criteria: { bullish: "หนุน", bearish: "กด", neutral: "สมดุล" } },
        impact: { type: "score", instructions: "Market impact (0-3)?", criteria: ["เบา", "มีนัย", "สำคัญ", "Game changer"] },
      }).catch(() => null) : null;
      out.push({
        title: n.title, source: n.source, time: n.time,
        direction: (a?.direction as { choice?: string })?.choice ?? null,
        impact: (a?.impact as { score?: number })?.score ?? null,
        stocks: (TOPIC_STOCKS.trump ?? []).map((t) => ({ t, chgPct: null })),
      });
    }
    const allT = [...new Set(out.flatMap((x) => x.stocks.map((s) => s.t)))].slice(0, 15);
    if (allT.length) {
      const quotes = await getQuotes(allT).catch(() => ({} as Record<string, { changePct: number }>));
      for (const item of out) for (const s of item.stocks) s.chgPct = quotes[s.t]?.changePct ?? null;
    }
    return out;
  }) as Promise<TrumpPulseItem[]>;
}
