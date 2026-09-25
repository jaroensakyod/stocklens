"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ModelSnapshot } from "@/lib/modelPortfolio";

// 💼 พอร์ตจำลอง StockLens — ทุนสมมติ ฿100,000 · AI ปรับสัดส่วนทุกสัปดาห์ · เก็บผลงานจริงสะสมเป็น Track Record สาธารณะ

interface ApiData {
  startedAt: string;
  initialThb: number;
  latest: ModelSnapshot | null;
  live: { navThb: number; liveReturnPct: number; asOf: string };
  history: ModelSnapshot[];
  weeksCount: number;
  nextRebalanceTh: string;
  aiAvailable: boolean;
}

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

function Spark({ navs }: { navs: number[] }) {
  if (navs.length < 2) return <div className="text-xs text-zinc-600 py-4 text-center">เส้นผลงานจะเกิดขึ้นเมื่อครบ 2 สัปดาห์ขึ้นไป</div>;
  const w = 100;
  const h = 34;
  const min = Math.min(...navs);
  const max = Math.max(...navs);
  const span = max - min || 1;
  const pts = navs.map((v, i) => `${(i / (navs.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`).join(" ");
  const up = navs[navs.length - 1] >= navs[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" preserveAspectRatio="none" aria-label="เส้นผลงานสะสม">
      <polyline points={pts} fill="none" stroke={up ? "#34d399" : "#f87171"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function ModelPortfolioPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () =>
    fetch("/api/model-portfolio")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const forceAdjust = async () => {
    const code = prompt("รหัสแอดมิน (ADMIN_CODE):");
    if (!code) return;
    setBusy(true);
    setMsg("กำลังให้ AI ปรับพอร์ต… (~30 วิ)");
    try {
      const res = await fetch("/api/model-portfolio", { method: "POST", headers: { "x-admin-code": code } });
      const j = await res.json();
      setMsg(res.ok ? `✅ ปรับแล้ว — ${j.latest?.changes?.join(" · ") ?? ""}` : `❌ ${j.error ?? "รหัสไม่ถูกต้อง"}`);
      await load();
    } catch {
      setMsg("❌ เกิดข้อผิดพลาด");
    }
    setBusy(false);
  };

  const latest = data?.latest;
  const livePct = data?.live.liveReturnPct ?? 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <section className="text-center pt-4">
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-50">
          💼 พอร์ตจำลอง StockLens <span className="text-accent">AI ปรับรายสัปดาห์</span>
        </h1>
        <p className="text-zinc-400 mt-3 text-sm leading-relaxed max-w-2xl mx-auto">
          ทุนสมมติ <b className="text-zinc-200">฿100,000</b> — ทุกสัปดาห์ AI ของเราปรับสัดส่วนพอร์ตจากข้อมูลจริง (คะแนนงบ · Daily Picks · ความร้อนธีม)
          แล้ว<b className="text-zinc-200">บันทึกผลจริงทุกสัปดาห์</b>ไว้ที่นี่ ตรวจสอบย้อนหลังได้ทั้งหมด — โปร่งใส ไม่มีการลบประวัติ
        </p>
        {data && (
          <p className="text-[11px] text-zinc-500 mt-2">
            เริ่ม {new Date(data.startedAt).toLocaleDateString("th-TH")} · สัปดาห์ที่ {data.weeksCount} · ปรับรอบหน้า {data.nextRebalanceTh} · ราคาสด {data.live.asOf}
          </p>
        )}
      </section>

      {/* สรุปผลงาน */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="card p-4">
          <div className="text-[10px] text-zinc-500">มูลค่าพอร์ตตอนนี้ (สด)</div>
          <div className="num text-2xl font-bold text-zinc-50">{data ? `฿${baht(data.live.navThb)}` : "…"}</div>
          <div className="text-[10px] text-zinc-500">เริ่มต้น ฿{baht(data?.initialThb ?? 100000)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[10px] text-zinc-500">กำไร/ขาดทุนรวม</div>
          <div className={`num text-2xl font-bold ${livePct >= 0 ? "text-up" : "text-down"}`}>
            {data ? `${livePct >= 0 ? "+" : ""}${livePct.toFixed(2)}%` : "…"}
          </div>
          <div className="text-[10px] text-zinc-500">นับจากวันเริ่ม (รวมค่าเงิน)</div>
        </div>
        <div className="card p-4">
          <div className="text-[10px] text-zinc-500">ผลสัปดาห์ล่าสุด (ปิดรอบ)</div>
          <div className={`num text-2xl font-bold ${latest && (latest.weekReturnPct ?? 0) >= 0 ? "text-up" : "text-down"}`}>
            {latest?.weekReturnPct != null ? `${latest.weekReturnPct >= 0 ? "+" : ""}${latest.weekReturnPct.toFixed(2)}%` : "รอบแรก"}
          </div>
          <div className="text-[10px] text-zinc-500">{latest ? latest.dateTh : ""}</div>
        </div>
        <div className="card p-4">
          <div className="text-[10px] text-zinc-500">ตัวตัดสินใจรอบล่าสุด</div>
          <div className="text-2xl font-bold">{latest?.engine === "ai" ? "🤖 AI" : "📐 กฎ"}</div>
          <div className="text-[10px] text-zinc-500">{data && !data.aiAvailable && "(ยังไม่เสียบ AI key — ใช้กฎ)"}</div>
        </div>
      </section>

      {/* เส้นผลงานสะสม */}
      <section className="card p-4">
        <h2 className="text-sm font-bold text-zinc-400 mb-2">📈 เส้นผลงานสะสม (NAV รายสัปดาห์)</h2>
        <Spark navs={[data?.initialThb ?? 100000, ...(data?.history ?? []).slice().reverse().map((s) => s.navThb)]} />
      </section>

      {/* พอร์ตปัจจุบัน + เหตุผล AI */}
      {latest && (
        <section>
          <h2 className="text-sm font-bold text-zinc-400 mb-3">🤖 พอร์ตสัปดาห์นี้ — {latest.dateTh} (สัปดาห์ {latest.weekKey})</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-[11px] text-zinc-500 border-b border-base-700">
                  <th className="py-2 px-3">หุ้น/ETF</th>
                  <th className="py-2 px-3 text-right">สัดส่วน</th>
                  <th className="py-2 px-3 text-right">ราคา ณ วันปรับ (฿)</th>
                  <th className="py-2 px-3 text-right">เงินลง (฿)</th>
                </tr>
              </thead>
              <tbody>
                {latest.positions.map((p) => (
                  <tr key={p.symbol} className="border-b border-base-700/40">
                    <td className="py-2 px-3">
                      <Link href={`/stock/${p.symbol}`} className="font-semibold text-zinc-100 hover:text-accent">{p.symbol}</Link>
                      <span className="text-zinc-500 text-xs ml-2">{p.name}</span>
                    </td>
                    <td className="py-2 px-3 text-right num text-zinc-200">{p.weight}%</td>
                    <td className="py-2 px-3 text-right num text-zinc-400">{baht(p.priceThb)}</td>
                    <td className="py-2 px-3 text-right num text-zinc-300">฿{baht((latest.navThb * p.weight) / 100)}</td>
                  </tr>
                ))}
                <tr className="border-b-0">
                  <td className="py-2 px-3 font-semibold text-zinc-300">💵 เงินสด</td>
                  <td className="py-2 px-3 text-right num text-zinc-200">{latest.cashPct}%</td>
                  <td />
                  <td className="py-2 px-3 text-right num text-zinc-300">฿{baht((latest.navThb * latest.cashPct) / 100)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card p-4 mt-3">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {latest.changes.map((c) => (
                <span key={c} className="chip bg-base-800 text-zinc-300 text-[11px]">{c}</span>
              ))}
            </div>
            <div className="text-[11px] text-zinc-500 mb-1">เหตุผลการจัดพอร์ต ({latest.engine === "ai" ? "AI เขียน" : "โหมดกฎ"}):</div>
            <p className="text-sm text-zinc-300 leading-relaxed">{latest.rationale}</p>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button onClick={forceAdjust} disabled={busy} className="btn-ghost !py-1.5 !px-3 text-xs">
              ⚙️ ปรับพอร์ตตอนนี้ (แอดมิน)
            </button>
            {msg && <span className="text-[11px] text-zinc-400">{msg}</span>}
          </div>
        </section>
      )}

      {/* ประวัติรายสัปดาห์ — Track Record */}
      {data && data.history.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-zinc-400 mb-3">📜 ประวัติการปรับพอร์ต + ผลจริงทุกสัปดาห์ (ไม่มีลบ)</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-[11px] text-zinc-500 border-b border-base-700">
                  <th className="py-2 px-3">สัปดาห์</th>
                  <th className="py-2 px-3">การปรับตัว</th>
                  <th className="py-2 px-3 text-right">ผลสัปดาห์นั้น</th>
                  <th className="py-2 px-3 text-right">สะสม</th>
                  <th className="py-2 px-3 text-right">NAV</th>
                  <th className="py-2 px-3">โดย</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((s) => (
                  <tr key={s.weekKey} className="border-b border-base-700/40 align-top">
                    <td className="py-2 px-3 text-zinc-300 whitespace-nowrap">
                      {s.weekKey}
                      <div className="text-[10px] text-zinc-600">{s.dateTh}</div>
                    </td>
                    <td className="py-2 px-3 text-[11px] text-zinc-400 max-w-md">{s.changes.join(" · ")}</td>
                    <td className={`py-2 px-3 text-right num ${s.weekReturnPct == null ? "text-zinc-600" : s.weekReturnPct >= 0 ? "text-up" : "text-down"}`}>
                      {s.weekReturnPct == null ? "—" : `${s.weekReturnPct >= 0 ? "+" : ""}${s.weekReturnPct.toFixed(2)}%`}
                    </td>
                    <td className={`py-2 px-3 text-right num ${s.totalReturnPct >= 0 ? "text-up" : "text-down"}`}>
                      {s.totalReturnPct >= 0 ? "+" : ""}{s.totalReturnPct.toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-right num text-zinc-300">฿{baht(s.navThb)}</td>
                    <td className="py-2 px-3 text-xs">{s.engine === "ai" ? "🤖" : "📐"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!data && (
        <div className="card p-10 text-center text-zinc-500 text-sm animate-pulse">กำลังให้ AI จัดพอร์ตรอบแรก… (อาจใช้ ~30 วิ)</div>
      )}

      <p className="text-[11px] text-zinc-500 leading-relaxed border-t border-base-700/60 pt-4">
        ⚠️ พอร์ตจำลองเพื่อการศึกษา/โปร่งใสของระบบ — ทุกการตัดสินใจใช้เฉพาะข้อมูล ณ วันปรับ (ไม่มีการแอบดูอนาคต) · ผลคำนวณจากราคาจริงรวมค่าเงินบาท ไม่หักค่าธรรมเนียม/ภาษี ไม่รวมปันผล · ไม่ใช่คำแนะนำการลงทุน · อยากดู Track Record แบบอื่น? <Link href="/track-record" className="text-accent-soft underline">คลิกที่นี่</Link> · อยากถาม AI ถึงเหตุผลการปรับ? ถามที่แชท 💬 ได้เลย เช่น &ldquo;พอร์ตจำลองเป็นยังไงบ้าง&rdquo;
      </p>
    </div>
  );
}
