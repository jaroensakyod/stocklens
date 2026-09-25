import type { Metadata } from "next";
import { getQuotes } from "@/lib/yahoo";
import type { Quote } from "@/lib/types";

// ชื่อแท็บ + og:title แบบมีราคาสด ตอนแชร์ลิงก์หุ้น ("MU 1,080.53 (+4.61%) — StockLens")
export async function generateMetadata({ params }: { params: { ticker: string } }): Promise<Metadata> {
  const ticker = decodeURIComponent(params.ticker || "").toUpperCase();
  let title = `${ticker} — บทวิเคราะห์หุ้น`;
  let description = `บทวิเคราะห์ ${ticker}: กราฟ · คะแนนปัจจัย 5 มิติจากงบจริง · สัญญาณเทคนิค · สถานการณ์ Bull/Base/Bear · AI วิเคราะห์ภาษาไทย`;
  let og = {};
  try {
    const quotes = await getQuotes([ticker]);
    const q = (quotes as Record<string, Quote>)[ticker];
    if (q && isFinite(q.price)) {
      const pct = q.changePct >= 0 ? `+${q.changePct.toFixed(2)}%` : `${q.changePct.toFixed(2)}%`;
      title = `${ticker} ${q.price.toFixed(2)} (${pct})`; // "| StockLens" ต่อท้ายอัตโนมัติโดย template
      description = `${q.name} · ราคา ${q.price.toFixed(2)} ${q.currency} (${pct}) — คะแนนปัจจัย 5 มิติ · สัญญาณเทคนิค · AI วิเคราะห์ไทย · Bull/Base/Bear`;
      og = { title, description }; // override og:title/og:description ของ root (Next merge แบบ shallow)
    }
  } catch {
    // ดึงราคาไม่ได้ก็ใช้ title พื้นฐาน
  }
  return { title, description, openGraph: og };
}

export default function StockLayout({ children }: { children: React.ReactNode }) {
  return children;
}
