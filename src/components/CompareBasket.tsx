"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBasket, removeFromBasket, clearBasket, onBasketChange, BASKET_MAX } from "@/lib/compareBasket";

// 🧺 ตะกร้าเปรียบเทียบลอย — ติดมุมจอทุกหน้า กดเพิ่มจากปุ่ม ⚔️ ที่ไหนก็ได้ แล้วพาไป /compare
export default function CompareBasket() {
  const [items, setItems] = useState<string[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setItems(getBasket());
    return onBasketChange(setItems);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-[92vw]">
      {open ? (
        <div className="card p-3 border-accent/40 shadow-xl shadow-black/40 bg-base-900/95 backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-100">🧺 รายการเปรียบเทียบ <span className="num text-zinc-500">{items.length}/{BASKET_MAX}</span></span>
            <div className="flex gap-1.5">
              <button className="text-[10px] text-zinc-500 hover:text-zinc-300" onClick={() => clearBasket()}>ล้าง</button>
              <button className="text-zinc-500 hover:text-zinc-200" onClick={() => setOpen(false)} title="ย่อ">▾</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {items.map((t) => (
              <span key={t} className="chip bg-base-800 text-zinc-100 border border-base-700 !text-[11px]">
                {t}
                <button className="text-zinc-500 hover:text-down ml-1" onClick={() => removeFromBasket(t)}>✕</button>
              </span>
            ))}
          </div>
          {items.length >= 2 ? (
            <Link href={`/compare?t=${encodeURIComponent(items.join(","))}`} className="btn-primary w-full block text-center text-xs !py-1.5">⚔️ เปรียบเทียบเลย</Link>
          ) : (
            <p className="text-[10px] text-zinc-500 text-center">เพิ่มอีกอย่างน้อย 1 ตัวเพื่อเริ่มเทียบ</p>
          )}
        </div>
      ) : (
        <button className="chip bg-accent text-zinc-950 font-bold border border-accent !text-xs shadow-lg" onClick={() => setOpen(true)}>
          🧺 {items.length}/{BASKET_MAX} เทียบ
        </button>
      )}
    </div>
  );
}
