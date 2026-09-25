// ===== จัดการหลายตลาด: รู้จัก ticker ตลาดไหน + แนะนำช่องทางซื้อสำหรับคนไทย =====
import type { MarketId } from "./types";

const ANY_SUFFIX = /\.(NS|BO|KS|KQ|AX|SS|SZ|HM|HN|SI|JK|TW|TO|V|PA|AS|SW|ST|MI|MC|IS|TA|AD|SR|JO|SA|MX|NZ|L|DE|BK|HK|T)$/;

export function detectMarket(symbol: string): MarketId {
  const s = symbol.toUpperCase();
  if (s.endsWith(".BK")) return "TH";
  if (s.endsWith(".HK")) return "HK";
  if (s.endsWith(".T")) return "JP";
  if (ANY_SUFFIX.test(s)) return "EU"; // ตลาดอื่นๆ ทั่วโลก (เอเชีย/ยุโรป/ตะวันออกกลาง/อเมริกาใต้)
  if (/(-USD|-USDT)$/.test(s)) return "CRYPTO";
  if (/^(CL|BZ|NG|GC|SI|HG|CC|KC|ZC|ZW|ZS|SB|CT|JO|LE)=F$/.test(s)) return "COMMODITY";
  if (s.startsWith("^")) return "INDEX";
  if (/(THB|USD|EUR|JPY)=/.test(s) || s === "DX-Y.NYB") return "FX";
  return "US";
}

export interface BrokerInfo {
  label: string;
  detail: string;
  buyable: boolean;
}

/** ป้ายช่องทางซื้อตามตลาด — ข้อมูล ณ ก.ย. 2026 เช็คซ้ำได้ที่ src/lib/markets.ts */
export function brokerFor(symbol: string): BrokerInfo {
  const m = detectMarket(symbol);
  switch (m) {
    case "US":
      return { label: "Dime", detail: "ซื้อได้ใน Dime! (เศษหุ้นเริ่ม 50฿, ค่าธรรมเนียม ~0.15%) หรือ InnovestX / Webull", buyable: true };
    case "TH":
      return { label: "โบรกเกอร์ไทย", detail: "ซื้อผ่านโบรกเกอร์ไทยที่มีบัญชี SET", buyable: true };
    case "HK":
      return { label: "InnovestX", detail: "ตลาดฮ่องกง — ผ่าน InnovestX หรือโบรกเกอร์ต่างประเทศ", buyable: true };
    case "JP":
      return { label: "InnovestX", detail: "ตลาดญี่ปุ่น — ผ่าน InnovestX หรือโบรกเกอร์ต่างประเทศ", buyable: true };
    case "EU":
      return { label: "โบรกต่างประเทศ", detail: "ตลาดนี้ (เอเชีย/ยุโรป/ตะวันออกกลาง/อเมริกาใต้) — ผ่านโบรกเกอร์ต่างประเทศ เช่น IBKR", buyable: true };
    default:
      return { label: "ตราสารอ้างอิง", detail: "สินค้าโภคภัณฑ์/ดัชนี — ซื้อขายตรงไม่ได้ ดูเป็นสัญญาณประกอบการวิเคราะห์", buyable: false };
  }
}

export const MARKET_LABEL: Record<MarketId, string> = {
  US: "สหรัฐฯ 🇺🇸",
  TH: "ไทย 🇹🇭",
  HK: "ฮ่องกง 🇭🇰",
  JP: "ญี่ปุ่น 🇯🇵",
  EU: "ตลาดอื่นทั่วโลก 🌍",
  COMMODITY: "สินค้าโภคภัณฑ์",
  INDEX: "ดัชนี",
  FX: "อัตราแลกเปลี่ยน",
  CRYPTO: "คริปโต",
};

export function isThbNative(symbol: string) {
  return detectMarket(symbol) === "TH";
}

/** ช่วงเวลาเทรดโดยประมาณ (เวลาไทย) — ไว้แสดงบอกความรู้สึก "ตลาดเปิดอยู่ไหม" */
export function marketOpenHint(symbol: string): string {
  const m = detectMarket(symbol);
  if (m === "US") return "ตลาดสหรัฐฯ: 21:30–04:00 น. (เวลาไทย)";
  if (m === "TH") return "ตลาดไทย: 10:00–16:30 น.";
  if (m === "HK") return "ตลาดฮ่องกง: 09:30–16:00 น. (เวลาไทย)";
  if (m === "JP") return "ตลาดญี่ปุ่น: 09:00–15:00 น. (เวลาไทย)";
  return "";
}
