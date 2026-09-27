"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCan } from "@/lib/authContext";
import LockGate from "@/components/LockGate";

// 🔬 ProLens — วิเคราะห์ความเชื่อมโยงโลก ตามกรอบ AT
// ข้อมูลจาก transcript 27 คลิป (1 ล้านตัวอักษร) + SYSTEM ARCHITECTURE 8 เล่ม
interface Signal { id: string; emoji: string; name: string; clips: number; desc: string; rule: string; watch: string[]; up: string[]; down: string[]; status?: string; currentValue?: string }
interface Prediction { date: string; text: string; status: string; result?: string; note?: string }
interface Framework { howHeReadsHistory: string[]; howHeSeesFuture: string[] }
interface Data { signals: Signal[]; predictions: Prediction[]; framework: Framework; supernova?: { rows: { id: string; label: string; price: number | null; chg5d: number | null }[]; insider?: { netBuyers: number; n: number } }; jiangSignals?: Signal[]; jiangPredictions?: Prediction[]; compareView?: { agree: { topic: string; thaweesakh: string; jiang: string }[]; differ: { topic: string; thaweesakh: string; jiang: string }[] } }
interface AnalyzeResult { signals: Signal[]; chains: { name: string; stocks: string[] }[]; note: string }

const STATUS_ICON: Record<string, string> = { green: "🟢", yellow: "🟡", red: "🔴" };
const PRED_ICON: Record<string, string> = { verified: "✅", pending: "⏳", active: "🔥", standing: "📌" };

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
          ตามกรอบวิเคราะห์ของ <b className="text-zinc-200">AT</b> — สกัดจาก transcript 27 คลิป YouTube (1 ล้านตัวอักษร) + หนังสือ SYSTEM ARCHITECTURE 8 เล่ม + The House of Rothschild
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
          <LockGate need="starter" title="🔓 เปิด Event Analyzer" desc="พิมพ์เหตุการณ์ แล้วระบบวิเคราะห์ผ่าน 14 หลักการของ AT" />
        )}
      </div>

      {/* 6. Dual Lens: ทวีสุข vs Jiang */}
      {data.jiangSignals && data.jiangSignals.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-bold text-zinc-100 mb-1">🧠 Dual Lens — ทวีสุข × PJ</h2>
          <p className="text-[10px] text-zinc-600 mb-4">
            เทียบกรอบคิดของ 2 นักวิเคราะห์ที่ทำนายแม่นที่สุดในโลกปัจจุบัน — จุดที่เห็นตรงกัน = สัญญาณแรง (High Conviction)
          </p>

          {/* Jiang's Signals */}
          <h3 className="text-xs font-bold text-zinc-300 mb-2">📜 PJ (Predictive History) — 16 หลักการ</h3>
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
              <div className="mb-6"><LockGate need="starter" title="🔓 ดู 16 หลักการของ Jiang" /></div>
            </>
          )}

          {/* Jiang's Predictions */}
          {data.jiangPredictions && can.starter && (
            <>
              <h3 className="text-xs font-bold text-zinc-300 mb-2">📅 พยากรณ์ของ Jiang</h3>
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
                      <div className="text-[11px] text-zinc-400"><span className="text-accent-soft font-semibold">ทวีสุข:</span> {a.thaweesakh}</div>
                      <div className="text-[11px] text-zinc-400"><span className="text-accent-soft font-semibold">Jiang:</span> {a.jiang}</div>
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
                      <div className="text-[11px] text-zinc-400"><span className="text-accent-soft font-semibold">ทวีสุข:</span> {d.thaweesakh}</div>
                      <div className="text-[11px] text-zinc-400"><span className="text-accent-soft font-semibold">Jiang:</span> {d.jiang}</div>
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
