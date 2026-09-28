// ===== รีจิสทรีธีม/ภูมิภาค สำหรับ "🛠️ ปรับพอร์ตเอง" — pure data ไม่มี dependency =====
// แยกไฟล์เพื่อให้หน้า client import ได้โดยไม่ลากเครื่องยนต์ข้อมูล (yahoo/score/…) ติดไปด้วย
// ใช้ร่วมกัน: src/lib/starterCustom.ts (engine) + src/app/starter/page.tsx (UI)

export interface StarterCustomOptions {
  mix: { th: number; us: number; fund: number; intl: number }; // % รวมกัน 100
  count: number; // จำนวนตำแหน่งรวม 3|5|8|10|12
  themes: string[]; // id จาก CUSTOM_THEMES — ว่าง = ไม่จำกัดธีม
  regions: string[]; // id จาก INTL_REGIONS — ว่าง (เมื่อ intl>0) = กระจาย 4 ภูมิภาคหลัก
  minGrade: "all" | "AAA" | "AA" | "A" | "B"; // เกรด StockLens ขั้นต่ำ
  momentum: boolean; // เติมหุ้นซิ่ง/หุ้นเด่นวันนี้ ~10%
}

export interface ThemeDef {
  id: string;
  label: string;
  emoji: string;
  usSectors?: string[]; // ตรงกับ universe.json "s"
  usTickers?: string[]; // ตัวเด่นประจำธีม (curated — มีอยู่ใน universe จริง)
  thCats?: string[]; // ตรงกับ set-watchlist.json "s" (ว่าง = ไทยยังไม่มีของหมวดนี้)
}

export const CUSTOM_THEMES: ThemeDef[] = [
  { id: "ai", label: "AI / เทคโนโลยี", emoji: "🤖", usSectors: ["Technology"], usTickers: ["NVDA", "MSFT", "GOOGL", "META", "ORCL", "AMD", "AVGO", "TSM"], thCats: ["เทคโนโลยี", "โทรคมนาคม", "ค้าปลีก/เทค"] },
  { id: "space", label: "อวกาศ", emoji: "🚀", usTickers: ["RKLB", "ASTS", "LUNR", "RDW", "IRDM", "LMT"] },
  { id: "defense", label: "กลาโหม", emoji: "🛡️", usTickers: ["RTX", "LMT", "NOC", "GD", "LHX", "HWM"] },
  { id: "food", label: "อาหาร & เครื่องดื่ม", emoji: "🍔", usTickers: ["KO", "PEP", "MCD", "SBUX", "GIS", "MDLZ", "HSY"], thCats: ["เกษตร/อาหาร", "เครื่องดื่ม"] },
  { id: "staples", label: "สินค้าอุปโภคบริโภค", emoji: "🧴", usSectors: ["Consumer Defensive"], thCats: ["เกษตร/อาหาร", "เครื่องดื่ม", "ค้าปลีก"] },
  { id: "retail", label: "ค้าปลีก", emoji: "🏪", usTickers: ["WMT", "COST", "AMZN", "TGT", "HD", "LOW", "ROST", "TJX", "DG"], thCats: ["ค้าปลีก", "ค้าปลีก/เทค"] },
  { id: "logistics", label: "ขนส่ง & โลจิสติกส์", emoji: "🚚", usTickers: ["UPS", "FDX", "UNP", "CSX", "ODFL", "XPO"], thCats: ["ขนส่ง", "ขนส่ง/บริการ"] },
  { id: "energy", label: "พลังงาน", emoji: "⚡", usSectors: ["Energy", "Utilities"], thCats: ["พลังงาน"] },
  { id: "bank", label: "ธนาคาร & การเงิน", emoji: "🏦", usSectors: ["Financial"], thCats: ["การเงิน"] },
  { id: "health", label: "สุขภาพ", emoji: "🏥", usSectors: ["Healthcare"], thCats: ["สาธารณสุข"] },
  { id: "travel", label: "ท่องเที่ยว & โรงแรม", emoji: "🏨", usTickers: ["MAR", "RCL", "CCL", "DAL", "UAL", "BKNG", "EXPE"], thCats: ["โรงแรม", "โรงแรม/บันเทิง"] },
  { id: "telecom", label: "โทรคมนาคม", emoji: "📱", usSectors: ["Communication"], thCats: ["โทรคมนาคม"] },
  { id: "property", label: "อสังหาฯ & ก่อสร้าง", emoji: "🏠", usSectors: ["Real Estate"], thCats: ["อสังหาฯ", "วัสดุก่อสร้าง", "ก่อสร้าง"] },
  { id: "gold", label: "ทองคำ", emoji: "🥇", usTickers: ["NEM", "GOLD", "AEM"] },
  { id: "dividend", label: "ปันผลสม่ำเสมอ", emoji: "💰" }, // พิเศษ: ใช้เครื่องยนต์หุ้นปันผลจริง (ไทย+เมกา)
];

export interface IntlRegionDef {
  id: string;
  label: string;
  flag: string;
  etf: string;
  etfName: string;
  adrs: [string, string][];
}

export const INTL_REGIONS: IntlRegionDef[] = [
  { id: "japan", label: "ญี่ปุ่น", flag: "🇯🇵", etf: "EWJ", etfName: "กองทุนดัชนีหุ้นญี่ปุ่น", adrs: [["TM", "โตโยต้า (ADR)"], ["SONY", "โซนี่ (ADR)"]] },
  { id: "china", label: "จีน", flag: "🇨🇳", etf: "FXI", etfName: "กองทุนดัชนีหุ้นใหญ่จีน", adrs: [["BABA", "อาลีบาบา (ADR)"], ["JD", "JD.com (ADR)"], ["PDD", "PDD (ADR)"]] },
  { id: "india", label: "อินเดีย", flag: "🇮🇳", etf: "INDA", etfName: "กองทุนดัชนีหุ้นอินเดีย", adrs: [["INFY", "Infosys (ADR)"], ["WIT", "Wipro (ADR)"]] },
  { id: "europe", label: "ยุโรป", flag: "🇪🇺", etf: "VGK", etfName: "กองทุนดัชนีหุ้นยุโรป", adrs: [["ASML", "ASML ผู้ผลิตเครื่องจักรชิป (เนเธอร์แลนด์)"], ["NVO", "โนโว นอร์ดิสก์ยาเบาหวาน (เดนมาร์ก)"], ["SAP", "SAM ซอฟต์แวร์องค์กร (เยอรมนี)"], ["TTE", "โททัล เอนเนอร์ยี (ฝรั่งเศส)"]] },
  { id: "korea", label: "เกาหลี", flag: "🇰🇷", etf: "EWY", etfName: "กองทุนดัชนีหุ้นเกาหลี", adrs: [] },
  { id: "taiwan", label: "ไต้หวัน", flag: "🇹🇼", etf: "EWT", etfName: "กองทุนดัชนีหุ้นไต้หวัน", adrs: [["TSM", "TSMC โรงหล่อชิปโลก (ADR)"]] },
  { id: "vietnam", label: "เวียดนาม", flag: "🇻🇳", etf: "VNM", etfName: "กองทุนดัชนีเวียดนาม", adrs: [] },
  { id: "singapore", label: "สิงคโปร์", flag: "🇸🇬", etf: "EWS", etfName: "กองทุนดัชนีสิงคโปร์", adrs: [] },
];
