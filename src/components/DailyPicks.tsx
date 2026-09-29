"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import InvestWarn from "@/components/InvestWarn";
import StarButton from "@/components/StarButton";
import { addToBasket } from "@/lib/compareBasket";

interface Pick {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  currency: string;
  changePct: number;
  marketCapB: number | null;
  score: number;
  tag: string;
  tagEmoji: string;
  reason: string;
}

// 🎯 Daily Picks — "หุ้นน่าสนใจวันนี้" ตอบคำถามแรกของคนเข้าใหม่จาก Reel: "ตัวไหนน่าสนใจ"
// ทุกตัวคัดจากข้อมูลจริง (ราคา คะแนนปัจจัยจากงบ) ไม่ใช่คำแนะนำการลงทุน
export default function DailyPicks() {
  const [data, setData] = useState<null | { date: string; picks: Pick[]; note: string }>(null);
  const [failed, setFailed] = useState(false);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    fetch("/api/picks")
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch(() => setFailed(true));
  }, []);

  return (
    <section>
      <div className="flex items-end justify-between mb-3 gap-2">
        <h2 className="text-sm font-bold text-zinc-400">🎯 หุ้นน่าสนใจวันนี้</h2>
        {data?.date && <span className="text-[11px] text-zinc-600 shrink-0">{data.date}</span>}
      </div>

      <div className="mb-3"><InvestWarn /></div>

      {!data && !failed && (
        <div className="card p-8 text-center text-xs text-zinc-500">กำลังสแกนตลาดหาหุ้นที่ขยับแรง + งบแข็งแรง… (~20 วินาที)</div>
      )}
      {failed && <div className="card p-8 text-center text-xs text-zinc-500">ยังไม่สามารถคัดหุ้นได้ช่วงนี้ — ลองใหม่อีกครั้ง</div>}

      {data && data.picks.length === 0 && (
        <div className="card p-8 text-center text-xs text-zinc-500">วันนี้ยังไม่มีหุ้นที่ผ่านเกณฑ์ (ขยับแรง + คะแนนรวม ≥ 55) — กลับมาดูใหม่ภายหลัง</div>
      )}

      {data && data.picks.length > 0 && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {data.picks.map((p, i) => {
              const up = p.changePct >= 0;
              return (
                <div key={p.ticker} className="card p-3.5 hover:border-accent/40 transition-colors group">
                  <div className="flex items-start justify-between gap-1">
                    <span className="chip bg-accent/10 text-accent-soft text-[10px]">{p.tagEmoji} {p.tag}</span>
                    <span className="text-[10px] text-zinc-600 num">#{i + 1}</span>
                  </div>
                  <div className="mt-2">
                    <Link href={`/stock/${p.ticker}`} className="font-bold text-zinc-50 group-hover:text-accent-soft">{p.ticker}</Link>
                    <p className="text-[11px] text-zinc-500 truncate">{p.name}</p>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="num text-sm text-zinc-100">{p.price.toFixed(2)}</span>
                    <span className="text-[10px] text-zinc-600">{p.currency}</span>
                    <span className={`num text-xs font-semibold ${up ? "text-up" : "text-down"}`}>
                      {up ? "+" : ""}{p.changePct.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-2 leading-snug line-clamp-3">{p.reason}</p>
                  {/* จัดการทันที: เข้าพอร์ต / เทียบ (เชื่อมกับฟังก์ชันใหม่) */}
                  <div className="flex gap-2 mt-2 pt-2 border-t border-base-700/40">
                    <a href={`/portfolio?add=${encodeURIComponent(p.ticker)}`} className="chip bg-base-800 text-zinc-400 border border-base-700 !text-[10px] hover:text-accent-soft">➕ พอร์ต</a>
                    <button
                      className="chip bg-base-800 text-zinc-400 border border-base-700 !text-[10px] hover:text-accent-soft"
                      onClick={() => {
                        const res = addToBasket(p.ticker);
                        setFlash(res === "added" ? `เพิ่ม ${p.ticker} เข้าตะกร้าเทียบ` : res === "full" ? "ตะกร้าเต็ม (4 ตัว)" : "");
                        if (res === "added") setTimeout(() => setFlash(""), 2500);
                      }}
                    >⚔️ เทียบ</button>
                    <StarButton ticker={p.ticker} className="text-sm ml-auto" />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">⚠️ {data.note} · คะแนนเป็นการประเมินเชิงข้อมูลจากงบการเงินล่าสุด ราคาอาจหน่วง ~15 นาที</p>
          {flash && <p className="text-[11px] text-accent-soft mt-1">{flash} — <Link href="/compare" className="underline">ไปหน้าเปรียบเทียบ →</Link></p>}
        </>
      )}
    </section>
  );
}
