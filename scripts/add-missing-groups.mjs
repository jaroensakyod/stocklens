// เพิ่มกลุ่ม/ธีมที่ยังไม่มี: 11 ธีมใหม่ + 9 ห่วงโซ่ใหม่ — รันครั้งเดียว: node scripts/add-missing-groups.mjs
// กลุ่มไทย (ธนาคาร/อสังหาฯ/ปิโตรเคมี/ไฟฟ้า/เทเลคอม/รีเทล/โรงพยาบาล/เกษตร) + กลุ่มโลก (ทองคำ/คริปโต/EV)
// idempotent: รันซ้ำ = ทับค่าเดิม ไม่ซ้ำซ้อน
import { readFileSync, writeFileSync } from "node:fs";

const themesFile = "src/data/radar-themes.json";
const mapFile = "src/data/impact-map.json";

// ---------- 1) ธีมใหม่ 11 ตัว ----------
const NEW_THEMES = [
  {
    id: "gold",
    name: "ทองคำ & โลหะมีค่า",
    emoji: "💎",
    desc: "ราคาทอง-เงินโลก กับธุรกิจทองไทย (ร้านทอง/กองทุนทอง) และหุ้นเหมืองโลก — คนไทยถือทองต่อหัวมากที่สุดในโลก ตอบสนองดอกเบี้ยและความเสี่ยงสงคราม",
    watch: ["GC=F", "GLD", "SI=F"],
    impactIds: ["gold"],
    keys: ["ทองคำ", "ราคาทอง", "ทองคำแท่ง", "ทองรูปพรรณ", "กองทุนทอง", "ปอนด์ทอง", "gold", "gold price", "xauusd", "เหมืองทอง", "ร้านทอง", "ซื้อทอง"],
  },
  {
    id: "thaibank",
    name: "ธนาคารไทย",
    emoji: "🏦",
    desc: "กลุ่มน้ำหนักมากที่สุดของ SET — กำไร NIM หนี้เสีย NPL ค่าเผื่อ ต้นทุนเงินฝาก ผูกดอกเบี้ยและเศรษฐกิจไทยโดยตรง",
    watch: ["KBANK.BK", "BBL.BK", "SCB.BK"],
    impactIds: ["thai-banks", "ratescycle", "banking-stress"],
    keys: ["ธนาคาร", "หุ้นธนาคาร", "kbank", "ธ.กสิกร", "bbl", "scb", "ไทยพาณิชย์", "scbb", "scbx", "ktb", "กรุงไทย", "ttb", "tisco", "kkp", "ktc", "bay", "กรุงศรี", "nim", "npl", "ค่าเผื่อ", "กำไรธนาคาร", "ดอกเบี้ยเงินกู้", "ดอกเบี้ยเงินฝาก", "bank earnings"],
  },
  {
    id: "property",
    name: "อสังหาฯ ไทย",
    emoji: "🏠",
    desc: "เด็กเลอร์-ก่อสร้างไทย — ผูกดอกเบี้ยเงินกู้ มาตรการรัฐ กำลังซื้อ และรอบเปิดโครงการใหม่",
    watch: ["LH.BK", "AP.BK", "QH.BK"],
    impactIds: ["property-thai", "ratescycle"],
    keys: ["อสังหา", "อสังหาริมทรัพย์", "เด็กเลอร์", "บ้านจัดสรร", "คอนโด", "ที่ดิน", "โครงการใหม่", "รอบเปิดขาย", "ยอดโอน", "lh", "แลนด์แอนด์เฮ้าส์", "ลุมพินี", "พฤกษา", "plus", "เซ็นทรัลพัฒนา", "housing loan", "เงินกู้ซื้อบ้าน"],
  },
  {
    id: "petro",
    name: "ปิโตรเคมี",
    emoji: "🧪",
    desc: "หัวใจกลุ่มทรัพยากรของ SET — ส่วนต่างผลิตภัณฑ์ (spread) ผูกราคาน้ำมัน ก๊าซ และอุปสงค์จีน",
    watch: ["PTTGC.BK", "IVL.BK", "SCC.BK"],
    impactIds: ["petro-thai", "oil", "gas"],
    keys: ["ปิโตรเคมี", "เคมีภัณฑ์", "โอเลฟินส์", "พีทีทีจีซี", "pttgc", "ivl", "อินดอรามา", "เอสซีซี", "scc", "สเปรด", "spread", "เม็ดพลาสติก", "พลาสติก", "โพลีเมอร์"],
  },
  {
    id: "thaipower",
    name: "ไฟฟ้า & พลังงานไทย",
    emoji: "⚡",
    desc: "ผู้ผลิตไฟฟ้าเอกชน (IPP/SPP) — ค่าไฟ FT ราคาก๊าซ สัญญาซื้อขายไฟ PPA และความต้องการไฟจากดาต้าเซ็นเตอร์-EV",
    watch: ["GULF.BK", "GPSC.BK", "NG=F"],
    impactIds: ["thai-power", "renewables"],
    keys: ["ค่าไฟ", "ค่าไฟฟ้า", "ไฟฟ้า", "ft", "ผู้ผลิตไฟฟ้า", "โรงไฟฟ้า", "gulf", "กัลฟ์", "พลังงานหมุนเวียน", "โซลาร์", "เซลล์แสงอาทิตย์", "พลังงานลม", "ppa", "แบตเตอรี่", "ธุรกิจไฟฟ้า"],
  },
  {
    id: "telecom",
    name: "โทรคมนาคม",
    emoji: "📶",
    desc: "ค่ายมือถือ-ดาวเทียมไทย — ยอดใช้ 5G สงครามราคา และปันผลงามที่นักลงทุนไทยรัก",
    watch: ["ADVANC.BK", "TRUE.BK", "SAMART.BK"],
    impactIds: ["telecom-thai"],
    keys: ["โทรคมนาคม", "เทเลคอม", "5g", "6g", "advanc", "แอดวานซ์", "ais", "ทรู", "true", "ค่าโทร", "ค่าโทรศัพท์", "arpu", "ดาวเทียมไทยคม", "กสทช"],
  },
  {
    id: "retail",
    name: "รีเทล & การบริโภค",
    emoji: "🛒",
    desc: "ค้าปลีกไทย-โลก — กำลังซื้อคนไทย นักท่องเที่ยว และสงครามราคาห้าง",
    watch: ["CPALL.BK", "CRC.BK", "WMT"],
    impactIds: ["retail"],
    keys: ["รีเทล", "ค้าปลีก", "เซเว่น", "cpall", "ซีพีออล", "crc", "เซ็นทรัลรีเทล", "แม็คโคร", "โฮมโปร", "ห้าง", "ยอดขายปลีก", "กำลังซื้อ", "สินค้าอุปโภคบริโภค", "คอนซูมเมอร์", "same store sales", "บัตรเครดิต"],
  },
  {
    id: "health",
    name: "สุขภาพ & โรงพยาบาล",
    emoji: "🏥",
    desc: "โรงพยาบาลไทย (medical hub ของอาเซียน) + ยา-วัคซีนโลก — คนไข้ต่างชาติและสิทธิการรักษาในประเทศ",
    watch: ["BDMS.BK", "BH.BK", "LLY"],
    impactIds: ["health-thai", "pharma"],
    keys: ["โรงพยาบาล", "การแพทย์", "คนไข้ต่างชาติ", "ท่องเที่ยวเชิงการแพทย์", "medical hub", "bdms", "บำรุงราษฎร์", "จุฬารัตน์", "รามาธิบดี", "ธนบุรีเฮลท์แคร์", "ประกันสุขภาพ", "บัตรทอง", "ยา", "วัคซีน", "fda approval", "หุ้นกลุ่มสายดาว"],
  },
  {
    id: "thaiagro",
    name: "เกษตร & อาหารไทย",
    emoji: "🐔",
    desc: "หมู-ไก่-กุ้ง-ทูน่า-อาหารสัตว์ — ราคาส่งออกโปรตีน ต้นทุนข้าวโพด และกำปั้น CPF",
    watch: ["CPF.BK", "TU.BK", "GFPT.BK"],
    impactIds: ["thai-agro", "corn", "soy"],
    keys: ["หมู", "ราคาหมู", "สุกร", "ไก่", "ราคาไก่", "ไก่ไข่", "กุ้ง", "ทูน่า", "ซีพีเอฟ", "cpf", "ทียูเอฟ", "tuf", "อาหารสัตว์", "เกษตร", "ฟาร์ม", "โปรตีน", "ส่งออกอาหารทะเล", "ข้าวโพด"],
  },
  {
    id: "crypto",
    name: "คริปโต & ดิจิทัลแอสเซ็ต",
    emoji: "🪙",
    desc: "บิตคอยน์-อัลต์คอยน์ — เงินไหลเข้า ETF สถาบัน กับหุ้นที่รายได้ผูกคริปโตตรงๆ (ธุรกิจแลกเปลี่ยน/ไมนิ่ง)",
    watch: ["BTC-USD", "ETH-USD", "COIN"],
    impactIds: ["crypto"],
    keys: ["บิตคอยน์", "bitcoin", "btc", "เอธิเรียม", "ethereum", "eth", "คริปโต", "crypto", "คริปโตคัลเรนซี", "ดิจิทัลแอสเซ็ต", "อัลต์คอยน์", "altcoin", "etf bitcoin", "coinbase", "microstrategy", "ไมนิ่ง", "mining rig", "วอลเล็ต"],
  },
  {
    id: "ev",
    name: "EV & ยานยนต์ไฟฟ้า",
    emoji: "🚗",
    desc: "รถไฟฟ้าโลก — ยอดขาย ราคาแบตเตอรี่ ลิเทียม และผู้เล่นตลอดห่วงโซ่ (รวมสายการผลิตไทยที่ปรับตัว)",
    watch: ["TSLA", "BYDDY", "NIO"],
    impactIds: ["ev"],
    keys: ["ev", "ยานยนต์ไฟฟ้า", "รถไฟฟ้า", "tesla", "เทสลา", "byd", "บีวายดี", "nio", "แบตเตอรี่", "lithium", "ลิเทียม", "ชาร์จรถ", "สถานีชาร์จ", "รถ ev ไทย"],
  },
];
const tj = JSON.parse(readFileSync(themesFile, "utf8"));
for (const t of NEW_THEMES) {
  const i = tj.themes.findIndex((x) => x.id === t.id);
  if (i >= 0) tj.themes[i] = t;
  else tj.themes.push(t);
}
writeFileSync(themesFile, JSON.stringify(tj, null, 2) + "\n");

// ---------- 2) ห่วงโซ่ใหม่ 9 กลุ่ม ----------
const NEW_NODES = [
  {
    id: "thai-banks", type: "theme", name: "ธนาคารไทย", yahoo: "KBANK.BK",
    upReason: "กำไรธนาคารไทยดีขึ้น (NIM ขยาย/ค่าเผื่อลด/สินเชื่อโตตามเศรษฐกิจฟื้น) = กลุ่มธนาคารซึ่งหนักที่สุดใน SET จะดีดพาดัชนี",
    stocks: [
      { ticker: "KBANK.BK", market: "TH", direction: "positive", strength: "strong", reason: "ธนาคารเอกชนใหญ่สุดโดยสินทรัพย์ — ส่งออกไทยและธุรกิจฟื้น = รายได้ค่าธรรมเนียม+สินเชื่อโตพร้อมกัน" },
      { ticker: "BBL.BK", market: "TH", direction: "positive", strength: "medium", reason: "ธนาคารระบบเก่าแก่ ฐานลูกหนี้รายใหญ่/รัฐวิสาหกิจ ผูกเศรษฐกิจไทยโดยตรง" },
      { ticker: "SCB.BK", market: "TH", direction: "positive", strength: "medium", reason: "ธนาคารพาณิชย์ (อดีต SCB ในเครือ SCBx) ผูกสินเชื่อบุคคล-เกษตร-ธุรกิจขนาดย่อม" },
      { ticker: "KTB.BK", market: "TH", direction: "positive", strength: "medium", reason: "ธนาคารรัฐ — สินเชื่อโครงการรัฐ/SME ขยายเมื่อรัฐอัดฉีดงบ" },
      { ticker: "TTB.BK", market: "TH", direction: "positive", strength: "medium", reason: "ธนาคารเพื่อรายย่อย-ธุรกิจ ต้นทุนเงินฝากลด = NIM ฟื้นเร็ว" },
      { ticker: "TISCO.BK", market: "TH", direction: "positive", strength: "medium", reason: "สินเชื่อรถยนต์-ไฟแนนซ์ ผูกกำลังซื้อฐานล่างและรอบผ่อนรถ" },
      { ticker: "KKP.BK", market: "TH", direction: "positive", strength: "medium", reason: "สินเชื่อเช่าซื้อ-ธุรกิจ กำไรเด้งแรงเมื่อเศรษฐกิจไทยฟื้นชัด" },
      { ticker: "KTC.BK", market: "TH", direction: "positive", strength: "medium", reason: "บัตรเครดิต-สินเชื่อบุคคล โตตามการบริโภคและการท่องเที่ยว" },
      { ticker: "BAY.BK", market: "TH", direction: "positive", strength: "medium", reason: "กรุงศรีอยุธยา — สินเชื่อรถยนต์/ผู้บริโภค ผูกกำลังซื้อไทย" },
    ],
  },
  {
    id: "property-thai", type: "theme", name: "อสังหาฯ ไทย", yahoo: "LH.BK",
    upReason: "ดอกเบี้ยลง/มาตรการรัฐ (ลดภาระจำนอง/สินเชื่อเพื่อที่อยู่อาศัยผ่อนคลาย) = ยอดโอน-รอบเปิดโครงการดีขึ้นทั้งกลุ่มเด็กเลอร์",
    stocks: [
      { ticker: "LH.BK", market: "TH", direction: "positive", strength: "strong", reason: "เด็กเลอร์รายใหญ่สุด ลูกบ้านระดับกลาง-บน ไวต่อดอกเบี้ยเงินกู้โดยตรง" },
      { ticker: "AP.BK", market: "TH", direction: "positive", strength: "strong", reason: "เด็กเลอร์หรู-ทำเลท็อป กำไรต่อหน่วงสูง หุ้นไวต่อ sentiment กลุ่ม" },
      { ticker: "QH.BK", market: "TH", direction: "positive", strength: "medium", reason: "คอนโด-บ้านฐานกว้าง รอบเปิดไวต่อมาตรการกระตุ้นการซื้อบ้านแรก" },
      { ticker: "PLUS.BK", market: "TH", direction: "positive", strength: "medium", reason: "ทางหลวง-โครงสร้างพื้นฐานภาครัฐ ผู้รับประโยชน์ตรงจากงบลงทุนภาครัฐ" },
      { ticker: "SIRI.BK", market: "TH", direction: "positive", strength: "medium", reason: "เด็กเลอร์พันธมิตรแบรนด์ต่างชาติ โตตามตลาดบ้านจัดสรรทั้งประเทศ" },
      { ticker: "SC.BK", market: "TH", direction: "positive", strength: "medium", reason: "ครัวสั่งซื้อ-เด็กเลอร์คาเดนซ่า โตทั้งในไทยและต่างประเทศ (อินเดีย)" },
      { ticker: "WHA.BK", market: "TH", direction: "positive", strength: "medium", reason: "นิคมอุตสาหกรรม-โกดัง ผู้เช่าผูก FDI และภาคการผลิต/ดาต้าเซ็นเตอร์" },
    ],
  },
  {
    id: "petro-thai", type: "theme", name: "ปิโตรเคมีไทย", yahoo: "PTTGC.BK",
    upReason: "ส่วนต่างผลิตภัณฑ์ (spread) ขยาย — ราคาผลิตภัณฑ์ขึ้นเร็วกว่าวัตถุดิบน้ำมัน/ก๊าซ = กำไรกลุ่มเคมีบินสูง",
    stocks: [
      { ticker: "PTTGC.BK", market: "TH", direction: "positive", strength: "strong", reason: "ผู้ผลิตโอเลฟินส์-PO รายใหญ่สุดของไทย ไวต่อ spread ตรงที่สุดในกลุ่ม" },
      { ticker: "IVL.BK", market: "TH", direction: "positive", strength: "strong", reason: "เคมีภัณฑ์ครบวงจรกระจายทั่วโลก กำไรผูก margin ทั้ง PET และกลุ่ม HVC" },
      { ticker: "SCC.BK", market: "TH", direction: "positive", strength: "medium", reason: "ราชาเคมีภัณฑ์+วัสดุก่อสร้าง หลากหลายกำไร ผูกอุปสงค์จีนและก่อสร้างไทยด้วย" },
    ],
  },
  {
    id: "thai-power", type: "theme", name: "ผู้ผลิตไฟฟ้าไทย", yahoo: "GULF.BK",
    upReason: "ค่าไฟ FT ปรับขึ้น/ความต้องการไฟฟ้าโต (ดาต้าเซ็นเตอร์-EV) = ผู้ผลิตไฟเอกชนรายได้ขยาย โดยเฉพาะ RE ที่ต้นทุนต่ำลงต่อเนื่อง",
    stocks: [
      { ticker: "GULF.BK", market: "TH", direction: "positive", strength: "strong", reason: "ผู้ผลิตไฟเอกชนใหญ่สุด โรงไฟก๊าซ+RE พร้อมเดิมพันใหม่ที่ดาต้าเซ็นเตอร์และไฟฟ้าแห่งอนาคต" },
      { ticker: "GPSC.BK", market: "TH", direction: "positive", strength: "medium", reason: "พลังงานหลากหลาย (ก๊าซ/RE/ต่างประเทศ) ในเครือ CP ผูกความต้องการไฟภาคอุตสาหกรรม" },
      { ticker: "BGRIM.BK", market: "TH", direction: "positive", strength: "medium", reason: "RE ลูกค้าอุตสาหกรรม+โครงการต่างประเทศ (ลาว/เวียดนาม) สัญญา PPA ระยะยาว" },
      { ticker: "EA.BK", market: "TH", direction: "positive", strength: "medium", reason: "พลังงานลม-แบตเตอรี่-EV เดิมพันนโยบายพลังงานสะอาดทั้งกลุ่ม" },
      { ticker: "BCPG.BK", market: "TH", direction: "positive", strength: "medium", reason: "โรงไฟหลัก-ชีวมวล-พลังน้ำเล็ก รายได้เสถียรผูกค่า FT และสัญญาซื้อขายไฟ" },
    ],
  },
  {
    id: "telecom-thai", type: "theme", name: "โทรคมนาคมไทย", yahoo: "ADVANC.BK",
    upReason: "ยอดใช้บริการ/รายได้ 5G ขยาย สงครามราคาเบาลง = กำไรและกระแสปันผลกลุ่มเทเลคอมไทยฟื้น",
    stocks: [
      { ticker: "ADVANC.BK", market: "TH", direction: "positive", strength: "strong", reason: "AIS — ค่ายมือถือเบอร์ 1 ปันผลงาม ไวต่อ ARPU และความรุนแรงของสงครามราคา" },
      { ticker: "TRUE.BK", market: "TH", direction: "positive", strength: "medium", reason: "ทรู คอร์ปอเรชั่น (รวม dtac แล้ว) กำไรเทิร์นราวด์ผูกวินัยราคาตลาด 2 ค่าย" },
      { ticker: "SAMART.BK", market: "TH", direction: "positive", strength: "medium", reason: "ดาวเทียม-ระบบสื่อสารภาครัฐ/เอเชีย ได้จากสัญญารัฐและงานดาวเทียมโดยตรง" },
    ],
  },
  {
    id: "retail", type: "theme", name: "ค้าปลีก & การบริโภค", yahoo: "CPALL.BK",
    upReason: "กำลังซื้อคนไทย-นักท่องเที่ยวฟื้น = ยอดขาย same-store โตทั้งโมเดิร์นเทรดและรีเทลออนไลน์",
    stocks: [
      { ticker: "CPALL.BK", market: "TH", direction: "positive", strength: "strong", reason: "เซเว่นอีเลฟเว่นทั่วไทย ยอดขายร้านคือเกจกำลังซื้อคนไทยแบบเรียลไทม์" },
      { ticker: "CRC.BK", market: "TH", direction: "positive", strength: "medium", reason: "เซ็นทรัล-โรบินสัน-แม็คโคร ผูกทั้งคนไทยและกำลังซื้อนักท่องเที่ยว" },
      { ticker: "HMPRO.BK", market: "TH", direction: "positive", strength: "medium", reason: "โฮมโปร — ผูกการลงทุนปรับปรุงบ้านและงานก่อสร้างภาคครัวเรือน" },
      { ticker: "DOHOME.BK", market: "TH", direction: "positive", strength: "medium", reason: "โด เฮาส์ — วัสดุก่อสร้างปลีก ตามงานซ่อม-สร้างบ้าน" },
      { ticker: "GLOBAL.BK", market: "TH", direction: "positive", strength: "medium", reason: "โกลบอล เฮาส์ โตตามหัวเมือง ผูกการก่อสร้างบ้านนอก กทม." },
      { ticker: "COM7.BK", market: "TH", direction: "positive", strength: "medium", reason: "ผู้จัดจำหน่ายสมาร์ทโฟน-ไอที ผูกรอบเปิดตัวเครื่องใหม่และกำลังซื้อ" },
      { ticker: "WMT", market: "US", direction: "positive", strength: "medium", reason: "วอลมาร์ท — ยักษ์ค้าปลีกสหรัฐ มาตรฐานเทียบรีเทลโลกและสุขภาพผู้บริโภค" },
      { ticker: "COST", market: "US", direction: "positive", strength: "medium", reason: "คอสโต้ — สโมสรราคาส่ง สมาชิกจ่ายรายปี กำไรเสถียรตามการบริโภค" },
    ],
  },
  {
    id: "health-thai", type: "theme", name: "โรงพยาบาล & การแพทย์ไทย", yahoo: "BDMS.BK",
    upReason: "คนไข้ต่างชาติ (ตะวันออกกลาง/จีน/CLMV) กลับมาเต็ม + สิทธิประกัน-บัตรทองใช้บริการมากขึ้น = รายได้กลุ่มโรงพยาบาลฟื้นแรง",
    stocks: [
      { ticker: "BDMS.BK", market: "TH", direction: "positive", strength: "strong", reason: "เครือโรงพยาบาลใหญ่สุดของไทย มีทั้งคนไข้ต่างชาติและฐานบัตรสวัสดิการกว้างที่สุด" },
      { ticker: "BH.BK", market: "TH", direction: "positive", strength: "strong", reason: "บำรุงราษฎร์ — สัดส่วนคนไข้ต่างชาติสูงสุด ไวต่อท่องเที่ยวเชิงการแพทย์ตรงที่สุด" },
      { ticker: "CHG.BK", market: "TH", direction: "positive", strength: "medium", reason: "จุฬารัตน์ — โรงพยาบาลชุมชนนอก กทม. โตตามสิทธิการรักษาฐานล่าง" },
      { ticker: "RAM.BK", market: "TH", direction: "positive", strength: "medium", reason: "รามาธิบดี — โรงพยาบาลตติยภูมิ ผสานคนไข้สิทธิประกันและต่างชาติ" },
      { ticker: "THG.BK", market: "TH", direction: "positive", strength: "medium", reason: "ธนบุรีเฮลท์แคร์ — เครือธนบุรี + เครือข่ายลงทุนต่างประเทศ (สปป.ลาว)" },
    ],
  },
  {
    id: "thai-agro", type: "theme", name: "เกษตร & อาหารไทย", yahoo: "CPF.BK",
    upReason: "ราคาหมู-กุ้ง-ไก่ส่งออกขยับขึ้น ประกอบต้นทุนอาหารสัตว์ (ข้าวโพด/ปลาป่น) ที่ลดลง = กำไรกลุ่มเกษตร-อาหารไทยดีขึ้น",
    stocks: [
      { ticker: "CPF.BK", market: "TH", direction: "positive", strength: "strong", reason: "ซีพีเอฟ — โปรตีนครบวงจรทั่วโลก ทั้งหมู ไก่ กุ้ง และอาหารสัตว์ สัญญาณของราคาโปรตีนโลก" },
      { ticker: "TU.BK", market: "TH", direction: "positive", strength: "strong", reason: "ทูน่า-กุ้ง-อาหารทะเลสำเร็จรูป รายได้ผูกราคาส่งออกอาหารทะเลโลกโดยตรง" },
      { ticker: "GFPT.BK", market: "TH", direction: "positive", strength: "medium", reason: "สุกร-อาหารสัตว์เบ็ดเสร็จ ผูกราคาหมูในประเทศตรงที่สุด" },
    ],
  },
  {
    id: "crypto", type: "theme", name: "คริปโต & ดิจิทัลแอสเซ็ต", yahoo: "BTC-USD",
    upReason: "บิตคอยน์ขึ้น = รายได้ค่าธรรมเนียม-กำไรถุงคริปโตของทุกบริษัทในห่วงโซ่บินตาม (แลกเปลี่ยน/ไมนิ่ง/คลาวด์)",
    stocks: [
      { ticker: "COIN", market: "US", direction: "positive", strength: "strong", reason: "Coinbase — รายได้ค่าธรรมเนียมผูกโวลุ่มซื้อขายคริปโตตรงที่สุดในหุ้นสหรัฐ" },
      { ticker: "MSTR", market: "US", direction: "positive", strength: "strong", reason: "ไมโครสแตรเทจี — คลังบิตคอยน์ใหญ่สุดขององค์กร เด้งเหมือนบิตคอยน์แบบ leverage" },
      { ticker: "MARA", market: "US", direction: "positive", strength: "medium", reason: "ขุดบิตคอยน์รายใหญ่ กำไรผูกราคาบิทและต้นทุนพลังงาน" },
      { ticker: "RIOT", market: "US", direction: "positive", strength: "medium", reason: "ไมนิ่ง+ศูนย์ข้อมูล ไวต่อราคาบิตคอยน์สุดกลุ่ม" },
      { ticker: "CLSK", market: "US", direction: "positive", strength: "medium", reason: "ไมนิ่งพลังงานสะอาด ต้นทุนต่อเหรียญถูก กำไรผูก margin การขุด" },
    ],
  },
];
const m = JSON.parse(readFileSync(mapFile, "utf8"));
for (const n of NEW_NODES) {
  const i = m.nodes.findIndex((x) => x.id === n.id);
  if (i >= 0) m.nodes[i] = n;
  else m.nodes.push(n);
}
writeFileSync(mapFile, JSON.stringify(m, null, 2) + "\n");

console.log(`ธีมทั้งหมด: ${tj.themes.length} (เพิ่ม ${NEW_THEMES.map((t) => t.id).join(", ")})`);
console.log(`ห่วงโซ่ทั้งหมด: ${m.nodes.length} (เพิ่ม ${NEW_NODES.map((n) => n.id).join(", ")})`);
