// ===== Chat Intent Router — สมองส่วนตรวจคำถามของแชท AI =====
// หลักการเดิมของโปรเจกต์: "Truth Packet" — ข้อมูลจริงเข้าก่อน LLM เดาไม่ได้
// ทำ 2 หน้าที่: (1) รู้จักชื่อหุ้น (ticker regex + name-map + search fallback + .BK retry)
//              (2) จำแนกคำถามเป็น intent แล้วประกอบ truth packet จาก lib ที่มีอยู่ทั้งหมด
import nameMapJson from "@/data/name-map.json";
import brokersJson from "@/data/brokers.json";
import { buildAnalysis } from "./analysis";
import { findSectorInfo, tvUniverse } from "./tvscanner";
import { getQuotes, getNews, getChart, getUsdThb, searchSymbols } from "./yahoo";
import { keywordAnalyze, computeThemeHeat, IMPACT_NODES } from "./radar";
import { getPicks } from "./picks";
import { getSurge } from "./surge";
import { getLiveGurus } from "./gurus13f";
import { runBacktest, STRATEGIES, type StrategyId } from "./backtest";
import { getLongterm } from "./longterm";
import { getStarterPortfolios } from "./starterPortfolio";
import { getMonthlyDividends } from "./monthlyDividends";
import { getModelPortfolio, liveNav } from "./modelPortfolio";
import { getValueScan } from "./valueScan";
import { brokerFor, marketOpenHint, detectMarket, MARKET_LABEL } from "./markets";
import { applyAdvisorRules } from "./advisorBacktest";

export type ChatIntent =
  | "stock" | "portfolio" | "watchlist" | "market" | "surge" | "guru" | "backtest"
  | "event" | "news" | "longterm" | "monthly-div" | "model" | "value" | "broker" | "help" | "starter" | "general";

export interface ChatHolding {
  ticker: string;
  qty: number;
  avgCost: number;
}

export interface Grounding {
  packet: string;
  demoReply: string;
  tickers: string[];
  intents: ChatIntent[];
}

// ---------- 1) รู้จักชื่อหุ้น ----------

const NAME_MAP = Object.entries((nameMapJson as { aliases: Record<string, string> }).aliases).sort(
  (a, b) => b[0].length - a[0].length // ชื่อยาวมาก่อน — "ปตทสำรวจ" ต้องชนะ "ปตท"
);

const TICKER_STOP = new Set([
  "IS", "ARE", "THE", "AND", "FOR", "YOU", "HOW", "WHAT", "WHY", "STOCK", "BUY", "SELL", "AI", "VS", "OR",
  "NOT", "CAN", "TOP", "SET", "ETF", "IPO", "GDP", "CPI", "FED", "OIL", "GOLD", "WELL", "RSI", "PE", "PB",
  "ROE", "USD", "THB", "NOW", "TODAY", "NEWS", "HOLD", "BEST", "GOOD", "WILL", "THIS", "THAT",
]);
const WORD_STOP = new Set([
  ...TICKER_STOP, "stock", "market", "what", "when", "where", "which", "with", "from", "have", "should",
  "would", "could", "compare", "better", "between", "about", "please", "tell", "mean", "here", "there",
  "dividend", "profit", "analysis", "backtest", "portfolio", "watchlist", "broker", "help",
]);

const isLatin = (s: string) => /^[a-z0-9 &.\-'']+$/i.test(s);

// คำที่หน้าตาเป็น ticker แต่จริงๆ เป็น "ชื่อบริษัท" ใน name-map (APPLE/GOOGLE/BOEING…) — ใช้ symbol จาก map แทน
const ALIAS_KEYS = new Map(NAME_MAP.map(([a, s]) => [a.toLowerCase(), s]));

/** จับ ticker จากข้อความ (regex เดิม) + ชื่อบริษัทจาก name-map + fallback ค้นหา Yahoo */
export async function resolveNames(text: string): Promise<string[]> {
  const upper = text.toUpperCase();
  const matches = upper.match(/\b([A-Z]{2,5}(?:\.(?:BK|HK|T|TO|DE|PA|AS|L|MI|MC|ST|SW|KS|NS))?)\b/g) ?? [];
  const portfolioMode = /พอร์ต|ถือ|เทียบ|กับ|portfolio|holdings|compare|vs/i.test(text);
  const cap = portfolioMode ? 4 : 2;
  const out: string[] = [];
  for (const m of matches) {
    if (out.length >= cap) break;
    const mapped = ALIAS_KEYS.get(m.trim().toLowerCase());
    const t = mapped ?? m.trim();
    if (!mapped && TICKER_STOP.has(t)) continue;
    if (!out.includes(t)) out.push(t);
  }

  // name-map: ไทยจับแบบ includes / อังกฤษจับแบบมีขอบคำ — ไม่ให้ "ปตท" โดนตอนพิมพ์ "ปตทสำรวจ"
  const lower = " " + text.toLowerCase() + " ";
  for (const [alias, sym] of NAME_MAP) {
    if (out.length >= cap) break;
    if (out.includes(sym)) continue;
    if (isLatin(alias)) {
      const re = new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`, "i");
      if (re.test(lower)) out.push(sym);
    } else if (alias.length >= 2 && lower.includes(alias)) {
      out.push(sym);
    }
  }

  // fallback: ยังไม่เจอเลย + มีคำอังกฤษยาวๆ → ค้นหา Yahoo (เช่น "apple เป็นยังไง" → AAPL)
  if (!out.length) {
    const words = (text.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !WORD_STOP.has(w.toLowerCase()));
    const word = words.sort((a, b) => b.length - a.length)[0];
    if (word) {
      try {
        const results = await searchSymbols(word);
        const equity = results.find((r) => r.type === "Equity" && /^[A-Z]{1,5}$/.test(r.symbol));
        if (equity) out.push(equity.symbol);
      } catch {
        // ค้นหาไม่ได้ก็ข้าม — ปล่อยให้ intent อื่นทำงาน
      }
    }
  }

  return out.slice(0, cap);
}

// ---------- 2) จำแนก intent ----------

const isRealStock = (t: string) => !t.startsWith("^") && !t.includes("=F");

/** คืน intent หลักทั้งหมดที่ตรง (เรียงตามลำดับที่ packet จะถูกประกอบ) */
export function detectIntent(text: string, tickers: string[], ctx: { portfolio?: ChatHolding[]; watchlist?: string[] } = {}): ChatIntent[] {
  const t = text.toLowerCase();
  const has = (re: RegExp) => re.test(t);
  const realStocks = tickers.filter(isRealStock);
  const intents: ChatIntent[] = [];

  if (realStocks.length) intents.push("stock");

  // พอร์ตตัวอย่างมือใหม่ — ต้องชนะ intent พอร์ตของตัวเอง ("พอร์ตตัวอย่าง/แนะนำ/รายวัน" ≠ "พอร์ตฉัน")
  const starterAsk = has(/มือใหม่|พอร์ตตัวอย่าง|พอร์ตแนะนำ|พอร์ตรายวัน|เริ่มต้นลงทุน|จัดพอร์ตให้|จัดพอร์ตมือใหม่|เริ่มซื้อหุ้นยังไง/);
  if (starterAsk) intents.push("starter");

  // เหตุการณ์: ถามถึงผลกระทบ/ห่วงโซ่ ต่อให้มี ticker (เช่น "น้ำมันแพง กระทบอะไร" ที่จับ CL=F ได้)
  const eventAsk = has(/กระทบ|ผลกระทบ|ห่วงโซ่|เกี่ยวกับอะไร|เกี่ยวข้องอะไร/);
  const eventWord = has(/สงคราม|ภัยแล้ง|ฝนตก|น้ำท่วม|แผ่นดินไหว|ภาษีนำเข้า|tariff|คว่ำบาตร|ดอกเบี้ย|เศรษฐกิจ|โรคระบาด|เหตุการณ์|อากาศ|อุณหภูมิ|แพงขึ้น|ถูกลง|แรงส่ง/);
  if ((eventAsk && !realStocks.length) || (eventAsk && realStocks.length) || (!realStocks.length && eventWord)) intents.push("event");

  if (!starterAsk && ctx.portfolio?.length && has(/พอร์ต|portfolio|holdings|position|ถือครอง/)) intents.push("portfolio");
  if (ctx.watchlist?.length && has(/วอตช์|watchlist|เฝ้าดู|ติดตามไว้|รายการดู/)) intents.push("watchlist");
  if (!realStocks.length && has(/วันนี้|ตลาดวันนี้|น่าสนใจ|เด่น|เกิดอะไรขึ้น|overview|market today|มีอะไร|เป็นยังไงบ้าง|ภาพรวม|เปิดตลาด|เช้านี้/)) intents.push("market");
  if (realStocks.length && has(/backtest|ย้อนหลัง|ทดสอบกลยุทธ์|golden cross|death cross|rsi oversold|sma ?200|กลยุทธ์/)) intents.push("backtest");
  if (has(/หุ้นซิ่ง|ซิ่ง|ขยับแรง|เด้งแรง|เด้งวันนี้|เด้งเยอะ|surge|บูรี/)) intents.push("surge");
  if (has(/กูรู|บัฟเฟตต์|บัฟเฟต์|buffett|ซอรอส|soros|ดาลิโอ|dalio|แอ็คแมน|ackman|เบอร์รี่|burry|ฉลาม|druckenmiller|ดรักเคน|แคทธี|cathie|ark|13f|คลาร์แมน|klarman|เทปเปอร์|tepper|ไซมอนส์|simons|ทีเกอร์|tiger|เรเนซองส์|renaissance|berkshire|เบิร์กชัยร์/)) intents.push("guru");
  if (has(/ข่าว|news|ดราม่า|ลือ|rumor|อุบัติเหตุ|เกิดอะไรขึ้นกับ/)) intents.push("news");
  if (has(/ปันผลรายเดือน|เดือนละครั้ง|จ่ายรายเดือน|เงินเดือนเสริม|monthly dividend|เดือนละ(ครั้ง|จ่าย)/)) intents.push("monthly-div");
  if (has(/ใต้น้ำ|หุ้นถูก|underval|โดนขายเกิน|แพงเกิน|overpric|หุ้นแพง|คุ้มค่าที่จะเก็บ/)) intents.push("value");
  if (has(/พอร์ตจำลอง|พอร์ต.*ai.*ปรับ|model portfolio|ผลงาน.*พอร์ต|พอร์ตหุ้นสด|พอร์ตของเว็บ/)) intents.push("model");
  else if (has(/ปันผล|ระยะยาว|dividend|ถือยาว|เก็บรับ|compound|โตยาว/)) intents.push("longterm");
  if (has(/ซื้อยังไง|ซื้อยังไง|ซื้อที่ไหน|ซื้อได้ที่ไหน|ซื้อผ่าน|โบรก|broker|เปิดบัญชี|dime|innovestx|ibkr|ค่าธรรมเนียม|เศษหุ้น/)) intents.push("broker");
  if (has(/ใช้ยังไง|วิธีใช้|ทำอะไรได้|ฟีเจอร์|หน้าอะไร|มีหน้า|help|เว็บนี้|เริ่มยังไง|มีอะไรบ้าง|ทำอะไรได้บ้าง/)) intents.push("help");

  if (!intents.length) intents.push(realStocks.length ? "stock" : "general");
  return [...new Set(intents)];
}

// ---------- 3) ตัวช่วยจัดรูป ----------

const spct = (x: number | undefined | null) => (x === undefined || x === null || !isFinite(x) ? null : `${x >= 0 ? "+" : ""}${x.toFixed(2)}%`);
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

// ---------- 4) Packet builders ----------

/** หุ้นรายตัว — เต็มกำลังจาก buildAnalysis (เดิมทิ้ง scenarios/financials/technicals ไปเยอะ) + .BK retry */
async function buildStockPacket(tickers: string[]): Promise<{ packet: string; demo: string }> {
  const parts: string[] = [];
  const demos: string[] = [];

  const jobs = tickers.map(async (t) => {
    let a = await buildAnalysis(t);
    if (!isFinite(a.quote.price) && !t.includes(".")) {
      // .BK retry — "PTT" ไม่มีจริงในสหรัฐฯ แต่ PTT.BK มี (pattern เดียวกับ portfolio-advisor)
      const bk = await buildAnalysis(t + ".BK").catch(() => null);
      if (bk && isFinite(bk.quote.price)) a = bk;
    }
    if (!isFinite(a.quote.price)) {
      return `[ไม่พบข้อมูล ${t} — ticker นี้หาไม่เจอใน Yahoo ให้บอกผู้ใช้ตรงๆ และแนะนำใช้ช่องค้นหาบนเว็บเพื่อหาสัญลักษณ์ที่ถูกต้อง]`;
    }
    const sym = a.quote.symbol;
    const sec = await findSectorInfo(sym).catch(() => null);
    const f = a.factors, tech = a.technicals, p = a.profile, fin = a.financials;
    const lines: string[] = [];
    lines.push(
      `[ข้อมูลจริง ${sym} — ${a.quote.name}${sec?.sector ? ` · หมวด ${sec.sector}${sec.industry ? ` (${sec.industry})` : ""}` : ""}]`
    );
    lines.push(
      `ราคา ${a.quote.price.toFixed(2)} ${a.quote.currency} (${spct(a.quote.changePct) ?? "?"} วันนี้)` +
        (a.usdThb && a.quote.currency === "USD" ? ` ≈ ${(a.quote.price * a.usdThb).toFixed(0)}บาท (ซื้อได้ใน Dime เศษหุ้นเริ่ม 50฿)` : "")
    );
    if (p?.marketCap) {
      lines.push(
        `มูลค่าตลาด ${(p.marketCap / 1e9).toFixed(0)}พันล้านUSD` +
          (p.trailingPE ? ` | P/E ${p.trailingPE.toFixed(1)}` : "") +
          (p.priceToBook ? ` | P/B ${p.priceToBook.toFixed(1)}` : "") +
          (p.priceToSales ? ` | P/S ${p.priceToSales.toFixed(1)}` : "") +
          (p.evToEbitda ? ` | EV/EBITDA ${p.evToEbitda.toFixed(1)}` : "")
      );
    }
    if (fin) {
      const bits = [
        fin.revenueGrowth !== undefined ? `รายได้โต ${(fin.revenueGrowth * 100).toFixed(1)}%YoY` : null,
        fin.earningsGrowth !== undefined ? `กำไรโต ${(fin.earningsGrowth * 100).toFixed(1)}%YoY` : null,
        fin.profitMargins !== undefined ? `มาร์จิ้นสุทธิ ${(fin.profitMargins * 100).toFixed(1)}%` : null,
        fin.returnOnEquity !== undefined ? `ROE ${(fin.returnOnEquity * 100).toFixed(1)}%` : null,
        fin.debtToEquity !== undefined ? `หนี้/ทุน ${fin.debtToEquity.toFixed(1)}` : null,
        fin.freeCashflow !== undefined ? `FCF ${(fin.freeCashflow / 1e9).toFixed(1)}พันล้านUSD` : null,
      ].filter(Boolean);
      if (bits.length) lines.push(bits.join(" | "));
    }
    if (f) lines.push(`คะแนนปัจจัย: Valuation ${f.valuation} · Growth ${f.growth} · Profitability ${f.profitability} · Momentum ${f.momentum} · Health ${f.health} (รวม ${f.overall}/100)`);
    if (a.scenarios) {
      const sc = a.scenarios.scenarios.map((s) => `${s.label.split("—")[0].trim()} ${s.targetPrice.toFixed(2)} (${s.upsidePct >= 0 ? "+" : ""}${s.upsidePct.toFixed(0)}%)`).join(" · ");
      lines.push(`สถานการณ์12เดือน(สมมติ): ${sc} — คำนวณจาก EPSจริง×สมมติP/E`);
    }
    if (tech) {
      lines.push(
        `เทคนิค: สัญญาณ${tech.signal === "bullish" ? "เอียงบวก" : tech.signal === "bearish" ? "เอียงลบ" : "เป็นกลาง"}${tech.rsi14 !== undefined ? ` · RSI ${tech.rsi14.toFixed(0)}` : ""}` +
          (tech.atrStop ? ` · จุดตัดขาดทุน(ATR) ~${tech.atrStop.long.toFixed(2)}` : "")
      );
      lines.push(`เหตุผลเทคนิค: ${tech.reasons.slice(0, 5).join(" · ")}`);
    }
    if (a.news.length) lines.push(`ข่าวล่าสุด: ${a.news.slice(0, 3).map((n) => n.title).join(" / ")}`);
    lines.push(`ความน่าเชื่อถือข้อมูล: ${a.confidence.score}% (${a.confidence.coveredCount}/${a.confidence.totalCount} ฟิลด์) · ช่องทางซื้อ: ${brokerFor(sym).detail}${brokerFor(sym).label === "Dime" ? " และช่องทางอื่นอีก 8 ที่ (InnovestX/BLS/Kim Eng/CGS/Phillip/IBKR/Webull — เทียบที่หน้าหุ้นปุ่ม 🛒)" : ""}`);

    const demo =
      `**${sym} — ${a.quote.name}** ${a.quote.price.toFixed(2)} ${a.quote.currency} (${spct(a.quote.changePct) ?? "?"})` +
      (f ? `\n- คะแนนรวม **${f.overall}/100** (มูลค่า ${f.valuation} · โต ${f.growth} · กำไร ${f.profitability} · โมเมนตัม ${f.momentum} · แข็งแรง ${f.health})` : "") +
      (tech ? `\n- เทคนิค: **${tech.signal === "bullish" ? "เอียงบวก 📈" : tech.signal === "bearish" ? "เอียงลบ 📉" : "เป็นกลาง ⚖️"}** — ${tech.reasons.slice(0, 2).join(" · ")}` : "") +
      (a.scenarios ? `\n- กรอบราคา 12 เดือน (สมมติ): ${a.scenarios.scenarios.map((s) => `${s.name === "bull" ? "🐂" : s.name === "base" ? "⚖️" : "🐻"} ${s.targetPrice.toFixed(0)}`).join(" / ")}` : "");
    return { text: lines.join("\n"), demo };
  });

  for (const r of await Promise.all(jobs)) {
    if (typeof r === "string") parts.push(r);
    else {
      parts.push(cut(r.text, 1700));
      demos.push(r.demo);
    }
  }
  return { packet: parts.join("\n\n"), demo: demos.join("\n\n") };
}

/** ภาพรวมตลาดวันนี้ — เดิม + Daily Picks + หุ้นซิ่ง top3 */
async function buildMarketPacket(): Promise<{ packet: string; demo: string }> {
  const [indices, moversAll, news, picks, surge] = await Promise.all([
    getQuotes(["^GSPC", "^IXIC", "^DJI", "^VIX", "^SET.BK"]),
    tvUniverse("america", 600).catch(() => [] as Awaited<ReturnType<typeof tvUniverse>>),
    getNews("stock market", 8, 48 * 3600_000),
    getPicks().catch(() => null),
    getSurge().catch(() => null),
  ]);
  const idxNames: Record<string, string> = { "^GSPC": "S&P500", "^IXIC": "NASDAQ", "^DJI": "DOW", "^VIX": "VIX", "^SET.BK": "SET" };
  const idxLine = Object.entries(indices)
    .filter(([, q]) => isFinite(q.price))
    .map(([s, q]) => `${idxNames[s] ?? s} ${q.price.toFixed(0)} (${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%)`)
    .join(" · ");

  const byChange = [...moversAll].sort((a, b) => b.changePct - a.changePct);
  const big = byChange.filter((r) => r.mcap > 5e9);
  const gainers = big.slice(0, 6).map((r) => `${r.symbol} +${r.changePct.toFixed(1)}% (${r.sector})`).join(", ");
  const losers = big.slice(-6).reverse().map((r) => `${r.symbol} ${r.changePct.toFixed(1)}% (${r.sector})`).join(", ");
  const pm = moversAll.filter((r) => r.premarketPct !== null && Math.abs(r.premarketPct) >= 4).sort((a, b) => Math.abs(b.premarketPct ?? 0) - Math.abs(a.premarketPct ?? 0)).slice(0, 6)
    .map((r) => `${r.symbol} ${r.premarketPct !== null ? (r.premarketPct >= 0 ? "+" : "") + r.premarketPct.toFixed(1) + "%" : ""}`).join(", ");
  const newsLine = news.slice(0, 5).map((n) => n.title).join(" / ");

  const heat = await computeThemeHeat();
  const themes = heat.slice(0, 3).map((h) => `${h.theme.emoji}${h.theme.name} ความร้อน${h.heat}`).join(", ");
  const picksLine = picks ? picks.picks.slice(0, 3).map((p) => `${p.ticker} ${p.tagEmoji}${p.tag} (${p.reason})`).join(" · ") : "ไม่มีข้อมูล";
  const surgeLine = surge ? surge.rows.slice(0, 3).map((r) => `${r.ticker} +${r.changePct.toFixed(1)}% [${r.flags.join("/") || "ขยับแรง"}]`).join(" · ") : "ไม่มี";

  const packet = `[ภาพรวมตลาดวันนี้ — ข้อมูลจริง]\nดัชนี: ${idxLine}\nขึ้นแรง (mcap>5B): ${gainers}\nลงแรง: ${losers}\nพรีมาร์เก็ตเด่น: ${pm || "ไม่มีข้อมูล"}\nธีม Radar ร้อนสุด: ${themes}\n🎯 Daily Picks วันนี้: ${picksLine}\n🚀 หุ้นซิ่งเด่น: ${surgeLine}\nข่าว 48 ชม.ล่าสุด: ${newsLine}`;
  const demo = `**📊 ตลาดวันนี้ (ข้อมูลจริง ณ ตอนนี้)**\n- ดัชนี: ${idxLine}\n- 🚀 ขึ้นแรง: ${gainers}\n- 💀 ลงแรง: ${losers}${pm ? `\n- 🌅 พรีมาร์เก็ตเด่น: ${pm}` : ""}\n- 🔥 ธีมร้อนสุด: ${themes}${picks ? `\n- 🎯 Picks วันนี้: ${picksLine}` : ""}\n\n📰 พาดหัวล่าสุด:\n${news.slice(0, 4).map((n) => `- ${n.title}`).join("\n")}`;
  return { packet, demo };
}

/** พอร์ตผู้ใช้ — P/L จริง + น้ำหนัก + กฎ advisor เดียวกับระบบ + ธีมที่ทับพอร์ต */
async function buildPortfolioPacket(holdings: ChatHolding[]): Promise<{ packet: string; demo: string }> {
  const clean = holdings.filter((h) => h && h.ticker && isFinite(h.qty) && h.qty > 0 && isFinite(h.avgCost) && h.avgCost >= 0).slice(0, 8);
  if (!clean.length) return { packet: "", demo: "" };
  const symbols = [...new Set(clean.map((h) => h.ticker.toUpperCase()))];
  const [quotes, usdThb] = await Promise.all([getQuotes(symbols), getUsdThb()]);

  const rows = clean.map((h) => {
    const q = quotes[h.ticker.toUpperCase()];
    const price = q?.price ?? NaN;
    const fx = q?.currency === "THB" ? 1 : usdThb; // ตลาดอื่นนอกจาก THB ประมาณด้วยอัตรา USD
    const value = isFinite(price) ? h.qty * price * fx : NaN;
    return { h, q, price, valueThb: value };
  });
  const totalThb = rows.reduce((a, r) => a + (isFinite(r.valueThb) ? r.valueThb : 0), 0);

  // วิเคราะห์เชิงลึกเฉพาะตัวใหญ่ top6 (buildAnalysis หนัก — แต่ yahoo cache ช่วยได้เยอะ)
  const top = [...rows].filter((r) => isFinite(r.valueThb)).sort((a, b) => b.valueThb - a.valueThb).slice(0, 6);
  const analyses = await Promise.all(
    top.map(async (r) => {
      try {
        return await buildAnalysis(r.h.ticker.toUpperCase());
      } catch {
        return null;
      }
    })
  );
  const techOf = new Map<string, typeof analyses[number]>();
  for (const a of analyses) if (a && isFinite(a.quote.price)) techOf.set(a.quote.symbol, a);

  const lines = [`[พอร์ตผู้ใช้ — ข้อมูลจริง ณ ตอนนี้ · มูลค่ารวม ~${totalThb.toLocaleString("th-TH", { maximumFractionDigits: 0 })}บาท(โดยประมาณ)]`];
  const demoLines: string[] = [];
  for (const r of rows) {
    const q = r.q;
    if (!q || !isFinite(q.price)) {
      lines.push(`${r.h.ticker}: ไม่พบราคา — ticker อาจผิด`);
      continue;
    }
    const cost = r.h.qty * r.h.avgCost;
    const pl = r.h.qty * (q.price - r.h.avgCost);
    const plPct = cost > 0 ? (pl / cost) * 100 : 0;
    const weight = totalThb > 0 && isFinite(r.valueThb) ? (r.valueThb / totalThb) * 100 : 0;
    const a = techOf.get(q.symbol);
    const flags: string[] = [];
    if (Math.abs(q.changePct) >= 2) flags.push(`วันนี้ขยับ ${spct(q.changePct)}`);
    if (a?.technicals?.rsi14 !== undefined && a.technicals.rsi14 >= 75) flags.push(`RSI ${a.technicals.rsi14.toFixed(0)} ร้อนแรง`);
    if (plPct <= -45) flags.push("ขาดทุนเกิน 45% (จุด stop-loss ตามกฎ advisor)");
    lines.push(
      `${q.symbol} ${r.h.qty}@${r.h.avgCost} → ราคาตลาด ${q.price.toFixed(2)}${q.currency} · P/L ${pl >= 0 ? "+" : ""}${pl.toFixed(0)}${q.currency === "THB" ? "฿" : "$"} (${plPct >= 0 ? "+" : ""}${plPct.toFixed(1)}%) · น้ำหนัก${weight.toFixed(0)}%${flags.length ? ` · ⚠️ ${flags.join(" · ")}` : ""}`
    );
    demoLines.push(`- **${q.symbol}** ${spct(q.changePct) ?? "?"} วันนี้ · P/L ${plPct >= 0 ? "+" : ""}${plPct.toFixed(1)}% · น้ำหนัก ${weight.toFixed(0)}%`);
  }

  // กฎ advisor ชุดเดียวกับ /advisor-test (R1 ความเข้มข้น R2 ร้อนแรง R3 เทรนด์ลบ R4 stop-loss R5 de-risk)
  const ruleInput = top
    .filter((r) => r.q && isFinite(r.price))
    .map((r) => {
      const a = techOf.get(r.q!.symbol);
      return {
        ticker: r.q!.symbol,
        price: r.price,
        entryPrice: r.h.avgCost,
        weight: totalThb > 0 && isFinite(r.valueThb) ? (r.valueThb / totalThb) * 100 : 0,
        rsi: a?.technicals?.rsi14 ?? null,
        sma200: a?.technicals?.sma200 ?? null,
      };
    });
  if (ruleInput.length) {
    const { actions, cashPct } = applyAdvisorRules(ruleInput);
    if (actions.length) lines.push(`ธงจากกฎ advisor: ${actions.map((x) => `${x.ticker} ${x.rule}`).join(" · ")}`);
    if (cashPct > 0) lines.push(`กฎ de-risk แนะให้เก็บเงินสด ${cashPct}% (ตัวที่สัญญาณลบเกินครึ่งพอร์ต)`);
  }

  // ธีมเหตุการณ์โลกที่ทับพอร์ต — ticker ใน impact map ∩ ที่ผู้ใช้ถือ
  const holdSet = new Set(symbols);
  const hot = await computeThemeHeat();
  for (const h of hot.slice(0, 3)) {
    const hit: string[] = [];
    for (const id of h.theme.impactIds) {
      const node = IMPACT_NODES.find((n) => n.id === id);
      if (!node) continue;
      for (const s of node.stocks) if (holdSet.has(s.ticker.toUpperCase())) hit.push(s.ticker);
    }
    if (hit.length) lines.push(`ธีมร้อน ${h.theme.emoji}${h.theme.name} (ความร้อน${h.heat}) เกี่ยวกับที่คุณถือ: ${[...new Set(hit)].join(", ")}`);
  }

  const packet = lines.join("\n");
  const demo = `**💼 พอร์ตคุณ (ข้อมูลจริง)** มูลค่ารวม ~${totalThb.toLocaleString("th-TH", { maximumFractionDigits: 0 })}฿\n${demoLines.join("\n")}\n\n_โหมดตัววิเคราะห์ AI ต้องมี AI key — ตอนนี้แสดงตัวเลขจริงก่อน_`;
  return { packet, demo };
}

/** Watchlist — ราคาสด + ตัวที่ขยับแรง */
async function buildWatchlistPacket(list: string[]): Promise<{ packet: string; demo: string }> {
  const symbols = [...new Set(list.map((s) => s.toUpperCase()))].slice(0, 12);
  if (!symbols.length) return { packet: "", demo: "" };
  const quotes = await getQuotes(symbols);
  const rows = symbols.map((s) => quotes[s]).filter((q): q is NonNullable<typeof q> => !!q && isFinite(q.price));
  rows.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  const line = (q: typeof rows[number]) =>
    `${q.symbol} ${q.price.toFixed(2)}${q.currency} (${spct(q.changePct ?? 0)})${Math.abs(q.changePct) >= 2 ? " ⚠️ขยับแรง" : ""}`;
  return {
    packet: `[Watchlist ผู้ใช้ — ข้อมูลจริง เรียงตามแรงขยับ]\n${rows.map(line).join("\n")}`,
    demo: `**⭐ Watchlist คุณ**\n${rows.slice(0, 8).map(line).map((s) => `- ${s}`).join("\n")}`,
  };
}

/** กูรู 13F — รายตัว (รวม QoQ) หรือภาพรวมทุกคน */
const GURU_KEYS: [RegExp, string][] = [
  [/บัฟเฟตต์|บัฟเฟต์|buffett|berkshire|เบิร์กชัย/, "buffett"],
  [/เบอร์รี่|burry|ฉลาม(?!เเลา)/, "burry"],
  [/แคทธี|cathie|\bark\b/, "ark"],
  [/ดาลิโอ|dalio/, "dalio"],
  [/แอ็คแมน|ackman/, "ackman"],
  [/ไซมอนส์|simons|เรเนซองส์|renaissance/, "simons"],
  [/คลาร์แมน|klarman/, "klarman"],
  [/ดรักเคน|druckenmiller/, "druckenmiller"],
  [/ทีเกอร์|tiger|โคลแมน|coleman/, "tiger"],
  [/เทปเปอร์|tepper/, "tepper"],
  [/เอ็งแลนเดอร์|englander/, "englander"],
  [/ฮัลวอร์เซน|halvorsen/, "halvorsen"],
];

async function buildGuruPacket(text: string): Promise<{ packet: string; demo: string }> {
  const gurus = await getLiveGurus().catch(() => []);
  if (!gurus.length) return { packet: "[ระบบ 13F ดึงข้อมูลไม่สำเร็จชั่วคราว — แนะนำหน้า /gurus]", demo: "ดึงข้อมูลกูรูไม่สำเร็จชั่วคราวครับ ลองใหม่หรือเปิดหน้า /gurus" };
  const t = text.toLowerCase();
  const want = GURU_KEYS.find(([re]) => re.test(t))?.[1];
  const g = want ? gurus.find((x) => x.id === want) : undefined;

  if (g) {
    const top = g.holdings.slice(0, 10);
    const holdLine = top
      .map((h) => {
        const badge = h.change?.type === "new" ? "🆕เพิ่งซื้อ" : h.change?.type === "increased" ? `เพิ่มขึ้น` : h.change?.type === "decreased" ? "ลดลง" : "";
        return `${h.ticker ?? h.issuer} ${h.pct.toFixed(1)}% ของพอร์ต${badge ? ` (${badge})` : ""}`;
      })
      .join(" · ");
    const exited = g.qoq?.exited?.slice(0, 4).map((e) => e.ticker ?? e.issuer).join(", ");
    const totalB = isFinite(g.totalValueUsd ?? NaN) ? `${((g.totalValueUsd ?? 0) / 1e9).toFixed(0)}พันล้านUSD` : "";
    const packet = `[กูรู ${g.emoji}${g.name} (${g.firm}) — 13F สดจาก SEC งวด ${g.asOf ?? "?"}${totalB ? ` ยอดพอร์ตหุ้นสหรัฐฯ ~${totalB}` : ""}]\nสไตล์: ${g.style}\nTop holdings: ${holdLine}${exited ? `\nขายออกไป: ${exited}` : ""}\nข้อควรระวังอ่าน 13F: ${g.caution}`;
    const demo = `**${g.emoji} ${g.name}** งวด ${g.asOf ?? "-"}\nTop: ${top.slice(0, 5).map((h) => `${h.ticker ?? h.issuer} ${h.pct.toFixed(1)}%`).join(" · ")}${exited ? `\nเพิ่งขายออก: ${exited}` : ""}\n\n(ดูเต็มที่หน้า /gurus — 13F ล่าช้า 45 วัน)`;
    return { packet, demo };
  }

  const overview = gurus
    .slice(0, 7)
    .map((x) => `${x.emoji}${x.name}: ${x.holdings.slice(0, 3).map((h) => h.ticker ?? h.issuer).join("/")}${x.asOf ? ` (งวด${x.asOf})` : ""}`)
    .join("\n");
  return {
    packet: `[รายงาน 13F ล่าสุดจาก SEC EDGAR — เลือกดูกูรูที่เกี่ยวข้องกับคำถาม หรือสรุปภาพรวม]\n${overview}\nหมายเหตุ: 13F เห็นเฉพาะหุ้นสหรัฐฯ ล่าช้าสูงสุด45วัน`,
    demo: `**🐋 กูรูที่ติดตามได้**\n${gurus.slice(0, 6).map((x) => `- ${x.emoji}${x.name} — ถือ ${x.holdings.slice(0, 2).map((h) => h.ticker ?? h.issuer).join(", ")}...`).join("\n")}\n\nถามเจาะได้ เช่น "บัฟเฟต์เพิ่งขายอะไร"`,
  };
}

/** Backtest — กลยุทธ์จากคำถาม + ตัวแรกที่เจอ (default RSI) */
async function buildBacktestPacket(text: string, tickers: string[]): Promise<{ packet: string; demo: string }> {
  const t = text.toLowerCase();
  let strategy: StrategyId = "rsi_oversold";
  if (/golden|death|ครอส|cross/.test(t)) strategy = "golden_cross";
  else if (/sma ?200|เทรนด์|trend|หลบขาลง/.test(t)) strategy = "sma200_filter";
  else if (/rsi/.test(t)) strategy = "rsi_oversold";

  const ticker = tickers.find(isRealStock) ?? "SPY";
  const candles = await getChart(ticker, "5YD").catch(() => []);
  if (candles.length < 250) return { packet: `[backtest ${ticker} ไม่ได้ — ข้อมูลย้อนหลังไม่พอ]`, demo: `ข้อมูลย้อนหลังของ ${ticker} ไม่พอสำหรับ backtest ครับ` };
  const r = runBacktest(ticker, candles, strategy);
  if (!r) return { packet: `[backtest ${ticker} ไม่ได้ — กลยุทธ์นี้ไม่สร้างสัญญาณบนข้อมูลช่วงนั้น]`, demo: `กลยุทธ์นี้ไม่สร้างสัญญาณเทรดบน ${ticker} ในช่วง 5 ปีครับ` };
  const packet = `[Backtest จริง ${r.ticker} · กลยุทธ์: ${STRATEGIES[strategy].name} · ช่วง ${r.from} → ${r.to}]\nจำนวนไม้: ${r.trades} · Win rate ${r.winRate.toFixed(0)}% · เฉลี่ยต่อไม้ ${spct(r.avgReturnPerTrade)}\nกลยุทธ์รวม ${spct(r.strategyReturn)} vs ถือเฉยๆ ${spct(r.buyHoldReturn)} (เหนือกว่า ${spct(r.outperformance)}) · Drawdown สูงสุด ${r.maxDrawdown.toFixed(1)}%\nสมมติฐาน: เข้า-ออกที่ราคาปิดวันสัญญาณ ไม่รวมค่าธรรมเนียม/ปันผล/slippage`;
  const demo = `**🧪 Backtest ${r.ticker} 5 ปี — ${STRATEGIES[strategy].name}**\n- ไม้ทั้งหมด ${r.trades} ไม้ · Win rate **${r.winRate.toFixed(0)}%**\n- กลยุทธ์ได้ ${spct(r.strategyReturn)} vs ถือเฉยๆ ${spct(r.buyHoldReturn)}\n- Drawdown สูงสุด ${r.maxDrawdown.toFixed(1)}%\n\n_ไม่รวมค่าธรรมเนียม/ปันผล — ผลอดีตไม่รับประกันอนาคต_`;
  return { packet, demo };
}

/** ข่าวตามหัวข้อที่ถาม */
async function buildNewsPacket(text: string): Promise<{ packet: string; demo: string }> {
  let items = await getNews(text, 6, 48 * 3600_000).catch(() => []);
  if (items.length < 2) items = await getNews("stock market", 6, 48 * 3600_000).catch(() => []);
  if (!items.length) return { packet: "[ไม่พบข่าวตามหัวข้อนี้ — บอกผู้ใช้ตรงๆ]", demo: "ไม่พบข่าวตามหัวข้อนี้ครับ ลองเปลี่ยนคำค้น" };
  const age = (t: number) => {
    const h = Math.round((Date.now() - t) / 3600_000);
    return h < 1 ? "เมื่อสักครู่" : h < 24 ? `${h} ชม.ที่แล้ว` : `${Math.round(h / 24)} วันที่แล้ว`;
  };
  const packet = `[ข่าวจริงล่าสุดตามหัวข้อ "${cut(text, 40)}"]\n${items.map((n) => `- ${n.title} (${n.publisher}, ${age(n.time)})`).join("\n")}`;
  const demo = `**📰 ข่าวล่าสุด**\n${items.slice(0, 5).map((n) => `- ${n.title} _(${age(n.time)})_`).join("\n")}`;
  return { packet, demo };
}

/** ปันผล/ระยะยาว — logic เดียวกับหน้า /longterm */
async function buildLongtermPacket(): Promise<{ packet: string; demo: string }> {
  const data = await getLongterm().catch(() => null);
  if (!data) return { packet: "[ระบบคัดหุ้นระยะยาวไม่พร้อมชั่วคราว — แนะนำหน้า /longterm]", demo: "ระบบคัดหุ้นระยะยาวยังไม่พร้อมชั่วคราวครับ ลองเปิดหน้า /longterm" };
  const div = data.dividends.slice(0, 6).map((r) => `${r.ticker} ปันผล~${r.yieldPct?.toFixed(1)}%/ปี · ROE ${r.roePct?.toFixed(0) ?? "?"}% · งบแข็งแรง ${r.health}/100 · 5ปี ${r.ret5yPct !== null ? `${r.ret5yPct >= 0 ? "+" : ""}${r.ret5yPct}%` : "?"} (ราคาล้วน)`).join("\n");
  const comp = data.compounders.slice(0, 4).map((r) => `${r.ticker} CAGR5ปี ${r.cagr5yPct?.toFixed(1)}% · ${r.note}`).join("\n");
  const packet = `[หุ้นปันผล/ระยะยาว — คัดจากงบจริง + ปันผลจาก TradingView]\nสายปันผล:\n${div}\nสายโตต่อเนื่อง (compounder):\n${comp}\n${data.note}`;
  const demo = `**💤 หุ้นระยะยาวน่าสนใจ (ข้อมูลจริง)**\nปันผล:\n${data.dividends.slice(0, 4).map((r) => `- **${r.ticker}** ~${r.yieldPct?.toFixed(1)}%/ปี · งบ ${r.health}/100`).join("\n")}\nCompounder:\n${data.compounders.slice(0, 3).map((r) => `- **${r.ticker}** CAGR ${r.cagr5yPct?.toFixed(0)}%/ปี`).join("\n")}`;
  return { packet, demo };
}

/** ซื้อผ่านไหน/ยังไง — markets.ts + ลิสต์โบรกไทยจาก brokers.json */
function buildBrokerPacket(tickers: string[]): { packet: string; demo: string } {
  const lines: string[] = [];
  for (const t of tickers.filter(isRealStock).slice(0, 3)) {
    const b = brokerFor(t);
    const hint = marketOpenHint(t);
    lines.push(`${t} [${MARKET_LABEL[detectMarket(t)]}] → ${b.label}: ${b.detail}${hint ? ` · ${hint}` : ""}`);
  }
  if (!lines.length) {
    const brokers = (brokersJson as { brokers: { name: string; type: string; markets: string; fee: string; fractional: boolean; highlight: string }[] }).brokers;
    const brokerLines = brokers.map((b) => `${b.name} (${b.type}${b.fractional ? "·เศษหุ้นได้" : ""}) — ${b.markets} · ค่าธรรมเนียม ${b.fee} — ${b.highlight}`).join("\n");
    lines.push(
      `[ช่องทางซื้อหุ้นต่างประเทศสำหรับคนไทย — ทั้งหมด ${brokers.length} ช่องทาง (ค่าธรรมเนียมโดยประมาณ ก.ย. 2026)]`,
      brokerLines,
      "หุ้นไทย: โบรกเกอร์ไทยที่มีบัญชี SET ทุกที่ · ดัชนี/ทอง/น้ำมัน: ซื้อตรงไม่ได้ ดูเป็นสัญญาณ (อยากถือทองดู ETF อย่าง GLD)"
    );
  }
  return {
    packet: `[ช่องทางซื้อสำหรับคนไทย]\n${lines.join("\n")}`,
    demo: `**🛒 ช่องทางซื้อ**\n${lines.map((l) => `- ${l}`).join("\n")}`,
  };
}

/** วิธีใช้เว็บ */
function buildHelpPacket(): { packet: string; demo: string } {
  const guide = `[คู่มือเว็บ StockLens — ใช้ตอบคำถาม "ทำอะไรได้บ้าง" และชี้หน้าที่เกี่ยวข้อง]
- หน้าแรก /: Daily Picks หุ้นน่าสนใจวันนี้ · ดัชนี 6 ตลาด · Top Movers · ข่าวสด + สรุปไทย
- /surge: เรดาร์หุ้นซิ่ง พร้อมหลักฐาน 3 ชั้น (วอลุ่ม/ระยะจากยอด52สัปดาห์/พรีมาร์เก็ต)
- /radar: พิมพ์เหตุการณ์โลก → ห่วงโซ่ เหตุการณ์→สินค้า→หุ้น 12 ธีม 36 โหนด
- /screener: คัดกรอง 30 ประเทศ หมวดจริง+อุตสาหกรรมย่อย
- /stock/[TICKER]: กราฟ · คะแนนปัจจัย5มิติจากงบจริง · Bull/Base/Bear · AI 5 มุมมอง · เทคนิคขั้นสูง (Fibonacci/Elliott)
- /portfolio: watchlist + พอร์ต (P/L $+฿) + แจ้งเตือนราคา + เหตุการณ์โลกที่กระทบพอร์ต
- /backtest: ทดสอบ 3 กลยุทธ์ย้อนหลัง ~5 ปี
- /advisor-test: พิสูจน์เครื่องยนต์ AI advisor ย้อนหลัง 3 ปี
- /timemachine: ย้อนเวลาทำนายเหตุการณ์จริง 15 เหตุการณ์
- /gurus: 13F สดจาก SEC — กูรู 12 คน ถืออะไร/เพิ่งขายอะไร + backtest ตามกูรู
- /longterm: หุ้นปันผล & ระยะยาว
- /compare: เทียบหุ้น 2-4 ตัวข้ามตลาด
- /track-record: สถิติความแม่นสาธารณะ · /pricing: แพ็กเกจสมาชิก
- แชท (ตัวนี้): ถามได้ทั้งชื่อบริษัทภาษาไทย/อังกฤษ · วิเคราะห์พอร์ต/watchlist ของตัวเอง · เหตุการณ์โลก · กูรู · backtest · ปันผล · ข่าว · ซื้อผ่านเบอร์ไหน`;
  return { packet: guide, demo: guide };
}

/** เหตุการณ์ → ห่วงโซ่ Radar (keyword) — ถ้าไม่เจอ ส่งความร้อนธีมให้ AI วิเคราะห์เชิงเหตุผลต่อ */
async function buildEventPacket(text: string): Promise<{ packet: string; demo: string }> {
  const ev = await keywordAnalyze(text).catch(() => null);
  if (ev?.chains.length) {
    const lines = ev.chains.slice(0, 2).map((c) => {
      const up = c.stocks.filter((s) => s.direction === "positive").slice(0, 4).map((s) => `${s.ticker}${s.quote ? `(${spct(s.quote.changePct) ?? "?"})` : ""}`).join(", ");
      const down = c.stocks.filter((s) => s.direction === "negative").slice(0, 4).map((s) => `${s.ticker}${s.quote ? `(${spct(s.quote.changePct) ?? "?"})` : ""}`).join(", ");
      return `${c.name}: ${c.reason}\n→ มีแนวโน้มได้ประโยชน์: ${up || "-"} · เสียประโยชน์: ${down || "-"}`;
    });
    const heat = await computeThemeHeat();
    const heatLine = heat.slice(0, 3).map((h) => `${h.theme.emoji}${h.theme.name} ความร้อน${h.heat} (เฉลี่ย ${spct(h.avgChange) ?? "?"})`).join(", ");
    const packet = `[ห่วงโซ่ผลกระทบจากฐานความรู้ StockLens (36 โหนด) + ราคาสด]\n${lines.join("\n\n")}\nความร้อนธีมวันนี้: ${heatLine}`;
    const c0 = ev.chains[0];
    const demo = `**🕸️ ${c0.name}** — ${c0.reason}\n- ได้ประโยชน์: **${c0.stocks.filter((s) => s.direction === "positive").slice(0, 4).map((s) => s.ticker).join(", ") || "-"}**\n- เสียประโยชน์: **${c0.stocks.filter((s) => s.direction === "negative").slice(0, 4).map((s) => s.ticker).join(", ") || "-"}**\n\n(ห่วงโซ่เต็มที่หน้า /radar)`;
    return { packet, demo };
  }
  // ไม่เจอในฐานความรู้ — ให้ heat เป็นบริบท แล้ว AI วิเคราะห์เชิงเหตุผล (ห้ามแต่งตัวเลข)
  const heat = await computeThemeHeat();
  const heatLine = heat.slice(0, 3).map((h) => `${h.theme.emoji}${h.theme.name} ความร้อน${h.heat}`).join(", ");
  return {
    packet: `[เหตุการณ์นี้ไม่อยู่ในฐานความรู้ห่วงโซ่ — ให้วิเคราะห์เชิงเหตุผลได้ แต่ห้ามอ้างตัวเลขที่ไม่มีให้ และแนะนำผู้ใช้ลองหน้า /radar อธิบายเหตุการณ์ละเอียดกว่านี้]\nความร้อนธีมวันนี้เป็นบริบท: ${heatLine}`,
    demo: `เหตุการณ์นี้ยังไม่อยู่ในฐานความรู้ห่วงโซ่ของเราครับ 🙏\nธีมร้อนวันนี้: ${heatLine}\nลองเล่าเหตุการณ์เจาะจงขึ้น (ชื่อสินค้า/ประเทศ) หรือเปิดหน้า /radar ครับ`,
  };
}

/** 🤿 ใต้น้ำ vs 🎈 แพงเกินตัว — เครื่องยนต์เดียวกับหน้า /value */
async function buildValuePacket(): Promise<{ packet: string; demo: string }> {
  const data = await getValueScan().catch(() => null);
  if (!data) return { packet: "[สแกนใต้น้ำ/แพงเกินตัวไม่พร้อมชั่วคราว — แนะนำหน้า /value]", demo: "ระบบสแกนยังไม่พร้อมชั่วคราวครับ ลองเปิดหน้า /value" };
  const under = data.undervalued.map((r) => `${r.symbol} (${r.sector}) ราคา~${Math.round(r.priceThb).toLocaleString("th-TH")}฿ ตกจากยอด${Math.abs(r.from52wHighPct ?? 0).toFixed(0)}% · ปัจจัย${r.overall}/100 ความแพง${r.valuation}/100 · ${r.reasons.slice(0, 2).join(" · ")}`).join("\n");
  const over = data.overpriced.map((r) => `${r.symbol} (${r.sector}) วิ่ง+${r.changePct.toFixed(1)}% วันนี้ · ความแพง${r.valuation}/100 · ${r.reasons.slice(1, 3).join(" · ")}`).join("\n");
  const packet = `[สแกนรายวัน ${data.asOf} — สแกนแล้ว ${data.scannedCount} ตัว]\n🤿 ใต้น้ำพร้อมขึ้น (พื้นฐานดี ราคาต่ำ สัญญาณกลับตัว):\n${under || "วันนี้ไม่มีตัวผ่านเกณฑ์"}\n\n🎈 แพงเกินตัว (แพงตามงบ+ร้อนตามเทคนิค):\n${over || "วันนี้ไม่มีตัวผ่านเกณฑ์"}\n${data.note}`;
  const demo = `**🤿 ใต้น้ำวันนี้**\n${data.undervalued.slice(0, 4).map((r) => `- **${r.symbol}** ตกจากยอด ${Math.abs(r.from52wHighPct ?? 0).toFixed(0)}% · ปัจจัย ${r.overall}/100`).join("\n") || "- ไม่มีตัวผ่านเกณฑ์"}\n\n**🎈 แพงเกินตัววันนี้**\n${data.overpriced.slice(0, 4).map((r) => `- **${r.symbol}** +${r.changePct.toFixed(1)}% · ความแพง ${r.valuation}/100`).join("\n") || "- ไม่มีตัวผ่านเกณฑ์"}\n\nดูเต็มที่ /value`;
  return { packet, demo };
}

/** พอร์ตจำลอง StockLens (AI ปรับรายสัปดาห์) — ผลงานจริงสะสม */
async function buildModelPacket(): Promise<{ packet: string; demo: string }> {
  const state = await getModelPortfolio().catch(() => null);
  if (!state) return { packet: "[พอร์ตจำลองยังไม่พร้อมชั่วคราว — แนะนำหน้า /model-portfolio]", demo: "พอร์ตจำลองยังไม่พร้อมชั่วคราวครับ" };
  const last = state.snapshots[state.snapshots.length - 1];
  const live = await liveNav(state).catch(() => null);
  const hold = last.positions.map((p) => `${p.symbol} ${p.weight}%`).join(", ");
  const hist = state.snapshots.slice(-6).map((s) => `${s.weekKey}: ${s.weekReturnPct == null ? "เริ่มต้น" : (s.weekReturnPct >= 0 ? "+" : "") + s.weekReturnPct.toFixed(2) + "%"}`).join(" · ");
  const packet = `[พอร์ตจำลอง StockLens — ทุนสมมติ ฿100,000 · AI ปรับรายสัปดาห์]\nพอร์ตล่าสุด (${last.dateTh}): ${hold} + เงินสด ${last.cashPct}%\nNAV สด: ฿${(live?.navThb ?? last.navThb).toLocaleString("th-TH")} (${live && live.liveReturnPct >= 0 ? "+" : ""}${(live?.liveReturnPct ?? last.totalReturnPct).toFixed(2)}% รวม)\nเหตุผล AI: ${last.rationale.slice(0, 400)}\nผลรายสัปดาห์ล่าสุด: ${hist}\nอ่านเต็มที่ /model-portfolio`;
  const demo = `**💼 พอร์ตจำลอง StockLens**\n- พอร์ตล่าสุด: ${hold} + เงินสด ${last.cashPct}%\n- รวม ${(live?.liveReturnPct ?? last.totalReturnPct) >= 0 ? "+" : ""}${(live?.liveReturnPct ?? last.totalReturnPct).toFixed(2)}% จากทุน ฿100,000\n\nดูผลงานทุกสัปดาห์ที่ /model-portfolio`;
  return { packet, demo };
}

/** หุ้นจ่ายปันผลรายเดือน + ตัวเลขวางแผน — เครื่องยนต์เดียวกับหน้า /dividend */
async function buildMonthlyDivPacket(): Promise<{ packet: string; demo: string }> {
  const data = await getMonthlyDividends().catch(() => null);
  if (!data?.rows.length) return { packet: "[รายชื่อหุ้นปันผลรายเดือนไม่พร้อมชั่วคราว — แนะนำหน้า /dividend]", demo: "รายชื่อปันผลรายเดือนยังไม่พร้อมชั่วคราวครับ ลองเปิดหน้า /dividend" };
  const line = (r: (typeof data.rows)[number]) =>
    `${r.symbol} (${r.type}${r.risk === "สูง" ? "·เสี่ยงสูง" : r.risk === "ต่ำ" ? "·เสี่ยงต่ำ" : ""}) yield ${r.yieldPct.toFixed(1)}%/ปี${r.yieldSource === "live" ? "" : "(~)"} → ลง100kได้สุทธิ~${r.monthlyPer100kThb}฿/เดือน`;
  const safe = data.rows.filter((r) => r.risk !== "สูง").slice(0, 5).map(line).join("\n");
  const sweet = data.rows.filter((r) => r.risk === "สูง").slice(0, 4).map(line).join("\n");
  const packet = `[หุ้น/ETF จ่ายปันผลรายเดือน — yield สด ${data.asOf} (ภาษี 15% คิดแล้วในตัวเลขสุทธิ)]\nกลุ่มเสี่ยงต่ำ-กลาง:\n${safe}\nกลุ่ม yield หวานเสี่ยงสูง (มูลค่าพอร์ตมักลด กินปันผลอย่างเดียว):\n${sweet}\nสูตรวางแผน: อยากได้ X฿/เดือน = X×12÷(yieldสุทธิ) เช่น 10,000฿/เดือน ที่ 6%สุทธิ ต้องมีทุน ~2ล้าน — บอกผู้ใช้เปิด /dividend เพื่อวางแผนแบบละเอียด (สะสม+DRIP)`;
  const demo = `**📅 จ่ายปันผลเดือนละครั้ง**\n${data.rows.slice(0, 5).map((r) => `- **${r.symbol}** ${r.yieldPct.toFixed(1)}%/ปี → ~${r.monthlyPer100kThb}฿/เดือน ต่อทุน 1แสน`).join("\n")}\n\nเปิดหน้า /dividend วางแผนรายได้เต็มๆ ได้เลย`;
  return { packet, demo };
}

/** พอร์ตตัวอย่างรายวันสำหรับมือใหม่ — เครื่องยนต์เดียวกับหน้า /starter */
async function buildStarterPacket(text: string): Promise<{ packet: string; demo: string }> {
  const data = await getStarterPortfolios().catch(() => null);
  if (!data) return { packet: "[ระบบจัดพอร์ตมือใหม่ไม่พร้อมชั่วคราว — แนะนำหน้า /starter]", demo: "ระบบจัดพอร์ตยังไม่พร้อมชั่วคราวครับ ลองเปิดหน้า /starter" };
  const t = text.toLowerCase();
  const pickId = /ไทย|ตลาดไทย|ปันผลไทย|เป็นบาท/.test(t)
    ? "thai"
    : /สายเทค|หุ้นเทค|เทคโนโลยี|นาสแดก|qqq/.test(t)
      ? "tech"
      : /ตามรอยบัฟเฟต์|ตามรอยกูรู|พอร์ตบัฟเฟต์/.test(t)
        ? "guru"
        : /นิ่ง|กินปันผล|หลับ/.test(t)
          ? "calm"
          : /เติบโต|โตแรง|เสี่ยงได้|ซิ่ง/.test(t)
            ? "grow"
            : "balance";
  const p = data.profiles.find((x) => x.id === pickId) ?? data.profiles[1];
  const rows = p.positions
    .map((x) => `${x.symbol} (${x.name}) ${x.weight}% ราคา~${x.priceThb ? Math.round(x.priceThb).toLocaleString("th-TH") : "?"}บาท [เสี่ยง${x.risk}] — ${x.reason}`)
    .join("\n");
  const others = data.profiles.filter((x) => x.id !== p.id).map((x) => `${x.emoji}${x.title}`).join(", ");
  const packet = `[พอร์ตตัวอย่างรายวันสำหรับมือใหม่ โปรไฟล์ ${p.emoji}${p.title} — จัดจากข้อมูลจริงวันนี้]\nเงินสด ${p.cashPct}%\n${rows}\n(โปรไฟล์อื่น: ${others} — บอกผู้ใช้เปิดหน้า /starter เพื่อใส่งบบาทแล้วดูจำนวนหุ้นเป๊ะๆ)\n${data.note}`;
  const demo = `**${p.emoji} พอร์ตตัวอย่าง "${p.title}" วันนี้**\n${p.positions.map((x) => `- **${x.symbol}** ${x.weight}% — ${x.reason}`).join("\n")}\n- 💵 เงินสด ${p.cashPct}%\n\nเปิดหน้า /starter ใส่งบเป็นบาทได้เลย`;
  return { packet, demo };
}

// ---------- 5) ประตูรวม — เรียกจาก /api/chat ----------

const PACKET_CAP = 8000;

export async function assembleGrounding(
  text: string,
  portfolio?: ChatHolding[],
  watchlist?: string[]
): Promise<Grounding> {
  const tickers = await resolveNames(text);
  const intents = detectIntent(text, tickers, { portfolio, watchlist });
  const packets: string[] = [];
  const demos: string[] = [];
  const realStocks = tickers.filter(isRealStock);

  const push = (r: { packet: string; demo: string }) => {
    if (r.packet) packets.push(r.packet);
    if (r.demo) demos.push(r.demo);
  };

  for (const intent of intents) {
    try {
      if (intent === "stock") push(await buildStockPacket(realStocks));
      else if (intent === "portfolio") push(await buildPortfolioPacket(portfolio ?? []));
      else if (intent === "watchlist") push(await buildWatchlistPacket(watchlist ?? []));
      else if (intent === "market") push(await buildMarketPacket());
      else if (intent === "surge") {
        const s = await getSurge();
        if (s.rows.length) {
          const line = s.rows.slice(0, 5).map((r) => `${r.ticker} +${r.changePct.toFixed(1)}% [${r.flags.join("/") || "ขยับแรง"}] (mcap ${r.marketCapB.toFixed(1)}พันล้านUSD)`).join(" · ");
          push({ packet: `[หุ้นซิ่งวันนี้ — เหลักฐานจริง3ชั้น ข้อมูล ${s.asOf}]\n${line}`, demo: `**🚀 หุ้นซิ่งเด่นวันนี้**\n${s.rows.slice(0, 4).map((r) => `- **${r.ticker}** +${r.changePct.toFixed(1)}% ${r.flags.join(" ")}`).join("\n")}` });
        }
      } else if (intent === "guru") push(await buildGuruPacket(text));
      else if (intent === "backtest") push(await buildBacktestPacket(text, tickers));
      else if (intent === "event") push(await buildEventPacket(text));
      else if (intent === "news") push(await buildNewsPacket(text));
      else if (intent === "longterm") push(await buildLongtermPacket());
      else if (intent === "monthly-div") push(await buildMonthlyDivPacket());
      else if (intent === "model") push(await buildModelPacket());
      else if (intent === "value") push(await buildValuePacket());
      else if (intent === "starter") push(await buildStarterPacket(text));
      else if (intent === "broker") push(buildBrokerPacket(tickers));
      else if (intent === "help") push(buildHelpPacket());
      // "general" — ไม่มี packet: โหมดรอบด้าน ตอบจากความรู้ AI + กติกาห้ามเดาเลข
    } catch {
      // intent ไหนพังไม่ดึงพวกลง — ที่เหลือยังตอบได้
    }
  }

  let packet = packets.join("\n\n");
  if (packet.length > PACKET_CAP) packet = packet.slice(0, PACKET_CAP) + "\n…(ข้อมูลถูกย่อเพื่อประหยัดบริบท)";
  const demoReply = demos.length
    ? demos.join("\n\n") + "\n\n_ตอบจากข้อมูลจริง ณ ตอนนี้ (โหมดตัวอย่าง) · ⚠️ เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน_"
    : "";
  return { packet, demoReply, tickers, intents };
}
