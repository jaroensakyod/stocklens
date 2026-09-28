// ===== ประกอบข้อมูล StockAnalysis ครบชุดสำหรับหน้าวิเคราะห์ + AI =====
import { getChart, getFundamentals, getNews, getQuotes, getUsdThb, deriveRatios } from "./yahoo";
import { computeFactors } from "./factors";
import { readTechnicals } from "./indicators";
import { buildScenarios, type Scenarios } from "./scenarios";
import { scoreNewsMany, credibilityBadge, heuristicRisk } from "./typesafe";
import { saveNews } from "./turso";
import type { StockAnalysis } from "./types";

export interface AnalysisConfidence {
  score: number;
  coveredCount: number;
  totalCount: number;
  missing: string[];
  hasTechnicals: boolean;
  hasNews: boolean;
  priceSource: string;
  fundamentalsSource: string;
}

export async function buildAnalysis(ticker: string): Promise<StockAnalysis & { usdThb?: number; confidence: AnalysisConfidence; scenarios?: Scenarios }> {
  const sym = decodeURIComponent(ticker).toUpperCase();
  // ข่าว: ใช้ ticker ถ้าสหรัฐฯ แต่ใช้ "ชื่อบริษัท + หุ้น" ถ้าไทย (Yahoo search หา .BK ไม่เจอ)
  const isThai = sym.endsWith(".BK");
  const newsQuery = isThai ? sym.replace(".BK", " หุ้น") : sym;
  const [quotes, chart, fund, news] = await Promise.all([
    getQuotes([sym]),
    getChart(sym, "1Y"),
    getFundamentals(sym),
    getNews(newsQuery, 15),
  ]);
  // ไทย: ถ้าได้น้อย → Yahoo ชื่อบริษัท → Google News RSS (Yahoo ไม่ครอบคลุมไทย)
  const quote0 = quotes[sym];
  let allNews = news;
  if (isThai && news.length < 4 && quote0?.name && quote0.name !== sym) {
    const extra = await getNews(`${quote0.name} หุ้น`, 10).catch(() => []);
    const seen = new Set(news.map(n => n.title.slice(0, 40)));
    allNews = [...news, ...extra.filter(n => !seen.has(n.title.slice(0, 40)))].slice(0, 15);
  }
  // ถ้ายังน้อย → Google News RSS ตรง (ภาษาไทย) — ใช้ชื่อบริษัทหรือ ticker สั้น
  if (allNews.length < 4) {
    // ไทย: ใช้ ticker สั้น (PTTEP) — ค้นเจอง่ายกว่า full name / สหรัฐ: ใช้ ticker ตรง
    const q2 = isThai ? sym.replace(".BK", "") : sym;
    const locale = isThai ? "hl=th&gl=TH&ceid=TH:th" : "hl=en-US&gl=US&ceid=US:en";
    const suffix = isThai ? "+หุ้น" : "+stock";
    try {
      const rssRes = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q2)}${suffix}+when:1m&${locale}`, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10_000) });
      if (rssRes.ok) {
        const xml = await rssRes.text();
        const items = (xml.match(/<item>[\s\S]*?<\/item>/g) ?? []).slice(0, 10).map(item => {
          const title = (item.match(/<title>(.*?)<\/title>/)?.[1] ?? "").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
          const publisher = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] ?? "Google News";
          const link = item.match(/<link>(.*?)<\/link>/)?.[1] ?? "";
          const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";
          return { title, publisher, link, time: pubDate ? new Date(pubDate).getTime() : Date.now() };
        }).filter(x => x.title.length > 10);
        const seen = new Set(allNews.map(n => n.title.slice(0, 40)));
        allNews = [...allNews, ...items.filter(n => !seen.has(n.title.slice(0, 40)))].slice(0, 15);
      }
    } catch { /* RSS ล่ม = ใช้ข่าวเดิม */ }
  }
  const quote = quotes[sym] ?? { symbol: sym, name: sym, price: NaN, change: 0, changePct: 0, currency: "USD", exchange: "" };

  // ให้คะแนนข่าวรายหุ้นด้วย Jev (ถ้ามี key — แคช 24 ชม./พาดหัว) + กรองข่าวขยะ/วาไรตี้ออก (คงไว้อย่างน้อย 3 ชิ้น)
  const newsScores = await scoreNewsMany(allNews.map((n) => n.title)).catch(() => new Map());
  const newsMarked = allNews.map((n) => {
    const score = newsScores.get(n.title);
    const cred = credibilityBadge(score ?? null, n.title);
    return cred ? { ...n, score, cred } : { ...n, score };
  });
  const newsReal = newsMarked.filter((n) => n.score?.substantive !== false);
  const newsScored = newsReal.length >= 3 ? newsReal : newsMarked;
  // 📰 สะสมข่าวรายหุ้น + คะแนนเป็นของเรา (fire-and-forget ไม่กระทบความเร็วหน้า)
  void saveNews(newsMarked.map((n) => ({
    title: n.title, source: n.publisher, link: n.link, pubTime: n.time, themeId: sym,
    jevSentiment: n.score?.sentiment, jevImpact: n.score?.impact, jevSubstantive: n.score?.substantive, jevSuspicious: n.score?.suspicious,
    heuristicRisk: heuristicRisk(n.title), credibility: (n as { cred?: { label: string } }).cred?.label,
  })));

  // อัตราแลกเปลี่ยนสำหรับหุ้นสหรัฐฯ (แสดงราคาบาท)
  const usdThb = quote.currency === "USD" ? await getUsdThb() : undefined;

  // ratios จาก filings จริง (timeseries)
  const ratios = fund ? deriveRatios(fund, quote.price) : {};
  const num = (...keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = ratios[k];
      if (typeof v === "number" && isFinite(v)) return v;
    }
    return undefined;
  };

  const profile = {
    marketCap: num("marketCap"),
    trailingPE: num("trailingPE"),
    priceToBook: num("priceToBook"),
    priceToSales: num("priceToSalesTrailing12Months"),
    evToEbitda: num("evToEbitda"),
  };
  const financials = {
    revenueGrowth: num("revenueGrowth"),
    earningsGrowth: num("earningsGrowth"),
    grossMargins: num("grossMargins"),
    operatingMargins: num("operatingMargins"),
    profitMargins: num("profitMargins"),
    returnOnEquity: num("returnOnEquity"),
    returnOnAssets: num("returnOnAssets"),
    debtToEquity: num("debtToEquity"),
    currentRatio: num("currentRatio"),
    freeCashflow: num("freeCashflow"),
    totalCash: num("totalCash"),
    totalDebt: num("totalDebt"),
  };

  const hasFundamentalData = Object.keys(ratios).length > 0;
  // factors.ts อ่าน key แบบ flat — ส่ง ratios ตรงๆ
  const factors = hasFundamentalData ? computeFactors(ratios, chart) : undefined;
  const technicals = chart.length > 40 ? readTechnicals(chart) : undefined;

  // Confidence: ความครบของข้อมูล (แนวคิด trust-model — "รู้ว่าระบบรู้อะไร ไม่รู้อะไร")
  const EXPECTED_FIELDS: [string, string][] = [
    ["marketCap", "มูลค่าตลาด"], ["trailingPE", "P/E"], ["priceToBook", "P/B"], ["priceToSalesTrailing12Months", "P/S"], ["evToEbitda", "EV/EBITDA"],
    ["revenueGrowth", "การเติบโตรายได้"], ["earningsGrowth", "การเติบโตกำไร"],
    ["grossMargins", "มาร์จิ้นขั้นต้น"], ["operatingMargins", "มาร์จิ้นดำเนินงาน"], ["profitMargins", "มาร์จิ้นสุทธิ"],
    ["returnOnEquity", "ROE"], ["returnOnAssets", "ROA"],
    ["debtToEquity", "หนี้/ทุน"], ["currentRatio", "สภาพคล่อง"], ["freeCashflow", "FCF"], ["totalCash", "เงินสด"], ["totalDebt", "หนี้สิน"],
  ];
  const coveredFields = EXPECTED_FIELDS.filter(([k]) => ratios[k] !== undefined);
  const confidence = {
    score: Math.round((coveredFields.length / EXPECTED_FIELDS.length) * 100),
    coveredCount: coveredFields.length,
    totalCount: EXPECTED_FIELDS.length,
    missing: EXPECTED_FIELDS.filter(([k]) => ratios[k] === undefined).map(([, label]) => label),
    hasTechnicals: !!technicals,
    hasNews: news.length > 0,
    priceSource: "Yahoo Finance (delay ~15 นาที)",
    fundamentalsSource: "Filings รายไตรมาสผ่าน Yahoo fundamentals-timeseries",
  };

  // สถานการณ์ Bull/Base/Bear (จาก EPS TTM จริง × สมมติ P/E)
  const scenarios =
    ratios.trailingPE && quote.price > 0 ? (buildScenarios(quote.price, quote.price / ratios.trailingPE, ratios.trailingPE, ratios.revenueGrowth, ratios.earningsGrowth) ?? undefined) : undefined;

  return { quote, profile, financials, factors, technicals, news: newsScored, usdThb, confidence, scenarios };
}
