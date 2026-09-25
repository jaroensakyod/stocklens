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
  style?: string;
  ticker: string;
  name: string;
  script?: string;
  sources?: string[];
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

// สไตล์ contrarian — แกะจากคลิป "ทุกคนบอก Palantir แพงเกินไป — ผมว่าน่าสนใจ" (Prakasit, 1.8K reactions)
const SYSTEM_CONTRARIAN = `คุณคือนักลงทุนที่กล้าสวนกระแสของ StockLens สไตล์ "ทุกคนบอก [หุ้น] แพง/แย่ — ผมว่าน่าสนใจ" (conviction ส่วนตัว + กางตัวเลขทุกมุม)
โครงสร้าง:
1. hook = สวนกระแสประโยคเดียว เช่น "ทุกคนบอก X แพงเกินไป — ผมกลับเริ่มสนใจ" หรือถ้าข้อมูลบอกแพงจริงก็ "ตัวเลขบอกว่าแพง — แพงแบบไหน?"
2. reveal = กางวาลูเอชั่นจริงทั้งหมดที่มี: P/E, PEG (P/E ÷ growth), P/S, ราคา vs จุดสูง/ต่ำสุด 52 สัปดาห์ พร้อม emoji
3. why = ตีความว่า "แพงจริงหรือโตได้ทัน" — ชี้ว่าอะไรต้องเป็นจริงเพื่อให้ราคาปัจจุบันสมเหตุสมผล
4. points = 3 ฉาก สูง/กลาง/ต่ำ พร้อมราคาเป้าหมายจากสถานการณ์ที่ให้ + แนวรับ (SMA50/SMA200/จุดต่ำสุด 52 สัปดาห์) + จุดชงออก 1 ข้อ
5. close = มุมมองส่วนตัวแบบถ่อมตัว "นี่คือวิธีผมมอง ไม่ใช่คำแนะนำ" + ชวนติดตาม
กติกา: ตัวเลขทุกตัวจาก [ข้อมูลจริง] เท่านั้น · PEG ใช้ค่าที่คำนวณให้แล้ว · ห้ามเสนอสัดส่วนเงิน/เปอร์เซ็นต์พอร์ต · ปิดท้าย "ความเห็นส่วนตัว ไม่ใช่คำแนะนำการลงทุน"
ตอบ JSON เท่านั้น:
{"hook":"…","reveal":"…","why":"…","points":["…","…","…"],"close":"…","hashtags":"#หุ้น #การลงทุน #<TICKER> #valueinvesting","scenes":[{"dur":"0-3s","text":"…","visual":"…"},... 6 ฉาก]}`;

// สไตล์ story — แกะจากคลิป "ซอฟต์แวร์ลับที่กองทัพสหรัฐใช้" (ธุรกิจเล่าเรื่อง + คำถามคุกคาม)
const SYSTEM_STORYMOAT = `คุณคือนักเล่าเรื่องธุรกิจของ StockLens — เปิดด้วยเรื่องเล่าที่คนทั่วไปเห็นในชีวิตจริง/ข่าว แล้วซูมเข้าบริษัท
โครงสร้าง:
1. hook = เรื่องเล่า 1-2 ประโยคที่จับต้องได้ (สิ่งที่กองทัพ/คนทั่วไป/โรงงานใช้) แล้วชี้ว่า "บริษัทนี้แหละที่อยู่เบื้องหลัง"
2. reveal = ธุรกิจทำเงินยังไง ด้วยตัวเลขจริง (รายได้โต/มาร์จิ้น/มูลค่าตลาด) พร้อม emoji
3. why = คำถามคุกคาม: "สิ่งที่มาแทนมันได้มีไหม? (AI/คู่แข่ง/เทคโนโลยีใหม่)" แล้วตอบจากความรู้ทั่วไป + ตัวเลขคูเมืองที่มีให้ (มาร์จิ้นสูง = คูเมืองมีจริง)
4. points = 3 ข้อ: จุดแข็งคูเมือง (ใช้ margin/ROE จริง) · ความเสี่ยงที่ต้องเฝ้า · ตัวเลขที่นักลงทุนควรจับตา
5. close = สรุป 1 ประโยค + ชวนติดตาม
กติกา: ตัวเลขการเงินจาก [ข้อมูลจริง] เท่านั้น · เล่าเรื่องธุรกิจ/ลูกค้า/ผลิตภัณฑ์จากความรู้ทั่วไปได้ แต่ห้ามแต่งตัวเลขสเปค/สัญญา/ยอดสั่งซื้อ
ตอบ JSON เท่านั้น:
{"hook":"…","reveal":"…","why":"…","points":["…","…","…"],"close":"…","hashtags":"#หุ้น #การลงทุน #<TICKER>","scenes":[{"dur":"0-3s","text":"…","visual":"…"},... 6 ฉาก]}`;

// สไตล์ listicle — แกะจากคลิป "5 บริษัทพลังงานที่มาแรงที่สุด" (พีท จิรายุ, 437K views — ยอดสูงสุดในบรรดาคลิปที่แกะ)
const SYSTEM_LISTICLE = `คุณคือนักเขียน listicle หุ้นของ StockLens สไตล์ "5 บริษัท [ธีม] ที่มาแรงที่สุดในตอนนี้"
โครงสร้าง:
1. hook = 1 ประโยคว่าทำไมธีมนี้ "มาแรง ณ ตอนนี้" (อ้างอิงสถานการณ์ตลาดวันนี้ที่ให้มา เช่น หมวดพลังงานวันนี้ +x%)
2. reveal = บอกว่าจะพาดู 5 บริษัท พร้อมเหตุผลสั้นว่าเลือกจากอะไร
3. why = 2-3 ประโยค บริบทธีมนี้ใหญ่เพราะอะไร (เชื่อมเหตุการณ์โลก/เทรนด์)
4. points = 5 รายการ ผู้เล่นใหญ่ระดับโลกของธีมนั้น แต่ละรายการ: ชื่อบริษัท + ticker + 1-2 ประโยคว่าทำอะไรและทำไมอยู่ในลิสต์ (เล่าจากความรู้ทั่วไปได้)
5. close = สรุปสั้น + "อยากดูคะแนนปัจจัย 5 มิติของตัวไหน ไปค้นใน StockLens"
กติกา: เลือกบริษัทจากความรู้ทั่วไป (ระดับโลก มีสภาพคล่อง) · ห้ามแต่งตัวเลขงบ/ราคา/มูลค่าตลาดของบริษัทใดๆ ถ้าจะพูดถึงตัวเลขตลาด ใช้เฉพาะ [ข้อมูลตลาดวันนี้] ที่ให้มา · ห้ามคำว่า "ควรซื้อ"
ตอบ JSON เท่านั้น:
{"hook":"…","reveal":"…","why":"…","points":["บริษัทที่ 1 — …","…","…","…","…"],"close":"…","hashtags":"#หุ้น #การลงทุน #<ธีมอังกฤษ>","scenes":[{"dur":"0-3s","text":"…","visual":"…"},... 6-7 ฉาก]}`;

// สไตล์ narration — 🎙️ บทเล่าเสียงพากษ์เต็ม 60-90 วินาที (สไตล์นักเล่าเรื่องหุ้นที่เล่าเก่งจริง)
// หลักการเล่าเรื่องที่ฝังไว้ใน prompt: 1 คลิป 1 คำถาม · ประโยคสั้น พูดออกเสียงได้จริง ·
// ตัวเลขเป็น "ตัวละคร" (เกือบ 8 ใน 10 ของรายได้) · ช่องว่างความอยากรู้ · จังหวะหยุด
const SYSTEM_NARRATION = `คุณคือนักเล่าเรื่องหุ้น (voice-over scriptwriter) ของ StockLens — เขียน "บทพูดพากษ์เสียง" สำหรับคลิปหุ้น 60-90 วินาที ภาษาไทยพูด
เทคนิคการเล่าที่ต้องใช้ (แบบนักเล่าเรื่องที่มียอดวิวแสน):
- หนึ่งคลิป = หนึ่งคำถามเท่านั้น ห้ามเพี้ยนเรื่อง
- ประโยคสั้น 8-15 คำ พูดออกเสียงแล้วเป็นธรรมชาติ หนึ่งประโยค = หนึ่งความคิด
- ตัวเลขต้องกลายเป็นตัวละคร: ไม่พูด "รายได้โต 92.8%" ลอยๆ แต่พูด "เกือบเท่าตัวจากปีก่อน" แล้วตามด้วยตัวเลขจริงในวงเล็บ
- เปิดด้วยคำถามชวนสงสัย กลางเรื่องมีประโยค "แต่เดี๋ยวก่อน…" หรือ "ทีนี้พาร์ตี่ที่สนุก…" สลับจังหวะ 1 ครั้ง
- ใส่ [หยุด 1 วิ] กำกับจังหวะเงียบ 2-3 จุด
- ห้ามศัพท์การเงินหนักๆ เกิน 2 คำในเรื่องเดียว ถ้าจำเป็นให้ขยายความทันที ("มาร์จิ้น คือกำไรที่เหลือจริงๆ ต่อการขายหนึ่งบาท")
โครงสร้างบท: เปิดคำถาม (2 ประโยค) → เฉลยตัวเลขเด็ด (3-4 ประโยค) → ทำไมมันเป็นแบบนี้/เชื่อมโลกภายนอก (3-4 ประโยค) → แง่มุมที่ต้องระวัง 1 ประโยค → ปิดชวนติดตาม (1-2 ประโยค)
กติกาข้อมูล: ตัวเลขทุกตัวต้องมาจาก [ข้อมูลจริง] เท่านั้น ห้ามเดา · เล่าผลิตภัณฑ์/ลูกค้า/คู่แข่งจากความรู้ทั่วไปได้แต่ห้ามแต่งตัวเลข
ตอบ JSON เท่านั้น:
{"hook":"ประโยคเปิดคำถาม 1 ประโยค","script":"บทพูดเต็มพร้อม [หยุด 1 วิ] (~170-230 คำ)","sources":["งบไตรมาสล่าสุด — <ตัวเลขที่ใช้>","ราคา ณ วันนี้ — <ราคา>","ข่าวล่าสุด — <หัวขื่อน>","คะแนนปัจจัย StockLens — <ค่า>"],"hashtags":"#หุ้น #การลงทุน #<TICKER>","scenes":[{"dur":"0-5s","text":"ประโยคที่พูดช่วงนี้ (ตัดจากบท)","visual":"ภาพที่ควรขึ้นจอ"},... 7-9 ฉากครอบคลุมทั้งบท]}`;

const SYSTEMS: Record<string, string> = {
  classic: SYSTEM_STORY,
  contrarian: SYSTEM_CONTRARIAN,
  story: SYSTEM_STORYMOAT,
  listicle: SYSTEM_LISTICLE,
  narration: SYSTEM_NARRATION,
};

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
  // ส่วนเสริมสำหรับสไตล์ contrarian — วาลูเอชั่นครบมุม + 3 ฉาก + แนวรับ
  const sc = (a as Awaited<ReturnType<typeof buildAnalysis>> & { scenarios?: { scenarios: { label: string; targetPrice: number; upsidePct: number; assumptions: string }[] } }).scenarios;
  if (sc) {
    lines.push(
      `สถานการณ์ 12 เดือน (จาก EPS TTM จริง × สมมติ P/E):\n` +
        sc.scenarios.map((s) => `- ${s.label}: เป้า ${s.targetPrice.toFixed(1)} (${s.upsidePct >= 0 ? "+" : ""}${s.upsidePct.toFixed(0)}%) — ${s.assumptions}`).join("\n")
    );
  }
  if (p?.trailingPE && f?.earningsGrowth && f.earningsGrowth > 0) {
    const peg = p.trailingPE / (f.earningsGrowth * 100);
    lines.push(`PEG (P/E ÷ growth) = ${peg.toFixed(2)}${peg < 1 ? " (<1 โตเร็วกว่าที่จ่าย)" : peg > 2 ? " (>2 จ่ายแพงกว่าที่โต)" : " (สมดุล)"}`);
  }
  if (a.technicals?.sma50 || a.technicals?.sma200) {
    const sup: string[] = [];
    if (a.technicals?.sma50) sup.push(`SMA50 ${a.technicals.sma50.toFixed(2)}`);
    if (a.technicals?.sma200) sup.push(`SMA200 ${a.technicals.sma200.toFixed(2)}`);
    if (p?.fiftyTwoLow) sup.push(`จุดต่ำสุด 52 สัปดาห์ ${p.fiftyTwoLow.toFixed(2)}`);
    lines.push(`แนวรับที่นักวิเคราะห์ใช้: ${sup.join(" · ")}`);
  }
  return lines.join("\n");
}

// packet สำหรับ listicle — บริบทตลาดวันนี้จริง ให้ AI เลือกบริษัทจากความรู้ + อ้างอิงตัวเลขตลาดจากที่นี่เท่านั้น
async function buildThemePacket(theme: string): Promise<string> {
  const parts: string[] = [`[ธีมที่ผู้ใช้ขอ] ${theme}`];
  try {
    const res = await fetch("http://localhost:3000/api/heatmap?region=america");
    const j = (await res.json()) as { sectors?: { sector: string; avgPct: number }[] };
    const secs = j.sectors ?? [];
    if (secs.length) {
      parts.push(`[หมวดที่แรงที่สุดวันนี้ (สหรัฐฯ)]\n- ${secs.slice(0, 5).map((s) => `${s.sector} ${s.avgPct >= 0 ? "+" : ""}${s.avgPct.toFixed(2)}%`).join("\n- ")}`);
      parts.push(`[หมวดที่อ่อนที่สุดวันนี้]\n- ${secs.slice(-3).map((s) => `${s.sector} ${s.avgPct >= 0 ? "+" : ""}${s.avgPct.toFixed(2)}%`).join("\n- ")}`);
    }
  } catch {}
  try {
    const res = await fetch("http://localhost:3000/api/movers?region=america");
    const j = (await res.json()) as { gainers?: { symbol: string; changePct: number; sector?: string }[] };
    if (j.gainers?.length) parts.push(`[หุ้นที่ขึ้นแรงที่สุดวันนี้ (สหรัฐฯ)]\n- ${j.gainers.slice(0, 6).map((g) => `${g.symbol} +${g.changePct.toFixed(1)}%${g.sector ? ` (${g.sector})` : ""}`).join("\n- ")}`);
  } catch {}
  return parts.join("\n\n");
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

const NUM_EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

function assembleCaption(c: StoryCard): string {
  // สไตล์ narration — ตัวเมืองคือ "บทพูด" + ที่มาข้อมูลให้ตรวจสอบได้
  if (c.script) {
    return [
      c.script,
      "",
      "📚 ข้อมูลมาจากไหน (ตรวจสอบได้):",
      ...(c.sources ?? []).map((s) => "· " + s),
      "",
      "⚠️ บทวิเคราะห์เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน การลงทุนมีความเสี่ยง",
      "",
      c.hashtags,
    ].join("\n");
  }
  const points = c.points.slice(0, 5).map((p, i) => `${NUM_EMOJI[i] || "•"} ${p}`);
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
  const sp = req.nextUrl.searchParams;
  const style = sp.get("style") || "classic";
  const q = (sp.get("q") || "").trim();
  const s = (sp.get("s") || "").trim().toUpperCase();
  const system = SYSTEMS[style] || SYSTEMS.classic;

  // ===== สไตล์ listicle — ใส่ธีม ไม่ต้องใส่ ticker =====
  if (style === "listicle") {
    if (!q) return Response.json({ error: "สไตล์ listicle ต้องใส่ธีมที่ ?q= เช่น พลังงาน, AI, อวกาศ" }, { status: 400 });
    if (!hasAI()) {
      const demo: StoryCard = {
        engine: "demo", ticker: "", name: q, style,
        hook: `5 บริษัท${q}ที่มาแรงที่สุดในตอนนี้ — ใครคือผู้เล่นหลักบ้าง?`,
        reveal: `เลือกจากบริษัทระดับโลกที่อยู่ในใจกลางธีม "${q}" — ดูรายละเอียดเชิงตัวเลขของแต่ละตัวได้ใน StockLens`,
        why: `ธีมนี้เชื่อมกับเหตุการณ์โลกที่กำลังเกิด — ใครจับตา early จะเห็นมุมก่อนตลาด`,
        points: ["(เปิดใช้ AI key เพื่อให้ระบบเลือกบริษัท 5 ตัวพร้อมเหตุผลอัตโนมัติ)"],
        close: `อยากดูคะแนนปัจจัย 5 มิติของตัวไหน ค้นใน StockLens ได้เลย`,
        hashtags: `#หุ้น #การลงทุน #${q.replace(/\s+/g, "")}`,
        scenes: [{ n: 1, dur: "0-3s", text: `5 บริษัท${q}`, visual: "โลโก้บริษัทไล่ฉาก" }],
      };
      return Response.json({ ...demo, caption: assembleCaption(demo) });
    }
    try {
      const packet = await buildThemePacket(q);
      const raw = await chatOnce([{ role: "system", content: system }, { role: "user", content: `${packet}\n\nเขียน listicle "5 บริษัท ${q}" ตามสูตร — 6-7 ฉาก` }], 0.7);
      const j = JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim()) as Partial<StoryCard>;
      const card: StoryCard = {
        engine: "ai", ticker: "", name: q, style,
        hook: j.hook || `5 บริษัท${q}ที่มาแรงที่สุด`,
        reveal: j.reveal || "", why: j.why || "",
        points: Array.isArray(j.points) ? j.points.slice(0, 5) : [],
        close: j.close || "", hashtags: j.hashtags || `#หุ้น #การลงทุน`,
        scenes: Array.isArray(j.scenes) ? j.scenes.slice(0, 8).map((sc: { dur?: string; text?: string; visual?: string }, i: number) => ({ n: i + 1, dur: sc.dur || "", text: sc.text || "", visual: sc.visual || "" })) : [],
      };
      return Response.json({ ...card, caption: assembleCaption(card) });
    } catch (e) {
      return Response.json({ error: friendlyAIError(e) }, { status: 502 });
    }
  }

  // ===== สไตล์ที่ใช้ ticker (classic / contrarian / story) =====
  if (!s) return Response.json({ error: "missing s (ticker) — หรือใช้ ?style=listicle&q=ธีม" }, { status: 400 });

  const a = await buildAnalysis(s);
  if (!isFinite(a.quote.price)) return Response.json({ error: `ไม่พบ ${s} ในระบบ` }, { status: 404 });

  if (!hasAI()) {
    const demo = demoCard(a);
    return Response.json({ ...demo, style, caption: assembleCaption(demo) });
  }

  try {
    const raw = await chatOnce(
      [
        { role: "system", content: system },
        { role: "user", content: `${buildPacket(a)}\n\nเขียน story card ของ ${a.quote.symbol} สไตล์ ${style} ตามสูตร — จำนวน scenes 6-7 ฉาก` },
      ],
      0.7,
    );
    const cleaned = raw.replace(/^```(json)?|```$/g, "").trim();
    const j = JSON.parse(cleaned) as Partial<StoryCard> & { points?: string[]; hashtags?: string };
    const card: StoryCard = {
      engine: "ai",
      style,
      ticker: a.quote.symbol,
      name: a.quote.name,
      script: typeof j.script === "string" ? j.script : undefined,
      sources: Array.isArray(j.sources) ? j.sources.slice(0, 8) : undefined,
      hook: j.hook || `ใครสงสัยบ้างว่าเบื้องหลังหุ้น ${a.quote.symbol} มีอะไร?`,
      reveal: j.reveal || `ราคาตอนนี้ ${a.quote.price.toFixed(2)} ${a.quote.currency} (${a.quote.changePct >= 0 ? "+" : ""}${a.quote.changePct.toFixed(2)}%)`,
      why: j.why || "",
      points: Array.isArray(j.points) && j.points.length ? j.points.slice(0, style === "contrarian" ? 4 : 3) : [],
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
    return Response.json({ ...fb, style, caption: assembleCaption(fb), error: friendlyAIError(e) });
  }
}
