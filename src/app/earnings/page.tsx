"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { EarningsRow } from "@/lib/earningsCalendar";

// ===== 📑 ปฏิทินงบรายไตรมาส — ใครแถลงผลวันไหน + ตลาดคาด EPS/รายได้เท่าไหร่ =====
// ครอบคลุมหุ้นสหรัฐฯ ยอดนิยมของคนไทย ~170 ตัว (Megacap, S&P ใหญ่, หุ้นเทรนด์)

const RANGES = [
  { id: "3d", label: "3 วันข้างหน้า", days: 3 },
  { id: "week", label: "สัปดาห์นี้", days: 7 },
  { id: "2w", label: "2 สัปดาห์", days: 14 },
  { id: "month", label: "1 เดือน", days: 31 },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

const HOT = new Set(["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "AMD", "NFLX", "JPM", "LLY", "WMT", "COST", "V", "MA", "ORCL", "CRM", "UBER", "SHOP", "MU", "PLTR", "COIN", "MELI"]);

const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thDays = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

const ict = (ts: number) => new Date(ts + 7 * 3600e3);
const dayKey = (ts: number) => {
  const d = ict(ts);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
};
const dayLabel = (ts: number) => {
  const d = ict(ts);
  return `${thDays[d.getUTCDay()]}ที่ ${d.getUTCDate()} ${thMonths[d.getUTCMonth()]}`;
};
const dayDiff = (ts: number) => Math.floor((ts + 7 * 3600e3) / 86400e3) - Math.floor((Date.now() + 7 * 3600e3) / 86400e3);

function fmtBig(v?: number): string {
  if (v === undefined || !isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return "$" + (v / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return "$" + (v / 1e6).toFixed(0) + "M";
  return "$" + v.toFixed(0);
}

export default function EarningsPage() {
  const [rows, setRows] = useState<EarningsRow[] | null>(null);
  const [err, setErr] = useState("");
  const [range, setRange] = useState<RangeId>("2w");
  const [hotOnly, setHotOnly] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/earnings?days=90")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "โหลดไม่สำเร็จ");
        setRows(j.rows);
      })
      .catch((e) => setErr(e.message));
  }, []);

  const days = RANGES.find((r) => r.id === range)!.days;
  const grouped = useMemo(() => {
    if (!rows) return [];
    const kw = q.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      const dd = dayDiff(r.ts);
      if (dd < 0 || dd > days) return false;
      if (hotOnly && !HOT.has(r.ticker)) return false;
      if (kw && !(r.ticker.toLowerCase().includes(kw) || r.name.toLowerCase().includes(kw))) return false;
      return true;
    });
    const map = new Map<string, EarningsRow[]>();
    for (const r of filtered) {
      const k = dayKey(r.ts);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()].map(([k, list]) => [k, [...list].sort((a, b) => (HOT.has(b.ticker) ? 1 : 0) - (HOT.has(a.ticker) ? 1 : 0))] as [string, EarningsRow[]]);
  }, [rows, days, hotOnly, q]);

  const todayKey = dayKey(Date.now());
  const tomorrowKey = dayKey(Date.now() + 86400e3);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-50">📑 ปฏิทินงบรายไตรมาส</h1>
        <p className="text-sm text-zinc-400 mt-2 max-w-3xl leading-relaxed">
          ฤดูกาลงบคือช่วงที่หุ้นขยับแรงที่สุด — ดูว่าบริษัทที่คุณถือ/สนใจแถลงผลวันไหน และ<b className="text-zinc-200">ตลาดคาดหมาย EPS / รายได้เท่าไหร่</b>ก่อนเข้าวันจริง
          {" "}<span className="text-zinc-500">(หุ้นสหรัฐฯ ยอดนิยม ~170 ตัว)</span>
        </p>
      </div>

      {/* ตัวกรอง */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-base-850 rounded-lg p-1 border border-base-700">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${range === r.id ? "bg-accent/20 text-accent-soft" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setHotOnly((v) => !v)}
          className={`chip border text-xs ${hotOnly ? "bg-accent/20 text-accent-soft border-accent/40" : "bg-base-850 text-zinc-400 border-base-700 hover:text-zinc-200"}`}
        >
          🔥 เฉพาะตัวจักร
        </button>
        <input
          className="input max-w-48 text-xs"
          placeholder="ค้นหา เช่น NVDA, Apple"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {err && <div className="card p-6 text-center text-sm text-zinc-400">{err}</div>}
      {!rows && !err && (
        <div className="card p-10 text-center">
          <div className="text-3xl animate-pulse mb-2">📑</div>
          <p className="text-xs text-zinc-500">กำลังรวบรวมวันแถลงงบจาก Yahoo — ครั้งแรกของวันอาจใช้ ~10-20 วินาที</p>
        </div>
      )}
      {rows && grouped.length === 0 && (
        <div className="card p-8 text-center text-sm text-zinc-400">ไม่มีบริษัทแถลงงบในช่วงที่เลือก — ลองขยายช่วงเวลา</div>
      )}

      {grouped.map(([key, list]) => (
        <div key={key} className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-base-850 border-b border-base-700/70">
            <span className="text-sm font-bold text-zinc-100">{dayLabel(list[0].ts)}</span>
            {key === todayKey && <span className="chip bg-accent/15 text-accent-soft border border-accent/30 text-[10px] font-bold">วันนี้</span>}
            {key === tomorrowKey && <span className="chip bg-zinc-500/15 text-zinc-300 border border-base-600 text-[10px]">พรุ่งนี้</span>}
            <span className="text-[10px] text-zinc-500 ml-auto">{list.length} บริษัท</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead>
                <tr className="text-zinc-500 border-b border-base-700/50">
                  <th className="text-left font-normal py-2 px-3">บริษัท</th>
                  <th className="text-left font-normal py-2 px-2 w-24">ราคาตอนนี้</th>
                  <th className="text-right font-normal py-2 px-2 w-24">EPS ที่ตลาดคาด</th>
                  <th className="text-right font-normal py-2 px-2 w-28">รายได้ที่ตลาดคาด</th>
                  <th className="text-right font-normal py-2 px-3 w-28" title="อัตราโต EPS ทั้งปีบัญชีที่นักวิเคราะห์คาด">EPS ปีนี้โต (คาด)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-700/40">
                {list.map((r) => (
                  <tr key={r.ticker} className="hover:bg-base-800/50">
                    <td className="py-2.5 px-3">
                      <Link href={`/stock/${r.ticker}`} className="font-bold text-zinc-100 hover:text-accent-soft">
                        {HOT.has(r.ticker) && <span className="mr-1" title="ตัวจักรที่ขยับทั้งตลาด">🔥</span>}
                        {r.ticker}
                      </Link>
                      <span className="text-zinc-500 ml-2">{r.name}</span>
                      {r.dateEstimated && <span className="text-zinc-600 ml-1" title="วันที่โดยประมาณ — ยังไม่ยืนยันจากบริษัท">~</span>}
                    </td>
                    <td className="py-2.5 px-2">
                      {r.price !== undefined ? (
                        <>
                          <span className="num text-zinc-200">{r.price.toFixed(2)}</span>{" "}
                          <span className={`num ${r.changePct !== undefined && r.changePct >= 0 ? "text-up" : "text-down"}`}>
                            {r.changePct !== undefined ? (r.changePct >= 0 ? "+" : "") + r.changePct.toFixed(1) + "%" : ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right num text-zinc-200">{r.epsEst !== undefined ? "$" + r.epsEst.toFixed(2) : "—"}</td>
                    <td className="py-2.5 px-2 text-right num text-zinc-300">{fmtBig(r.revEst)}</td>
                    <td className={`py-2.5 px-3 text-right num ${r.growth !== undefined ? (r.growth >= 0 ? "text-up" : "text-down") : "text-zinc-600"}`}>
                      {r.growth !== undefined ? (r.growth >= 0 ? "+" : "") + (r.growth * 100).toFixed(0) + "%" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-bold text-zinc-100 mb-2">📖 ใช้ปฏิทินงบยังไงให้ครบ</h3>
          <ul className="text-xs text-zinc-400 space-y-1.5 leading-relaxed">
            <li>• ก่อนวันแถลง 1-2 สัปดาห์ มักมี &ldquo;คาดหวังล้น&rdquo; — เทียบราคาเดี๋ยวนี้กับไหวตาที่ <Link href="/stock/NVDA" className="text-accent-soft underline underline-offset-2">หน้ากราฟ</Link> ของตัวนั้น</li>
            <li>• ตัวจักร 🔥 แถลงแล้วขยับทั้งดัชนี — ดูห่วงโซ่ผลกระทบต่อหุ้นอื่นได้ที่ <Link href="/radar" className="text-accent-soft underline underline-offset-2">Global Radar</Link></li>
            <li>• เลข &ldquo;ตลาดคาด&rdquo; คือคอนเซนซัสนักวิเคราะห์ — แพ้/ชนะเลขนี้สำคัญกว่าโตหรือลบโดยตัวเอง</li>
            <li>• งบ Q ตอนไหนของฤดูกาล: ธนาคารใหญ่เปิดฤดู → ไม่กี่วันถัดมาเทคยักษ์ตามมาตลอด 2 สัปดาห์</li>
          </ul>
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-bold text-zinc-100 mb-2">ℹ️ ที่มาของข้อมูล</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            วันแถลง + คอนเซนซัสจาก Yahoo Finance (earningsTrend — เลขเดียวกับที่แสดงในแท็บ &ldquo;คอนเซนซัสนักวิเคราะห์&rdquo; ของแต่ละหุ้น) อัปเดตทุก 6 ชั่วโมง · ครอบคลุมหุ้นสหรัฐฯ ยอดนิยมในหมู่นักลงทุนไทย (แก้รายชื่อเพิ่มได้ที่ <code className="text-zinc-500">src/data/earnings-universe.json</code>)
          </p>
          <p className="text-[10px] text-zinc-600 mt-3 leading-relaxed">
            ตารางนี้เป็นข้อมูลอ้างอิงเพื่อวางแผนดูข่าว ไม่ใช่คำแนะนำซื้อขายหลักทรัพย์ · เวลาแถลงจริงของแต่ละบริษัท (ก่อน/หลังปิดตลาด) ดูได้ที่หน้าหุ้นรายตัว
          </p>
        </div>
      </div>
    </div>
  );
}
