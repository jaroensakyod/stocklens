import { NextRequest } from "next/server";
import { buildAnalysis } from "@/lib/analysis";
import { chatOnce, hasAI, friendlyAIError } from "@/lib/ai";

export const dynamic = "force-dynamic";

// 🎬 Story Card Generator — แกะสูตรคอนเทนต์หุ้นไวรัล (สไตล์ "Lab.เล่าหุ้น"):
// hook คำถาม → เฉลยด้วยตัวเลขจริง + emoji → "ทำไม?" → 3 จุดที่ต้องรู้พร้อมเลข → สรุป + disclaimer
// ตัวเลขทุกตัวมาจาก "truth packet" (งบจริง/ราคาจริง) เท่านั้น — AI ทำหน้าที่เรียบเรียง ไม่ใช่คิดเลขเอง

interface Scene {
  n: number;
  dur: string;
  text: string;
  visual: string;
}

interface StoryCard {
  engine: "ai" | "demo";
  ticker: string;
  name: string;
  hook: string;
  reveal: string;
  why: string;
  points: string[];
  close: string;
  hashtags: string;
  scenes: Scene[];
  error?: string;
}

const SYSTEM_STORY = `คุณคือนักเขียนคอนเทนต์หุ้นของ StockLens สไตล์ "เล่าหุ้นให้เข้าใจใน 30 วินาที" (เหมือนเพจคอนเทนต์หุ้นไวรัล)
สูตรที่ต้องทำตามเป๊ะ:
1. hook = คำถามเปิดชวนสงสัย 1 ประโยค รูปแบบ "ใครสงสัยบ้างว่า…" หรือ "ทำไม…?" ต้องอยากรู้คำตอบทันที
2. reveal = เฉลยคำถามด้วยตัวเลขจริงจากข้อมูลที่ให้มา ใส่ emoji กำกับ 2-3 ตัว
3. why = อธิบาย "ทำไมมันเป็นแบบนั้น" 2-3 ประโยค เชื่อมกับเทรนด์ใหญ่ (AI / สงคราม / อาหาร / พลังงาน / ดอลลาร์ ฯลฯ)
4. points = 3 ข้อ แต่ละข้อ 1-2 ประโยค ต้องมีตัวเลขหรือสเปคกำกับเสมอ
5. close = สรุปกระชับ 1-2 ประโยค แบบมืออาชีพ ชวนติดตามต่อ
กติกาสำคัญ: ตัวเลขงบการเงิน/ราคา/วาลูเอชั่น/ราคาเป้าหมาย ห้ามคิดเองทั้งหมด ใช้จาก [ข้อมูลจริง] เท่านั้น · ห้ามอ้าง "นักวิเคราะห์ให้เป้าหมาย…" หรือ consensus ใดๆ ที่ไม่มีในข้อมูล · เล่าบริบทธุรกิจ ผลิตภัณฑ์ คู่แข่ง จากความรู้ทั่วไปได้แต่ห้ามแต่งตัวเลขทุกชนิด (รวมสเปค ยอดขายสินค้า ส่วนแบ่งตลาด) · ภาษาพูดทางการ อ่านจบ ~30 วินาที · ห้ามคำว่า "ควรซื้อ/ควรขาย"
ตอบเป็น JSON เท่านั้น:
{"hook":"…","reveal":"…","why":"…","points":["…","…","…"],"close":"…","hashtags":"#หุ้น #การลงทุน #<TICKER> #<ชื่อย่อบริษัท>","scenes":[{"dur":"0-3s","text":"ข้อความ overlay บนจอ (สั้นมาก)","visual":"คำแนะนำภาพ/อารมณ์ฉาก"},... 6-7 ฉากครอบคลุม hook→reveal→why→3จุด→close]}`;

const CURRENCY_TH: Record<string, string> = { USD: "ดอลลาร์", THB: "บาท", HKD: "ดอลลาร์ฮ่องกง", JPY: "เยน", EUR: "ยูโร", GBP: "ปอนด์", TWD: "ดอลลาร์ไต้หวัน", KRW: "วอน", SGD: "ดอลลาร์สิงคโปร์", AUD: "ดอลลาร์ออสเตรเลีย", CAD: "ดอลลาร์แคนาดา", INR: "รูปี", IDR: "รูเปีย", VND: "ดอง", MYR: "ริงกิต", PHP: "เปโซ", CNY: "หยวน" };

function buildPacket(a: Awaited<ReturnType<typeof buildAnalysis>>): string {
  const f = a.financials;
  const p = a.profile;
  const pct = (x?: number) => (x !== undefined ? `${(x * 100).toFixed(1)}%` : null);
  // หน่วยเงินตราของงบ — Yahoo รายงานตามสกุลที่หุ้นจดทะเบียน (หุ้นไทย = บาท) ห้าม label เป็นดอลลาร์เด็ดขาด
  const curTh = CURRENCY_TH[a.quote.currency] || a.quote.currency;
  const bn = (x: number) => `${(x / 1e9).toFixed(1)} พันล้าน${curTh}`;
  const lines = [
    `[ข้อมูลจริง ${a.quote.symbol} — ${a.quote.name}]`,
    `ราคาปัจจุบัน ${a.quote.price.toFixed(2)} ${a.quote.currency} (${a.quote.changePct >= 0 ? "+" : ""}${a.quote.changePct.toFixed(2)}% วันนี้)`,
    `หมายเหตุ: ตัวเลขงบด้านล่างอยู่ในสกุล ${curTh} ตามที่บริษัทรายงาน`,
    p?.sector ? `หมวด: ${p.sector}${p.industry ? ` / ${p.industry}` : ""}` : null,
    p?.marketCap ? `มูลค่าตลาด ${bn(p.marketCap)}` : null,
    p?.trailingPE ? `P/E (TTM) ${p.trailingPE.toFixed(1)}${p.forwardPE ? ` · Forward P/E ${p.forwardPE.toFixed(1)}` : ""}` : null,
    p?.dividendYield ? `ปันผล ${p.dividendYield.toFixed(2)}%` : null,
    p?.fiftyTwoHigh ? `ไฮ/โลว์ 52 สัปดาห์ ${p.fiftyTwoLow?.toFixed(2)}–${p.fiftyTwoHigh.toFixed(2)}` : null,
    f?.revenueGrowth !== undefined ? `รายได้โต YoY ${pct(f.revenueGrowth)}` : null,
    f?.earningsGrowth !== undefined ? `กำไรโต YoY ${pct(f.earningsGrowth)}` : null,
    f?.grossMargins !== undefined ? `Gross Margin ${pct(f.grossMargins)}` : null,
    f?.operatingMargins !== undefined ? `Operating Margin ${pct(f.operatingMargins)}` : null,
    f?.profitMargins !== undefined ? `Net Margin ${pct(f.profitMargins)}` : null,
    f?.returnOnEquity !== undefined ? `ROE ${pct(f.returnOnEquity)}` : null,
    f?.debtToEquity !== undefined ? `หนี้/ทุน ${f.debtToEquity.toFixed(2)}` : null,
    f?.freeCashflow ? `FCF ${bn(f.freeCashflow)}` : null,
    a.factors ? `คะแนนปัจจัย: Valuation ${a.factors.valuation} · Growth ${a.factors.growth} · Profitability ${a.factors.profitability} · Momentum ${a.factors.momentum} · Health ${a.factors.health} (รวม ${a.factors.overall}/100)` : null,
    a.technicals ? `สัญญาณเทคนิค: ${a.technicals.signal}${a.technicals.rsi14 ? ` · RSI ${a.technicals.rsi14.toFixed(0)}` : ""}` : null,
    a.news.length ? `ข่าวล่าสุด:\n- ${a.news.slice(0, 3).map((n) => n.title).join("\n- ")}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

// โหมดตัวอย่าง (ไม่มี AI key) — เทมเพลตจากตัวเลขจริงล้วน
function demoCard(a: Awaited<ReturnType<typeof buildAnalysis>>): StoryCard {
  const f = a.financials;
  const p = a.profile;
  const pct = (x?: number) => (x !== undefined ? `${(x * 100).toFixed(1)}%` : "n/a");
  const growth = f?.revenueGrowth !== undefined ? (f.revenueGrowth >= 0 ? "โต" : "หด") : "";
  const t = a.quote.symbol;
  const curTh = CURRENCY_TH[a.quote.currency] || a.quote.currency;
  const bn = (x: number) => `${(x / 1e9).toFixed(0)} พันล้าน${curTh}`;
  return {
    engine: "demo",
    ticker: t,
    name: a.quote.name,
    hook: `ใครสงสัยบ้างว่าเบื้องหลังราคาหุ้น ${t} ตอนนี้ ${a.quote.price.toFixed(2)} ${a.quote.currency} มีตัวเลขอะไรซ่อนอยู่บ้าง?`,
    reveal: `📈 รายได้${growth} ${pct(f?.revenueGrowth)} YoY${p?.marketCap ? ` · มูลค่าตลาด ${bn(p.marketCap)}` : ""}${p?.trailingPE ? ` · P/E ${p.trailingPE.toFixed(1)}` : ""}`,
    why: `ทำไมต้องดู? เพราะตัวเลขพวกนี้คือสิ่งที่นักลงทุนสถาบันดูก่อนตัดสินใจเสมอ — ${p?.sector ? `ในธุรกิจ${p.sector}` : "ในธุรกิจนี้"} ใครจับ margin และกระแสเงินสดได้ดีกว่า คือผู้ชนะในระยะยาว`,
    points: [
      `💰 ความสามารถทำกำไร: Net Margin ${pct(f?.profitMargins)}${f?.returnOnEquity !== undefined ? ` · ROE ${pct(f.returnOnEquity)}` : ""} — วัดว่าบริษัทแปลงยอดขายเป็นกำไรจริงเก่งแค่ไหน`,
      `📊 การเติบโต: รายได้ ${pct(f?.revenueGrowth)}${f?.earningsGrowth !== undefined ? ` · กำไร ${pct(f.earningsGrowth)}` : ""} YoY — สิ่งที่ตลาดจ่ายแพงเพื่อให้ได้`,
      a.factors ? `🧭 คะแนนรวม StockLens ${a.factors.overall}/100 (แตกตาม 5 มิติ: Valuation ${a.factors.valuation} · Growth ${a.factors.growth} · Profitability ${a.factors.profitability} · Momentum ${a.factors.momentum} · Health ${a.factors.health})` : `🧭 ดูความแข็งแรงงบ: ${f?.debtToEquity !== undefined ? `หนี้/ทุน ${f.debtToEquity.toFixed(2)}` : "ข้อมูลงบยังไม่ครบ"}${f?.freeCashflow ? ` · FCF ${bn(f.freeCashflow)}` : ""}`,
    ],
    close: `อยากดูบทวิเคราะห์ฉบับเต็ม+สถานการณ์ Bull/Base/Bear ของ ${t} — หาได้เลยที่ StockLens (ฟรี) และรายงาน Deep Dive ในกลุ่ม VIP`,
    hashtags: `#หุ้น #การลงทุน #${t.replace(/[.=]/g, "")} #StockLens #ลงทุนอย่างมีข้อมูล`,
    scenes: [
      { n: 1, dur: "0-3s", text: a.quote.name, visual: "โลโก้บริษัทใหญ่กลางจอ + ticker เด้งเข้ามา" },
      { n: 2, dur: "3-6s", text: `ราคา ${a.quote.price.toFixed(2)} ${a.quote.currency} (${a.quote.changePct >= 0 ? "+" : ""}${a.quote.changePct.toFixed(2)}%)`, visual: "กราฟราคา 1 ปีเลื่อนจากซ้ายไปขวา" },
      { n: 3, dur: "6-10s", text: `รายได้${growth} ${pct(f?.revenueGrowth)} YoY`, visual: "ตัวเลขใหญ่เด้ง + bar ชูขึ้น/ลง" },
      { n: 4, dur: "10-14s", text: `Net Margin ${pct(f?.profitMargins)} · ROE ${pct(f?.returnOnEquity)}`, visual: "การ์ดตัวเลข 2 ใบไล่เข้าทีละใบ" },
      { n: 5, dur: "14-19s", text: "3 จุดที่ต้องรู้ (ไล่ตามคลิป)", visual: "ข้อความ 3 บรรทัดโผล่ทีละบรรทัด" },
      { n: 6, dur: "19-24s", text: "สรุป: ดูข้อมูลก่อนตัดสินใจเสมอ", visual: "หน้าเว็บ StockLens + ปุ่มติดตาม" },
      { n: 7, dur: "24-27s", text: "⚠️ เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน", visual: "disclaimer ตัวเล็กด้านล่าง" },
    ],
  };
}

function assembleCaption(c: StoryCard): string {
  const points = c.points.slice(0, 3).map((p, i) => `${["1️⃣", "2️⃣", "3️⃣"][i] || "•"} ${p}`);
  return [
    c.hook,
    "",
    c.reveal,
    "",
    c.why,
    "",
    ...points,
    "",
    c.close,
    "",
    "⚠️ บทวิเคราะห์เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน การลงทุนมีความเสี่ยง",
    "",
    c.hashtags,
  ].join("\n");
}

export async function GET(req: NextRequest) {
  const s = (req.nextUrl.searchParams.get("s") || "").trim().toUpperCase();
  if (!s) return Response.json({ error: "missing s" }, { status: 400 });

  const a = await buildAnalysis(s);
  if (!isFinite(a.quote.price)) return Response.json({ error: `ไม่พบ ${s} ในระบบ` }, { status: 404 });

  if (!hasAI()) {
    const demo = demoCard(a);
    return Response.json({ ...demo, caption: assembleCaption(demo) });
  }

  try {
    const raw = await chatOnce(
      [
        { role: "system", content: SYSTEM_STORY },
        { role: "user", content: `${buildPacket(a)}\n\nเขียน story card ของ ${a.quote.symbol} ตามสูตร — จำนวน scenes 6-7 ฉาก` },
      ],
      0.7,
    );
    const cleaned = raw.replace(/^```(json)?|```$/g, "").trim();
    const j = JSON.parse(cleaned) as Partial<StoryCard> & { points?: string[]; hashtags?: string };
    const card: StoryCard = {
      engine: "ai",
      ticker: a.quote.symbol,
      name: a.quote.name,
      hook: j.hook || `ใครสงสัยบ้างว่าเบื้องหลังหุ้น ${a.quote.symbol} มีอะไร?`,
      reveal: j.reveal || `ราคาตอนนี้ ${a.quote.price.toFixed(2)} ${a.quote.currency} (${a.quote.changePct >= 0 ? "+" : ""}${a.quote.changePct.toFixed(2)}%)`,
      why: j.why || "",
      points: Array.isArray(j.points) && j.points.length ? j.points.slice(0, 4) : [],
      close: j.close || "",
      hashtags: j.hashtags || `#หุ้น #การลงทุน #${a.quote.symbol.replace(/[.=]/g, "")}`,
      scenes: Array.isArray(j.scenes)
        ? j.scenes.slice(0, 8).map((sc: { dur?: string; text?: string; visual?: string }, i: number) => ({
            n: i + 1,
            dur: sc.dur || "",
            text: sc.text || "",
            visual: sc.visual || "",
          }))
        : [],
    };
    return Response.json({ ...card, caption: assembleCaption(card) });
  } catch (e) {
    const fb = demoCard(a);
    return Response.json({ ...fb, caption: assembleCaption(fb), error: friendlyAIError(e) });
  }
}
