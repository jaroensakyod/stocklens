// ===== AI Chat แบบ Grounded (หลักการเดียวกับ bazi: "Truth Packet" — ข้อมูลจริงเข้าก่อน LLM เดาไม่ได้) =====
import { NextRequest } from "next/server";
import { buildAnalysis } from "@/lib/analysis";
import { keywordAnalyze } from "@/lib/radar";
import { chatStream, hasAI, SYSTEM_ANALYST, friendlyAIError } from "@/lib/ai";
import { getNews, getQuotes } from "@/lib/yahoo";
import { tvUniverse, findSectorInfo } from "@/lib/tvscanner";

export const dynamic = "force-dynamic";

// คำถามเชิงภาพรวมตลาด — "วันนี้มีอะไรน่าสนใจ / ตลาดวันนี้เป็นยังไง"
function isMarketOverviewQuestion(text: string, tickers: string[]): boolean {
  if (tickers.length > 0) return false;
  return /วันนี้|ตลาดวันนี้|น่าสนใจ|เด่น|เกิดอะไรขึ้น|overview|market today|มีอะไร|เป็นยังไงบ้าง/.test(text);
}

/** สร้าง truth packet ภาพรวมตลาดวันนี้: ดัชนี + movers ทั้งตลาด + premarket + ธีมร้อน + ข่าวสด */
async function buildMarketPacket(): Promise<{ packet: string; demoReply: string }> {
  const [indices, moversAll, news] = await Promise.all([
    getQuotes(["^GSPC", "^IXIC", "^DJI", "^VIX", "^SET.BK"]),
    tvUniverse("america", 600),
    getNews("stock market", 8, 48 * 3600_000),
  ]);
  const idxNames: Record<string, string> = { "^GSPC": "S&P 500", "^IXIC": "NASDAQ", "^DJI": "DOW", "^VIX": "VIX", "^SET.BK": "SET" };
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

  const heat = await import("@/lib/radar").then((m) => m.computeThemeHeat());
  const themes = heat.slice(0, 3).map((h) => `${h.theme.emoji}${h.theme.name} ความร้อน ${h.theme ? h.heat : "?"}`).join(", ");

  const packet = `[ภาพรวมตลาดวันนี้ — ข้อมูลจริง]\nดัชนี: ${idxLine}\nขึ้นแรง (mcap>5B): ${gainers}\nลงแรง: ${losers}\nพรีมาร์เก็ตเด่น: ${pm || "ไม่มีข้อมูล"}\nธีม Radar ร้อนสุด: ${themes}\nข่าว 48 ชม.ล่าสุด: ${newsLine}`;
  const demoReply = `**📊 ตลาดวันนี้ (ข้อมูลจริง ณ ตอนนี้)**\n- ดัชนี: ${idxLine}\n- 🚀 ขึ้นแรง: ${gainers}\n- 💀 ลงแรง: ${losers}${pm ? `\n- 🌅 พรีมาร์เก็ตเด่น: ${pm}` : ""}\n- 🔥 ธีมที่ร้อนสุด: ${themes}\n\n📰 พาดหัวล่าสุด:\n${news.slice(0, 4).map((n) => `- ${n.title}`).join("\n")}\n\n_ตอบจากข้อมูลจริง (โหมดตัวอย่าง — เสียบ AI key เพื่อคำวิเคราะห์เต็ม)_\n\n⚠️ เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน`;
  return { packet, demoReply };
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

// ตรวจจับ ticker ในข้อความ — ถ้าถามเรื่องพอร์ต/หลายตัว รับได้ถึง 4
function extractTickers(text: string): string[] {
  const matches = text.toUpperCase().match(/\b([A-Z]{2,5}(?:\.(?:BK|HK|T|TO|DE|PA|AS|L|MI|MC|ST|SW|KS|NS))?)\b/g) ?? [];
  const common = new Set(["IS", "ARE", "THE", "AND", "FOR", "YOU", "HOW", "WHAT", "WHY", "STOCK", "BUY", "SELL", "AI", "VS", "OR", "NOT", "CAN", "TOP", "SET", "ETF", "IPO", "GDP", "CPI", "FED", "OIL", "GOLD", "WELL"]);
  const unique = [...new Set(matches.map((m) => m.trim()))].filter((t) => !common.has(t));
  const portfolioMode = /พอร์ต|ถือ|portfolio|holdings/i.test(text) || unique.length > 2;
  return unique.slice(0, portfolioMode ? 4 : 2);
}

// สร้าง "truth packet" — ข้อมูลจริงที่ฉีดเข้า context
async function buildTruthPacket(userText: string): Promise<{ packet: string; demoReply: string; tickers: string[] }> {
  const tickers = extractTickers(userText);
  const parts: string[] = [];
  const demoParts: string[] = [];

  for (const t of tickers) {
    const a = await buildAnalysis(t);
    if (!isFinite(a.quote.price)) continue;
    const sec = await findSectorInfo(t);
    const f = a.factors, tech = a.technicals;
    parts.push(
      `[ข้อมูลจริง ${t} — ${a.quote.name}${sec?.sector ? ` · หมวด ${sec.sector}${sec.industry ? ` (${sec.industry})` : ""}` : ""}]\nราคา ${a.quote.price.toFixed(2)} ${a.quote.currency} (${a.quote.changePct >= 0 ? "+" : ""}${a.quote.changePct.toFixed(2)}% วันนี้)` +
      (a.usdThb && a.quote.currency === "USD" ? ` ≈ ${(a.quote.price * a.usdThb).toFixed(0)} บาท (ซื้อได้ใน Dime! เศษหุ้นเริ่ม 50฿)` : "") +
      (a.profile?.marketCap ? ` | มูลค่าตลาด ${(a.profile.marketCap / 1e9).toFixed(0)} พันล้าน USD` : "") +
      (a.profile?.trailingPE ? ` | P/E ${a.profile.trailingPE.toFixed(1)}` : "") +
      (f ? `\nคะแนนปัจจัย: Valuation ${f.valuation} · Growth ${f.growth} · Profitability ${f.profitability} · Momentum ${f.momentum} · Health ${f.health} (รวม ${f.overall}/100)` : "") +
      (a.financials?.revenueGrowth !== undefined ? ` | รายได้โต ${(a.financials.revenueGrowth * 100).toFixed(1)}% YoY` : "") +
      (a.financials?.returnOnEquity !== undefined ? ` | ROE ${(a.financials.returnOnEquity * 100).toFixed(1)}%` : "") +
      (tech ? `\nเทคนิค: สัญญาณ${tech.signal === "bullish" ? "เอียงบวก" : tech.signal === "bearish" ? "เอียงลบ" : "เป็นกลาง"} — ${tech.reasons.slice(0, 3).join(" · ")}` : "") +
      (a.news.length ? `\nข่าวล่าสุด: ${a.news.slice(0, 2).map((n) => n.title).join(" / ")}` : "")
    );
    demoParts.push(
      `**${t} — ${a.quote.name}** ${a.quote.price.toFixed(2)} ${a.quote.currency} (${a.quote.changePct >= 0 ? "+" : ""}${a.quote.changePct.toFixed(2)}%)` +
      (a.usdThb && a.quote.currency === "USD" ? ` ≈ ${(a.quote.price * a.usdThb).toFixed(0)}฿` : "") +
      (f ? `\n- คะแนนรวม **${f.overall}/100** (มูลค่า ${f.valuation} · โต ${f.growth} · กำไร ${f.profitability} · โมเมนตัม ${f.momentum} · แข็งแรง ${f.health})` : "") +
      (tech ? `\n- เทคนิค: **${tech.signal === "bullish" ? "เอียงบวก 📈" : tech.signal === "bearish" ? "เอียงลบ 📉" : "เป็นกลาง ⚖️"}** — ${tech.reasons.slice(0, 2).join(" · ")}` : "") +
      (a.financials?.revenueGrowth !== undefined ? `\n- รายได้โต ${(a.financials.revenueGrowth * 100).toFixed(1)}% · ROE ${a.financials.returnOnEquity !== undefined ? (a.financials.returnOnEquity * 100).toFixed(0) + "%" : "-"}` : "")
    );
  }

  // ถ้าไม่มี ticker — ลองมองว่าเป็นเหตุการณ์ → ห่วงโซ่ Radar
  if (!tickers.length) {
    const ev = await keywordAnalyze(userText);
    if (ev.chains.length) {
      const c = ev.chains[0];
      const up = c.stocks.filter((s) => s.direction === "positive").slice(0, 4).map((s) => s.ticker).join(", ");
      const down = c.stocks.filter((s) => s.direction === "negative").slice(0, 4).map((s) => s.ticker).join(", ");
      parts.push(`[ห่วงโซ่ผลกระทบจากฐานความรู้ StockLens]\n${c.name}: ${c.reason}\nหุ้นที่มีแนวโน้มได้ประโยชน์: ${up || "-"} · เสียประโยชน์: ${down || "-"}`);
      demoParts.push(
        `**${c.name}** — ${c.reason}\n- มีแนวโน้มได้ประโยชน์: **${up}**\n- มีแนวโน้มเสียประโยชน์: **${down}**\n\n(ดูห่วงโซ่เต็มได้ที่หน้า Global Radar)`
      );
    }
  }

  return {
    packet: parts.join("\n\n"),
    demoReply: demoParts.length
      ? demoParts.join("\n\n") + "\n\n_ตอบจากข้อมูลจริง ณ ตอนนี้ (โหมดตัวอย่าง — เสียบ AI key ที่ .env.local เพื่อคุยเต็มรูปแบบ)_\n\n⚠️ เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน"
      : "",
    tickers,
  };
}

// POST /api/chat { messages } → stream คำตอบภาษาไทย
export async function POST(req: NextRequest) {
  const { messages } = (await req.json().catch(() => ({}))) as { messages?: ChatMsg[] };
  if (!messages?.length) return new Response("missing messages", { status: 400 });
  const history = messages.slice(-8); // จำกล่องล่าสุด 8 ข้อความ
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

  // คำถามภาพรวมตลาด → truth packet แบบตลาดทั้งหมด / ไม่งั้น → ตาม ticker/เหตุการณ์
  const preTickers = extractTickers(lastUser);
  const market =
    isMarketOverviewQuestion(lastUser, preTickers)
      ? await buildMarketPacket()
      : null;
  const { packet, demoReply } = market ?? (await buildTruthPacket(lastUser));
  const enc = new TextEncoder();

  if (!hasAI()) {
    const text =
      demoReply ||
      "สอบถามได้เลยครับ เช่น:\n- **NVDA ตอนนี้เป็นยังไง** (พิมพ์ชื่อหุ้น — ผมจะดึงราคา/คะแนนปัจจัย/สัญญาณจริงมาตอบ)\n- **ฝนตกหนักที่แอฟริกา กระทบหุ้นอะไร** (เหตุการณ์ → ห่วงโซ่ผลกระทบ)\n\n_โหมดตัวอย่าง (ยังไม่มี AI key) — ตอบจากข้อมูลจริงที่คำนวณได้เท่านั้น_";
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of text.match(/[\s\S]{1,16}/g) ?? []) {
          controller.enqueue(enc.encode(chunk));
          await new Promise((r) => setTimeout(r, 10));
        }
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-AI-Mode": "demo" } });
  }

  const sys = SYSTEM_ANALYST +
    `\n\nคุณกำลังเป็น "ผู้ช่วยแชท" ของ StockLens ตอบสั้นกระชับเหมือนคุยกัน (ไม่ต้องครบทุกหัวข้อเหมือนรายงาน) ใช้ markdown น้อยๆ ยกเว้นตัวหนา\nถ้ามี [ข้อมูลจริง ...] แนบมา ให้ตอบจากข้อมูลนั้นเป็นหลัก อ้างตัวเลขจริง ห้ามเดาเลข\nถ้าถามว่าควรซื้อไหม ให้ชี้ว่าอะไรหนุน/อะไรกดดันจากข้อมูล + เตือนความเสี่ยง ไม่ตัดสินใจแทน`;
  const aiMessages = [
    { role: "system" as const, content: sys },
    ...(packet ? [{ role: "system" as const, content: `ข้อมูลจริงประกอบคำตอบ:\n${packet}` }] : []),
    ...history,
  ];

  try {
    const stream = await chatStream(aiMessages, 0.5);
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-AI-Mode": "live" } });
  } catch (e) {
    const msg = `⚠️ ${friendlyAIError(e)} — แสดงข้อมูลจริงแทน\n\n` + (demoReply || "ลองใหม่อีกครั้งครับ");
    return new Response(msg, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-AI-Mode": "demo" } });
  }
}
