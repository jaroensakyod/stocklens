"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// 📬 Insights — Daily Brief วันนี้ (สาธารณะฉบับย่อ) + ธีมเหตุการณ์ร้อนวันนี้ (เทียบ "บทความข่าว" ของคู่แข่ง แต่เรา generate จากข้อมูลจริงทุกวัน)
interface Brief { thDate?: string; fbStarter?: string; fbPro?: string; headlines?: string[] }
interface Theme { id: string; name: string; emoji: string; heat: number; desc: string; newsCount?: number }

export default function InsightsPage() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);

  useEffect(() => {
    fetch("/api/brief").then((r) => r.json()).then(setBrief).catch(() => {});
    fetch("/api/radar").then((r) => r.json()).then((j) => setThemes((j.themes ?? []).slice(0, 6))).catch(() => {});
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">📬 Insights ประจำวัน</h1>
        <p className="text-sm text-zinc-400 mt-1">สรุปตลาด + เหตุการณ์ที่กำลังร้อน — เขียนใหม่ทุกวันจากข้อมูลจริง (สมาชิกได้ฉบับเต็ม + PDF + LINE)</p>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h2 className="text-base font-bold text-zinc-100">📰 Daily Brief {brief?.thDate ? `· ${brief.thDate}` : ""}</h2>
          <span className="chip bg-up/10 text-up border border-up/30 !text-[10px]">อัปเดตทุกวันทำการ</span>
        </div>
        {brief ? (
          <>
            <div className="space-y-2">
              {(brief.fbStarter ?? "").split("\n").filter(Boolean).slice(0, 14).map((line, i) => (
                <p key={i} className="text-xs text-zinc-300 leading-relaxed">{line}</p>
              ))}
            </div>
            <details className="mt-3">
              <summary className="text-xs text-accent-soft cursor-pointer">อ่านฉบับเต็ม (สำหรับสมาชิก)</summary>
              <div className="mt-2 space-y-1.5">
                {(brief.fbPro ?? "").split("\n").filter(Boolean).slice(0, 20).map((line, i) => (
                  <p key={i} className="text-xs text-zinc-400 leading-relaxed">{line}</p>
                ))}
              </div>
            </details>
            <p className="text-[10px] text-zinc-600 mt-3">
              ฉบับพิมพ์ PDF สวยๆ + ส่ง LINE ทุกเช้า = สิทธิ์สมาชิก — <Link href="/pricing" className="text-accent-soft underline">ดูแพ็กเกจ</Link>
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-500 py-6 text-center">กำลังเขียนสรุปประจำวันจากข้อมูลล่าสุด… (~20 วิ)</p>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-zinc-100">🔥 เหตุการณ์ร้อนวันนี้</h2>
          <Link href="/radar" className="text-xs text-accent-soft hover:underline">Global Radar เต็ม →</Link>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {themes.map((t) => (
            <Link key={t.id} href="/radar" className="rounded-lg border border-base-700 p-3 hover:border-accent/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-100">{t.emoji} {t.name}</span>
                <span className={`num text-xs font-bold px-1.5 py-0.5 rounded ${t.heat >= 70 ? "bg-down/15 text-down" : t.heat >= 40 ? "bg-accent/15 text-accent-soft" : "bg-base-700/30 text-zinc-500"}`}>{t.heat}°</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 leading-snug line-clamp-2">{t.desc}</p>
            </Link>
          ))}
          {!themes.length && <p className="text-xs text-zinc-500">กำลังโหลด…</p>}
        </div>
      </div>
    </div>
  );
}
