// ===== 📰 ข่าวล่าสุด (สไตล์ investing.com/latest-news) — ไทย+ตลาดโลก พร้อม Jev ตีความ =====
// ทุกชิ้นผ่าน Jev: เชิงบวก/เชิงลบ/กลาง (scoreNews ที่มีอยู่) + "ส่งผลกระทบต่อกลุ่มไหน" (choice ใหม่)
// แล้วโชว์หุ้นตัวแทนของกลุ่มพร้อมราคาเปลี่ยนแปลงจริง — แยกแท็บ "อัปเดตหุ้น" จากข่าวที่พูดถึงหุ้นตรงๆ
import { cached, getNews, getQuotes, getCached, setCached } from "./yahoo";
import { scoreNewsMany, jevAsk, type NewsScore } from "./typesafe";
import { chatOnce, hasAI } from "./ai";
import { createHash } from "crypto";
import setWatch from "@/data/set-watchlist.json";
import universe from "@/data/universe.json";

export interface LatestItem {
  title: string;
  source: string;
  link: string;
  time: number;
  lang: "th" | "en";
  score: NewsScore | null; // Jev: sentiment/impact/suspicious (null = ยังไม่ได้วิเคราะห์)
  affect: string | null; // key ของ AFFECTS — กลุ่มที่ข่าวส่งผลกระทบ
  stocks: { t: string; chgPct: number | null }[]; // หุ้นที่เกี่ยว (ตัวแทนกลุ่ม หรือตัวที่ถูกพูดถึง)
  matched: string[]; // หุ้นที่ข่าวพูดถึงตรงๆ (ชื่อบริษัทไทยในพาดหัว / relatedTickers ของ Yahoo)
  summaryTh?: string; // 🌐→🇹🇭 แปลอัตโนมัติ (Gemini batch คัดโดย Jev — cache 12 ชม.)
}

export interface LatestFeed {
  asOf: string;
  items: LatestItem[]; // ใหม่สุดก่อน
  stockItems: LatestItem[]; // เฉพาะชิ้นที่พูดถึงหุ้นรายตัว
  mood: { dir: "bullish" | "bearish" | "neutral"; score: number } | null;
  jevOn: boolean;
}

// ---------- กลุ่มที่ข่าวกระทบ → หุ้นตัวแทน (โชว์ราคาสดใต้แต่ละข่าว) ----------
export const AFFECTS: Record<string, { label: string; tickers: string[] }> = {
  th: { label: "🇹🇭 หุ้นไทย/SET", tickers: ["^SET.BK", "PTT.BK"] },
  us: { label: "🇺🇸 หุ้นอเมริกา", tickers: ["SPY", "QQQ"] },
  tech: { label: "💻 เทค/AI", tickers: ["NVDA", "DEL.BK"] },
  banks: { label: "🏦 ธนาคาร", tickers: ["KBANK.BK", "JPM"] },
  energy: { label: "🛢️ พลังงาน/น้ำมัน", tickers: ["PTT.BK", "XOM"] },
  gold: { label: "🥇 ทอง/ลี้ภัย", tickers: ["GLD", "GC=F"] },
  tourism: { label: "✈️ ท่องเที่ยว", tickers: ["AOT.BK", "MINT.BK"] },
  agro: { label: "🌾 อาหาร/เกษตร", tickers: ["CPF.BK", "TUF.BK"] },
  property: { label: "🏗️ อสังหาฯ", tickers: ["LH.BK", "AP.BK"] },
  crypto: { label: "🪙 คริปโต", tickers: ["BTC-USD", "COIN"] },
  rates: { label: "💰 ดอกเบี้ย/พันธบัตร", tickers: ["^TNX", "TLT"] },
};

const AFFECT_CRITERIA: Record<string, string> = {
  th: "ตลาดหุ้นไทย/SET/เศรษฐกิจไทย",
  us: "ตลาดหุ้นอเมริกา/ดัชนีอเมริกา/บริษัทอเมริกัน",
  tech: "เทคโนโลยี/AI/เซมิคอนดักเตอร์",
  banks: "ธนาคาร/สถาบันการเงิน",
  energy: "พลังงาน/น้ำมัน/ก๊าซ",
  gold: "ทองคำ/สินทรัพย์ลี้ภัย",
  tourism: "ท่องเที่ยว/โรงแรม/สายการบิน",
  agro: "อาหาร/เกษตร/ส่งออกอาหาร",
  property: "อสังหาริมทรัพย์/ก่อสร้าง",
  crypto: "คริปโต/บล็อกเชน",
  rates: "ดอกเบี้ย/เงินเฟ้อ/พันธบัตร/เฟด",
  none: "ไม่เจาะจงกลุ่มใด",
};

// ---------- จับ "หุ้นที่ข่าวพูดถึง" จากชื่อบริษัทไทยในพาดหัว ----------
const ALIASES: [string, string][] = [
  ["กสิกร", "KBANK.BK"],
  ["ไทยพาณิชย์", "SCB.BK"],
  ["กรุงไทย", "KTB.BK"],
  ["ธนาคารกรุงเทพ", "BBL.BK"],
  ["เอไอเอส", "ADVANC.BK"],
  ["ทรู คอร์ป", "TRUE.BK"],
  ["ปตท.สำรวจ", "PTTEP.BK"],
  ["โฮมโปร", "HMPRO.BK"],
];
const thNameMap: [string, string][] = (setWatch as { tickers: { t: string; n: string }[] }).tickers
  .map((r) => [r.n, r.t] as [string, string])
  .filter(([n]) => n && n.length >= 5); // ชื่อสั้นกว่านี้เสี่ยง match ผิด

function matchThaiTickers(title: string): string[] {
  const out = new Set<string>();
  for (const [name, t] of thNameMap) if (title.includes(name)) out.add(t);
  for (const [alias, t] of ALIASES) if (alias && title.includes(alias)) out.add(t);
  return [...out].slice(0, 4);
}

// ---------- จับ "หุ้นที่ข่าวพูดถึง" จากชื่อบริษัทอังกฤษ/ticker ในพาดหัว ----------
const usNameMap: [RegExp, string][] = (universe as { tickers: { t: string; n: string; s?: string }[] }).tickers
  .filter((r) => /^[A-Za-z][A-Za-z0-9.\- ]{3,}$/.test(r.n) && !["Fund", "Trust", "ETF"].includes(r.n))
  .map((r) => [new RegExp(`\\b${r.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), r.t] as [RegExp, string]);
const usTickerMap: [RegExp, string][] = ["NVDA", "AAPL", "TSLA", "MSFT", "GOOGL", "AMZN", "META", "PLTR", "AMD", "AVGO", "TSM", "JPM", "XOM", "COIN", "MSTR"].map(
  (t) => [new RegExp(`\\b${t}\\b`), t] as [RegExp, string]
);

function matchUsTickers(title: string): string[] {
  const out = new Set<string>();
  for (const [re, t] of [...usTickerMap, ...usNameMap]) if (re.test(title)) out.add(t);
  return [...out].slice(0, 4);
}

// ---------- Google News RSS (ไทย/อังกฤษ — แบบเดียวกับ political.ts) ----------
async function fetchRSS(query: string, lang: "th" | "en", max: number): Promise<LatestItem[]> {
  try {
    const locale = lang === "th" ? "hl=th&gl=TH&ceid=TH:th" : "hl=en-US&gl=US&ceid=US:en";
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:1d")}&${locale}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: LatestItem[] = [];
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
      // Google RSS มักต่อท้าย " - ชื่อสำนัก" ซ้ำกับ <source> — ตัดทิ้ง
      if (title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
      items.push({ title, source, link, time, lang, score: null, affect: null, stocks: [], matched: [] });
      if (items.length >= max) break;
    }
    return items;
  } catch {
    return [];
  }
}

// ---------- Main ----------
export async function getLatestNews(): Promise<LatestFeed> {
  return cached("latestnews:v4", 5 * 60_000, async () => {
    const [thMarket, thStocks, enWorld, yahooUs, enStocks] = await Promise.all([
      fetchRSS("ตลาดหุ้น หุ้นไทย SET", "th", 12),
      fetchRSS("หุ้น กำไร ปันผล ธุรกิจ", "th", 10),
      fetchRSS("stock market today", "en", 8),
      getNews("stock market", 8, 24 * 3600e3).catch(() => []),
      // ข่าวหุ้นตัวหลักอังกฤษ — จับชื่อบริษัท/ticker ในพาดหัวเอง (เลี้ยงแท็บ "อัปเดตหุ้น")
      fetchRSS("Nvidia Tesla Apple stock", "en", 8),
    ]);
    const enItems: LatestItem[] = yahooUs.map((n) => ({
      title: n.title,
      source: n.publisher,
      link: n.link,
      time: n.time,
      lang: "en" as const,
      score: null,
      affect: null,
      stocks: [],
      matched: (n.relatedTickers ?? []).slice(0, 4),
    }));

    // รวม + ตัดซ้ำ + เฉพาะ 24 ชม.ล่าสุด + ใหม่สุดก่อน
    const seen = new Set<string>();
    let all: LatestItem[] = [
      ...thMarket,
      ...thStocks,
      ...enItems,
      ...enWorld,
      ...enStocks,
    ]
      .filter((n) => n.title.length > 15 && Date.now() - n.time < 26 * 3600e3)
      .filter((n) => {
        const k = n.title.slice(0, 55);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => b.time - a.time);
    if (!all.length) {
      return { asOf: new Date().toISOString(), items: [], stockItems: [], mood: null, jevOn: false };
    }

    // จับหุ้นที่ถูกพูดถึง: ไทยจากชื่อบริษัท · อังกฤษจากชื่อบริษัท/ticker (+ relatedTickers ของ Yahoo)
    for (const n of all) {
      if (n.lang === "th") n.matched = matchThaiTickers(n.title);
      else n.matched = [...new Set([...matchUsTickers(n.title), ...n.matched])].slice(0, 4);
    }

    // Jev: sentiment/impact ครบทุกชิ้นที่จะโชว์ (scoreNewsMany — แคชต่อพาดหัว 24 ชม.)
    const pool = all.slice(0, 14);
    let scores = new Map<string, NewsScore>();
    let jevOn = false;
    try {
      scores = await scoreNewsMany(pool.map((n) => n.title));
      jevOn = scores.size > 0;
    } catch {
      // ไม่มี key = ข่าวยังโชว์ได้ แค่ไม่มีป้ายบวก/ลบ
    }
    for (const n of pool) n.score = scores.get(n.title) ?? null;

    // ตัดบทคขยะ (listicle/evergreen ที่ Jev ชี้ว่าไม่ใช่ข่าวจริง) ถ้ายังเหลือพอโชว์
    const cleaned = all.filter((n) => n.score?.substantive !== false);
    if (cleaned.length >= 8) all = cleaned;

    // Jev: กลุ่มที่กระทบ (choice) — สำหรับ 8 ชิ้นบนสุดที่ยังไม่รู้กลุ่ม
    for (const n of pool.slice(0, 8)) {
      if (n.matched.length) continue; // พูดถึงหุ้นตรงๆ แล้ว ไม่ต้องถามกลุ่ม
      const a = await jevAsk(`ข่าวการเงิน/หุ้น (ภาษา${n.lang === "th" ? "ไทย" : "อังกฤษ"}): "${n.title}" (source: ${n.source})`, {
        affect: {
          type: "choice",
          instructions: "Which sector or market does this news most directly affect? (used to show related stock tickers to Thai retail investors)",
          criteria: AFFECT_CRITERIA,
        },
      }).catch(() => null);
      const choice = (a?.affect as { choice?: string })?.choice;
      if (choice && AFFECTS[choice]) n.affect = choice;
    }

    // หุ้นตัวแทนของกลุ่ม + ราคา batch เดียว
    const allT = [
      ...new Set([...all.flatMap((n) => (n.affect ? AFFECTS[n.affect].tickers : [])), ...all.flatMap((n) => n.matched)]),
    ].slice(0, 24);
    const quotes = allT.length ? await getQuotes(allT).catch(() => ({} as Record<string, { changePct: number }>)) : {};
    for (const n of all) {
      const tickers = n.matched.length ? n.matched : n.affect ? AFFECTS[n.affect].tickers : [];
      n.stocks = tickers.map((t) => ({ t, chgPct: quotes[t]?.changePct ?? null }));
    }

    // อารมณ์รวมของฟีด (ถ่วง impact)
    const scored = pool.filter((n) => n.score);
    let sum = 0;
    for (const n of scored) {
      const s = n.score!;
      sum += (s.sentiment === "bullish" ? 1 : s.sentiment === "bearish" ? -1 : 0) * Math.max(0.3, s.impact);
    }
    const mood = scored.length ? { dir: (sum > 0.5 ? "bullish" : sum < -0.5 ? "bearish" : "neutral") as "bullish" | "bearish" | "neutral", score: Math.round(sum * 10) / 10 } : null;

    // 🌐→🇹🇭 แปลอัตโนมัติ (ประหยัดสุดแบบ 2 ชั้น): Jev คัดไว้แล้วว่าข่าวไหนสำคัญจริง (substantive/impact)
    // → Gemini แปลเฉพาะข่าวอังกฤษบนสุด ~8 ชิ้นแบบ batch 1 call (cache 12 ชม./หัวข้อ = คนทั้งเว็บแชร์กัน)
    await autoTranslateTop(pool).catch(() => {});

    // อัปเดตหุ้น = พูดถึงหุ้นรายตัวจริง (มีใน universe/watchlist — กันบทค listicle ของ ETF แวมูเข้ามา)
    // + ผ่านประตูคุณภาพ (ไม่ใช่บทคขยะ/ข่าวเตือนปั่น)
    const knownStock = new Set<string>([
      ...(universe as { tickers: { t: string }[] }).tickers.map((r) => r.t),
      ...(setWatch as { tickers: { t: string }[] }).tickers.map((r) => r.t),
    ]);
    const stockItems = all
      .filter((n) => n.matched.some((t) => knownStock.has(t)) && n.score?.substantive !== false && !n.score?.suspicious)
      .slice(0, 10);

    return {
      asOf: new Date().toISOString(),
      items: all.slice(0, 14),
      stockItems,
      mood,
      jevOn,
    };
  }) as Promise<LatestFeed>;
}

// ---------- 🌐→🇹🇭 แปลข่าวอัตโนมัติ (ประหยัดสุด: Jev คัด → Gemini batch → cache 12 ชม.) ----------
// เหตุผลที่ไม่ใช้ Jev แปล: Jev (TypeSafe) เป็นเครื่อง "ให้คะแนนแบบมี type" (choice/score) ไม่ใช่ตัวเขียนบท
// บทบาทที่คุ้มที่สุด = ให้ Jev คัดข่าวสำคัญ (ทำอยู่แล้วผ่าน substantive/impact) แล้ว Gemini แปลเฉพาะที่ผ่าน
const TRANSLATE_TTL = 12 * 3600_000;
const TRANSLATE_MAX = 8;

function titleKey(title: string): string {
  return "newsth:" + createHash("sha1").update(title).digest("hex").slice(0, 20);
}

/** แปลข่าวอังกฤษบนสุด (ตาม impact ของ Jev) เป็นไทยแบบ batch 1 call — attach เข้า item.summaryTh */
export async function autoTranslateTop(items: LatestItem[]): Promise<void> {
  if (!hasAI()) return;
  const targets = items
    .filter((n) => n.lang === "en" && !n.summaryTh && n.score?.substantive !== false && (n.score?.impact ?? 1) >= 1)
    .sort((a, b) => (b.score?.impact ?? 0) - (a.score?.impact ?? 0))
    .slice(0, TRANSLATE_MAX);
  if (!targets.length) return;

  // ดึงจาก cache ก่อน — เหลือเฉพาะที่ยังไม่เคยแปล
  const missing: LatestItem[] = [];
  for (const n of targets) {
    const hit = getCached<string>(titleKey(n.title), TRANSLATE_TTL);
    if (hit) n.summaryTh = hit;
    else missing.push(n);
  }
  if (!missing.length) return;

  try {
    const raw = await chatOnce(
      [
        {
          role: "system",
          content:
            "คุณคือบรรณาธิการข่าวการเงินภาษาไทย หน้าที่: แปล/สรุปพาดหัวข่าวอังกฤษเป็นไทยสั้น 1 ประโยค (≤60 ตัวอักษร) คงตัวเลขสำคัญและชื่อบริษัท/ตัวย่อเดิม ไม่เพิ่มความเห็น ไม่แนะนำซื้อขาย " +
            "ตอบเป็น JSON array ของ string เท่านั้น ตามลำดับที่ส่งให้ ห้าม markdown",
        },
        { role: "user", content: JSON.stringify(missing.map((n) => n.title)) },
      ],
      0.2
    );
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return;
    const arr = JSON.parse(m[0]) as unknown[];
    missing.forEach((n, i) => {
      const t = typeof arr[i] === "string" ? (arr[i] as string).trim().slice(0, 200) : "";
      if (t) {
        n.summaryTh = t;
        setCached(titleKey(n.title), t);
      }
    });
  } catch {
    // แปลพัง = โชว์หัวข้ออังกฤษเดิม (เหมือนก่อนมีระบบนี้)
  }
}
