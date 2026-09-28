import { NextResponse } from "next/server";
import { getQuotes, getUsdThb } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

// ราคาสินค้าโภคภัณฑ์ที่ติดตาม + FX + คริปโต (แถบหน้าแรก / อ้างอิงอื่นๆ)
const COMMODITIES = [
  { s: "GC=F", n: "ทองคำ", e: "🥇" },
  { s: "SI=F", n: "เงิน", e: "🥈" },
  { s: "CL=F", n: "น้ำมัน WTI", e: "🛢️" },
  { s: "BZ=F", n: "น้ำมัน Brent", e: "🛢️" },
  { s: "NG=F", n: "ก๊าซธรรมชาติ", e: "🔥" },
  { s: "HG=F", n: "ทองแดง", e: "🔶" },
  { s: "CC=F", n: "โกโก้", e: "🍫" },
  { s: "KC=F", n: "กาแฟ", e: "☕" },
  { s: "ZC=F", n: "ข้าวโพด", e: "🌽" },
  { s: "ZW=F", n: "ข้าวสาลี", e: "🌾" },
  { s: "ZS=F", n: "ถั่วเหลือง", e: "🫘" },
  { s: "SB=F", n: "น้ำตาล", e: "🍬" },
  { s: "CT=F", n: "ฝ้าย", e: "🧵" },
  { s: "JO=F", n: "น้ำส้มคั้ย", e: "🍊" },
  { s: "DX-Y.NYB", n: "ดัชนีเงินดอลลาร์", e: "💵" },
  { s: "^TNX", n: "ดอกเบี้ยสหรัฐฯ 10 ปี", e: "📈" },
];

const FX = [
  { s: "THB=X", n: "USD/THB", e: "🇹🇭" },
  { s: "EURUSD=X", n: "EUR/USD", e: "🇪🇺" },
  { s: "JPY=X", n: "USD/JPY", e: "🇯🇵" },
  { s: "CNY=X", n: "USD/CNY", e: "🇨🇳" },
];

const CRYPTO = [
  { s: "BTC-USD", n: "Bitcoin", e: "₿" },
  { s: "ETH-USD", n: "Ethereum", e: "Ξ" },
];

export async function GET() {
  const all = [...COMMODITIES, ...FX, ...CRYPTO];
  const [quotes, usdThb] = await Promise.all([getQuotes(all.map((c) => c.s)), getUsdThb()]);
  const pick = (list: typeof COMMODITIES) => list.map((c) => ({ ...c, quote: quotes[c.s] })).filter((x) => x.quote && isFinite(x.quote.price));
  return NextResponse.json({
    commodities: pick(COMMODITIES),
    fx: pick(FX),
    crypto: pick(CRYPTO),
    usdThb,
  });
}
