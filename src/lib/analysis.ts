// ===== ประกอบข้อมูล StockAnalysis ครบชุดสำหรับหน้าวิเคราะห์ + AI =====
import { getChart, getFundamentals, getNews, getQuotes, getUsdThb, deriveRatios } from "./yahoo";
import { computeFactors } from "./factors";
import { readTechnicals } from "./indicators";
import { buildScenarios, type Scenarios } from "./scenarios";
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
  const [quotes, chart, fund, news] = await Promise.all([
    getQuotes([sym]),
    getChart(sym, "1Y"),
    getFundamentals(sym),
    getNews(sym, 6),
  ]);
  const quote = quotes[sym] ?? { symbol: sym, name: sym, price: NaN, change: 0, changePct: 0, currency: "USD", exchange: "" };

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

  return { quote, profile, financials, factors, technicals, news, usdThb, confidence, scenarios };
}
