import { NextResponse } from "next/server";
import { getQuotes, getUsdThb } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

// ราคาสินค้าโภคภัณฑ์ที่ติดตาม + FX
const COMMODITIES = [
  { s: "CL=F", n: "น้ำมัน WTI", e: "🛢️" },
  { s: "BZ=F", n: "น้ำมัน Brent", e: "🛢️" },
  { s: "NG=F", n: "ก๊าซธรรมชาติ", e: "🔥" },
  { s: "GC=F", n: "ทองคำ", e: "🥇" },
  { s: "SI=F", n: "เงิน", e: "🥈" },
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

export async function GET() {
  const quotes = await getQuotes(COMMODITIES.map((c) => c.s));
  const usdThb = await getUsdThb();
  const items = COMMODITIES.map((c) => ({ ...c, quote: quotes[c.s] })).filter((x) => x.quote && isFinite(x.quote.price));
  return NextResponse.json({ commodities: items, usdThb });
}
