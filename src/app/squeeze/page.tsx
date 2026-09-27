"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import LockGate from "@/components/LockGate";

// 🔥 Squeeze Radar — ตรวจจับ "oversell ของกองทุน" แบบที่คนตรวจเจอ GME 2021
// หลักการเดียวกับในคลิป: short interest เทียบ float — เกิน 100% = ขายฝากเกินหุ้นที่มี = วัตถุดิบ squeeze

interface SqueezeRow {
  symbol: string; name: string; shortInterest: number; prevShort: number; adv: number; dtc: number;
  chgPct: number; settlementDate: string; score: number; tier: string; tierLabel: string; gmeZone: boolean;
  shortPctFloat: number | null; floatShares: number | null; mcap: number | null; price: number | null;
  dayChangePct: number | null; reasons: string[];
}
interface CoverRow { symbol: string; name: string; shortInterest: number; chgPct: number; dtc: number; price: number | null; dayChangePct: number | null }
interface ThaiRow { symbol: string; name: string; price: number; chg1m: number; chg3m: number; mcap: number; sector: string }
interface Dashboard { asOf: string; scanned: number; risky: SqueezeRow[]; gmeZoneCount: number; covering: CoverRow[]; thai: ThaiRow[] }
interface Analysis extends SqueezeRow { verdict: string; explain: string[]; yahoo: { shortPctFloat: number | null; sharesShort: number | null; sharesShortPrior: number | null; shortRatio: number | null; floatShares: number | null } | null }

const fmtM = (n: number | null) => (n === null ? "-" : n >= 1e9 ? (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(0) + "K" : String(n));

export default function SqueezePage() {
  const { member } = useAuth();
  const locked = !member || (member.tier as string) === "free";
  const [data, setData] = useState<Dashboard | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"risky" | "covering" | "thai">("risky");
  const [q, setQ] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | { error: string } | null>(null);
  const [loadingA, setLoadingA] = useState(false);

  useEffect(() => {
    fetch("/api/squeeze").then(r => r.json()).then(j => { if (j.error) setErr(j.error); else setData(j); }).catch(() => setErr("โหลดไม่สำเร็จ"));
  }, []);

  const analyze = async () => {
    const s = q.trim().toUpperCase();
    if (!s) return;
    setLoadingA(true); setAnalysis(null);
    try { const res = await fetch("/api/squeeze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: s }) }); setAnalysis(await res.json()); } catch {}
    setLoadingA(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🔥 Squeeze Radar — ตรวจจับ &quot;oversell ของกองทุน&quot;</h1>
        <p className="text-sm text-zinc-400 mt-1">
          หลักการเดียวกับที่คนตรวจเจอ GameStop: เทียบ <b className="text-zinc-200">ยอดหุ้นที่ถูกยืมไปขาย (short interest)</b> กับ{" "}
          <b className="text-zinc-200">หุ้นที่หมุนเวียนจริง (float)</b> — ถ้าเกิน 100% = ขายฝากเกินหุ้นที่มี = วัตถุดิบ short squeeze
          {data && <> · สแกน <span className="num text-accent-soft">{data.scanned.toLocaleString()}</span> หุ้นสหรัฐฯ รอบ FINRA <span className="num">{data.asOf}</span></>}
        </p>
      </div>

      {/* ค้นหารายตัว */}
      <div className="card p-4">
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="ตรวจรายตัว เช่น GME, AMC, CVNA..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && analyze()} />
          <button className="btn-primary shrink-0" onClick={analyze} disabled={loadingA || !q.trim()}>{loadingA ? "กำลังตรวจ…" : "ตรวจ"}</button>
        </div>
        {analysis && "error" in analysis && <div className="mt-3 text-sm text-down">{analysis.error}</div>}
        {analysis && !("error" in analysis) && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/stock/${analysis.symbol}`} className="text-lg font-bold text-accent-soft hover:underline">{analysis.symbol}</Link>
              <span className="text-sm text-zinc-400 truncate">{analysis.name}</span>
              <span className={`chip !text-xs ${analysis.score >= 8 ? "bg-down/15 text-down border border-down/30" : analysis.score >= 6 ? "bg-orange-500/15 text-orange-400 border border-orange-500/30" : "bg-base-800 text-zinc-400 border border-base-600"}`}>
                {analysis.tier} {analysis.tierLabel} · Score {analysis.score}/10
              </span>
              {analysis.price !== null && <span className="text-sm num">ราคา ${analysis.price.toFixed(2)} {analysis.dayChangePct !== null && <span className={analysis.dayChangePct >= 0 ? "text-up" : "text-down"}>({analysis.dayChangePct >= 0 ? "+" : ""}{analysis.dayChangePct.toFixed(1)}%)</span>}</span>}
            </div>
            <div className="rounded-lg bg-accent/10 border border-accent/25 px-3 py-2 text-sm text-zinc-200">{analysis.verdict}</div>
            <div className="grid sm:grid-cols-3 gap-2 text-center">
              <Stat label="Short % ของ float" value={analysis.shortPctFloat !== null ? analysis.shortPctFloat.toFixed(1) + "%" : "-"} hot={analysis.gmeZone} />
              <Stat label="Days to Cover" value={analysis.dtc > 0 ? analysis.dtc.toFixed(1) + " วัน" : "-"} hot={analysis.dtc >= 7} />
              <Stat label="Δ Short รอบก่อน" value={analysis.chgPct !== 0 ? (analysis.chgPct > 0 ? "+" : "") + analysis.chgPct.toFixed(1) + "%" : "-"} hot={analysis.chgPct >= 25} />
            </div>
            <ul className="space-y-1.5">
              {analysis.explain.map((e, i) => <li key={i} className="text-xs text-zinc-400 leading-relaxed">• {e}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* ตารางหลัก */}
      <div className="card overflow-hidden">
        <div className="flex gap-1.5 px-4 pt-3">
          {([["risky", `🔥 เสี่ยง Squeeze${data ? ` (${data.risky.length})` : ""}`], ["covering", `🏃 Shorts กำลังถอย${data ? ` (${data.covering.length})` : ""}`], ["thai", "🇹🇭 โหมดไทย (ตกหนักด้านราคา)"]] as const).map(([id, label]) => (
            <button key={id} className={`chip border !text-xs ${tab === id ? "bg-accent/20 text-accent-soft border-accent/40" : "bg-base-800 text-zinc-400 border-base-700"}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {err && <div className="p-6 text-sm text-down">{err}</div>}
        {!data && !err && <div className="p-6 text-sm text-zinc-500">กำลังสแกนทั้งตลาดสหรัฐฯ จาก FINRA… (ครั้งแรกใช้ ~20-40 วินาที)</div>}

        {data && tab === "risky" && (
          <div className="overflow-x-auto">
            {data.gmeZoneCount > 0 && (
              <div className="mx-4 mt-3 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-xs text-down">
                🚨 พบ {data.gmeZoneCount} ตัวใน &quot;โซน GME&quot; (short &gt; 100% ของ float — ขายฝากเกินหุ้นที่มีจริง)
              </div>
            )}
            <table className="w-full text-sm mt-2">
              <thead><tr className="text-[10px] text-zinc-500 uppercase border-b border-base-700">
                <th className="px-3 py-2 text-left">Score</th><th className="px-3 py-2 text-left">หุ้น</th>
                <th className="px-3 py-2 text-right">Short% Float</th><th className="px-3 py-2 text-right">DTC</th>
                <th className="px-3 py-2 text-right">ΔShort</th><th className="px-3 py-2 text-right">ราคา/วันนี้</th><th className="px-3 py-2 text-left">เหตุผล</th>
              </tr></thead>
              <tbody>
                {data.risky.slice(0, locked ? 5 : 40).map((r) => (
                  <tr key={r.symbol} className="border-b border-base-800 hover:bg-base-850">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`chip !text-[11px] ${r.score >= 8 ? "bg-down/15 text-down border border-down/30" : r.score >= 6 ? "bg-orange-500/15 text-orange-400 border border-orange-500/30" : "bg-base-800 text-zinc-400 border border-base-700"}`}>{r.tier} {r.score}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/stock/${r.symbol}`} className="font-bold text-zinc-100 hover:text-accent-soft">{r.symbol}</Link>
                      <span className="block text-[10px] text-zinc-600 truncate max-w-40">{r.name}</span>
                    </td>
                    <td className={`px-3 py-2 text-right num font-semibold ${r.gmeZone ? "text-down" : (r.shortPctFloat ?? 0) >= 20 ? "text-orange-400" : "text-zinc-300"}`}>
                      {r.shortPctFloat !== null ? r.shortPctFloat.toFixed(0) + "%" : "-"}{r.gmeZone ? " 🚨" : ""}
                    </td>
                    <td className="px-3 py-2 text-right num text-zinc-300">{r.dtc > 0 ? r.dtc.toFixed(1) : "-"}</td>
                    <td className={`px-3 py-2 text-right num ${r.chgPct >= 0 ? "text-down" : "text-up"}`}>{r.chgPct > 0 ? "+" : ""}{r.chgPct.toFixed(0)}%</td>
                    <td className="px-3 py-2 text-right num whitespace-nowrap text-zinc-300">
                      {r.price !== null ? "$" + r.price.toFixed(2) : "-"}
                      {r.dayChangePct !== null && <span className={`ml-1 ${r.dayChangePct >= 0 ? "text-up" : "text-down"}`}>{r.dayChangePct >= 0 ? "+" : ""}{r.dayChangePct.toFixed(1)}%</span>}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-zinc-500 max-w-56">{r.reasons.slice(0, 2).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {locked && data.risky.length > 5 && (
              <LockGate need="starter" title="🔥 Squeeze Radar เต็มรูปแบบ" desc={`เห็นทั้งหมด ${data.risky.length} ตัว + ลิสต์ shorts ถอยทั้งหมด`} />
            )}
          </div>
        )}

        {data && tab === "covering" && (
          <div className="overflow-x-auto">
            <p className="px-4 pt-3 text-[11px] text-zinc-500">ยอด short ลดลงเร็ว (≥15%) แต่ขนาดยังใหญ่ = หมีกำลังซื้อคืน — ช่วงต้นของการบีบ หรือเพียงแค่ปรับพอร์ต</p>
            <table className="w-full text-sm mt-2">
              <thead><tr className="text-[10px] text-zinc-500 uppercase border-b border-base-700">
                <th className="px-3 py-2 text-left">หุ้น</th><th className="px-3 py-2 text-right">ยอด Short</th>
                <th className="px-3 py-2 text-right">ΔShort</th><th className="px-3 py-2 text-right">DTC</th><th className="px-3 py-2 text-right">ราคา/วันนี้</th>
              </tr></thead>
              <tbody>
                {data.covering.slice(0, locked ? 5 : 25).map((r) => (
                  <tr key={r.symbol} className="border-b border-base-800 hover:bg-base-850">
                    <td className="px-3 py-2">
                      <Link href={`/stock/${r.symbol}`} className="font-bold text-zinc-100 hover:text-accent-soft">{r.symbol}</Link>
                      <span className="block text-[10px] text-zinc-600 truncate max-w-48">{r.name}</span>
                    </td>
                    <td className="px-3 py-2 text-right num text-zinc-300">{fmtM(r.shortInterest)}</td>
                    <td className="px-3 py-2 text-right num text-up">{r.chgPct.toFixed(0)}%</td>
                    <td className="px-3 py-2 text-right num text-zinc-400">{r.dtc.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right num whitespace-nowrap text-zinc-300">
                      {r.price !== null ? "$" + r.price.toFixed(2) : "-"}
                      {r.dayChangePct !== null && <span className={`ml-1 ${r.dayChangePct >= 0 ? "text-up" : "text-down"}`}>{r.dayChangePct >= 0 ? "+" : ""}{r.dayChangePct.toFixed(1)}%</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && tab === "thai" && (
          <div className="overflow-x-auto">
            <p className="px-4 pt-3 text-[11px] text-zinc-500">
              ⚠️ ตลาดไทยยังไม่เปิดยอดขายชอร์ตรายหุ้นแบบ FINRA — ตารางนี้เป็น &quot;หุ้นไทยที่ตกหนักด้านราคา 1 เดือน&quot; (ตัวเริ่มศึกษา ไม่ใช่สัญญาณ squeeze จริง)
            </p>
            <table className="w-full text-sm mt-2">
              <thead><tr className="text-[10px] text-zinc-500 uppercase border-b border-base-700">
                <th className="px-3 py-2 text-left">หุ้น</th><th className="px-3 py-2 text-right">ราคา</th>
                <th className="px-3 py-2 text-right">1M</th><th className="px-3 py-2 text-right">3M</th><th className="px-3 py-2 text-right">แคป</th><th className="px-3 py-2 text-left">กลุ่ม</th>
              </tr></thead>
              <tbody>
                {data.thai.map((t) => (
                  <tr key={t.symbol} className="border-b border-base-800 hover:bg-base-850">
                    <td className="px-3 py-2">
                      <Link href={`/stock/${encodeURIComponent(t.symbol)}`} className="font-bold text-zinc-100 hover:text-accent-soft">{t.symbol.replace(".BK", "")}</Link>
                      <span className="block text-[10px] text-zinc-600 truncate max-w-44">{t.name}</span>
                    </td>
                    <td className="px-3 py-2 text-right num text-zinc-300">{t.price.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right num text-down">{t.chg1m.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right num text-down">{t.chg3m.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right num text-zinc-400">{fmtM(t.mcap)}</td>
                    <td className="px-3 py-2 text-[11px] text-zinc-500">{t.sector}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* การ์ดความรู้: เรื่องเดียวกับในคลิป */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-bold text-zinc-100">🎮 เรื่องเดียวกับในคลิป: คนตรวจเจอ &quot;oversell ของกองทุน&quot; ที่ GME ยังไง — แล้วเราทำซ้ำยังไง</h2>
        <div className="grid md:grid-cols-2 gap-4 text-xs leading-relaxed text-zinc-400">
          <div className="space-y-2">
            <p><b className="text-zinc-200">สิ่งที่เขาทำ (ธ.ค. 2020 - ม.ค. 2021):</b> กองทุน/ฮัดจ์ฟันด์เชื่อว่า GameStop ร้านเกมกำลังจะตาย (ยอดขายร่วง ดิจิทัลกินร้าน) เลยยืมหุ้นมาขายกันหนักๆ — จนยอด short แตะ <b className="text-down">~140% ของ float</b> (ขายฝากหุ้นมากกว่าหุ้นที่มีอยู่จริง เพราะยืมซ้ำ+สังเคราะห์) นักลงทุนใน Reddit (WallStreetBets) อ่านตัวเลขสาธารณะนี้แล้วเห็นช่อง: ถ้าราคาไม่ลง หมีทุกคน<b>ต้อง</b>ซื้อคืนพร้อมกัน = จุดระเบิด</p>
            <p>ม.ค. 2021 ราคา GME จาก ~$20 → $483 ใน 2 สัปดาห์ · Melvin Capital ขาดทุน -53% ในเดือนเดียว (ปิดกองทุนปีเดียวกัน) · คุณ DFV (Keith Gill) พลิก $53k → ราว $48M · โบรกเกอร์ระงับซื้อชั่วคราวจนกลายเป็นเรื่องการเมือง-คดีความ</p>
          </div>
          <div className="space-y-2">
            <p><b className="text-zinc-200">สูตรตรวจเอง 3 ตัวเลข (หน้านี้ทำให้อัตโนมัติทั้งตลาด):</b></p>
            <p>1️⃣ <b>Short % ของ Float</b> — &gt;10% เริ่มน่าสนใจ / &gt;20% สูง / &gt;50% สูงมาก / <b className="text-down">&gt;100% = โซน GME (ขายเกินหุ้นที่มี)</b></p>
            <p>2️⃣ <b>Days to Cover (DTC)</b> — ยอด short ÷ วอลุ่มเฉลี่ย = กี่วันจะซื้อคืนหมด ยิ่งสูงยิ่งบีบแรง (GME ตอนนั้น &gt;10 วัน)</p>
            <p>3️⃣ <b>Δ Short เดือนต่อเดือน</b> — หมีเพิ่มขบวนหรือกำลังหนี (ลิสต์ 🏃 ของเรา)</p>
            <p className="text-zinc-500">คำเตือน: หุ้นที่ถูก short หนัก มักมีพื้นฐานแยกจริง — ฝั่งหมีของ GME วิเคราะห์ถูก แต่ positioning ผิด จนล้างพอร์ต ซื้อฝั่งสวน short squeeze = เกมความเสี่ยงสูงมาก ไม่ใช่การลงทุนพื้นฐาน</p>
          </div>
        </div>
        <div className="text-[11px] text-zinc-600 border-t border-base-700/60 pt-3">
          ข้อมูล: FINRA Consolidated Short Interest (อัปเดต 2 ครั้ง/เดือน — ตามรอบ settlement ของสหรัฐฯ) + Yahoo Finance (float/ราคา) · อ่านเพิ่มใน 🕵️ <Link href="/atlas" className="link">Atlas — การ์ด GameStop 2021</Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${hot ? "bg-down/10 border-down/30" : "bg-base-900 border-base-700/60"}`}>
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className={`text-lg font-bold num ${hot ? "text-down" : "text-zinc-100"}`}>{value}</div>
    </div>
  );
}
