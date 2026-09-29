"use client";

import { useFavorites } from "@/lib/store";

// 💜 ปุ่มหุ้นโปรด — แยกจาก ⭐ watchlist ("สนใจจริงจัง" vs "เฝ้าดูราคา")
export default function FavButton({ ticker, className = "" }: { ticker: string; className?: string }) {
  const { has, toggle } = useFavorites();
  const on = has(ticker);
  return (
    <button
      onClick={() => toggle(ticker)}
      className={`hover:scale-110 transition-transform ${on ? "text-fuchsia-400" : "text-zinc-600 hover:text-fuchsia-400"} ${className}`}
      title={on ? "เอาออกจากหุ้นโปรด" : "เพิ่มเป็นหุ้นโปรด (แยกจาก watchlist)"}
      aria-label="หุ้นโปรด"
    >
      {on ? "💜" : "🤍"}
    </button>
  );
}
