"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrokerBadge from "@/components/BrokerBadge";

// ===== 🪙 DR Radars — รวมหุ้นต้นทางของ DR ไทย พร้อมวิเคราะห์ภาษาไทย =====
// DR (Depositary Receipt) = ใบแทนหุ้นต่างประเทศที่บล.ไทยออก ซื้อขายบน SET ด้วยเงินบาท
// จุดต่างของเรา: ผู้ใช้ DR ต้องการรู้เรื่อง "หุ้นต้นทาง" — เรามีหน้าวิเคราะห์ภาษาไทยของทุกตัวอยู่แล้ว
const UNDERLYINGS: { sym: string; note: string }[] = [
  { sym: "NVDA", note: "ราชา AI — DR ยอดนิยมอันดับ 1 ของไทย" },
  { sym: "TSLA", note: "EV + หุ่นยนต์ — ผันผวนแรง เหมาะสายทน" },
  { sym: "AAPL", note: "เครื่องจักรเงินสด + ระบบนิเวศ" },
  { sym: "MSFT", note: "คลาวด์ Azure + Copilot" },
  { sym: "GOOGL", note: "ค้นหา + YouTube + Gemini" },
  { sym: "META", note: "โฆษณาโลกโซเชียล + Llama" },
  { sym: "AMZN", note: "อีคอมเมิร์ซ + AWS" },
  { sym: "AMD", note: "ชิป AI คู่แข่งตรง NVDA" },
  { sym: "AVGO", note: "ชิปเครือข่าย/AI สำหรับดาต้าเซ็นเตอร์" },
  { sym: "NFLX", note: "สตรีมมิ่งรายใหญ่สุด" },
  { sym: "PLTR", note: "ซอฟต์แวร์ข้อมูลรัฐ/องค์กร" },
  { sym: "COIN", note: "ตัวแทนตลาดคริปโต" },
];

interface Q { symbol: string; name: string; price: number; changePct: number; currency: string }

export default function DRPage() {
  const [quotes, setQuotes] = useState<Record<string, Q>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/quote?s=${UNDERLYINGS.map((u) => u.sym).join(",")}`)
      .then((r) => r.json())
      .then((j) => {
        const map: Record<string, Q> = {};
        for (const q of j.quotes ?? []) map[q.symbol] = q;
        setQuotes(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🪙 DR Radars — หุ้นต้นทางของ DR ไทย วิเคราะห์ภาษาไทย</h1>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
          DR (Depositary Receipt) คือใบแทนหุ้นต่างประเทศที่บริษัทหลักทรัพย์ไทย (BBL, KTB, SCB, TTB, CIMB ฯลฯ) ออกให้ซื้อขายบน SET ด้วยเงินบาท —
          ราคา DR จะเดินตาม <b className="text-zinc-200">หุ้นต้นทาง</b> เปะแปะ (บวกค่าธรรมเนียม/สัดส่วน DR แต่ละใบ) ดังนั้นก่อนซื้อ DR ให้ดูปัจจัยของหุ้นต้นทางก่อนเสมอ
        </p>
        <div className="flex gap-2 flex-wrap mt-2">
          <span className="chip bg-base-800 text-zinc-400 border border-base-700">ราคา DR สด + ค่าธรรมเนียมรายใบ: ดูที่แอปโบรกเกอร์ หรือ <a className="text-accent-soft hover:underline" href="https://www.set.or.th/th/market" target="_blank" rel="noopener noreferrer">set.or.th</a></span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {UNDERLYINGS.map((u) => {
          const q = quotes[u.sym];
          const up = (q?.changePct ?? 0) >= 0;
          return (
            <div key={u.sym} className="card card-hover p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={`/stock/${u.sym}`} className="text-lg font-bold text-zinc-100 hover:text-accent-soft">{u.sym}</Link>
                  <div className="text-[11px] text-zinc-500">{q?.name ?? u.sym}</div>
                </div>
                <div className="text-right">
                  <div className="num font-bold text-zinc-100">{q ? q.price.toFixed(2) : "—"} <span className="text-[10px] text-zinc-500">{q?.currency ?? ""}</span></div>
                  {q && <div className={`num text-xs font-semibold ${up ? "text-up" : "text-down"}`}>{up ? "+" : ""}{q.changePct.toFixed(2)}%</div>}
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 mt-2 leading-snug">{u.note}</p>
              <div className="flex items-center justify-between mt-3">
                <Link href={`/stock/${u.sym}`} className="text-xs text-accent-soft hover:underline">วิเคราะห์เต็มภาษาไทย →</Link>
                <BrokerBadge ticker={u.sym} compact />
              </div>
            </div>
          );
        })}
      </div>

      {loading && <p className="text-xs text-zinc-500">กำลังโหลดราคาหุ้นต้นทาง…</p>}

      <div className="card p-4 text-xs text-zinc-400 leading-relaxed">
        💡 <b className="text-zinc-200">เกร็ดนักลงทุน DR:</b> ค่าธรรมเนียมซื้อขาย DR บน SET มักสูงกว่าและสภาพคล่องต่ำกว่าหุ้นจริง —
        ถือเป็นทางเลือกสะดวก (ซื้อในพอร์ต SET เดิม ไม่ต้องเปิดบัญชีต่างประเทศ) แต่ถ้าลงทุนก้อนใหญ่ระยะยาว การเปิดบัญชีหุ้น US ตรงๆ ผ่านโบรกเกอร์ไทยมักถูกกว่าในระยะยาว
        (เทียบช่องทางได้ที่ปุ่ม 🛒 ในหน้าหุ้นแต่ละตัว) — และอย่าลืมว่า DR แต่ละใบถือหุ้นจริงแค่ "เศษส่วน" ของหุ้น 1 ตัว ต้องคิดต้นทุนจริงเป็นสัดส่วนเสมอ
      </div>
    </div>
  );
}
