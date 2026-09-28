"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Quote } from "@/lib/types";

// ===== แถบ "ทอง · น้ำมัน · FX · คริปโต" หน้าแรก — 3 ค่าที่คนไทยเช็คทุกวัน + ตัวเสริม =====
// ทุกการ์ดกดได้ → หน้า /stock/<symbol> (ดูกราฟ/สัญญาณของสินค้านั้นได้เหมือนหุ้น)

interface Item { s: string; n: string; e: string; quote: Quote }
interface Data { commodities: Item[]; fx: Item[]; crypto: Item[] }

// เลือกตัวที่ต้องโชว์บนแถบหลัก (ที่เหลือดูได้จากหน้า stock ผ่าน /radar)
const MAIN_COMMODITIES = ["GC=F", "SI=F", "CL=F", "BZ=F", "NG=F", "HG=F", "DX-Y.NYB", "^TNX"];

export default function CommoditiesStrip() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/commodities")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  const comm = data.commodities.filter((c) => MAIN_COMMODITIES.includes(c.s));
  const items = [...comm, ...data.fx, ...data.crypto];
  if (!items.length) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-zinc-400">🥇 ทอง · น้ำมัน · สกุลเงิน · คริปโต</h2>
        <Link href="/radar" className="text-xs text-accent-soft hover:underline">ผลกระทบต่อหุ้น →</Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
        {items.map((it) => {
          const up = it.quote.changePct >= 0;
          return (
            <Link key={it.s} href={`/stock/${encodeURIComponent(it.s)}`} className="card p-3 hover:border-accent/40 transition-colors" title={`ดูกราฟ/สัญญาณ ${it.n}`}>
              <div className="text-xs text-zinc-400 truncate">{it.e} {it.n}</div>
              <div className="num text-base font-bold text-zinc-50 mt-1">{fmtPrice(it.quote)}</div>
              <div className={`num text-xs font-semibold ${up ? "text-up" : "text-down"}`}>
                {up ? "▲ +" : "▼ "}{it.quote.changePct.toFixed(2)}%
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function fmtPrice(q: Quote) {
  // แสดงเป็นพันสำหรับราคาใหญ่ (กาแฟ/โกโก้/ธัญพืช ซื้อขายเป็นร้อย-พันเซนต์ต่อหน่วย)
  if (q.price >= 1000) return q.price.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (q.price >= 10) return q.price.toFixed(2);
  return q.price.toFixed(4);
}
