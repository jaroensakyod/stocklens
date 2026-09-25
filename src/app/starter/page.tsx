"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { StarterProfile, StarterResult } from "@/lib/starterPortfolio";

// 🧑‍🎓 พอร์ตตัวอย่างรายวันสำหรับมือใหม่ — เลือก 2 อย่าง: งบ + สไตล์(6 แบบ) → ได้สัดส่วน+สถิติพอร์ต พร้อมเหตุผลภาษาคนไม่มีความรู้
// (ข้อมูลจากเครื่องยนต์จริง หมุนรายวัน — เป็นตัวอย่างเพื่อการเรียนรู้ ไม่ใช่คำแนะนำการลงทุน)

const BUDGETS = [5000, 10000, 50000, 100000];
const KIND_LABEL: Record<string, { label: string; emoji: string }> = {
  etf: { label: "กองทุนดัชนี", emoji: "🧺" },
  dividend: { label: "หุ้นปันผล", emoji: "💰" },
  growth: { label: "หุ้นโตต่อเนื่อง", emoji: "🌱" },
  momentum: { label: "หุ้นน่าสนใจวันนี้", emoji: "🎯" },
  surge: { label: "หุ้นซิ่ง", emoji: "🚀" },
  commodity: { label: "ทองคำ", emoji: "🥇" },
  guru: { label: "หุ้นที่กูรูถือ", emoji: "🐋" },
  cash: { label: "เงินสด", emoji: "💵" },
};

const RISK_COLOR: Record<string, string> = {
  "ต่ำ": "chip bg-emerald-500/10 text-emerald-400 text-[10px]",
  "กลาง": "chip bg-amber-500/10 text-amber-400 text-[10px]",
  "สูง": "chip bg-red-500/10 text-red-400 text-[10px]",
};

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

export default function StarterPage() {
  const [data, setData] = useState<StarterResult | null>(null);
  const [risk, setRisk] = useState<StarterProfile["id"]>("balance");
  const [budget, setBudget] = useState(10000);
  // ทบต้น: rate override (null = ใช้ค่า default จากพอร์ตที่เลือก) + การเพิ่มเงินประจำ
  const [rateOverride, setRateOverride] = useState<number | null>(null);
  const [contribMode, setContribMode] = useState<"none" | "week" | "month" | "year">("month");
  const [contrib, setContrib] = useState(1000);

  useEffect(() => {
    fetch("/api/starter")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  // สลับพอร์ต → รีเซ็ตอัตราโตกลับไปใช้ default ของพอร์ตใหม่
  useEffect(() => {
    setRateOverride(null);
  }, [risk]);

  const profile = useMemo(() => data?.profiles.find((p) => p.id === risk), [data, risk]);
  const yearlyDiv = profile?.stats.yieldPerYearPct != null ? (budget * profile.stats.yieldPerYearPct) / 100 : null;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero สำหรับคนไม่รู้อะไรเลย */}
      <section className="text-center pt-4">
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-50">
          🧑‍🎓 พอร์ตตัวอย่างรายวัน <span className="text-accent">สำหรับมือใหม่</span>
        </h1>
        <p className="text-zinc-400 mt-3 text-sm leading-relaxed max-w-2xl mx-auto">
          ไม่รู้เรื่องหุ้นเลย? เลือกแค่ 2 อย่าง — <b className="text-zinc-200">มีเงินเท่าไหร่</b> กับ{" "}
          <b className="text-zinc-200">อยากแบบไหน (6 สไตล์)</b> — เราจัดสัดส่วนให้จากข้อมูลจริงของวันนี้
          พร้อมเหตุผลกำกับทุกตัว ปันผลคาดหมาย ผลตอบแทนย้อนหลัง และสัดส่วนความเสี่ยงของพอร์ต
        </p>
        {data && (
          <p className="text-[11px] text-zinc-500 mt-2">
            ข้อมูลวันที่ {data.dateTh} · คำนวณล่าสุด {data.asOf}
          </p>
        )}
      </section>

      {/* เลือกสไตล์ — 6 แบบ */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">1️⃣ เลือกสไตล์ของคุณ (6 แบบ)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(data?.profiles ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => setRisk(p.id)}
              className={`card p-3.5 text-left transition-colors ${risk === p.id ? "!border-accent bg-accent/5" : "hover:border-base-600"}`}
            >
              <div className="text-xl">{p.emoji}</div>
              <div className={`font-bold text-sm mt-1 ${risk === p.id ? "text-accent" : "text-zinc-100"}`}>{p.title}</div>
              <div className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{p.desc}</div>
            </button>
          ))}
          {!data && (
            <div className="card p-8 text-center text-zinc-500 text-sm col-span-2 md:col-span-3">
              <span className="animate-pulse">กำลังคำนวณพอร์ตจากข้อมูลวันนี้…</span>
            </div>
          )}
        </div>
      </section>

      {/* เลือกงบ — chips + slider + พิมพ์เอง */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">2️⃣ มีเงินก้อนแรกเท่าไหร่? (บาท)</h2>
        <div className="flex flex-wrap gap-2 items-center">
          {BUDGETS.map((b) => (
            <button
              key={b}
              onClick={() => setBudget(b)}
              className={`chip ${budget === b ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700"} num`}
            >
              ฿{baht(b)}
            </button>
          ))}
          <input
            type="number"
            min={100}
            step={500}
            value={budget}
            onChange={(e) => setBudget(Math.max(100, Number(e.target.value) || 0))}
            className="input num !w-36"
            aria-label="งบประมาณ (บาท)"
          />
        </div>
        <input
          type="range"
          min={1000}
          max={1000000}
          step={1000}
          value={Math.min(Math.max(budget, 1000), 1000000)}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="w-full mt-3 accent-[var(--accent,#f5b340)]"
          aria-label="เลื่อนปรับงบประมาณ"
        />
        {budget < 1000 && <p className="text-[11px] text-amber-400 mt-1">เริ่มจริงได้จากหลักร้อย (เศษหุ้น Dime เริ่ม 50฿) แต่แนะนำ ≥1,000฿ ให้กระจายพอ</p>}
      </section>

      {/* สถิติพอร์ตรวม — เห็นภาพก่อนดูตาราง */}
      {profile && (
        <section>
          <h2 className="text-sm font-bold text-zinc-400 mb-3">
            3️⃣ ภาพรวมพอร์ต {profile.emoji} {profile.title} · งบ ฿{baht(budget)}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="card p-3">
              <div className="text-[10px] text-zinc-500">ปันผลคาดหมาย/ปี</div>
              <div className="num text-lg font-bold text-accent">{yearlyDiv != null ? `~฿${baht(yearlyDiv)}` : "-"}</div>
              <div className="text-[10px] text-zinc-500">{profile.stats.yieldPerYearPct != null ? `${profile.stats.yieldPerYearPct.toFixed(1)}% ของงบ` : "จาก yield จริงของหุ้นในพอร์ต"}</div>
            </div>
            <div className="card p-3">
              <div className="text-[10px] text-zinc-500">ผลตอบแทน 5 ปีเฉลี่ย (ราคาล้วน)</div>
              <div className="num text-lg font-bold text-zinc-50">{profile.stats.avgCagr5yPct != null ? `${profile.stats.avgCagr5yPct.toFixed(1)}%/ปี` : "-"}</div>
              <div className="text-[10px] text-zinc-500">อดีตไม่รับประกันอนาคต</div>
            </div>
            <div className="card p-3">
              <div className="text-[10px] text-zinc-500">สัดส่วนตลาด</div>
              <div className="text-lg font-bold text-zinc-50">🇺🇸 {profile.stats.usPct}% <span className="text-zinc-600">|</span> 🇹🇭 {profile.stats.thPct}%</div>
              <div className="text-[10px] text-zinc-500">สหรัฐฯ ซื้อเป็นบาทผ่าน Dime ได้</div>
            </div>
            <div className="card p-3">
              <div className="text-[10px] text-zinc-500">ความเสี่ยงพอร์ต</div>
              <div className="text-sm font-bold mt-1 space-x-1">
                <span className="text-emerald-400">ต่ำ {profile.stats.riskLow}%</span>{" "}
                <span className="text-amber-400">กลาง {profile.stats.riskMid}%</span>{" "}
                <span className="text-red-400">สูง {profile.stats.riskHigh}%</span>
              </div>
              <div className="text-[10px] text-zinc-500">+ เงินสด {profile.cashPct}%</div>
            </div>
            <div className="card p-3 col-span-2 md:col-span-1">
              <div className="text-[10px] text-zinc-500">แนะนำการลงเงิน</div>
              <div className="num text-lg font-bold text-zinc-50">฿{baht(Math.max(500, Math.round(budget / 12 / 100) * 100))}<span className="text-xs text-zinc-500 font-normal">/เดือน</span></div>
              <div className="text-[10px] text-zinc-500">ทยอยลง 12 เดือน (DCA) เฉลี่ยราคาให้เอง</div>
            </div>
          </div>
        </section>
      )}

      {/* ตารางจัดสรรละเอียด */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">4️⃣ รายละเอียดทุกตำแหน่ง — ซื้ออะไร เท่าไหร่ ทำไม</h2>
        {profile && (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="text-left text-[11px] text-zinc-500 border-b border-base-700">
                  <th className="py-2 px-3">ตัวที่ซื้อ + ตัวเลขสำคัญ</th>
                  <th className="py-2 px-3 text-right">สัดส่วน</th>
                  <th className="py-2 px-3 text-right">ใช้เงิน</th>
                  <th className="py-2 px-3 text-right">ราคา/หน่วย</th>
                  <th className="py-2 px-3 text-right">ได้กี่หุ้น</th>
                  <th className="py-2 px-3">ความเสี่ยง</th>
                </tr>
              </thead>
              <tbody>
                {profile.positions.map((p) => {
                  const money = (budget * p.weight) / 100;
                  const units = p.priceThb ? money / p.priceThb : null;
                  const facts: string[] = [];
                  if (p.pe != null) facts.push(`P/E ${p.pe.toFixed(1)}`);
                  if (p.yieldPct != null) facts.push(`ปันผล ${p.yieldPct.toFixed(1)}%/ปี`);
                  if (p.roePct != null) facts.push(`ROE ${p.roePct.toFixed(0)}%`);
                  if (p.health != null) facts.push(`งบแข็งแรง ${p.health}/100`);
                  if (p.cagr5yPct != null) facts.push(`5 ปี ${p.cagr5yPct.toFixed(1)}%/ปี`);
                  if (p.guruPct != null) facts.push(`บัฟเฟต์ถือ ${p.guruPct.toFixed(1)}%${p.guruChange ? ` (${p.guruChange})` : ""}`);
                  return (
                    <tr key={p.symbol} className="border-b border-base-700/50 align-top">
                      <td className="py-2.5 px-3">
                        <Link href={`/stock/${p.symbol}`} className="font-semibold text-zinc-100 hover:text-accent">
                          {p.symbol}
                        </Link>
                        <span className="text-zinc-500 text-xs ml-2">{p.name}</span>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          {KIND_LABEL[p.kind].emoji} {KIND_LABEL[p.kind].label}
                          {p.market === "TH" ? " · 🇹🇭" : " · 🇺🇸"}
                          {p.changePct !== null && (
                            <span className={p.changePct >= 0 ? "text-up ml-1 num" : "text-down ml-1 num"}>
                              {p.changePct >= 0 ? "+" : ""}
                              {p.changePct.toFixed(2)}% วันนี้
                            </span>
                          )}
                        </div>
                        {facts.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {facts.map((f) => (
                              <span key={f} className="chip bg-base-800 text-zinc-400 text-[10px] num">{f}</span>
                            ))}
                          </div>
                        )}
                        <div className="text-[11px] text-zinc-400 mt-1 leading-relaxed max-w-md">{p.reason}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right num text-zinc-200">{p.weight}%</td>
                      <td className="py-2.5 px-3 text-right num text-accent font-semibold">฿{baht(money)}</td>
                      <td className="py-2.5 px-3 text-right num text-zinc-400">{p.priceThb ? `฿${baht(p.priceThb)}` : "-"}</td>
                      <td className="py-2.5 px-3 text-right num text-zinc-400">
                        {units === null
                          ? "-"
                          : p.unitThb
                            ? `${Math.floor(units)} หุ้น${units % 1 > 0.01 ? ` (เศษ ฿${baht((units % 1) * (p.priceThb ?? 0))})` : ""}`
                            : `~${units.toFixed(units < 2 ? 3 : 1)} หุ้น (เศษได้)`}
                      </td>
                      <td className="py-2.5 px-3"><span className={RISK_COLOR[p.risk]}>{p.risk}</span></td>
                    </tr>
                  );
                })}
                <tr className="border-b-0">
                  <td className="py-2.5 px-3 font-semibold text-zinc-300">💵 เงินสด (รอจังหวะดีค่อยลง)</td>
                  <td className="py-2.5 px-3 text-right num text-zinc-200">{profile.cashPct}%</td>
                  <td className="py-2.5 px-3 text-right num text-zinc-300">฿{baht((budget * profile.cashPct) / 100)}</td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ทบต้น — รายสัปดาห์·เดือน·ปี จนถึง 30 ปี */}
      {profile && (() => {
        const defRate = profile.stats.avgCagr5yPct != null
          ? Math.min(25, Math.max(1, Math.round(((profile.stats.avgCagr5yPct ?? 0) + (profile.stats.yieldPerYearPct ?? 0)) * 10) / 10))
          : 8;
        const rate = rateOverride ?? defRate;
        // จำลอง 2 เส้นรายสัปดาห์: (ทบต้น) vs (ดอกเบี้ยเฉพาะเงินต้น = ไม่เอาดอกเบี้ยงอกดอกเบี้ย)
        const i = Math.pow(1 + rate / 100, 1 / 52) - 1;
        const weeklyC = contribMode === "week" ? contrib : contribMode === "month" ? (contrib * 12) / 52 : contribMode === "year" ? contrib / 52 : 0;
        const MARKS: [number, string][] = [
          [4, "1 เดือน"], [13, "3 เดือน"], [26, "6 เดือน"], [52, "1 ปี"], [104, "2 ปี"],
          [156, "3 ปี"], [260, "5 ปี"], [520, "10 ปี"], [1040, "20 ปี"], [1560, "30 ปี"],
        ];
        let v = budget; // เส้นทบต้น
        let principal = budget; // เงินต้นสะสม (เส้น simple)
        let simpleInterest = 0; // ดอกเบี้ยแบบไม่ทบต้น (คิดจากเงินต้นเท่านั้น)
        let put = budget;
        const rows: { label: string; put: number; v: number; simple: number }[] = [];
        let w = 0;
        for (const [mark, label] of MARKS) {
          while (w < mark) {
            w++;
            v = v * (1 + i) + weeklyC;
            simpleInterest += principal * (rate / 100 / 52);
            principal += weeklyC;
            put += weeklyC;
          }
          rows.push({ label, put, v, simple: principal + simpleInterest });
        }
        const last = rows[rows.length - 1];
        const dcaHint = Math.max(500, Math.round(budget / 12 / 100) * 100);
        return (
          <section>
            <h2 className="text-sm font-bold text-zinc-400 mb-3">5️⃣ ทบต้นแล้วจะได้เท่าไหร่ — รายสัปดาห์ · เดือน · ปี</h2>

            {/* ปุ่มควบคุม: อัตราโต + การเพิ่มเงิน */}
            <div className="card p-4 mb-3 space-y-3">
              <div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>อัตราโตที่ใช้คำนวณ</span>
                  <span className="num font-bold text-accent">{rate.toFixed(1)}%/ปี</span>
                  {rateOverride == null && <span className="chip bg-base-800 text-zinc-500 text-[10px]">จากผลตอบแทน 5 ปีจริงของพอร์ตนี้ + ปันผล (ปรับได้)</span>}
                </div>
                <input
                  type="range"
                  min={1}
                  max={25}
                  step={0.5}
                  value={rate}
                  onChange={(e) => setRateOverride(Number(e.target.value))}
                  className="w-full mt-2"
                  aria-label="อัตราโตต่อปี"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-zinc-400">เพิ่มเงินประจำ:</span>
                {([
                  ["none", "ไม่เพิ่ม (ก้อนเดียว)"],
                  ["week", "สัปดาห์ละ"],
                  ["month", "เดือนละ"],
                  ["year", "ปีละ"],
                ] as const).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => setContribMode(m)}
                    className={`chip ${contribMode === m ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700"}`}
                  >
                    {label}
                  </button>
                ))}
                {contribMode !== "none" && (
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={contrib}
                    onChange={(e) => setContrib(Math.max(0, Number(e.target.value) || 0))}
                    className="input num !w-28 !py-1"
                    aria-label="จำนวนเงินที่เพิ่มแต่ละงวด (บาท)"
                  />
                )}
                {contribMode === "month" && <span className="text-[10px] text-zinc-500">แนะนำ ~฿{baht(dcaHint)} (DCA)</span>}
              </div>
            </div>

            <div className="card overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-[11px] text-zinc-500 border-b border-base-700">
                    <th className="py-2 px-3">อีกเมื่อไหร่</th>
                    <th className="py-2 px-3 text-right">เงินที่ลงทั้งหมด</th>
                    <th className="py-2 px-3 text-right">มูลค่าพอร์ต (ทบต้น)</th>
                    <th className="py-2 px-3 text-right">กำไร</th>
                    <th className="py-2 px-3 text-right">จากทบต้นล้วนๆ*</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const gain = r.v - r.put;
                    const compoundOnly = Math.max(0, r.v - r.simple);
                    return (
                      <tr key={r.label} className={`border-b border-base-700/40 ${r.label === "10 ปี" || r.label === "20 ปี" ? "bg-base-800/40" : ""}`}>
                        <td className="py-2 px-3 text-zinc-300 font-semibold">{r.label}</td>
                        <td className="py-2 px-3 text-right num text-zinc-400">฿{baht(r.put)}</td>
                        <td className="py-2 px-3 text-right num text-zinc-100 font-bold">฿{baht(r.v)}</td>
                        <td className={`py-2 px-3 text-right num ${gain >= 0 ? "text-up" : "text-down"}`}>
                          {gain >= 0 ? "+" : ""}฿{baht(gain)}
                        </td>
                        <td className="py-2 px-3 text-right num text-zinc-500">
                          {r.label === "1 เดือน" || r.label === "3 เดือน" ? "-" : `฿${baht(compoundOnly)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
              *ส่วนที่เกิดจาก &ldquo;ดอกเบี้ยงอกดอกเบี้ย&rdquo; ล้วนๆ (มูลค่าแบบทบต้น − ถ้าคิดดอกเบี้ยเฉพาะเงินต้นโดยไม่ทบ) · คำนวณทบต้นรายสัปดาห์จากอัตราต่อปี {rate.toFixed(1)}%
              {contribMode !== "none" && ` + เพิ่มเงิน${contribMode === "week" ? "รายสัปดาห์" : contribMode === "month" ? "รายเดือน" : "รายปี"} ฿${baht(contrib)}`}
              {" "}· ตัวเลขเป็นการจำลองเพื่อการศึกษา — ตลาดจริงไม่โตเส้นตรง มีปีขึ้นปีลง ผลอดีตไม่รับประกันอนาคต
            </p>
            <div className="card p-4 mt-2 border-accent/30">
              <p className="text-sm text-zinc-300 leading-relaxed">
                🌱 <b className="text-zinc-100">พลังของทบต้น:</b> จากเงินที่ลงรวม ฿{baht(last.put)} → เป็น ฿{baht(last.v)} ใน 30 ปี
                (กำไร ฿{baht(last.v - last.put)}) — ยิ่งเริ่มเร็ว ยิ่งเวลาทำงานให้คุณนาน
              </p>
            </div>
          </section>
        );
      })()}

      {/* ซื้อจริงยังไง */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">6️⃣ พอใจแล้ว ซื้อยังไงต่อ?</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="font-bold text-zinc-100">🇺🇸 หุ้น/กองทุนต่างประเทศ</div>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              ซื้อได้ใน <b className="text-accent">Dime</b> (เศษหุ้นเริ่ม 50฿, ค่าธรรมเนียม ~0.15%) หรือ InnovestX / Webull — เปิดบัญชี 1 วันเสร็จ ใช้แค่บัตรประชาชน+บัญชีธนาคาร
            </p>
          </div>
          <div className="card p-4">
            <div className="font-bold text-zinc-100">🇹🇭 หุ้นไทย</div>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              ซื้อผ่านโบรกเกอร์ไทยที่มีบัญชี SET ทุกที่ (เช่น บัญชีที่ธนาคารของคุณเปิดให้) — กดซื้อเองได้ในแอป ไม่ต้องโทรหาใคร
            </p>
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 mt-2">
          StockLens เป็นสื่อบทวิเคราะห์ ไม่ใช่โบรกเกอร์ — เราไม่มีระบบรับเงิน/ซื้อขายแทน และไม่มีส่วนแบ่งจากช่องทางใดๆ
        </p>
      </section>

      {/* คำศัพท์ 4 คำสำหรับคนไม่มีความรู้เลย */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">📚 4 คำที่มือใหม่ควรรู้ก่อนกดซื้อ</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            ["🧺 กองทุนดัชนี (ETF)", "ตะกร้าที่บรรจุหุ้นหลายสิบ/ร้อยตัวไว้แล้ว — ซื้อถ้วยเดียวเท่ากับกระจายความเสี่ยงให้ตัวเองอัตโนมัติ"],
            ["💰 ปันผล", "เงินที่บริษัทแบ่งกำไรให้ผู้ถือหุ้น ปีละครั้งหรือหลายครั้ง — ได้เงินเข้าบัญชีโดยไม่ต้องขายหุ้น"],
            ["⚖️ สัดส่วน (น้ำหนัก)", "เงินก้อนนึงแบ่งให้แต่ละตัวเท่าไหร่ — ยิ่งแบ่งหลายตัว ยิ่งไม่พังทั้งพอร์ตถ้าตัวเดียวลง"],
            ["🛑 ความเสี่ยง", "ต่ำ=ราคาขยับช้า นอนหลับได้ · สูง=วันละหลายเปอร์เซ็นต์ ต้องตามข่าว — ใส่ตัวเสี่ยงสูงแค่เงินที่เสียได้ไม่เจ็บ"],
          ].map(([t, d]) => (
            <div key={t} className="card p-3">
              <div className="text-xs font-bold text-zinc-200">{t}</div>
              <div className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {data && (
        <p className="text-[11px] text-zinc-500 leading-relaxed border-t border-base-700/60 pt-4">
          ⚠️ {data.note} · สงสัยตัวไหน กดสัญลักษณ์หุ้นดูข้อมูลเต็มได้ หรือถามผู้ช่วย AI (ปุ่ม 💬 มุมขวาล่าง) ได้เลย เช่น &ldquo;VOO คืออะไร&rdquo; หรือ &ldquo;ทำไมพอร์ตนี้ถึงมีทองคำ&rdquo;
        </p>
      )}
    </div>
  );
}
