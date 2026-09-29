"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ShortsPage() {
  const [videos, setVideos] = useState<{ id: string; title: string; publishedAt: string }[]>([]);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    fetch("/api/videos").then((r) => r.json()).then((j) => {
      setVideos(j.videos ?? []);
      setConfigured(!!j.configured);
    }).catch(() => {});
  }, []);

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🎬 วิดีโอความรู้การลงทุน</h1>
        <p className="text-sm text-zinc-400 mt-1">คลิปสั้นอธิบายเครื่องมือของ StockLens + ความรู้พื้นฐาน — ใหม่ล่าสุดจากช่อง YouTube ของเรา</p>
      </div>

      {videos.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((v) => (
            <a key={v.id} href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="card overflow-hidden hover:border-accent/40 transition-colors group">
              <div className="relative aspect-video bg-base-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                <span className="absolute inset-0 flex items-center justify-center text-3xl opacity-80">▶️</span>
              </div>
              <div className="p-3">
                <p className="text-xs text-zinc-200 leading-snug line-clamp-2">{v.title}</p>
                <p className="text-[10px] text-zinc-600 mt-1">{fmtDate(v.publishedAt)}</p>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-2">🎬</p>
          <p className="text-zinc-300 font-semibold">ช่องวิดีโอกำลังจะเปิดตัว</p>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed max-w-md mx-auto">
            เรากำลังผลิตคลิปสั้น "เครื่องมือไหนใช้ยังไง + ความรู้การลงทุน" — สร้างสตอรี่การ์ดหุ้นรายตัวได้แล้ววันนี้ที่หน้าหุ้น (ปุ่ม 🎬 Story Card)
            {!configured && " · (แอดมิน: ใส่ NEXT_PUBLIC_YT_CHANNEL_ID ใน .env.local เพื่อดึงคลิปจากช่องมาแสดงที่นี่อัตโนมัติ)"}
          </p>
          <div className="flex gap-2 justify-center mt-4 flex-wrap">
            <Link href="/stock/NVDA" className="chip bg-base-800 text-accent-soft border border-base-700">ลองดู 🎬 Story Card ที่หน้าหุ้น →</Link>
            <Link href="/starter" className="chip bg-base-800 text-accent-soft border border-base-700">🧑‍🎓 พอร์ตมือใหม่รายวัน</Link>
          </div>
        </div>
      )}
    </div>
  );
}
