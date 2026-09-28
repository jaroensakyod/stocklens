// แปลงสัญลักษณ์ Yahoo ให้อ่านง่าย: ^GSPC → S&P 500 · ^SET.BK → SET · ^TNX → US10Y · GC=F → ทองคำ
// ใช้ทุกที่ที่โชว์ ticker ตรงๆ บน UI (ข่าว/รายงาน/chips) — ^ และ =F เป็น syntax ของ Yahoo ไม่ควรโชว์ให้ผู้ใช้เห็น
const NAMES: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^IXIC": "NASDAQ",
  "^DJI": "DOW",
  "^VIX": "VIX",
  "^SET.BK": "SET",
  "^SET": "SET",
  "^N225": "NIKKEI",
  "^HSI": "HANG SENG",
  "^TNX": "US10Y (ดอกเบี้ยสหรัฐฯ 10 ปี)",
  "^FVX": "US5Y",
  "^TYX": "US30Y",
  "GC=F": "ทองคำ",
  "CL=F": "น้ำมัน WTI",
  "BZ=F": "น้ำมัน Brent",
  "SI=F": "เงิน",
  "HG=F": "ทองแดง",
  "BTC-USD": "BTC",
  "ETH-USD": "ETH",
  "THB=X": "USD/THB",
};

export function prettySym(s: string): string {
  if (!s) return s;
  const up = s.toUpperCase();
  if (NAMES[up]) return NAMES[up];
  // ^ABC → ABC · ABC=F → ABC ฟิวเจอร์ส · ที่เหลือตัด .BK ให้สั้น (บริบทเว็บเป็นหุ้นไทยอยู่แล้ว)
  return up.replace(/^&/, "").replace(/\^/, "").replace(/=F$/, "").replace(/\.BK$/, "");
}
