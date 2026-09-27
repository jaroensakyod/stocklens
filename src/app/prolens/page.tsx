"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCan } from "@/lib/authContext";
import LockGate from "@/components/LockGate";

// 🔬 ProLens — วิเคราะห์ความเชื่อมโยงโลก ตามกรอบ T
// ข้อมูลจาก transcript 27 คลิป (1 ล้านตัวอักษร) + SYSTEM ARCHITECTURE 8 เล่ม
interface Signal { id: string; emoji: string; name: string; clips: number; desc: string; rule: string; watch: string[]; up: string[]; down: string[]; status?: string; currentValue?: string }
interface Prediction { date: string; text: string; status: string; result?: string; note?: string }
interface Framework { howHeReadsHistory: string[]; howHeSeesFuture: string[] }
interface Data { signals: Signal[]; predictions: Prediction[]; framework: Framework; supernova?: { rows: { id: string; label: string; price: number | null; chg5d: number | null }[]; insider?: { netBuyers: number; n: number } }; jiangSignals?: Signal[]; jiangPredictions?: Prediction[]; compareView?: { agree: { topic: string; thaweesakh: string; jiang: string }[]; differ: { topic: string; thaweesakh: string; jiang: string }[] }; jevMining?: { ranAt: string; calls: number; summary: { chunks: number; hotChunks: number; predictionsFound: number; causalChunks: number; byAsset: Record<string, number> }; predictions: { clip: string; quote: string; assets: string | null; timeframe: string | null; predScore: number; direction?: string | null; confidence?: number | null }[]; causalQuotes: { clip: string; quote: string }[]; directionSummary?: Record<string, number>; scenario?: { dominant: string | null; evidenceScore: number | null; goldLean: number | null; note: string };
  fullSuite?: {
    phaseCount: Record<string, number>; adviceCount: Record<string, number>; convictionAvg: number | null;
    highConviction: { asset: string; direction: string; clipCount: number; quoteCount: number; avgConfidence: number; sample: string[] }[];
    contradictions: { asset: string; bear: { quote: string; clip: string }; bull: { quote: string; clip: string }; verdict: string | null; lean: number | null }[];
    stockCalls: { ticker: string; chunks: number; priceRange: { min: number; max: number; n: number } | null; sample: { clip: string; ctx: string } | null }[];
    allocation: { posture: string | null; cashRole: number | null; note: string };
  } } }
interface AnalyzeResult { signals: Signal[]; chains: { name: string; stocks: string[] }[]; note: string }

const STATUS_ICON: Record<string, string> = { green: "🟢", yellow: "🟡", red: "🔴" };
const PRED_ICON: Record<string, string> = { verified: "✅", pending: "⏳", active: "🔥", standing: "📌" };

const DIR_STYLE: Record<string, { label: string; cls: string }> = { bull: { label: "▲ บวก", cls: "bg-up/15 text-up border-up/30" }, bear: { label: "▼ ลบ", cls: "bg-down/15 text-down border-down/30" }, conditional: { label: "⇄ มีเงื่อนไข", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" }, neutral: { label: "● เล่าสถานะ", cls: "bg-base-800 text-zinc-500 border-base-700" } };
const SCEN_TH: Record<string, string> = { warInflationReset: "⚔️ สงคราม+เงินเฟ้อ+Reset ราว 2030 (ทอง/สินค้าโภคภัณฑ์/กลาโหมชนะ)", softLanding: "🕊️ ผ่านพ้นแบบนุ่ม หุ้นโตต่อ", stagflationGrind: "🐢 เงินเฟ้อสูง+เติบโตต่ำยาว (ทองแข็ง หุ้น sideways)" };

const PHASE_TH: Record<string, string> = { buildup: "🧱 สะสม/เตรียม", war: "⚔️ สงคราม/วิกฤต", reset: "🔄 รีเซ็ต", rebuild: "🏗️ สร้างใหม่" };
const ADVICE_TH: Record<string, string> = { buy: "🟢 ซื้อ/สะสม", sell: "🔴 ขาย/ลด", holdcash: "💵 ถือเงินสด/รอ", prepare: "🎒 เตรียมตัว", debt: "📉 ลดหนี้", diversify: "⚖️ กระจาย" };
const POSTURE_TH: Record<string, string> = { maxCashGold: "เงินสดสูง+ทองหนัก รอซื้อวิกฤต", barbell: "บาร์เบล: ทอง/สินค้าโภคภัณฑ์ + หุ้นคุณภาพนิดหน่อย", allIn: "ลงหุ้นเต็มตัว", diversified: "กระจายทุกสินทรัพย์เท่ากัน" };
const VERDICT_TH: Record<string, string> = { changed: "⚡ เปลี่ยนความเห็นจริง", timeframe: "✓ ไม่ขัดกัน — ต่าง timeframe/เงื่อนไข", differentAsset: "✓ คนละประเด็นในสินทรัพย์เดียวกัน" };
const ASSET_TH: Record<string, string> = { gold: "🥇 ทองคำ", oil: "🛢️ น้ำมัน/พลังงาน", thb: "🇹🇭 เงินบาท", set: "📊 SET", bonds: "🏛️ พันธบัตร/ดอกเบี้ย", land: "🌱 ที่ดิน", usd: "💵 ดอลลาร์", defense: "🛡️ กลาโหม" };
const TF_TH: Record<string, string> = { days: "ระยะสั้น (วัน-สัปดาห์)", months: "ไตรมาส-ไม่กี่เดือน", year: "ภายในปีเดียว", years: "หลายปี-2030+" };

export default function ProlensPage() {
  const can = useCan();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [input, setInput] = useState("");
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetch("/api/prolens").then(r => r.json()).then(setData).catch(() => setErr("โหลดไม่สำเร็จ"));
  }, []);

  const analyze = async () => {
    if (input.trim().length < 5) return;
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await fetch("/api/prolens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: input }) });
      setAnalysis(await res.json());
    } catch { setErr("วิเคราะห์ไม่สำเร็จ"); }
    setAnalyzing(false);
  };

  if (err) return <div className="card p-8 text-center text-sm text-down">{err}</div>;
  if (!data) return <div className="card p-8 text-center text-sm text-zinc-500">กำลังโหลดข้อมูล…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🔬 ProLens — วิเคราะห์ความเชื่อมโยงโลก</h1>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
          ตามกรอบวิเคราะห์ของ <b className="text-zinc-200">T</b> — สกัดจาก transcript 27 คลิป YouTube (1 ล้านตัวอักษร) + หนังสือ SYSTEM ARCHITECTURE 8 เล่ม + The House of Rothschild
        </p>
      </div>

      {/* 1. Macro Snapshot */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100 mb-3">📊 สัญญาณมหภาควันนี้ (Supernova)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(data.supernova?.rows ?? []).map(r => (
            <div key={r.id} className="bg-base-850 rounded-lg p-3">
              <div className="text-[10px] text-zinc-500">{r.label}</div>
              <div className="num text-lg font-bold text-zinc-50">{r.price?.toFixed(2) ?? "—"}</div>
              {r.chg5d !== null && <div className={`num text-[10px] ${r.chg5d >= 0 ? "text-up" : "text-down"}`}>5d {r.chg5d >= 0 ? "+" : ""}{r.chg5d.toFixed(2)}%</div>}
            </div>
          ))}
        </div>
        {data.supernova?.insider && data.supernova.insider.n > 0 && (
          <p className="text-[11px] text-zinc-500 mt-3">
            👔 Insider: {data.supernova.insider.netBuyers}/{data.supernova.insider.n} ตัวซื้อสุทธิ (6 เดือน)
          </p>
        )}
      </div>

      {/* 2. 14 หลักการ */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100 mb-1">🧭 14 หลักการที่เขาใช้ (จาก 27 คลิป)</h2>
        <p className="text-[10px] text-zinc-600 mb-3">เรียงตามความถี่ที่พูดถึง (clips = จำนวนคลิปที่พูดเรื่องนี้)</p>
        <div className="space-y-2">
          {data.signals.map(s => (
            <div key={s.id} className="bg-base-850 rounded-lg p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base">{s.emoji}</span>
                    <span className="text-sm font-bold text-zinc-100">{s.name}</span>
                    <span className="chip bg-base-700 text-zinc-500 !text-[9px]">{s.clips}/27 คลิป</span>
                  </div>
                  {can.starter ? (
                    <>
                      <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">{s.desc}</p>
                      <p className="text-[10px] text-accent-soft mt-1">📐 {s.rule}</p>
                      {s.currentValue && <p className="num text-[11px] text-zinc-300 mt-1.5">📊 ตอนนี้: {s.currentValue}</p>}
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {s.up.length > 0 && <span className="chip bg-up/10 text-up border border-up/30 !text-[9px]">▲ {s.up.slice(0, 3).join(", ")}</span>}
                        {s.down.length > 0 && <span className="chip bg-down/10 text-down border border-down/30 !text-[9px]">▼ {s.down.slice(0, 3).join(", ")}</span>}
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-zinc-600 mt-1">{s.currentValue ?? "ดูรายละเอียด — สมาชิก Starter"}</p>
                  )}
                </div>
                <div className="text-lg shrink-0" title={s.status === "green" ? "สัญญาณเด่น" : s.status === "red" ? "สัญญาณเตือน" : "เฝ้าดู"}>
                  {STATUS_ICON[s.status ?? "yellow"]}
                </div>
              </div>
            </div>
          ))}
        </div>
        {!can.starter && <div className="mt-3"><LockGate need="starter" title="🔓 ดูคำอธิบาย + กฎ + สินทรัพย์ที่กระทบ" desc="สมาชิก Starter ขึ้นไปเห็นรายละเอียดครบทุกหลักการ" /></div>}
      </div>

      {/* 3. Framework: History → Future */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-bold text-zinc-100 mb-2">📜 เขาอ่านประวัติศาสตร์ยังไง</h3>
          <ul className="space-y-1.5">
            {data.framework.howHeReadsHistory.map((h, i) => <li key={i} className="text-xs text-zinc-400 flex gap-2"><span className="text-zinc-600">{i + 1}.</span>{h}</li>)}
          </ul>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-bold text-zinc-100 mb-2">🔭 เขามองอนาคตยังไง</h3>
          <ul className="space-y-1.5">
            {data.framework.howHeSeesFuture.map((h, i) => <li key={i} className="text-xs text-zinc-400 flex gap-2"><span className="text-zinc-600">{i + 1}.</span>{h}</li>)}
          </ul>
        </div>
      </div>

      {/* 4. Timeline พยากรณ์ (Starter+) */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100 mb-1">📅 เขาพูดอะไรไว้ — เกิดขึ้นจริงไหม</h2>
        <p className="text-[10px] text-zinc-600 mb-3">จาก 27 คลิป · ตรวจสอบราคาด้วยฐานข้อมูล Turso ของเรา</p>
        {can.starter ? (
          <div className="space-y-2">
            {data.predictions.map((p, i) => (
              <div key={i} className="bg-base-850 rounded-lg p-3 flex items-start gap-3">
                <span className="text-lg shrink-0">{PRED_ICON[p.status] ?? "⏳"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 leading-snug">{p.text}</p>
                  <div className="flex gap-2 mt-1 flex-wrap text-[10px]">
                    <span className="text-zinc-600">{p.date}</span>
                    {p.result && <span className={p.status === "verified" ? "text-up font-semibold" : "text-zinc-500"}>{p.result}</span>}
                    {p.note && <span className="text-zinc-500">{p.note}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-2 opacity-40 blur-[3px] select-none" aria-hidden>
              {data.predictions.slice(0, 4).map((p, i) => <div key={i} className="bg-base-850 rounded-lg p-3 text-sm text-zinc-300">{PRED_ICON[p.status]} {p.text.slice(0, 50)}…</div>)}
            </div>
            <div className="mt-3"><LockGate need="starter" title="🔓 ดูคำทำนายทั้งหมด + ผลตรวจสอบ" desc="สมาชิก Starter ขึ้นไป" /></div>
          </>
        )}
      </div>

      {/* 5. Event Analyzer (Starter+) */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100 mb-1">🔍 วิเคราะห์เหตุการณ์ใหม่ ผ่านกรอบของเขา</h2>
        <p className="text-[10px] text-zinc-600 mb-3">พิมพ์เหตุการณ์/ข่าว → ระบบจะจับหลักการที่เกี่ยว + โยงสินทรัพย์ที่กระทบ</p>
        {can.starter ? (
          <>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="เช่น อิหร่านปิดช่องแคบฮอร์มุซ / ทรัมป์ลดดอกเบี้ย / ทองทะลุ 5,000 ดอลลาร์" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && analyze()} />
              <button className="btn-primary shrink-0" onClick={analyze} disabled={analyzing || input.trim().length < 5}>{analyzing ? "กำลังวิเคราะห์…" : "วิเคราะห์"}</button>
            </div>
            {analysis && (
              <div className="mt-4 space-y-3">
                {analysis.signals.length > 0 ? (
                  <>
                    <div className="text-xs text-zinc-400">หลักการที่เกี่ยวข้อง:</div>
                    {analysis.signals.map(s => (
                      <div key={s.id} className="bg-base-850 rounded-lg p-3">
                        <div className="text-sm font-bold text-zinc-100">{s.emoji} {s.name}</div>
                        <p className="text-[11px] text-zinc-400 mt-1">{s.desc}</p>
                        <p className="text-[10px] text-accent-soft mt-1">📐 {s.rule}</p>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {s.up.map(u => <Link key={u} href={`/stock/${encodeURIComponent(u)}`} className="chip bg-up/10 text-up border border-up/30 !text-[9px]">▲ {u}</Link>)}
                          {s.down.map(d => <span key={d} className="chip bg-down/10 text-down border border-down/30 !text-[9px]">▼ {d}</span>)}
                        </div>
                      </div>
                    ))}
                  </>
                ) : <p className="text-xs text-zinc-500">ไม่พบหลักการที่ตรง — ลองใส่รายละเอียดเพิ่ม</p>}
                {analysis.chains.length > 0 && (
                  <>
                    <div className="text-xs text-zinc-400">ห่วงโซ่ผลกระทบ (จาก impact map):</div>
                    {analysis.chains.map(c => (
                      <div key={c.name} className="bg-base-850 rounded-lg p-3">
                        <div className="text-sm text-zinc-200">{c.name}</div>
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">{c.stocks.map(s => <Link key={s} href={`/stock/${encodeURIComponent(s)}`} className="chip bg-base-700 text-zinc-300 !text-[9px]">{s}</Link>)}</div>
                      </div>
                    ))}
                  </>
                )}
                <p className="text-[10px] text-zinc-600">{analysis.note}</p>
              </div>
            )}
          </>
        ) : (
          <LockGate need="starter" title="🔓 เปิด Event Analyzer" desc="พิมพ์เหตุการณ์ แล้วระบบวิเคราะห์ผ่าน 14 หลักการของ T" />
        )}
      </div>

      {/* 5.5 🧠 Jev ขุดเพิ่มจาก 27 คลิป */}
      {data.jevMining && (
        <div className="card p-5">
          <h2 className="text-sm font-bold text-zinc-100 mb-1">🧠 Jev ขุดเพิ่มจากคลัง 27 คลิป ({data.jevMining.calls} chunks ตรวจ)</h2>
          <p className="text-[11px] text-zinc-500 mb-3">
            รอบแรก (ตอน Jev พัง 402) regex ได้ 21 พยากรณ์ — รอบนี้ Jev จริง ได้ <b className="text-accent-soft">{data.jevMining.summary.predictionsFound}</b> พยากรณ์ +{" "}
            <b className="text-accent-soft">{data.jevMining.summary.causalChunks}</b> ประโยค causal จาก {data.jevMining.summary.chunks} chunks ({data.jevMining.summary.hotChunks} chunks มีของ) · แสดง 12 อันดับคะแนนสูงสุด
          </p>
          {data.jevMining.directionSummary && (
            <p className="text-[11px] text-zinc-500 mb-2">
              ทิศทางรวมทั้งคลัง: {Object.entries(data.jevMining.directionSummary).filter(([k]) => DIR_STYLE[k]).map(([k, v]) => DIR_STYLE[k].label + " " + v).join(" · ")}
              {data.jevMining.scenario?.dominant && <> — <b className="text-accent-soft">สถานการณ์เด่นตาม Jev: {SCEN_TH[data.jevMining.scenario.dominant] ?? data.jevMining.scenario.dominant}</b> (หลักฐานเอียง {(data.jevMining.scenario.evidenceScore ?? 0).toFixed(1)}/4 · ทองเอียงบวก {(data.jevMining.scenario.goldLean ?? 0).toFixed(1)}/4)</>}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Object.entries(data.jevMining.summary.byAsset).filter(([k]) => k !== "none").sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <span key={k} className="chip bg-base-800 text-zinc-300 border border-base-700 !text-[10px]">{ASSET_TH[k] ?? k} <b className="num">{v}</b></span>
            ))}
          </div>
          <div className="space-y-2">
            {data.jevMining.predictions.slice(0, 12).map((p, i) => (
              <div key={i} className="bg-base-850 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="chip bg-accent/15 text-accent-soft border border-accent/30 !text-[10px] num">#{i + 1} · Jev {p.predScore.toFixed(1)}</span>
                  {p.assets && p.assets !== "none" && <span className="chip bg-base-800 text-zinc-400 border border-base-700 !text-[10px]">{ASSET_TH[p.assets] ?? p.assets}</span>}
                  {p.timeframe && p.timeframe !== "none" && <span className="chip bg-base-800 text-zinc-500 border border-base-700 !text-[10px]">{TF_TH[p.timeframe] ?? p.timeframe}</span>}{p.direction && DIR_STYLE[p.direction] && <span className={"chip border !text-[10px] " + DIR_STYLE[p.direction].cls}>{DIR_STYLE[p.direction].label}{p.confidence !== null && p.confidence !== undefined ? " · มั่นใจ " + p.confidence.toFixed(0) + "/3" : ""}</span>}
                  <span className="text-[10px] text-zinc-600">{p.clip}</span>
                </div>
                <p className="text-[12px] text-zinc-300 mt-1 leading-relaxed">“{p.quote}”</p>
              </div>
            ))}
          {/* ▼▼▼ Full Suite เพิ่ม 27 ก.ย. 2026 ▼▼▼ */}
          {data.jevMining.fullSuite && (
            <>
              <div className="mt-4 pt-3 border-t border-base-700/60 grid sm:grid-cols-3 gap-3 text-center">
                <div className="bg-base-900 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-zinc-500">เฟสที่พูดถึงบ่อยสุด (380 chunks)</div>
                  <div className="text-[13px] text-zinc-200 mt-1 leading-relaxed">{Object.entries(data.jevMining.fullSuite.phaseCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => <span key={k} className="mr-2">{PHASE_TH[k] ?? k} <b className="num text-accent-soft">{v}</b></span>)}</div>
                </div>
                <div className="bg-base-900 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-zinc-500">คำแนะนำที่บอกผู้ชม</div>
                  <div className="text-[13px] text-zinc-200 mt-1 leading-relaxed">{Object.entries(data.jevMining.fullSuite.adviceCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => <span key={k} className="mr-2">{ADVICE_TH[k] ?? k} <b className="num text-accent-soft">{v}</b></span>)}</div>
                </div>
                <div className="bg-accent/10 border border-accent/25 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-zinc-500">Posture ที่คำแนะนำสื่อ (Jev สังเคราะห์)</div>
                  <div className="text-[13px] font-bold text-accent-soft mt-1">{POSTURE_TH[data.jevMining.fullSuite.allocation.posture ?? ""] ?? data.jevMining.fullSuite.allocation.posture}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">บทบาทเงินสด (รอซื้อวิกฤต) {(data.jevMining.fullSuite.allocation.cashRole ?? 0).toFixed(0)}/3 · conviction เฉลี่ย {(data.jevMining.fullSuite.convictionAvg ?? 0).toFixed(1)}/3</div>
                </div>
              </div>

              {data.jevMining.fullSuite.highConviction.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-bold text-zinc-300 mb-2">📌 พยากรณ์หนักแน่น — ทิศทางเดียวกันซ้ำ ≥3 คลิป ({data.jevMining.fullSuite.highConviction.length} กลุ่ม)</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {data.jevMining.fullSuite.highConviction.map((h, i) => (
                      <div key={i} className="bg-base-850 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="chip bg-base-800 text-zinc-300 border border-base-700 !text-[10px]">{ASSET_TH[h.asset] ?? h.asset}</span>
                          <span className={`chip border !text-[10px] ${h.direction === "bull" ? "bg-up/15 text-up border-up/30" : "bg-down/15 text-down border-down/30"}`}>{h.direction === "bull" ? "▲ บวกต่อเนื่อง" : "▼ ลบต่อเนื่อง"}</span>
                          <span className="text-[10px] text-zinc-500 num">{h.clipCount} คลิป · {h.quoteCount} พูด · มั่นใจเฉลี่ย {h.avgConfidence.toFixed(1)}/3</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed line-clamp-2">“{h.sample[0]}”</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.jevMining.fullSuite.contradictions.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-bold text-zinc-300 mb-2">⚖️ ตรวจความขัดแย้ง — bull กับ bear ในสินทรัพย์เดียวกัน (Jev ตัดสิน)</div>
                  <div className="space-y-2">
                    {data.jevMining.fullSuite.contradictions.map((c, i) => (
                      <div key={i} className="bg-base-850 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="chip bg-base-800 text-zinc-300 border border-base-700 !text-[10px]">{ASSET_TH[c.asset] ?? c.asset}</span>
                          {c.verdict && <span className={`chip border !text-[10px] ${c.verdict === "changed" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-up/10 text-up border-up/25"}`}>{VERDICT_TH[c.verdict] ?? c.verdict}</span>}
                          {c.lean !== null && <span className="text-[10px] text-zinc-500 num">น้ำหนักรวมเอียงบวก {c.lean.toFixed(1)}/4</span>}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2 mt-1.5">
                          <p className="text-[11px] text-down leading-snug">▼ “{c.bear.quote.slice(0, 140)}”</p>
                          <p className="text-[11px] text-up leading-snug">▲ “{c.bull.quote.slice(0, 140)}”</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.jevMining.fullSuite.stockCalls.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-bold text-zinc-300 mb-2">💼 หุ้นที่พูดถึงพร้อมคำแนะนำ + ราคาตอนพูด (ตรวจย้อนกับราคาปัจจุบันได้ที่หน้าหุ้น)</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {data.jevMining.fullSuite.stockCalls.map((sc) => (
                      <div key={sc.ticker} className="bg-base-850 rounded-lg px-3 py-2 flex items-start gap-2">
                        <Link href={`/stock/${encodeURIComponent(sc.ticker.replace(" หรือ NVDA", ""))}`} className="chip bg-accent/15 text-accent-soft border border-accent/30 !text-[11px] shrink-0">{sc.ticker.replace(" หรือ NVDA", "")}</Link>
                        <div className="min-w-0">
                          <span className="text-[10px] text-zinc-500 num">พูดใน {sc.chunks} chunks{sc.priceRange ? ` · ราคาตอนพูด ${sc.priceRange.min}–${sc.priceRange.max} บาท (${sc.priceRange.n} ครั้ง)` : ""}</span>
                          {sc.sample && <p className="text-[11px] text-zinc-400 leading-snug line-clamp-2">{sc.sample.ctx.slice(0, 160)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      )}

      {/* 6. Dual Lens: T vs J */}
      {data.jiangSignals && data.jiangSignals.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-bold text-zinc-100 mb-1">🧠 Dual Lens — T × J</h2>
          <p className="text-[10px] text-zinc-600 mb-4">
            เทียบกรอบคิดของ 2 นักวิเคราะห์ที่ทำนายแม่นที่สุดในโลกปัจจุบัน — จุดที่เห็นตรงกัน = สัญญาณแรง (High Conviction)
          </p>

          {/* J's Signals */}
          <h3 className="text-xs font-bold text-zinc-300 mb-2">📜 J (Predictive History) — 16 หลักการ</h3>
          <p className="text-[10px] text-zinc-600 mb-3">Game Theory + Psychohistory + 2,000 ปีของจักรวรรดิ · 4.1 ล้านตัวอักษรจาก 16 คลิป</p>
          {can.starter ? (
            <div className="space-y-2 mb-6">
              {data.jiangSignals.map(s => (
                <div key={s.id} className="bg-base-850 rounded-lg p-3.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base">{s.emoji}</span>
                    <span className="text-sm font-bold text-zinc-100">{s.name}</span>
                    <span className="chip bg-base-700 text-zinc-500 !text-[9px]">{s.clips}/16 คลิป</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5">{s.desc}</p>
                  <p className="text-[10px] text-accent-soft mt-1">📐 {s.rule}</p>
                  {s.up.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {s.up.slice(0, 4).map(u => <Link key={u} href={`/stock/${encodeURIComponent(u)}`} className="chip bg-up/10 text-up border border-up/30 !text-[9px]">▲ {u}</Link>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-2 opacity-40 blur-[3px] select-none mb-4" aria-hidden>
                {data.jiangSignals.slice(0, 4).map(s => <div key={s.id} className="bg-base-850 rounded-lg p-3 text-sm">{s.emoji} {s.name}</div>)}
              </div>
              <div className="mb-6"><LockGate need="starter" title="🔓 ดู 16 หลักการของ J" /></div>
            </>
          )}

          {/* J's Predictions */}
          {data.jiangPredictions && can.starter && (
            <>
              <h3 className="text-xs font-bold text-zinc-300 mb-2">📅 พยากรณ์ของ J</h3>
              <div className="space-y-2 mb-6">
                {data.jiangPredictions.map((p, i) => (
                  <div key={i} className="bg-base-850 rounded-lg p-3 flex items-start gap-3">
                    <span className="text-lg">{PRED_ICON[p.status] ?? "⏳"}</span>
                    <div>
                      <p className="text-sm text-zinc-200">{p.text}</p>
                      <div className="flex gap-2 text-[10px] mt-1">
                        <span className="text-zinc-600">{p.date}</span>
                        {p.result && <span className={p.status === "verified" ? "text-up" : "text-zinc-500"}>{p.result}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Compare: Agree */}
          {data.compareView && (
            <>
              <h3 className="text-xs font-bold text-up mb-2">✅ เห็นตรงกัน (High Conviction)</h3>
              <div className="space-y-2 mb-4">
                {data.compareView.agree.map((a, i) => (
                  <div key={i} className="bg-up/5 border border-up/20 rounded-lg p-3">
                    <div className="text-sm font-bold text-zinc-100">{a.topic}</div>
                    <div className="grid md:grid-cols-2 gap-2 mt-2">
                      <div className="text-[11px] text-zinc-400"><span className="text-accent-soft font-semibold">T:</span> {a.thaweesakh}</div>
                      <div className="text-[11px] text-zinc-400"><span className="text-accent-soft font-semibold">J:</span> {a.jiang}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Compare: Differ */}
              <h3 className="text-xs font-bold text-yellow-500 mb-2">⚡ เห็นต่างกัน (สำรวจทั้งสองมุม)</h3>
              <div className="space-y-2">
                {data.compareView.differ.map((d, i) => (
                  <div key={i} className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                    <div className="text-sm font-bold text-zinc-100">{d.topic}</div>
                    <div className="grid md:grid-cols-2 gap-2 mt-2">
                      <div className="text-[11px] text-zinc-400"><span className="text-accent-soft font-semibold">T:</span> {d.thaweesakh}</div>
                      <div className="text-[11px] text-zinc-400"><span className="text-accent-soft font-semibold">J:</span> {d.jiang}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 6. หนังสือ/แหล่งอ้างอิง */}
      <div className="card p-4 text-[11px] text-zinc-500 leading-relaxed">
        📚 <b className="text-zinc-300">แหล่งข้อมูล:</b> Transcript 27 คลิป YouTube (1,019,059 ตัวอักษร) · หนังสือ SYSTEM ARCHITECTURE I-III (บ้านพระอาทิตย์) · The House of Rothschild: จักรวรรดิที่มองไม่เห็น (2567) · สัมมนา CTAT "The Great Economic Reset" · สัมมนา "ทันหุ้น"
        <div className="mt-1">⚠️ ข้อมูลเชิงการศึกษา — กรอบวิเคราะห์บุคคล ไม่ใช่คำแนะนำการลงทุนของ StockLens</div>
      </div>
    </div>
  );
}
