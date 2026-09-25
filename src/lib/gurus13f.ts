// ===== พอร์ตกูรูจาก 13F สด (SEC EDGAR โดยตรง — แหล่งแม่นยำที่สุด ไม่มีค่าใช้จ่าย) =====
import { getQuotes } from "./yahoo";
import type { Quote } from "./types";

const UA = { "User-Agent": "StockLens Research contact@stocklens.local" };

export interface GuruHolding13f {
  issuer: string;
  ticker?: string;
  valueUsd: number;
  pct: number;
  shares: number;
  putCall?: "PUT" | "CALL";
  note?: string; // "ทำไมเลือก" ฉบับคัดสรร (จากความรู้สาธารณะ)
  change?: { type: "new" | "increased" | "decreased" | "same"; deltaPct?: number }; // เทียบไตรมาสก่อน
}

export interface LiveGuru {
  id: string;
  name: string;
  firm: string;
  emoji: string;
  style: string; // สไตล์การลงทุน (สำหรับ AI อธิบายเหตุผล)
  thesis: string;
  caution: string;
  source: "live" | "snapshot";
  asOf?: string; // งวดรายงาน (reportDate)
  filedAt?: string;
  totalValueUsd?: number;
  holdings: GuruHolding13f[];
  qoq?: { increased: number; decreased: number; newCount: number; exited: { issuer: string; ticker?: string; prevPct: number }[] };
}

// ---- config: CIK ยืนยันแล้วกับ submissions API + เหตุผลสไตล์ (ความรู้สาธารณะ) ----
export const TICKER_MAP: Record<string, string> = {
  "APPLE INC": "AAPL", "MICROSOFT CORP": "MSFT", "ALPHABET INC": "GOOGL", "AMAZON COM INC": "AMZN",
  "META PLATFORMS INC": "META", "NVIDIA CORP": "NVDA", "BERKSHIRE HATHAWAY": "BRK-B", "BROADCOM INC": "AVGO",
  "TAIWAN SEMICONDUCTOR": "TSM", "ELI LILLY & CO": "LLY", "NOVO NORDISK": "NVO", "UNITEDHEALTH": "UNH",
  "JPMORGAN CHASE": "JPM", "BANK OF AMERICA": "BAC", "AMERICAN EXPRESS": "AXP", "COCA COLA CO": "KO",
  "CHEVRON CORP": "CVX", "OCCIDENTAL PETROLEUM": "OXY", "MCDONALDS CORP": "MCD", "STARBUCKS CORP": "SBUX",
  "PROCTER & GAMBLE": "PG", "JOHNSON & JOHNSON": "JNJ", "VISA INC": "V", "MASTERCARD INC": "MA",
  "ALPHABET INC CLASS A": "GOOGL", "LULULEMON ATHLETICA": "LULU", "MERCADOLIBRE INC": "MELI",
  "MOLINA HEALTHCARE": "MOH", "REGENERON PHARMACEUTICALS": "REGN", "SPDR GOLD SHARES": "GLD",
  "ISHARES GOLD TRUST": "IAU", "VANGUARD S&P 500 ETF": "VOO", "ISHARES CORE S&P 500 ETF": "IVV",
  "WELLS FARGO": "WFC", "CITIGROUP INC": "C", "GOLDMAN SACHS GROUP": "GS", "MORGAN STANLEY": "MS",
  "PFIZER INC": "PFE", "MODERNA INC": "MRNA", "BOEING CO": "BA", "LOCKHEED MARTIN": "LMT",
  "PALANTIR TECHNOLOGIES": "PLTR", "MICRON TECHNOLOGY": "MU", "ADVANCED MICRO DEVICES": "AMD",
  "TESLA INC": "TSLA", "NETFLIX INC": "NFLX", "ORACLE CORP": "ORCL", "SALESFORCE COM": "CRM",
  "COSTCO WHOLESALE": "COST", "WALMART INC": "WMT", "HOME DEPOT": "HD", "LOWES COMPANIES": "LOW",
  "ABBVIE INC": "ABBV", "MERCK & CO": "MRK", "ABBOTT LABORATORIES": "ABT", "THERMO FISHER": "TMO",
  "BOOKING HOLDINGS": "BKNG", "EXPEDIA GROUP": "EXPE", "DELTA AIR LINES": "DAL", "UNITED AIRLINES": "UAL",
  "GENERAL DYNAMICS": "GD", "RTX CORP": "RTX", "NORTHROP GRUMMAN": "NOC", "SPDR S&P 500 ETF TRUST": "SPY",
  "AMAZONCOM INC": "AMZN", "MICROSOFT CORP NEW": "MSFT", "APPLE INC COM": "AAPL",
  "CHARLES SCHWAB": "SCHW", "BLACKROCK INC": "BLK", "KRAFT HEINZ": "KHC", "LIBERTY BROADBAND": "LBRDK",
  "NU HOLDINGS": "NU", "COINBASE GLOBAL": "COIN", "ROBLOX CORP": "RBLX", "BLOCK INC": "SQ", "SHOPIFY INC": "SHOP",
  "ROKU INC": "ROKU", "T-MOBILE US": "TMUS", "COMCAST CORP": "CMCSA", "VERIZON COMMUNICATIONS": "VZ",
  "INTUITIVE SURGICAL": "ISRG", "INDEXVENTURES": "IVV", "ISHARES TR": "IVV", "ISHARES MSCI EM": "EEM", "ISHARES MSCI EMERGING": "EEM",
  "VANGUARD FTSE EMERGING": "VWO", "SPDR GOLD TR": "GLD", "GRANITE SHARES 2X LONG NVDA": "NVDL",
};

const note = (issuer: string, n?: string) => n;

export const GURU_CONFIG: {
  id: string; cik?: number; name: string; firm: string; emoji: string; style: string; thesis: string; caution: string;
  notes?: Record<string, string>;
}[] = [
  {
    id: "buffett", cik: 1067983, name: "Warren Buffett", firm: "Berkshire Hathaway", emoji: "🍦",
    style: "Value + คุณภาพถือยาว: เลือกธุรกิจที่เข้าใจได้ กำไรแข็งแรง (ROE/FCF สูง) มีคูเมือง ซื้อตอน margin of safety ไม่เปลี่ยนพอร์ตบ่อย",
    thesis: "เจ้าแห่ง value investing — กระจุกตัวสูง (หุ้น 5 ตัวแรกมัก >70% ของพอร์ต) ชอบการเงิน/ผู้บริโภค/พลังงาน ถือเงินสดเยอะตอนตลาดแพง",
    caution: "Berkshire ไม่ขายหุ้นหลักเพราะภาษี — พอร์ตเปลี่ยนช้ามาก · 13F เห็นเฉพาะฝั่งหุ้นสหรัฐฯ ไม่เห็นพันธบัตร/เงินสดก้อนใหญ่ · ไม่เห็นสัดส่วน insurance float",
    notes: {
      "APPLE INC": "ธุรกิจเครื่องใช้พันธมิตรผูกใจ — ผู้บริโภคยึดแบรนด์ กำไรต่อเครื่องสูง เขาเคยเรียกว่า 'ธุรกิจที่ดีที่สุดเท่าที่เรารู้จัก' ใน universe ที่เขาเข้าใจ",
      "BANK OF AMERICA": "ธนาคารใหญ่พันธมิตรของ Berkshire เดิม (ช่วยตอนวิกฤต 2008) — กระแสเงินสดคู่ขนานต้นทุนเงินกู้ต่ำ",
      "OCCIDENTAL PETROLEUM": "เขาให้เครดิตทีมบริหาร (Vicki Hollub) และมองว่ากำลังผลิตน้ำมันให้สหรัฐฯ ในราคาต้นทุนต่ำ อ่านงบ OXY ปีไหนต่อปีไหนเอง",
      "COCA COLA CO": "สัญลักษณ์ 'ธุรกิจตลาดชั่วนิรันดร์' — ผูกแบรนด์กับพฤติกรรมผู้บริโภคทั่วโลก ซื้อสมัย 1988 และไม่เคยขาย",
    },
  },
  {
    id: "renTech", cik: 1037389, name: "Jim Simons", firm: "Renaissance Technologies", emoji: "🧮",
    style: "Quantitative เต็มตัว: โมเดลสถิติ/แมชชีนเรื่อยริ่งกว่า 200 คน ไม่มีมนุษย์เลือกหุ้นเลย กระจายหลายพันตำแหน่งเท่ากัน ถือสั้นมาก",
    thesis: "สัญญาณจากข้อมูลราคา/มหภาคอย่างเดียว — 13F ของ RenTech คือ 'ภาพรวมความเชื่อของสถิติ' ไม่ใช่การเลือกหุ้นรายตัว",
    caution: "พอร์ตจริงหมุนเร็วกว่า 13F มาก (ถือเฉลี่ยไม่กี่สัปดาห์) · มี long-short สองข้าง 13F เห็นเฉพาะฝั่ง long · อย่าตามซื้อตาม",
    notes: {},
  },
  {
    id: "bridgewater", cik: 1350694, name: "Ray Dalio", firm: "Bridgewater Associates", emoji: "⚖️",
    style: "Macro All Weather: กระจายความเสี่ยงข้ามสินทรัพย์ (หุ้น/พันธบัตร/ทอง/ตลาดเกิดใหม่) ตามวัฏจักรหนี้และ Big Cycle ที่เขาเขียนไว้",
    thesis: "ไม่ทายทิศตลาด แต่จัดสมดุล 'ความเสี่ยง' — ชอบ ETF หุ้น/ทอง/EM มากกว่าหุ้นรายตัว ช่วงหลังพูดเรื่องหนี้สหรัฐฯ และทองคำหนักมาก",
    caution: "ใช้ derivative เยอะ 13F เห็นไม่ครบ · พอร์ตหลักเป็น macro/อนุพันธ์ อ่าน holdings เป็นแนวโน้มความเชื่อมั่นพอประมาณ",
    notes: {
      "ISHARES GOLD TRUST": "ทองคำ = hedge วัฏจักรหนี้โลก/สกุลเงินสำรองเปลี่ยนมือ — แนวคิด Changing World Order ของเขา",
      "VANGUARD FTSE EMERGING": "กระจายไปตลาดเกิดใหม่ตามหลัก All Weather ไม่ใช่การทายรายประเทศ",
    },
  },
  {
    id: "ackman", cik: 1336528, name: "Bill Ackman", firm: "Pershing Square", emoji: "🎯",
    style: "Activist value: เลือกบริษัทคุณภาพ 8-12 ตัวเท่านั้น เข้าตัวใหญ่แล้วผลักดันการเปลี่ยนแปลง (board/ซื้อคืน/ปรับกลยุทธ์) เรียกตัวเองว่า save haven ธรรมดา",
    thesis: "กระจุกตัวสุดขอในวงการ — เชื่อว่าเข้าใจบริษัทลึกกว่าตลาดและมีอำนาจกดดันให้มูลค่าปลดล็อก",
    caution: "พอร์ทไม่กี่ตัว = ความผันผวนสูงมากเมื่อเจ๊งเรื่องเดียว · เคยพลาดหนัก (Valeant, Herbalife short) · มี hedge S&P ผ่าน derivative ที่ 13F อาจไม่สะท้อน",
    notes: {
      "UNIVERSAL MUSIC GROUP": "การ์ดของเขายุคหลัง — มองว่าเป็น 'royalty company' จากสตรีมมิ่งที่โตแบบไม่ต้องลงทุนเพิ่มเยอะ",
      "CHIPOTLE MEXICAN GRILL": "แบรนด์อาหารเติบโตสองต่อ — เขาเคยบอกว่าคล้าย McDonald's รุ่นเยาว์ (เขาโตจาก Wendy's/McD activist เดิม)",
      "HILTON WORLDWIDE": "โมเดลแฟรนไชส์เบาสินทรัพย์ กระแสเงินสดประหยัดต้นทุน",
    },
  },
  {
    id: "tiger", cik: 1167483, name: "Chase Coleman", firm: "Tiger Global", emoji: "🐅",
    style: "Growth/Tech crossover: ล่าบริษัทโตเร็วทั้ง public/private ทั่วโลก ชอบแพลตฟอร์มเครือข่าย-effect และ SaaS margin สูง",
    thesis: "เดิมพัน 'ชนะผู้ชนะ' ใน internet era — กองทุนเติบโตจาก Amazon/Meta ยุคแรก ปรับตัวสู่ AI/software รุ่นใหม่",
    caution: "หุ้น growth beta สูง ตกหนักช่วง rate ขึ้น 2022 · มีสัดส่วน private ใหญ่ที่ 13F ไม่เห็น · turnover สูงกว่ากูรู value",
    notes: {},
  },
  {
    id: "klarman", cik: 1061768, name: "Seth Klarman", firm: "The Baupost Group", emoji: "🛡️",
    style: "Deep value + ความปลอดภัยก่อน: ล่าของถูกที่ตลาดเกลียด (special situation/spin-off/หุ้นยุโรป) ถือเงินสดเยอะเมื่อไม่เจอของถูก — เจ้าของหนังสือ Margin of Safety",
    thesis: "กาญจนาจารย์สายป้องกันความเสี่ยง — เลือกตำแหน่งที่ downside จำกัดแต่ upside เปิด เขียนจดหมายผู้ถือหุ้นที่คนตามกันทั้งวงการ",
    caution: "สไตล์หลบหุ้นแพง — ช่วงตลาดบูน 13F ของเขามัก 'น่าเบื่อ' แต่ยืนได้ตอนตลาดพัง · ถือเงินสดสูงมากเป็นระยะ (บางช่วง >30%)",
    notes: {},
  },
  {
    id: "druckenmiller", cik: 1536411, name: "Stanley Druckenmiller", firm: "Duquesne Family Office", emoji: "🌊",
    style: "Macro momentum: ผู้สานต่อตำนานจาก Quantum Fund — เชื่อ 'liquidity เป็นตัวขับเคลื่อนตลาด' เปลี่ยนพอร์ตเร็วตามวัฏจักรดอกเบี้ย/เงินเฟ้อ",
    thesis: "ไม่ผูกกับสไตล์ — ถ้าเห็น liquidity ไหลเข้าก็บุก เห็นพลิดก็หด เร็วและใหญ่ เทียบกูรู value แล้ว 13F ของเขาเปลี่ยนเพี้ยนทุกไตรมาส",
    caution: "สไตล์เปลี่ยนเร็วมาก — ตามทันทีไตรมาสหลังไม่มีความหมาย · เคยบอกเองว่าใช้ derivative ปรับ exposure ที่ 13F ไม่เห็น",
    notes: {},
  },
  {
    id: "ark", name: "Cathie Wood", firm: "ARK Invest", emoji: "🚀",
    style: "Innovation thematic: AI/จีโนมิกส์/หุ่นยนต์/อวกาศ/พลังงานใหม่ มอง 5 ปีแบบ exponential ไม่สน valuation ระยะสั้น",
    thesis: "Invest in Disruption — เชื่อว่าเทคโนโลยี deflation จะทำให้หุ้นธีมเหล่านี้โตกว่าตลาดคิดหลายเท่า",
    caution: "High-beta สุดในลิสต์ — ตกแรงทุกครั้งดอกเบี้ยขึ้น · benchmark ตามหลัง S&P หลายปี · อ่านเป็นแหล่งไอเดียธีม ไม่ใช่สัญญาณ · snapshot คัดสรรจากการเปิดเผยของ ARK (ARK เปิด holdings รายวันบนเว็บตัวเอง)",
    notes: {},
  },
  {
    id: "burry", name: "Michael Burry", firm: "Scion Asset Management", emoji: "🦈",
    style: "Contrarian deep value: ล่าของถูกที่คนเกลียด + short ของแพงที่คนรัก ผ่าน put option เป็นหลัก",
    thesis: "สไตล์ The Big Short — ซื้อ Value ที่ถูกเท (LULU/MELI/MOH) คู่ short กลุ่ม AI โมเมนตัม (PLTR/NVDA/MU/NBIS) มองว่าตลาด AI คล้ายปี 1999-2000",
    caution: "⚠️ Scion เลิกยื่น 13F กับ SEC (ลงทะเบียนเลิกกิจการ พ.ย. 2025) — ข้อมูลนี้เป็น snapshot สุดท้ายที่รวบรวมจาก 13F/สื่อ อาจเปลี่ยนแล้วทั้งหมด · มูลค่า put ใน 13F เป็น notional ไม่ใช่เงินจริง · เขาเคยกล่าวชัดว่าไม่ short CoreWeave (หุ้น memesville) · ตามเขาไม่ได้แปลว่ารวย — NBIS/PLTR เคยวิ่งสวน short เขา",
    notes: {
      "PALANTIR TECHNOLOGIES": "ตัวแทน 'หุ้น AI แพงที่สุด' — short ผ่าน put ตามธีสิส AI bubble (notional ~$900M)",
      "LULULEMON ATHLETICA": "หุ้นคุณภาพที่ถูกเทขายจนต่ำกว่า intrinsic ในสายตาเขา",
    },
  },
  {
    id: "millennium", cik: 1273087, name: "Izzy Englander", firm: "Millennium Management", emoji: "🧩",
    style: "Multi-strategy pod shop: 300+ ทีมอิสระแยกกัน เข้า-ออกเร็ว ควบคุม drawdown สูงสุดในวงการ hedge fund",
    thesis: "เครื่องจักร return นิ่ง — 13F เหมือนภาพรวมของร้อยกลยุทธ์ ไม่ใช่มุมมองคนเดียว เห็นหุ้นเยอะมากและเปลี่ยนเกือบทั้งพอร์ตทุกไตรมาส",
    caution: "Turnover สุดของในลิสต์ — ตำแหน่งวันยื่นไม่ใช่ตำแหน่งวันนี้ · เห็นเฉพาะฝั่ง long · อ่านเป็น 'สัญญาณรวมของ street' ดีกว่าตามซื้อ",
    notes: {},
  },
  {
    id: "viking", cik: 1103804, name: "Andreas Halvorsen", firm: "Viking Global Investors", emoji: "🛡️",
    style: "Tiger cub สาย equity long: บริษัทคุณภาพโตแรง พอร์ตกระจุก 30-60 ตัว ผสม growth/value ตามรอบ",
    thesis: "ลูกศิษย์ Julian Robertson รุ่นโตที่สุด — เข้าใจธุรกิจลึกแล้วเดิมพันใหญ่ เปลี่ยนพอร์ตช้ากว่า Millennium เร็วกว่า Buffett",
    caution: "มีฝั่ง short/hedge ที่ 13F มองไม่เห็น · ช่วงตลาดหมุนอาจ underperform ชั่วคราว",
    notes: {},
  },
  {
    id: "tepper", cik: 1656456, name: "David Tepper", firm: "Appaloosa", emoji: "🐴",
    style: "Concentrated macro-equity: เดิมพันใหญ่ตอนตลาดกลัวสุด (distressed คือราก) ถือ 10-20 ตัว เปลี่ยนตามมหภาคเร็ว",
    thesis: "สายกล้าซื้อตอนเลือดไหล — ยุค 2009 ซื้อธนาคารตอนพังจนติดตำนาน พอร์ตปัจจุบันมักกระจุกไม่กี่ธีมใหญ่",
    caution: "concentrate มาก — พลาดทีเดียวเจ็บหนัก · เปลี่ยนใจเร็วตามมหภาค",
    notes: {},
  },
];

// ---- ดึง + parse 13F ล่าสุดจาก EDGAR ----
const cache = new Map<string, { at: number; data: LiveGuru[] }>();
const TTL = 12 * 3600_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch พร้อม retry — EDGAR บางครั้งตอบ 403/เพี้ยนชั่วขณะเมื่อเรียกถี่ */
async function fetchRetry(url: string, tries = 3): Promise<Response> {
  let lastErr: unknown;
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15_000) });
      if (r.ok) return r;
      lastErr = new Error("HTTP " + r.status);
      if (r.status !== 403 && r.status !== 429 && r.status !== 503) throw lastErr;
    } catch (e) {
      lastErr = e;
    }
    await sleep(1200 + t * 800);
  }
  throw lastErr;
}

interface ParsedEntry { issuer: string; value: number; shares: number; putCall?: string }

async function fetchGuru13f(cik: number): Promise<{ filedAt: string; asOf: string; entries: ParsedEntry[]; prevEntries: ParsedEntry[] } | null> {
  try {
    const sub = (await (await fetchRetry(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, "0")}.json`)).json()) as {
      filings: { recent: { form: string[]; accessionNumber: string[]; filingDate: string[]; reportDate: string[]; } };
    };
    const rec = sub.filings.recent;
    // เอา 13F-HR หรือ 13F-HR/A ล่าสุด (amendment = ฉบับแก้ไขล่าสุด แม่นกว่า) + ตัวก่อนหน้าเพื่อเทียบ QoQ
    const is13f = (f: string) => f === "13F-HR" || f === "13F-HR/A";
    const i = rec.form.findIndex(is13f);
    if (i < 0) return null;
    const prevIdx = rec.form.findIndex((f, idx) => idx > i && is13f(f));
    const acc = rec.accessionNumber[i].replace(/-/g, "");
    const idx = (await (await fetchRetry(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/index.json`)).json()) as {
      directory: { item: { name: string }[] };
    };
    const xmlFile = idx.directory.item.map((x) => x.name).find((n) => n.toLowerCase().endsWith(".xml") && !n.toLowerCase().includes("primary_doc"));
    if (!xmlFile) return null;
    const raw = await (await fetchRetry(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/${xmlFile}`)).text();
    // บางไฟล์ใช้ namespace (ns1:) — ถอดออกให้ parser ใช้ร่วมได้
    const rawNS = raw.replace(/<(\/?)n[a-zA-Z0-9]*:/g, "<$1");
    const g = (block: string, tag: string) => {
      const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([^<\\]]+)`, ""));
      return m ? m[1].trim() : "";
    };
    const entries: ParsedEntry[] = [];
    for (const block of rawNS.split("</infoTable>")) {
      if (!block.includes("<nameOfIssuer>")) continue;
      entries.push({
        issuer: g(block, "nameOfIssuer").toUpperCase(),
        value: Number(g(block, "value")),
        shares: Number(g(block, "sshPrnamt")),
        putCall: g(block, "putCall") || undefined,
      });
    }
    // ดึงไฟล์ของไตรมาสก่อนหน้า (ถ้าได้ — ใช้ try แบบเงียบ)
    let prevEntries: ParsedEntry[] = [];
    if (prevIdx >= 0) {
      try {
        const prevAcc = rec.accessionNumber[prevIdx].replace(/-/g, "");
        const prevIdxJson = (await (await fetchRetry(`https://www.sec.gov/Archives/edgar/data/${cik}/${prevAcc}/index.json`)).json()) as { directory: { item: { name: string }[] } };
        const prevXml = prevIdxJson.directory.item.map((x) => x.name).find((n) => n.toLowerCase().endsWith(".xml") && !n.toLowerCase().includes("primary_doc"));
        if (prevXml) {
          const prevRaw = (await (await fetchRetry(`https://www.sec.gov/Archives/edgar/data/${cik}/${prevAcc}/${prevXml}`)).text()).replace(/<(\/?)[a-zA-Z0-9]+:/g, "<$1");
          for (const block of prevRaw.split("</infoTable>")) {
            if (!block.includes("<nameOfIssuer>")) continue;
            prevEntries.push({
              issuer: g(block, "nameOfIssuer").toUpperCase(),
              value: Number(g(block, "value")),
              shares: Number(g(block, "sshPrnamt")),
              putCall: g(block, "putCall") || undefined,
            });
          }
        }
      } catch {}
    }
    return { filedAt: rec.filingDate[i], asOf: rec.reportDate[i], entries, prevEntries };
  } catch {
    return null;
  }
}

/** ดึงกูรูทั้งหมด: live จาก EDGAR + snapshot (Burry) + ราคาปัจจุบัน top holdings */
export async function getLiveGurus(): Promise<LiveGuru[]> {
  const hit = cache.get("all");
  if (hit && Date.now() - hit.at < TTL) return hit.data;

  const out: LiveGuru[] = [];
  for (const cfg of GURU_CONFIG) {
    if (cfg.cik) {
      if (out.length) await sleep(600); // เว้นจังหวะกัน EDGAR rate-limit
      const f = await fetchGuru13f(cfg.cik);
      if (!f || !f.entries.length) continue;      const total = f.entries.reduce((a, e) => a + e.value, 0);
      // รวมตาม issuer (บริษัทเดียวมีได้หลาย class)
      const map = new Map<string, { v: number; s: number; pc?: string }>();
      for (const e of f.entries) {
        const key = e.issuer.replace(/ (CLASS [A-C]|COM|CL A|CL B|SPONSORED ADR|ADR)$/i, "");
        const cur = map.get(key) ?? { v: 0, s: 0 };
        cur.v += e.value;
        cur.s += e.shares;
        if (e.putCall === "PUT" || e.putCall === "CALL") cur.pc = e.putCall;
        map.set(key, cur);
      }
      // รวม prev ตาม issuer (สำหรับเทียบ QoQ)
      const norm = (x: string) => x.replace(/ (CLASS [A-C]|COM|CL A|CL B|SPONSORED ADR|ADR)$/i, "");
      const prevMap = new Map<string, number>();
      let prevTotal = 0;
      for (const e of f.prevEntries) {
        const key = norm(e.issuer);
        prevMap.set(key, (prevMap.get(key) ?? 0) + e.shares);
        prevTotal += e.value;
      }
      const holdings: GuruHolding13f[] = [...map.entries()]
        .sort((a, b) => b[1].v - a[1].v)
        .slice(0, 20)
        .map(([issuer, d]) => {
          const prevShares = prevMap.get(issuer);
          let change: GuruHolding13f["change"];
          if (prevShares === undefined) change = { type: "new" };
          else if (prevShares === 0) change = { type: "same" };
          else {
            const delta = ((d.s - prevShares) / prevShares) * 100;
            change = { type: delta > 5 ? "increased" : delta < -5 ? "decreased" : "same", deltaPct: Math.round(delta) };
          }
          return {
            issuer,
            ticker: TICKER_MAP[issuer] ?? TICKER_MAP[issuer.replace(/ INC| CORP| CO| PLC| LTD| LP| SA| NV| AG$/g, "").trim()] ?? undefined,
            valueUsd: d.v,
            pct: (d.v / total) * 100,
            shares: d.s,
            putCall: (d.pc as "PUT" | "CALL") ?? undefined,
            note: cfg.notes?.[issuer],
            change,
          };
        });
      // ขายออก: มีใน prev แต่หายไปใน current (เรียงตามสัดส่วน prev)
      const exited = prevTotal
        ? [...prevMap.keys()]
            .filter((k) => !map.has(k))
            .map((k) => ({ issuer: k, ticker: TICKER_MAP[k], prevPct: 0 }))
            .slice(0, 5)
        : [];
      const qoq = f.prevEntries.length
        ? {
            increased: holdings.filter((h) => h.change?.type === "increased").length,
            decreased: holdings.filter((h) => h.change?.type === "decreased").length,
            newCount: holdings.filter((h) => h.change?.type === "new").length,
            exited,
          }
        : undefined;
      out.push({ ...cfg, source: "live", asOf: f.asOf, filedAt: f.filedAt, totalValueUsd: total, holdings, qoq });
    } else {
      // snapshot: ใช้ holdings จาก JSON (Burry)
      const { snapshotGuru } = await import("./guruSnapshot");
      out.push(await snapshotGuru(cfg));
    }
  }

  // ราคาปัจจุบันของ tickers ที่ map ได้
  const tickers = [...new Set(out.flatMap((g) => g.holdings.map((h) => h.ticker).filter(Boolean) as string[]))];
  const quotes = await getQuotes(tickers);
  for (const g of out) {
    for (const h of g.holdings) {
      if (h.ticker) (h as { quote?: Quote }).quote = quotes[h.ticker];
    }
  }

  cache.set("all", { at: Date.now(), data: out });
  return out;
}
