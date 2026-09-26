"use client";

import { useState } from "react";
import { brokerFor, detectMarket } from "@/lib/markets";
import brokersJson from "@/data/brokers.json";
import type { MarketId } from "@/lib/types";

const BROKERS = (brokersJson as {
  brokers: { name: string; type: string; markets: string; fee: string; fractional: boolean; minNote: string; highlight: string; note: string }[];
}).brokers;

/** ช่องทางที่รองรับตลาดนี้ (จาก brokers.json — แก้ไขได้ที่ไฟล์โดยตรง) */
function channelsFor(m: MarketId) {
  if (m === "US") return BROKERS; // ทุกช่องทางในลิสต์รองรับสหรัฐฯ
  if (m === "HK") return BROKERS.filter((b) => b.markets.includes("ฮ่องกง"));
  if (m === "JP") return BROKERS.filter((b) => b.markets.includes("ญี่ปุ่น"));
  if (m === "CRYPTO") return [];
  return BROKERS.filter((b) => b.markets.includes("โลก")); // ยุโรป/ตลาดอื่น — ระดับโลกอย่าง IBKR
}

const MARKET_NAME: Partial<Record<MarketId, string>> = { US: "สหรัฐฯ 🇺🇸", TH: "ไทย 🇹🇭", HK: "ฮ่องกง 🇭🇰", JP: "ญี่ปุ่น 🇯🇵" };

// ป้ายช่องทางซื้อ — ทุกที่กดเปิดดูครบช่องทาง+ค่าธรรมเนียมได้ (โหมด compact เล็กพอให้อยู่ในตาราง)
export default function BrokerBadge({ ticker, compact = false }: { ticker: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const b = brokerFor(ticker);
  const market = detectMarket(ticker);
  if (!b.buyable && compact) return null;

  const color =
    b.label === "Dime" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : b.label === "โบรกเกอร์ไทย" ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
    : b.label === "InnovestX" ? "bg-violet-500/15 text-violet-400 border-violet-500/30"
    : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";

  if (!b.buyable) return <span className={`chip border ${color}`}>{b.label}</span>;

  const channels = channelsFor(market);
  const extra = Math.max(0, channels.length - 1);

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`chip border ${color} cursor-pointer hover:brightness-125`}
        title="กดดูช่องทางซื้อทั้งหมด + ค่าธรรมเนียม"
      >
        {compact ? (b.label === "Dime" ? "✓ " : "") : "🛒 ซื้อผ่าน "}
        {b.label}
        {extra > 0 && <span className="opacity-70 ml-1">+{extra} ▾</span>}
      </button>
      {open && (
        <div className={`absolute ${compact ? "right-0" : "left-0"} top-full mt-2 ${compact ? "w-72" : "w-[340px]"} max-w-[88vw] card p-3.5 z-50 shadow-2xl text-left space-y-2`}>
          <div className="text-[10px] text-zinc-500">
            ช่องทางซื้อ{MARKET_NAME[market] ?? "ตลาดนี้"}สำหรับคนไทย · {market === "TH" ? "เปิดบัญชี SET ได้ทุกโบรกไทย" : `${channels.length} ช่องทาง`}
          </div>
          {market === "TH" ? (
            <p className="text-xs text-zinc-400 leading-relaxed">
              หุ้นไทยซื้อผ่านโบรกเกอร์ไทยที่มีบัญชี SET ได้ทุกที่ — ธนาคารที่คุณใช้อยู่ (SCB/KBank/กรุงเทพ ฯลฯ) ล้วนมีบริษัทหลักทรัพย์ลูกให้เปิดบัญชีผ่านแอปธนาคารได้เลย
            </p>
          ) : (
            channels.map((c) => (
              <div key={c.name} className="pt-2 border-t border-base-700/50 first:border-0 first:pt-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-zinc-100">{c.name}</span>
                  <span className="chip bg-base-800 text-zinc-500 text-[9px]">{c.type}</span>
                  {c.fractional && <span className="chip bg-emerald-500/10 text-emerald-400 text-[9px]">เศษหุ้นได้</span>}
                </div>
                <div className="text-[10px] num text-accent-soft mt-0.5">{c.fee} · {c.minNote}</div>
                <div className="text-[10px] text-zinc-500 leading-relaxed mt-0.5">⭐ {c.highlight}</div>
              </div>
            ))
          )}
          <p className="text-[9px] text-zinc-600 pt-1">ค่าธรรมเนียมโดยประมาณ (เปลี่ยนได้) — เช็คล่าสุดกับทางโบรก · ตารางเทียบเต็มที่หน้า /dividend</p>
        </div>
      )}
    </span>
  );
}
