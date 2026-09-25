"use client";

import { useState } from "react";

// เครื่องคำนวณเศษหุ้น Dime: งบบาท → ได้กี่หุ้น + ค่าธรรมเนียมโดยประมาณ
export default function BudgetCalc({ priceUsd, usdThb, currency }: { priceUsd: number; usdThb: number; currency: string }) {
  const [budget, setBudget] = useState("1000");
  const b = Number(budget) || 0;

  if (currency !== "USD" || !isFinite(priceUsd) || priceUsd <= 0) return null;

  const thbPrice = priceUsd * usdThb;
  const shares = b / (thbPrice * 1.0015); // ค่าธรรมเนียม ~0.15%
  const fee = b - shares * thbPrice;
  const ok = b >= 50;

  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold text-zinc-100 mb-2">💰 เครื่องคำนวณเศษหุ้น (Dime!)</h3>
      <div className="flex gap-2 items-center mb-3">
        <input
          className="input num"
          type="number"
          min={0}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="งบประมาณ (บาท)"
        />
        <span className="text-sm text-zinc-400 shrink-0">บาท</span>
      </div>
      {ok ? (
        <div className="text-sm space-y-1">
          <p className="text-zinc-300">
            ซื้อได้ <span className="num text-accent-soft font-bold">{shares.toFixed(4)}</span> หุ้น
          </p>
          <p className="text-xs text-zinc-500 num">
            ราคาหุ้น ~{thbPrice.toFixed(0)} ฿/หุ้น · ค่าธรรมเนียมโดยประมาณ {fee.toFixed(1)} ฿ (0.15%) · Dime รองรับเศษหุ้นเริ่ม 50 ฿
          </p>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Dime! รองรับเศษหุ้นขั้นต่ำ ~50 บาท (~$1.50)</p>
      )}
    </div>
  );
}
