"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { MonthlyDivRow } from "@/lib/monthlyDividends";

// 📅 หุ้นปันผลรายเดือน + ตัววางแผนรายได้ปันผล — "สร้างเงินเดือนเสริมจากปันผลทุกเดือน"
// หุ้นไทยจ่ายสูงสุดปีละ 2 ครั้ง — ตัวจ่าย "เดือนละครั้ง" อยู่ตลาดสหรัฐฯ (ซื้อผ่าน Dime/โบรกต่างประเทศได้)

const RISK_COLOR: Record<string, string> = {
  "ต่ำ": "chip bg-emerald-500/10 text-emerald-400 text-[10px]",
  "กลาง": "chip bg-amber-500/10 text-amber-400 text-[10px]",
  "สูง": "chip bg-red-500/10 text-red-400 text-[10px]",
};

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

export default function DividendPage() {
  const [rows, setRows] = useState<MonthlyDivRow[] | null>(null);
  const [asOf, setAsOf] = useState("");

  useEffect(() => {
    fetch("/api/monthly-dividends")
      .then((r) => r.json())
      .then((j) => {
        setRows(j.rows ?? []);
        setAsOf(j.asOf ?? "");
      })
      .catch(() => {});
  }, []);

  // ===== ตัววางแผน — state ร่วม 2 โหมด =====
  const [target, setTarget] = useState(10000); // อยากได้ปันผลสุทธิ/เดือน
  const [initial, setInitial] = useState(10000);
  const [add, setAdd] = useState(2000);
  const [yieldPct, setYieldPct] = useState(6);
  const [growth, setGrowth] = useState(2);
  const [drip, setDrip] = useState(true);
  const [tax15, setTax15] = useState(true);

  const factor = tax15 ? 0.85 : 1;
  const netYield = yieldPct * factor;

  // โหมด A: เป้า→ทุน ที่ yield 3 ระดับ
  const needCapital = (y: number) => (target * 12) / ((y * factor) / 100);

  // โหมด B: จำลองสะสมรายเดือน (DRIP = ปันผลทบต้น) จนรายได้/เดือนถึงเป้า
  const plan = useMemo(() => {
    const months: { m: number; v: number; income: number; contributed: number }[] = [];
    let v = initial;
    let contributed = initial;
    let reachMonth = -1;
    for (let m = 1; m <= 480; m++) {
      const income = (v * netYield) / 100 / 12;
      if (reachMonth < 0 && income >= target) reachMonth = m;
      v = drip ? v * (1 + (growth + netYield) / 100 / 12) + add : v * (1 + growth / 100 / 12) + add;
      contributed += add;
      if (m % 12 === 0) months.push({ m, v, income: (v * netYield) / 100 / 12, contributed });
    }
    const reachYear = reachMonth > 0 ? Math.ceil(reachMonth / 12) : null;
    const showUntil = reachYear ? Math.min(reachYear + 2, 40) : 20;
    return { months: months.filter((x) => x.m / 12 <= showUntil), reachYear, finalIncome: months[months.length - 1]?.income ?? 0 };
  }, [initial, add, netYield, growth, drip, target]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <section className="text-center pt-4">
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-50">
          📅 ปันผลรายเดือน <span className="text-accent">สร้างเงินเดือนเสริมทุกเดือน</span>
        </h1>
        <p className="text-zinc-400 mt-3 text-sm leading-relaxed max-w-2xl mx-auto">
          หุ้นไทยจ่ายปันผลสูงสุดปีละ 2 ครั้ง — แต่ตลาดสหรัฐฯ มีหุ้น/ETF ที่จ่าย <b className="text-zinc-200">เดือนละครั้ง</b> ซื้อผ่าน Dime (เศษหุ้นเริ่ม 50฿) ได้เลย
          หน้านี้รวมรายชื่อยอดนิยม + <b className="text-zinc-200">ตัววางแผนรายได้ปันผล</b> ให้เห็นว่าต้องมีทุนเท่าไหร่ หรือต้องสะสมนานแค่ไหน
        </p>
        {asOf && <p className="text-[11px] text-zinc-500 mt-2">ราคา/yield ล่าสุด {asOf} · หุ้นไทยปันผลดูที่ <Link href="/longterm" className="text-accent-soft underline">หน้าระยะยาว</Link></p>}
      </section>

      {/* ตารางหุ้นจ่ายรายเดือน */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">1️⃣ หุ้น/ETF ที่จ่ายปันผลรายเดือน (เรียงจากเสี่ยงน้อย → หวานเสี่ยงสูง)</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[11px] text-zinc-500 border-b border-base-700">
                <th className="py-2 px-3">ตัวจ่าย + ทำไมต้องรู้จัก</th>
                <th className="py-2 px-3">ประเภท</th>
                <th className="py-2 px-3 text-right">Yield/ปี</th>
                <th className="py-2 px-3 text-right">ราคา/หุ้น</th>
                <th className="py-2 px-3 text-right">รับสุทธิ/เดือน*</th>
                <th className="py-2 px-3">ความเสี่ยง</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => (
                <tr key={r.symbol} className="border-b border-base-700/50 align-top">
                  <td className="py-2.5 px-3">
                    <Link href={`/stock/${r.symbol}`} className="font-semibold text-zinc-100 hover:text-accent">{r.symbol}</Link>
                    <span className="text-zinc-500 text-xs ml-2">{r.name}</span>
                    <div className="text-[11px] text-zinc-400 mt-1 max-w-md leading-relaxed">{r.note}</div>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-zinc-400">{r.type}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="num font-bold text-accent">{r.yieldPct.toFixed(1)}%</span>
                    {r.yieldSource === "approx" && <span className="text-[9px] text-zinc-600 ml-1">(โดยประมาณ)</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right num text-zinc-400">
                    {r.priceThb ? `฿${baht(r.priceThb)}` : "-"}
                    {r.changePct !== null && (
                      <span className={r.changePct >= 0 ? "text-up ml-1 num text-[10px]" : "text-down ml-1 num text-[10px]"}>
                        {r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right num text-zinc-200">฿{baht(r.monthlyPer100kThb)}</td>
                  <td className="py-2.5 px-3"><span className={RISK_COLOR[r.risk]}>{r.risk}</span></td>
                </tr>
              ))}
              {!rows && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500 text-sm animate-pulse">กำลังดึงราคา/yield ล่าสุด…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-zinc-500 mt-2">*รายได้ปันผลสุทธิต่อเดือน เมื่อลงเงิน ฿100,000 — คิดภาษี 15% ที่สหรัฐฯ หัก ณ ที่จ่ายแล้ว (ยื่น W-8BEN กับโบรกได้) · yield สดจาก TradingView (ที่ไม่มีข้อมูลสดใช้ค่าโดยประมาณ) · yield/ความถี่การจ่ายเปลี่ยนได้ ตรวจอีกครั้งก่อนซื้อ</p>
      </section>

      {/* ตัววางแผน โหมด A: เป้า → ทุน */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">2️⃣ วางแผนแบบที่ 1 — "อยากได้ปันผลเดือนละเท่าไหร่ ต้องมีทุนเท่าไหร่?"</h2>
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-400">อยากได้รายได้สุทธิ:</span>
            <input
              type="number"
              min={100}
              step={500}
              value={target}
              onChange={(e) => setTarget(Math.max(100, Number(e.target.value) || 0))}
              className="input num !w-32 !py-1"
              aria-label="รายได้เป้าหมายต่อเดือน (บาท)"
            />
            <span className="text-zinc-400">บาท/เดือน ที่ yield กลุ่ม…</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              { y: 4, label: "เสี่ยงต่ำ (กลุ่ม SPHD/REIT นิ่ง)" },
              { y: 7, label: "กลาง (กลุ่ม O/JEPI)" },
              { y: 10, label: "หวาน (กลุ่ม QYLD/mREIT)" },
            ].map(({ y, label }) => (
              <div key={y} className="card p-3">
                <div className="text-[10px] text-zinc-500">{label}</div>
                <div className="num text-lg font-bold text-accent mt-1">฿{baht(needCapital(y))}</div>
                <div className="text-[10px] text-zinc-500">มูลค่าพอร์ตที่ต้องมี ({y}%/ปี)</div>
              </div>
            ))}
          </div>
          {tax15 && <p className="text-[11px] text-zinc-500 mt-2">คิดภาษี 15% แล้ว (ปิดได้ด้านล่าง)</p>}
        </div>
      </section>

      {/* ตัววางแผน โหมด B: สะสมจนถึงเป้า */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">3️⃣ วางแผนแบบที่ 2 — "เริ่มวันนี้ จะถึงเป้าในกี่ปี" (สะสม + ทบต้น)</h2>
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs items-center">
            <label className="flex items-center gap-2">
              <span className="text-zinc-400">เริ่มด้วย</span>
              <input type="number" min={0} step={1000} value={initial} onChange={(e) => setInitial(Math.max(0, Number(e.target.value) || 0))} className="input num !w-28 !py-1" aria-label="เงินตั้งต้น" />
              <span className="text-zinc-500">฿</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-zinc-400">+ เพิ่มเดือนละ</span>
              <input type="number" min={0} step={500} value={add} onChange={(e) => setAdd(Math.max(0, Number(e.target.value) || 0))} className="input num !w-24 !py-1" aria-label="เพิ่มเดือนละ" />
              <span className="text-zinc-500">฿</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={drip} onChange={(e) => setDrip(e.target.checked)} className="accent-accent" />
              <span className="text-zinc-300">ปันผลทบต้น (DRIP)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={tax15} onChange={(e) => setTax15(e.target.checked)} className="accent-accent" />
              <span className="text-zinc-300">คิดภาษี 15%</span>
            </label>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-xs text-zinc-400"><span>Yield พอร์ต</span><span className="num font-bold text-accent">{yieldPct.toFixed(0)}%/ปี{tax15 ? ` (สุทธิ ${(netYield).toFixed(1)}%)` : ""}</span></div>
              <input type="range" min={2} max={15} step={0.5} value={yieldPct} onChange={(e) => setYieldPct(Number(e.target.value))} className="w-full mt-1" aria-label="อัตราปันผลต่อปี" />
            </div>
            <div>
              <div className="flex justify-between text-xs text-zinc-400"><span>ราคาหุ้นโตด้วย</span><span className="num font-bold text-accent">{growth.toFixed(0)}%/ปี</span></div>
              <input type="range" min={0} max={10} step={0.5} value={growth} onChange={(e) => setGrowth(Number(e.target.value))} className="w-full mt-1" aria-label="การเติบโตราคาหุ้นต่อปี" />
            </div>
          </div>

          {plan.reachYear ? (
            <div className="card p-4 border-accent/40">
              <p className="text-sm text-zinc-300 leading-relaxed">
                🎯 <b className="text-zinc-100">ครบเป้า "{baht(target)}฿/เดือน" ในปีที่ {plan.reachYear}</b> (ปันผลสุทธิ/เดือน ณ จุดนั้น ฿{baht(plan.months.find((x) => Math.ceil(x.m / 12) === plan.reachYear)?.income ?? target)})
                {" "}— ยิ่งเพิ่มเดือนละมาก + เปิด DRIP ยิ่งเร็วขึ้น
              </p>
            </div>
          ) : (
            <div className="card p-4 border-amber-500/30">
              <p className="text-sm text-zinc-400">🎯 ด้วยตัวเลขนี้ยังไม่ถึงเป้าใน 40 ปี (ปันผล/เดือนปีที่ 40 = ฿{baht(plan.months[plan.months.length - 1]?.income ?? 0)}) — ลองเพิ่มเงินรายเดือน หรือเพิ่ม yield เป้าหมาย</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-[11px] text-zinc-500 border-b border-base-700">
                  <th className="py-2 px-3">ปีที่</th>
                  <th className="py-2 px-3 text-right">เงินที่ลงรวม</th>
                  <th className="py-2 px-3 text-right">มูลค่าพอร์ต</th>
                  <th className="py-2 px-3 text-right">ปันผลสุทธิ/เดือน ถ้าหยุดวันนี้</th>
                </tr>
              </thead>
              <tbody>
                {plan.months.map((x) => {
                  const year = x.m / 12;
                  const isReach = plan.reachYear === year;
                  return (
                    <tr key={x.m} className={`border-b border-base-700/40 ${isReach ? "bg-accent/10" : ""}`}>
                      <td className="py-2 px-3 num text-zinc-300 font-semibold">{isReach ? "🎯 " : ""}{year}</td>
                      <td className="py-2 px-3 text-right num text-zinc-400">฿{baht(x.contributed)}</td>
                      <td className="py-2 px-3 text-right num text-zinc-100 font-bold">฿{baht(x.v)}</td>
                      <td className="py-2 px-3 text-right num text-zinc-200">฿{baht(x.income)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
          ⚠️ การจำลองเพื่อการศึกษา — ตลาดจริงมีปีขึ้นปีลง yield ตัวจ่ายรายเดือนบางตัว "ตัดเงินปันผล" ได้เมื่อธุรกิจแย่ (โดยเฉพาะกลุ่ม yield สูง 12%+) · กลุ่มหวานมักมูลค่าพอร์ตลดลงเรื่อยๆ จึงเหมาะแบบ "กินปันผล ไม่โฟกัสราคา" เท่านั้น · ผลอดีตไม่รับประกันอนาคต
        </p>
      </section>

      <p className="text-[11px] text-zinc-500 leading-relaxed border-t border-base-700/60 pt-4">
        อยากถือหุ้นไทยปันผลดีๆ แทน? ดู <Link href="/longterm" className="text-accent-soft underline">💤 หุ้นระยะยาว &amp; ปันผล</Link> · เพิ่งเริ่มลงทุน? เริ่มที่ <Link href="/starter" className="text-accent-soft underline">🧑‍🎓 พอร์ตมือใหม่รายวัน</Link> · สงสัยตัวไหนถามผู้ช่วย AI (💬) ได้เลย เช่น &ldquo;JEPI กับ QYLD ต่างกันยังไง&rdquo;
      </p>
    </div>
  );
}
