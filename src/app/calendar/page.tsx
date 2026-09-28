"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { EconEvent } from "@/lib/econCalendar";

// ===== 🗓️ ปฏิทินเศรษฐกิจ — เหตุการณ์/ตัวเลขมหภาคที่ขยับตลาดหุ้น พร้อมพยากรณ์ vs ตัวเลขจริง =====
// ทุกเวลาแสดงเป็นเวลาไทย (ICT) อัตโนมัติ

const RANGES = [
  { id: "today", label: "วันนี้", days: 0 },
  { id: "tomorrow", label: "พรุ่งนี้", days: 1 },
  { id: "week", label: "สัปดาห์นี้", days: 7 },
  { id: "2w", label: "2 สัปดาห์", days: 14 },
  { id: "month", label: "30 วัน", days: 30 },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

const IMPORTANCE = [
  { id: 1, label: "ทุกระดับ" },
  { id: 2, label: "★★ ขึ้นไป" },
  { id: 3, label: "เฉพาะ ★★★" },
] as const;

const thMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const thDays = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

function ictDayKey(ts: number): string {
  const d = new Date(ts + 7 * 3600e3);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}
function ictDayLabel(ts: number): string {
  const d = new Date(ts + 7 * 3600e3);
  return `${thDays[d.getUTCDay()]}ที่ ${d.getUTCDate()} ${thMonths[d.getUTCMonth()]}`;
}
function ictTime(ts: number): string {
  const d = new Date(ts + 7 * 3600e3);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
function dayDiff(ts: number): number {
  const now = Date.now();
  const a = Math.floor((ts + 7 * 3600e3) / 86400e3);
  const b = Math.floor((now + 7 * 3600e3) / 86400e3);
  return a - b;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<EconEvent[] | null>(null);
  const [live, setLive] = useState(true);
  const [err, setErr] = useState("");
  const [range, setRange] = useState<RangeId>("week");
  const [minImp, setMinImp] = useState<number>(1);

  useEffect(() => {
    fetch("/api/calendar?days=35")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "โหลดไม่สำเร็จ");
        setEvents(j.events);
        setLive(!!j.live);
      })
      .catch((e) => setErr(e.message));
  }, []);

  const days = RANGES.find((r) => r.id === range)!.days;
  const grouped = useMemo(() => {
    if (!events) return [];
    const todayKey = ictDayKey(Date.now());
    const filtered = events.filter((e) => {
      if (e.impact < minImp || e.impact === 0 && minImp >= 1) return false;
      const dd = dayDiff(e.ts);
      return dd >= 0 && dd <= days;
    });
    const map = new Map<string, EconEvent[]>();
    for (const e of filtered) {
      const k = ictDayKey(e.ts);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return [...map.entries()];
  }, [events, days, minImp]);

  return (
    <div className="space-y-5">
      {/* หัวเรื่อง */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-50">🗓️ ปฏิทินเศรษฐกิจ</h1>
        <p className="text-sm text-zinc-400 mt-2 max-w-3xl leading-relaxed">
          ตัวเลขมหภาคที่ขยับตลาดหุ้นทั่วโลก — เงินเฟ้อ CPI · ค่าจ้าง NFP · ดอกเบี้ย FOMC · GDP พร้อม<b className="text-zinc-200">พยากรณ์ vs ตัวเลขจริง</b>เทียบกันในที่เดียว
          {" "}<span className="text-zinc-500">(เวลาทั้งหมด = เวลาไทย)</span>
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
        <div className="flex gap-1 bg-base-850 rounded-lg p-1 border border-base-700">
          {IMPORTANCE.map((i) => (
            <button
              key={i.id}
              onClick={() => setMinImp(i.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${minImp === i.id ? "bg-accent/20 text-accent-soft" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              {i.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-zinc-500 ml-auto">
          {live ? "🟢 ข้อมูลสด (พยากรณ์/ตัวเลขจริง)" : "🟡 โหมดตารางหลัก (ไม่มีข้อมูลสดช่วงนี้)"}
        </span>
      </div>

      {/* เนื้อหา */}
      {err && <div className="card p-6 text-center text-sm text-zinc-400">{err}</div>}
      {!events && !err && (
        <div className="card p-10 text-center">
          <div className="text-3xl animate-pulse mb-2">🗓️</div>
          <p className="text-xs text-zinc-500">กำลังโหลดปฏิทิน…</p>
        </div>
      )}
      {events && grouped.length === 0 && (
        <div className="card p-8 text-center text-sm text-zinc-400">ไม่มีเหตุการณ์ในช่วงที่เลือก — ลองขยายช่วงเวลา หรือเลือก &ldquo;ทุกระดับ&rdquo;</div>
      )}

      {grouped.map(([key, list]) => {
        const dd = dayDiff(list[0].ts);
        return (
          <div key={key} className="card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-base-850 border-b border-base-700/70">
              <span className="text-sm font-bold text-zinc-100">{ictDayLabel(list[0].ts)}</span>
              {dd === 0 && <span className="chip bg-accent/15 text-accent-soft border border-accent/30 text-[10px] font-bold">วันนี้</span>}
              {dd === 1 && <span className="chip bg-zinc-500/15 text-zinc-300 border border-base-600 text-[10px]">พรุ่งนี้</span>}
              {dd > 1 && <span className="text-[10px] text-zinc-500">อีก {dd} วัน</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="text-zinc-500 border-b border-base-700/50">
                    <th className="text-left font-normal py-2 px-3 w-14">เวลา</th>
                    <th className="text-left font-normal py-2 px-2">เหตุการณ์</th>
                    <th className="text-center font-normal py-2 px-2 w-16">สำคัญ</th>
                    <th className="text-right font-normal py-2 px-2 w-20">พยากรณ์</th>
                    <th className="text-right font-normal py-2 px-2 w-20">จริง</th>
                    <th className="text-right font-normal py-2 px-3 w-20">ก่อนหน้า</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-700/40">
                  {list.map((e) => (
                    <tr key={e.id} className={e.impact === 3 ? "bg-amber-500/[0.03]" : ""}>
                      <td className="py-2.5 px-3 num text-zinc-300">{ictTime(e.ts)}</td>
                      <td className="py-2.5 px-2">
                        <span className="mr-1.5">{e.flag}</span>
                        <span className="text-zinc-200">{e.title}</span>
                        {e.approx && <span className="text-zinc-500 ml-1" title="วันที่ประมาณจากรอบประจำ — รอยืนยันทางการ">~</span>}
                        {e.impact === 0 && <span className="text-zinc-500 ml-1">(ตลาดปิด)</span>}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={e.impact === 3 ? "text-amber-400" : "text-zinc-600"}>{"★".repeat(e.impact) || "·"}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right num text-zinc-300">{e.forecast ?? "—"}</td>
                      <td className="py-2.5 px-2 text-right num font-bold text-zinc-50">{e.actual ?? "—"}</td>
                      <td className="py-2.5 px-3 text-right num text-zinc-500">{e.previous ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* อ่านต่อ + กฎกติกา */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-bold text-zinc-100 mb-2">📖 อ่านปฏิทินยังไงให้ใช้ได้จริง</h3>
          <ul className="text-xs text-zinc-400 space-y-1.5 leading-relaxed">
            <li>• <span className="text-amber-400">★★★</span> ขยับตลาดหุ้นหนัก (FOMC/CPI/NFP) — ก่อนประกาศมักมี Volatility สูง</li>
            <li>• <span className="text-zinc-300">★★</span> ขยับปานกลาง · <span className="text-zinc-500">★</span> ผลกระทบจำกัด</li>
            <li>• ตลาดแพ้พยากรณ์บ่อยๆ ต่อเนื่อง = แรงกดดันดอกเบี้ย/สกุลเงินเปลี่ยนทิศ — ตามไปดูที่ <Link href="/supernova" className="text-accent-soft underline underline-offset-2">เกจมหภาค</Link></li>
            <li>• เหตุการณ์ที่ติด <b>~</b> = วันที่ประมาณจากรอบประจำเดือน (เช่น CPI มักออกกลางเดือน) รอประกาศทางการ</li>
          </ul>
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-bold text-zinc-100 mb-2">🔗 เชื่อมต่อส่วนอื่นของ StockLens</h3>
          <ul className="text-xs text-zinc-400 space-y-1.5 leading-relaxed">
            <li>• ผลกระทบต่อหุ้นรายตัวหลังข่าวมหภาค → <Link href="/radar" className="text-accent-soft underline underline-offset-2">Global Radar</Link></li>
            <li>• บริษัทแถลงงบไตรมาสวันไหนบ้าง → <Link href="/earnings" className="text-accent-soft underline underline-offset-2">ปฏิทินงบ Q</Link></li>
            <li>• ดัชนี/ทอง/น้ำมันตอนนี้ → <Link href="/" className="text-accent-soft underline underline-offset-2">หน้าแรก</Link></li>
          </ul>
          <p className="text-[10px] text-zinc-600 mt-3 leading-relaxed">
            ข้อมูลสดรายสัปดาห์จาก ForexFactory + ตารางเหตุการณ์หลักที่ระบบสร้างจากรอบประกาศทางการ · ปฏิทินนี้เป็นข้อมูลอ้างอิง ไม่ใช่คำแนะนำการลงทุน
          </p>
        </div>
      </div>
    </div>
  );
}
