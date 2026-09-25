"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  time: number;
  relatedTickers?: string[];
}

function timeAgo(t: number): string {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "เมื่อสักครู่";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.round(h / 24)} วันที่แล้ว`;
}

function useSummary() {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const summarize = async (title: string, publisher: string, aiAvailable: boolean) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/news-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, publisher }),
      });
      const json = await res.json();
      setSummary(json.summary || (aiAvailable ? "สรุปไม่สำเร็จชั่วคราว" : "🔒 ต้องตั้ง AI key ก่อนจึงสรุปข่าวเป็นไทยได้"));
    } catch {
      setSummary("เกิดข้อผิดพลาด");
    }
    setLoading(false);
  };
  return { summary, loading, summarize };
}

// 📰 ข่าวแบบแบ่งครึ่งสไตล์หน้าข่าวจริง: ซ้าย = ข่าวเด่นการ์ดใหญ่ / ขวา = ลิสต์หัวข้อกระชับ
export default function NewsSplit({ news, aiAvailable }: { news: NewsItem[]; aiAvailable: boolean }) {
  const { tier } = useAuth();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const featured = useSummary();
  if (!news.length) return null;
  const [first, ...rest] = news;

  return (
    <div className="grid sm:grid-cols-2 gap-4 items-start">
      {/* ซ้าย: ข่าวเด่น */}
      <div className="card p-5 border-l-4 border-l-accent/70">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="chip bg-accent/15 text-accent-soft text-[10px] font-bold">📌 ข่าวเด่นล่าสุด</span>
          <span className="text-[11px] text-zinc-500">{first.publisher} · {timeAgo(first.time)}</span>
        </div>
        <a href={first.link} target="_blank" rel="noopener noreferrer" className="block text-lg font-bold text-zinc-50 leading-snug hover:text-accent-soft mt-2.5">
          {first.title}
        </a>
        {first.relatedTickers && first.relatedTickers.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {first.relatedTickers.slice(0, 5).map((t) => (
              <a key={t} href={`/stock/${t}`} className="chip bg-base-800 text-zinc-400 border border-base-700 text-[10px] hover:text-zinc-100 num">{t}</a>
            ))}
          </div>
        )}
        <div className="mt-3">
          <button
            className="btn-ghost !py-1 !px-3 text-xs"
            onClick={() => {
              setOpenIdx(0);
              if (tier !== "free" && !featured.summary) featured.summarize(first.title, first.publisher, aiAvailable);
            }}
          >
            {featured.loading ? "กำลังสรุป…" : "🇹🇭 สรุปไทยโดย AI"}
          </button>
          ).replacenothing()
          {openIdx === 0 && featured.summary && (
            <p className="text-sm text-zinc-300 leading-relaxed mt-2.5 bg-base-850 rounded-lg p-3 border border-base-700/60">{featured.summary}</p>
          )}
        </div>
      </div>

      {/* ขวา: ลิสต์ข่าวกระชับ */}
      <div className="card divide-y divide-base-700/50">
        {rest.slice(0, 5).map((n, i) => (
          <div key={i} className="px-4 py-2.5 hover:bg-base-800/50 transition-colors group">
            <div className="flex items-start gap-3">
              <span className="num text-[11px] text-zinc-600 shrink-0 w-5 pt-0.5">{i + 2}</span>
              <div className="min-w-0 flex-1">
                <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-[13px] text-zinc-200 leading-snug hover:text-accent-soft line-clamp-2">
                  {n.title}
                </a>
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  {n.publisher} · {timeAgo(n.time)}
                  {n.relatedTickers && n.relatedTickers.length > 0 && (
                    <span className="num text-zinc-500"> · {n.relatedTickers.slice(0, 3).join(" ")}</span>
                  )}
                </p>
              </div>
              <a href={`/radar`} className="text-[10px] text-zinc-600 hover:text-accent-soft shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" title="วิเคราะห์เป็นกราฟความเชื่อมโยง">🕸️</a>
            </div>
          </div>
        ))}
        <div className="px-4 py-2 text-right">
          <a href="https://finance.yahoo.com/topic/stock-market-news/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-600 hover:text-accent-soft">
            ดูทั้งหมด →
          </a>
        </div>
      </div>
    </div>
  );
}
