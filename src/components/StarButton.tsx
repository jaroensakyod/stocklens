"use client";

import { useWatchlist } from "@/lib/store";

// ปุ่มดาว เพิ่ม/ลบหุ้นจาก watchlist (บันทึกในเครื่อง)
export default function StarButton({ ticker, className = "" }: { ticker: string; className?: string }) {
  const { has, toggle } = useWatchlist();
  const active = has(ticker);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(ticker);
      }}
      title={active ? "ลบออกจาก Watchlist" : "เพิ่มใน Watchlist"}
      className={`transition-transform hover:scale-110 ${active ? "text-accent" : "text-zinc-600 hover:text-zinc-400"} ${className}`}
      aria-label={active ? "ลบออกจาก Watchlist" : "เพิ่มใน Watchlist"}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
