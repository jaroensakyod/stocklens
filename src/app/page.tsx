"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import NewsSplit from "@/components/NewsSplit";
import WatchlistStrip from "@/components/WatchlistStrip";
import MarketHeatmap from "@/components/MarketHeatmap";
import MoversByMarket from "@/components/MoversByMarket";
import DailyPicks from "@/components/DailyPicks";
import TodayBoard from "@/components/TodayBoard";
import type { Quote } from "@/lib/types";

interface DashboardData {
  indices: { s: string; n: string; quote: Quote }[];
  popular: Quote[];
  gainers: Quote[];
  losers: Quote[];
  news: { title: string; publisher: string; link: string; time: number; relatedTickers?: string[] }[];
  events: { date: string; label: string; impact: string; star: number }[];
  usdThb: number;
  aiAvailable: boolean;
  universeSize: number;
}

function QuoteRow({ q, usdThb }: { q: Quote; usdThb: number }) {
  const up = q.changePct >= 0;
  return (
    <Link href={`/stock/${q.symbol}`} className="flex items-center justify-between px-3 py-2 hover:bg-base-800 rounded-lg text-sm">
      <div className="min-w-0">
        <span className="font-semibold text-zinc-100">{q.symbol}</span>
        <span className="text-zinc-500 text-xs ml-2 truncate">{q.name}</span>
      </div>
      <div className="text-right shrink-0">
        <div className="num text-zinc-100">{q.price.toFixed(2)}</div>
        <div className={`num text-xs ${up ? "text-up" : "text-down"}`}>
          {up ? "+" : ""}{q.changePct.toFixed(2)}%
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [newsUpdatedAt, setNewsUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((j) => {
        setData(j);
        if (j.news?.length) setNewsUpdatedAt(Date.now());
      })
      .catch(() => {});
    // ข่าวอัปเดตอัตโนมัติทุก 60 วิ (server cache 2 นาทีกันยิง Yahoo บ่อย) — กรองเฉพาะ 12 ชม.ล่าสุดให้รู้สึก "สด"
    const newsTimer = setInterval(() => {
      fetch("/api/news?q=stock%20market&count=8&fresh=43200000")
        .then((r) => r.json())
        .then((j) => {
          if (j.news?.length) {
            setData((d) => (d ? { ...d, news: j.news } : d));
            setNewsUpdatedAt(Date.now());
          }
        })
        .catch(() => {});
    }, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      clearInterval(newsTimer);
      clearInterval(tick);
    };
  }, []);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="text-4xl animate-pulse">🔬</div>
        <p className="text-zinc-500 text-sm">กำลังโหลดข้อมูลตลาด…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-6">
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-50">
          หุ้นไม่ยาก — <span className="text-accent">วิเคราะห์ให้เห็นทุกมิติ</span>
        </h1>
        <p className="text-zinc-400 mt-3 max-w-2xl mx-auto text-sm leading-relaxed">
          เครื่องมือระดับมืออาชีพ: คะแนนปัจจัย 5 มิติ · สัญญาณเทคนิค · AI วิเคราะห์ภาษาไทย · Global Radar ที่แปลง
          &ldquo;เหตุการณ์โลก&rdquo; เป็นห่วงโซ่หุ้นที่ได้/เสียประโยชน์ — พร้อมบอกว่าซื้อหุ้นตัวไหนจาก Dime! / โบรกเกอร์ไหน
        </p>
        <div className="flex gap-3 justify-center mt-5 flex-wrap">
          <Link href="/starter" className="btn-primary">🧑‍🎓 มือใหม่? ดูพอร์ตตัวอย่างรายวัน</Link>
          <Link href="/radar" className="btn-ghost">🌍 ลอง Global Radar</Link>
          <Link href="/screener" className="btn-ghost">🔎 คัดกรองหุ้น</Link>
        </div>
        {/* ประโยคสร้างความเชื่อใจ — กับความกลัว "เว็บการเงินหลอกโอนเงิน" ของคนไทย */}
        <p className="text-[11px] md:text-xs text-zinc-500 mt-5 max-w-xl mx-auto leading-relaxed">
          🔒 <span className="text-zinc-400">StockLens เป็นสื่อบทวิเคราะห์ข้อมูล ไม่ใช่โบรกเกอร์หรือที่ปรึกษาการลงทุน</span> — ไม่มีระบบรับฝากเงิน
          ไม่มีการซื้อขายหุ้นแทนท่าน และจะไม่ขอรหัสบัญชี/รหัสโบรกเกอร์ใดๆ ทุกกรณี <Link href="/about" className="text-accent-soft underline underline-offset-2">ดูหลักการทำงาน</Link>
        </p>
      </section>

      {/* 📋 วันนี้ควรรู้อะไร — ตอบ "วันนี้ทำอะไร" ในจอเดียว (เหนือสิ่งอื่นทั้งหมด) */}
      <TodayBoard />

      {/* Daily Picks — ตอบคำถามแรกของคนเข้าใหม่: "ตัวไหนน่าสนใจวันนี้" */}
      <DailyPicks />

      {/* Watchlist ของผู้ใช้ (แสดงเมื่อมี) */}
      <WatchlistStrip />

      <MarketHeatmap renderMovers={(region) => <MoversByMarket controlledRegion={region} />} />

      {/* ดัชนี */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">📊 ดัชนีทั่วโลก</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {data.indices.map((i) => {
            const up = i.quote.changePct >= 0;
            return (
              <div key={i.s} className="card p-3">
                <div className="text-xs text-zinc-500">{i.n}</div>
                <div className="num text-lg font-bold text-zinc-50 mt-1">{i.quote.price.toFixed(2)}</div>
                <div className={`num text-xs font-semibold ${up ? "text-up" : "text-down"}`}>
                  {up ? "▲ +" : "▼ "}{i.quote.changePct.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ข่าว */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-zinc-400">📰 ข่าวที่ต้องรู้วันนี้</h2>
            <div className="flex items-center gap-2">
              {newsUpdatedAt && (
                <span className="text-[10px] chip bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  🔴 อัปเดตอัตโนมัติ · {Math.max(0, Math.round((now - newsUpdatedAt) / 1000))} วิที่แล้ว
                </span>
              )}
              <span className="text-xs text-zinc-600 num">USD/THB {data.usdThb.toFixed(2)}</span>
            </div>
          </div>
          <NewsSplit news={data.news} aiAvailable={data.aiAvailable} />
        </section>

        <div className="space-y-6">
          {/* ปฏิทิน */}
          <section>
            <h2 className="text-sm font-bold text-zinc-400 mb-3">🗓️ ปฏิทินเหตุการณ์สำคัญ</h2>
            <div className="card divide-y divide-base-700/60">
              {data.events.length === 0 && <p className="p-4 text-xs text-zinc-500">ไม่มีเหตุการณ์ที่บันทึกไว้ล่วงหน้า</p>}
              {data.events.map((e) => (
                <div key={e.date + e.label} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="num text-xs text-accent-soft font-semibold">{e.date}</span>
                    <span className="text-amber-400 text-xs">{"★".repeat(e.star)}</span>
                  </div>
                  <p className="text-sm text-zinc-200 mt-0.5">{e.label}</p>
                  <p className="text-xs text-zinc-500">{e.impact}</p>
                </div>
              ))}
            </div>
          </section>

                </div>
      </div>
    </div>
  );
}
