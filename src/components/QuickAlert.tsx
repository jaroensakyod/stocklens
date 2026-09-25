"use client";

import { useState } from "react";
import { useAlerts } from "@/lib/store";

// ฟอร์มตั้งแจ้งเตือนราคาด่วนบนหน้าหุ้นรายตัว
export default function QuickAlert({ ticker, price }: { ticker: string; price: number }) {
  const { add } = useAlerts();
  const [direction, setDirection] = useState<"above" | "below">("below");
  const [target, setTarget] = useState("");
  const [done, setDone] = useState(false);
  if (!isFinite(price)) return null;

  const t = Number(target) || price;

  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold text-zinc-100 mb-2">🔔 แจ้งเตือนเมื่อราคาถึงเป้า</h3>
      <div className="flex gap-2">
        <select className="input !w-28" value={direction} onChange={(e) => setDirection(e.target.value as "above" | "below")}>
          <option value="below">ลงถึง ≤</option>
          <option value="above">ขึ้นถึง ≥</option>
        </select>
        <input className="input num" type="number" placeholder={price.toFixed(2)} value={target} onChange={(e) => setTarget(e.target.value)} />
        <button
          className="btn-primary shrink-0"
          onClick={() => {
            add(ticker, direction, t);
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          }}
        >
          {done ? "✓ ตั้งแล้ว" : "ตั้ง"}
        </button>
      </div>
      <p className="text-[11px] text-zinc-600 mt-2">ราคา {ticker} ตอนนี้ {price.toFixed(2)} · จะแจ้งผ่านเบราว์เซอร์เมื่อเปิดเว็บไว้ (เช็คทุก 90 วิ) · จัดการทั้งหมดที่หน้า "พอร์ตของฉัน"</p>
    </div>
  );
}
