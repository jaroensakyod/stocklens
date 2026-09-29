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
  quote?: Quote;
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
  "CHUBB LIMITED": "CB", "MOODYS CORP": "MCO", "VERISIGN INC": "VRSN", "DAVITA INC": "DVA",
  "SIRIUS XM HOLDINGS INC": "SIRI", "LIBERTY LIVE HOLDINGS": "LLYVK", "KROGER CO": "KR", "NUCOR CORP": "NUE",
  "ALPHABET INC CL A": "GOOGL", "SPDR S&P 500 ETF": "SPY", "INVESCO QQQ TRUST": "QQQ", "INVESCO QQQ TR": "QQQ",
  "ISHARES NASDAQ BIOTECHNOLOGY": "IBB", "ISHARES 7-10 YEAR TREASURY": "IEF", "ISHARES TR 7 10YR TR": "IEF",
  "STATE STR SPDR S&P 500 ETF TR": "SPY", "VANGUARD TOTAL STOCK MARKET": "VTI", "VANGUARD 500 INDEX FUND": "VOO",
  "CREDO TECHNOLOGY GROUP": "CRDO", "SPACE EXPLORATION TECHNOLOGIES": "", "IHS MARKIT LTD": "",
  "STONECO LTD": "STNE", "PDD HOLDINGS": "PDD", "SEA LTD": "SE", "GRAB HOLDINGS": "GRAB",
  "FIVERR INTERNATIONAL": "FVRR", "SQUARE INC": "SQ", "TWILIO INC": "TWLO", "ZSCALER INC": "ZS",
  "NATERA INC": "NTRA", "NEBIUS GROUP N.V.": "NBIS", "NEBIUS GROUP NV": "NBIS",
  "STATE STR SPDR S&P 500 ETF T": "SPY", "STATE STR SPDR S&P 500 ETF": "SPY", "STATE STR SPDR S&P 500 ETF TRUST": "SPY",
  "CROWDSTRIKE HOLDINGS": "CRWD", "SNOWFLAKE INC": "SNOW", "DATADOG INC": "DDOG", "SERVICENOW INC": "NOW",
  "WORKDAY INC": "WDAY", "AUTODESK INC": "ADSK", "ADBE INC": "ADBE", "ADOBE INC": "ADBE",
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
    thesis: "กาญจนาจารย์สายป้องกันความเสี่ยง — เลือกตำแหน่งที่ downside จำกัดแต่ upside ปลดล็อก เขียนจดหมายผู้ถือหุ้นที่คนตามกันทั้งวงการ",
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
  // ---- เพิ่มรอบ "แซง konbalongtun": กูรู LIVE เพิ่มอีก 7 ราย (CIK ยืนยันกับ SEC submissions แล้ว) ----
  {
    id: "fisher", cik: 850529, name: "Ken Fisher", firm: "Fisher Asset Management", emoji: "📈",
    style: "Global growth สายประจำทุกไตรมาส: ถือหลายร้อยตำแหน่งทั่วโลก ชอบบริษัทใหญ่โต quality growth มองการลงทุนเป็น 'ยาวได้เพราะเศรษฐกิจโลกโต'",
    thesis: "หนึ่งใน 13F ที่ใหญ่ที่สุดในวงการ (~พันรายการ) — อ่านเป็น 'สายน้ำตลาดสถาบัน' ขนาดใหญ่ ชอบ mega-cap tech/pharma ผสม value รอบ",
    caution: "พอร์ตหลายพันตำแหน่ง — top 20 เห็นแค่เงาของภาพรวม · ลูกค้า fee-based ทำให้ turnover ต่ำ ไม่ได้แปลว่ามั่นใจรายตัว",
    notes: {},
  },
  {
    id: "citadel", cik: 1423053, name: "Ken Griffin", firm: "Citadel Advisors", emoji: "🏰",
    style: "Multi-strategy ยักษ์: quant + fundamental หลายสิบทีม พอร์ตหมุนเร็วมาก คุมความเสี่ยงระดับสถาบันชั้นนำของโลก",
    thesis: "13F ใหญ่ที่สุดกลุ่มหนึ่งของ SEC — ถือพันตำแหน่งข้ามตลาด อ่านเป็นแผนที่ความเชื่อของเงินสถาบัน ไม่ใช่การเลือกหุ้นของคนเดียว",
    caution: "หมุนเร็วมาก + มีฝั่ง short/hedge ที่ 13F มองไม่เห็น · ตำแหน่งเยอะจน top-20 เป็นเพียงส่วนเล็กของพอร์ตจริง",
    notes: {},
  },
  {
    id: "primecap", cik: 763212, name: "Theo Kolokotrones", firm: "PRIMECAP Management", emoji: "🌱",
    style: "Growth at reasonable price แบบซ้อมสปิริต: ทีมเล็กถือยาว ไม่แคร์ไตรมาส เก่งเรื่องหุ้น health/tech ที่โตต่อเนื่อง (เจ้าของ Odyssey/VOYAGER ของ Vanguard)",
    thesis: "ลึกกับบริษัทที่เข้าใจได้จริง ถือปีสิบปี — พอร์ตสะท้อน 'คุณภาพ + เวลา' มากกว่าจังหวะตลาด",
    caution: "ไม่มี short/hedge แต่ก็ไม่ได้เปิดเผยวัตถุประสงค์รายตำแหน่ง · หุ้น health ที่ถือหนักอาจขยับตามข่าวภาคการแพทย์แรง",
    notes: {},
  },
  {
    id: "baillie", cik: 1088875, name: "Baillie Gifford", firm: "Baillie Gifford & Co", emoji: "🦌",
    style: "Scottish long-term growth: ถือบริษัท 'ตัวจริงของศตวรรษ' 5-10 ปีขึ้นไป ลงทุนเพราะธุรกิจเปลี่ยนโลก ไม่สน multiple ระยะสั้น",
    thesis: "สถาบัน 100+ ปีจากเอดินบะระ — มือหนักหุ้น growth ทั่วโลก (รวม pre-IPO เช่น SpaceX ที่ 13F เห็นเป็นหุ้นเอกชนไม่มี ticker)",
    caution: "เสียเปรียบช่วงดอกเบี้ยขึ้นหนัก 2022 · ถือบริษัทเอกชนที่ 13F แสดงมูลค่าแต่ซื้อขายต่อไม่ได้ · turnover ต่ำมาก",
    notes: {},
  },
  {
    id: "point72", cik: 1603466, name: "Steve Cohen", firm: "Point72 Asset Management", emoji: "⚡",
    style: "Multi-strategy รุ่นใหม่ของ SAC: fundamental long/short + quant หลายสิบทีม ความเร็ว + ข้อมูลคืออาวุธ",
    thesis: "พอร์ตกว้างมาก อ่านเป็นสัญญาณรวมของทีมวิจัยระดับลึก — ชอบเทคโนโลยี/สุขภาพ แต่เปลี่ยนตามข้อมูลเร็ว",
    caution: "ฝั่ง short กว้างแต่ 13F เห็นเฉพาะ long · turnover สูง · อย่าอ่าน top holdings เป็น 'หุ้นชอบ' ของ Cohen ตรงๆ",
    notes: {},
  },
  {
    id: "soros", cik: 1029160, name: "George Soros", firm: "Soros Fund Management", emoji: "🌀",
    style: "Reflexivity macro: เดิมพันหนักเมื่อเห็นกระแสเงิน/นโยบายเปลี่ยน ปรับตัวเร็ว ไม่ยึดสไตล์เดิม",
    thesis: "ตำนานการเหลียวมองมหภาค — ปัจจุบันเป็น family office พอร์ตเล็กลงแต่ยังชอบหุ้นเศรษฐกิจใหม่/AI/บล็อกเชน",
    caution: "Reflexivity = เปลี่ยนใจเร็วมาก 13F ล่าช้า 45 วัน · มีสัดส่วนอนุพันธ์/private ที่มองไม่เห็น",
    notes: {},
  },
  {
    id: "lonepine", cik: 1061165, name: "Steve Mandel", firm: "Lone Pine Capital", emoji: "🌲",
    style: "Tiger cub สาย growth quality: ถือ 20-40 ตัวบริษัทที่ดีที่สุดในอุตสาหกรรมที่เชื่อ วิจัยลึกระดับหน่วยงานวิเคราะห์อิสระ",
    thesis: "เดิมพัน 'compounder' — หุ้นที่โตต่อเนื่องหลายปี พอร์ตกระจุกและเปลี่ยนช้ากว่ามหภาคกูรู",
    caution: "ช่วงตลาดหมุนหนัก growth ขายแรง · มีฝั่ง short แต่ 13F เห็นเฉพาะ long",
    notes: {},
  },
];

// ---- ดึง + parse 13F จาก EDGAR ----
const cache = new Map<string, { at: number; data: LiveGuru[] }>();
const detailCache = new Map<string, { at: number; data: unknown }>();
const TTL = 12 * 3600_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch พร้อม retry — EDGAR บางครั้งตอบ 403/เพี้ยนชั่วขณะเมื่อเรียกถี่ */
export async function fetchRetry(url: string, tries = 3): Promise<Response> {
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

/** decode XML entities ในชื่อบริษัท (เช่น S&amp;P → S&P) */
const decodeXml = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/** parse XML 13F รายไฟล์ (แก้ namespace ก่อนแยกบล็อก) */
function parse13fXml(raw: string): ParsedEntry[] {
  const rawNS = raw.replace(/<(\/?)[a-zA-Z0-9]*:/g, "<$1");
  const g = (block: string, tag: string) => {
    const m = block.match(new RegExp("<" + tag + ">(?:<!\\[CDATA\\[)?([^<\\]]+)"));
    return m ? decodeXml(m[1].trim()) : "";
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
  return entries;
}

/**
 * ดึง 13F ของ CIK — offset 0 = ฉบับล่าสุด, 1 = ไตรมาสก่อนหน้า, ...
 * คืน entries ของงวดนั้น + งวดก่อนหน้า (สำหรับ QoQ) + รายการไตรมาสที่มีทั้งหมด
 */
async function fetchGuru13f(cik: number, offset = 0): Promise<{ filedAt: string; asOf: string; entries: ParsedEntry[]; prevEntries: ParsedEntry[]; quarters: string[] } | null> {
  try {
    const sub = (await (await fetchRetry(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, "0")}.json`)).json()) as {
      filings: { recent: { form: string[]; accessionNumber: string[]; filingDate: string[]; reportDate: string[]; } };
    };
    const rec = sub.filings.recent;
    // ดัชนีของ 13F ทั้งหมดเรียงจากใหม่ → เก่า (13F-HR/A = ฉบับแก้ไข ให้ถือเป็นฉบับล่าสุดของงวดนั้น)
    const is13f = (f: string) => f === "13F-HR" || f === "13F-HR/A";
    const idxList: number[] = [];
    const seenQuarters = new Set<string>();
    for (let i = 0; i < rec.form.length && idxList.length < 8; i++) {
      if (!is13f(rec.form[i])) continue;
      // HR/A ตามหลัง HR ของงวดเดียวกัน — เอาอันที่ "ใหม่สุดของงวดนั้น" (ตัวแรกที่เจอ)
      if (seenQuarters.has(rec.reportDate[i])) continue;
      seenQuarters.add(rec.reportDate[i]);
      idxList.push(i);
    }
    if (idxList.length <= offset) return null;
    const i = idxList[offset];
    const prevIdx = idxList[offset + 1] ?? -1;
    const acc = rec.accessionNumber[i].replace(/-/g, "");
    const idx = (await (await fetchRetry(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/index.json`)).json()) as {
      directory: { item: { name: string }[] };
    };
    const xmlFile = idx.directory.item.map((x) => x.name).find((n) => n.toLowerCase().endsWith(".xml") && !n.toLowerCase().includes("primary_doc"));
    if (!xmlFile) return null;
    const raw = await (await fetchRetry(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/${xmlFile}`)).text();
    const entries = parse13fXml(raw);
    let prevEntries: ParsedEntry[] = [];
    if (prevIdx >= 0) {
      try {
        const prevAcc = rec.accessionNumber[prevIdx].replace(/-/g, "");
        const prevIdxJson = (await (await fetchRetry(`https://www.sec.gov/Archives/edgar/data/${cik}/${prevAcc}/index.json`)).json()) as { directory: { item: { name: string }[] } };
        const prevXml = prevIdxJson.directory.item.map((x) => x.name).find((n) => n.toLowerCase().endsWith(".xml") && !n.toLowerCase().includes("primary_doc"));
        if (prevXml) prevEntries = parse13fXml((await (await fetchRetry(`https://www.sec.gov/Archives/edgar/data/${cik}/${prevAcc}/${prevXml}`)).text()));
      } catch {}
    }
    return {
      filedAt: rec.filingDate[i],
      asOf: rec.reportDate[i],
      entries,
      prevEntries,
      quarters: idxList.map((x) => rec.reportDate[x]).slice(0, 4),
    };
  } catch {
    return null;
  }
}

/** รวม entries ตาม issuer + คำนวณ pct/QoQ — ใช้ร่วมทั้งรายการรวมและหน้า detail */
function buildHoldings(f: { entries: ParsedEntry[]; prevEntries: ParsedEntry[] }, cfg: { notes?: Record<string, string> }, maxHoldings: number) {
  // ⚠️ filer บางรายเขียน <value> เป็น "ดอลลาร์" บางรายเป็น "หน่วยพัน" (สเปก 13F ว่าพัน แต่หลายรายใหญ่ส่งดอลลาร์)
  // ตรวจจากราคาแฝง: value/shares ถ้าค่ากลาง < 1 แปลว่าเป็นหน่วยพัน → คูณ 1000
  const prices = f.entries.filter((e) => e.shares > 0 && e.value > 0).map((e) => e.value / e.shares).sort((a, b) => a - b);
  const medPrice = prices.length ? prices[Math.floor(prices.length / 2)] : 1;
  const scale = medPrice < 1 ? 1000 : 1;
  const entries = scale === 1 ? f.entries : f.entries.map((e) => ({ ...e, value: e.value * scale }));
  const prevEntries = scale === 1 ? f.prevEntries : f.prevEntries.map((e) => ({ ...e, value: e.value * scale }));

  const total = entries.reduce((a, e) => a + e.value, 0);
  const norm = (x: string) => x.replace(/ (CLASS [A-C]|COM|CL A|CL B|SPONSORED ADR|ADR)$/i, "");
  const map = new Map<string, { v: number; s: number; pc?: string }>();
  for (const e of entries) {
    const key = norm(e.issuer);
    const cur = map.get(key) ?? { v: 0, s: 0 };
    cur.v += e.value;
    cur.s += e.shares;
    if (e.putCall === "PUT" || e.putCall === "CALL") cur.pc = e.putCall;
    map.set(key, cur);
  }
  const prevMap = new Map<string, { s: number; v: number }>();
  let prevTotal = 0;
  for (const e of prevEntries) {
    const key = norm(e.issuer);
    const cur = prevMap.get(key) ?? { s: 0, v: 0 };
    cur.s += e.shares;
    cur.v += e.value;
    prevMap.set(key, cur);
    prevTotal += e.value;
  }
  const holdings: GuruHolding13f[] = [...map.entries()]
    .sort((a, b) => b[1].v - a[1].v)
    .slice(0, maxHoldings)
    .map(([issuer, d]) => {
      const prev = prevMap.get(issuer);
      let change: GuruHolding13f["change"];
      if (prev === undefined) change = { type: "new" };
      else if (prev.s === 0) change = { type: "same" };
      else {
        const delta = ((d.s - prev.s) / prev.s) * 100;
        change = { type: delta > 5 ? "increased" : delta < -5 ? "decreased" : "same", deltaPct: Math.round(delta) };
      }
      return {
        issuer,
        ticker: TICKER_MAP[issuer] ?? TICKER_MAP[issuer.replace(/ INC| CORP| CO| PLC| LTD| LP| SA| NV| AG$/g, "").trim()] ?? undefined,
        valueUsd: d.v,
        pct: (d.v / total) * 100,
        shares: d.s,
        putCall: (d.pc as "PUT" | "CALL") ?? undefined,
        note: cfg.notes?.[issuer] ? note(issuer, cfg.notes[issuer]) : undefined,
        change,
      };
    });
  // ขายออก: มีใน prev แต่หายไปใน current (เรียงตามสัดส่วน prev — ใช้มูลค่าจริงตอนนี้แล้ว ไม่ใช่ placeholder)
  const exited = prevTotal
    ? [...prevMap.entries()]
        .filter(([k]) => !map.has(k))
        .sort((a, b) => b[1].v - a[1].v)
        .slice(0, 5)
        .map(([k, d]) => ({ issuer: k, ticker: TICKER_MAP[k] ?? TICKER_MAP[k.replace(/ INC| CORP| CO| PLC| LTD| LP| SA| NV| AG$/g, "").trim()], prevPct: prevTotal ? (d.v / prevTotal) * 100 : 0 }))
    : [];
  const qoq = prevEntries.length
    ? {
        increased: holdings.filter((h) => h.change?.type === "increased").length,
        decreased: holdings.filter((h) => h.change?.type === "decreased").length,
        newCount: holdings.filter((h) => h.change?.type === "new").length,
        exited,
      }
    : undefined;
  return { holdings, qoq, total };
}

/** ดึงกูรูทั้งหมด: live จาก EDGAR (ขนาน 4 สาย กันหน้าเว็บรอนาน) + snapshot + ราคาปัจจุบัน top holdings */
export async function getLiveGurus(): Promise<LiveGuru[]> {
  const hit = cache.get("all");
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const liveCfgs = GURU_CONFIG.filter((c) => c.cik);
  const results = new Array<LiveGuru | null>(liveCfgs.length).fill(null);

  const worker = async (slot: number) => {
    for (let i = slot; i < liveCfgs.length; i += 4) {
      const cfg = liveCfgs[i];
      try {
        await sleep(300 + slot * 150); // เว้นจังหวะกัน EDGAR rate-limit
        const f = await fetchGuru13f(cfg.cik!, 0);
        if (!f || !f.entries.length) continue;
        const { holdings, qoq, total } = buildHoldings(f, cfg, 20);
        results[i] = { ...cfg, source: "live", asOf: f.asOf, filedAt: f.filedAt, totalValueUsd: total, holdings, qoq };
      } catch {}
    }
  };
  await Promise.all([worker(0), worker(1), worker(2), worker(3)]);

  const out: LiveGuru[] = results.filter((x): x is LiveGuru => x !== null);
  for (const cfg of GURU_CONFIG) {
    if (!cfg.cik) {
      const { snapshotGuru } = await import("./guruSnapshot");
      out.push(await snapshotGuru(cfg));
    }
  }
  // เรียงตามมูลค่าพอร์ตลดลง (เหมือนมาตรฐานกลาง)
  out.sort((a, b) => (b.totalValueUsd ?? 0) - (a.totalValueUsd ?? 0));

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

/** กูรูจาก cache เท่านั้น (ไม่ trigger ดึง SEC) — สำหรับ feature ที่ต้องเร็ว เช่น แชท AI: ถ้ายังไม่มี cache = ข้ามเงียบๆ */
export function getCachedGurus(): LiveGuru[] | null {
  const hit = cache.get("all");
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  return null;
}

export interface GuruDetail extends LiveGuru {
  quarters: string[]; // งวด 13F ที่เลือกย้อนหลังได้ (ล่าสุดก่อน)
  count: number; // จำนวนหลักทรัพย์ทั้งหมดในงวดนั้น
  concentrationTop10: number; // สัดส่วน top 10 รวมกัน
}

/** หน้า detail ต่อกูรู: เลือกไตรมาสย้อนหลังได้ (offset 0..3) + holdings เต็มกว่า (40) */
export async function getGuruDetail(id: string, offset = 0): Promise<GuruDetail | null> {
  const key = `detail:${id}:${offset}`;
  const hit = detailCache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data as GuruDetail;
  const cfg = GURU_CONFIG.find((c) => c.id === id);
  if (!cfg) return null;
  if (!cfg.cik) {
    // snapshot (Burry/ARK): ไม่มีประวัติไตรมาส — คืนข้อมูล snapshot พร้อม quarters ว่าง
    const gurus = await getLiveGurus();
    const g = gurus.find((x) => x.id === id);
    if (!g) return null;
    const detail: GuruDetail = { ...g, quarters: [], count: g.holdings.length, concentrationTop10: g.holdings.slice(0, 10).reduce((a, h) => a + h.pct, 0) };
    detailCache.set(key, { at: Date.now(), data: detail });
    return detail;
  }
  const f = await fetchGuru13f(cfg.cik, offset);
  if (!f || !f.entries.length) return null;
  const { holdings, qoq, total } = buildHoldings(f, cfg, 40);
  const detail: GuruDetail = {
    ...cfg, source: "live", asOf: f.asOf, filedAt: f.filedAt, totalValueUsd: total, holdings, qoq,
    quarters: f.quarters,
    count: new Set(f.entries.map((e) => e.issuer.replace(/ (CLASS [A-C]|COM|CL A|CL B|SPONSORED ADR|ADR)$/i, ""))).size,
    concentrationTop10: holdings.slice(0, 10).reduce((a, h) => a + h.pct, 0),
  };
  // ราคาปัจจุบันของ holdings ที่ map ได้
  const tickers = [...new Set(holdings.map((h) => h.ticker).filter(Boolean) as string[])];
  const quotes = await getQuotes(tickers);
  for (const h of holdings) if (h.ticker) (h as { quote?: Quote }).quote = quotes[h.ticker];
  detailCache.set(key, { at: Date.now(), data: detail });
  return detail;
}
