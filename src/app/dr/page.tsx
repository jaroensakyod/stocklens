"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BrokerBadge from "@/components/BrokerBadge";
import drData from "@/data/dr-underlyings.json";

// ===== 🪙 DR Radars — หุ้นต้นทางของ DR ไทยทั้งตลาด (จัดหมวด + ราคาสด + วิเคราะห์ภาษาไทย) =====
// DR (Depositary Receipt) = ใบแทนหุ้นต่างประเทศที่บล.ไทยออก ซื้อขายบน SET ด้วยเงินบาท
// จุดต่างของเรา: ราคา DR เดินตามหุ้นต้นทางเปะแปะ — เราให้ "วิเคราะห์หุ้นต้นทางเป็นภาษาไทย" ครบทุกตัว
type Item = { y: string; n: string; dr: number; note: string };
interface Q { symbol: string; name: string; price: number; changePct: number; currency: string }

const groups = drData.groups as { cat: string; items: Item[] }[];
const cats = drData.cats as Record<string, { name: string; emoji: string }>;
const all = groups.flatMap((g) => g.items.map((i) => ({ ...i, cat: g.cat })));

export default function DRPage() {
  const [quotes, setQuotes] = useState<Record<string, Q>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/quote?s=${all.map((u) => u.y).join(",")}`)
      .then((r) => r.json())
      .then((j) => {
        const map: Record<string, Q> = {};
        for (const x of j.quotes ?? []) map[x.symbol] = x;
        setQuotes(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => (i.n + " " + i.y).toLowerCase().includes(s)) }))
      .filter((g) => g.items.length);
  }, [q]);

  const shown = filtered.reduce((a, g) => a + g.items.length, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🪙 DR Radars — หุ้นต้นทาง DR ไทยทั้งตลาด</h1>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
          ตลาดมี DR แล้ว <b className="text-zinc-200">208 ใบจาก 146 หุ้นต้นทาง</b> — ราคา DR เดินตามหุ้นต้นทางเปะแปะ (บวกค่าธรรมเนียม/สัดส่วน)
          ก่อนซื้อ DR ให้ดูปัจจัยของหุ้นต้นทางก่อนเสมอ — เราคัดเกรดตัวที่คนไทยถือจริง {all.length} ตัว พร้อมวิเคราะห์เต็มภาษาไทยทุกตัว
        </p>
        <div className="flex gap-2 flex-wrap mt-2">
          <input className="input !w-64" placeholder="🔍 ค้นหุ้นต้นทาง เช่น NVDA, Alibaba, ทอง" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="chip bg-base-800 text-zinc-400 border border-base-700 self-center">ราคา DR สด + ค่าธรรมเนียมรายใบ: ดูที่แอปโบรกเกอร์ หรือ <a className="text-accent-soft hover:underline" href="https://www.set.or.th/dr" target="_blank" rel="noopener noreferrer">set.or.th/dr</a></span>
        </div>
      </div>

      {loading && <p className="text-xs text-zinc-500">กำลังโหลดราคาหุ้นต้นทางทั้ง {all.length} ตัว…</p>}

      {filtered.map((g) => {
        const c = cats[g.cat];
        return (
          <section key={g.cat}>
            <h2 className="text-sm font-bold text-zinc-200 mb-2 flex items-center gap-2">
              <span className="text-base">{c.emoji}</span> {c.name}
              <span className="text-[10px] text-zinc-600 font-normal">{g.items.length} ตัว</span>
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {g.items.map((u) => {
                const qt = quotes[u.y];
                const up = (qt?.changePct ?? 0) >= 0;
                return (
                  <div key={u.y} className="card card-hover p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link href={`/stock/${encodeURIComponent(u.y)}`} className="text-base font-bold text-zinc-100 hover:text-accent-soft">{u.n}</Link>
                          {u.dr >= 3 && <span className="chip bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30 !text-[9px]">DR {u.dr} ใบ · ฮิต</span>}
                          {u.dr === 2 && <span className="chip bg-base-700/40 text-zinc-400 border border-base-700 !text-[9px]">DR {u.dr} ใบ</span>}
                        </div>
                        <div className="text-[10px] text-zinc-600 num">{u.y}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="num font-bold text-zinc-100 text-sm">{qt ? qt.price.toLocaleString(undefined, { maximumFractionDigits: qt.price > 1000 ? 0 : 2 }) : "—"}</div>
                        {qt && <div className={`num text-[11px] font-semibold ${up ? "text-up" : "text-down"}`}>{up ? "+" : ""}{qt.changePct.toFixed(2)}% <span className="text-zinc-600">{qt.currency}</span></div>}
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-2 leading-snug">{u.note}</p>
                    <div className="flex items-center justify-between mt-3">
                      <Link href={`/stock/${encodeURIComponent(u.y)}`} className="text-xs text-accent-soft hover:underline">วิเคราะห์เต็มภาษาไทย →</Link>
                      <BrokerBadge ticker={u.y} compact />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {!loading && !shown && <div className="card p-8 text-center text-sm text-zinc-500">ไม่พบ "{q}" — ลองชื่ออื่น หรือดูรายชื่อเต็มที่ set.or.th/dr</div>}

      <div className="card p-4 text-xs text-zinc-400 leading-relaxed">
        💡 <b className="text-zinc-200">เกร็ดนักลงทุน DR:</b> ค่าธรรมเนียมซื้อขาย DR บน SET มักสูงกว่าและสภาพคล่องต่ำกว่าหุ้นจริง —
        ถือเป็นทางเลือกสะดวก (ซื้อในพอร์ต SET เดิม ไม่ต้องเปิดบัญชีต่างประเทศ) แต่ถ้าลงทุนก้อนใหญ่ระยะยาว การเปิดบัญชีหุ้น US ตรงๆ มักถูกกว่าในระยะยาว
        (เทียบช่องทางได้ที่ปุ่ม 🛒 ในหน้าหุ้นแต่ละตัว) — และอย่าลืมว่า DR แต่ละใบถือหุ้นจริงแค่ "เศษส่วน" ของหุ้น 1 ตัว ต้องคิดต้นทุนจริงเป็นสัดส่วนเสมอ
        <div className="mt-2 text-[10px] text-zinc-600">รายชื่อคัดเกรดจากรายการ DR จริงทั้งตลาด (ก.ย. 2026) · อัปเดตรายปี · ตัวที่ไม่อยู่ในลิสต์นี้ดูได้ที่ <a className="text-accent-soft hover:underline" href="https://www.set.or.th/dr" target="_blank" rel="noopener noreferrer">SET DR</a></div>
      </div>
    </div>
  );
}
