"use client";

import { useState } from "react";

interface Row {
  symbol: string;
  name: string;
  radar: { direction: string; magnitude: string; viaNode: string } | null;
  radarScore: number | null;
  ai: { direction: string; confidence: number; reason: string } | null;
  aiScore: number | null;
  actual: { pct: number; direction: string } | null;
}
interface EventResult {
  id: string; date: string; title: string; horizonDays: number; rows: Row[];
}
interface Result {
  summary: {
    radar: { accuracy: number; predicted: number; totalInstruments: number; grade: string; label: string; tone: string };
    ai: { accuracy: number; predicted: number; grade: string; label: string; tone: string } | null;
  };
  events: EventResult[];
}

const DIR_TH: Record<string, string> = { up: "↑ ขึ้น", down: "↓ ลง", flat: "→ เที่ยว" };
const dirColor = (d?: string) => (d === "up" ? "text-emerald-400" : d === "down" ? "text-rose-400" : "text-zinc-400");

export default function TimeMachinePage() {
  const [includeAI, setIncludeAI] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [progress, setProgress] = useState(0);

  const run = async () => {
    setBusy(true);
    setResult(null);
    setProgress(0);
    try {
      // โยก progress คร่าวๆ ระหว่างรอ (AI 10 เหตุการณ์ ~1-2 นาที)
      const timer = setInterval(() => setProgress((p) => Math.min(92, p + 2)), 2500);
      const res = await fetch("/api/timemachine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeAI }),
      });
      clearInterval(timer);
      setProgress(100);
      setResult(await res.json());
    } catch {
      alert("รันไม่สำเร็จ ลองใหม่");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-50">🕰️ ไทม์แมชชีน — ทดสอบระบบด้วยเหตุการณ์จริงในอดีต</h1>
        <p className="text-sm text-zinc-400 mt-2 max-w-3xl leading-relaxed">
          ย้อนเวลาไปยืนอยู่ <b className="text-zinc-200">ณ วันที่เหตุการณ์จริงเกิดขึ้น</b> (สงครามยูเครน · SVB ล่ม · โกโก้ทะลุสถิติ · ChatGPT เปิดตัว ฯลฯ) ให้ระบบทำนายทิศทางราคาจากข้อมูลที่มี<b className="text-zinc-200">เฉพาะวันนั้น</b> แล้วเทียบกับ<b className="text-zinc-200">ราคาจริงที่เกิดขึ้น</b>ภายหลัง — คือ Track Record ของระบบที่พิสูจน์ได้ใน 1 นาที
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input type="checkbox" className="accent-yellow-500 w-4 h-4" checked={includeAI} onChange={(e) => setIncludeAI(e.target.checked)} disabled={busy} />
            รวมการทำนายด้วย AI (ช้ากว่า ~1-2 นาที)
          </label>
          <button className="btn-primary ml-auto" onClick={run} disabled={busy}>
            {busy ? `กำลังย้อนเวลา… ${progress}%` : "▶ เริ่มการทดสอบย้อนเวลา"}
          </button>
        </div>
        {busy && (
          <div className="h-1.5 bg-base-800 rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          ⚖️ ความโปร่งใส: คะแนน <b className="text-zinc-400">"Radar บริสุทธิ์"</b> = ทดสอบฐานความรู้/ตรรกะของระบบ (ไม่มีทางรู้อนาคต) · คะแนน <b className="text-zinc-400">"AI"</b> = Gemini อาจจำเหตุการณ์จริงจากข้อมูลฝึกได้ จึงเป็นตัว "สาธิตศักยภาพ" ไม่ใช่หลักฐานล้วนๆ · เกณฑ์ผลจริง: ±3% ถือเป็น "เที่ยว" · เกณฑ์เกรด: S≥90 A≥80 B≥70 C≥60
        </p>
      </div>

      {result && (
        <div className="space-y-5 animate-fadeUp">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-5 border-l-4 border-l-accent">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-accent">{result.summary.radar.grade}</span>
                <div>
                  <div className="num text-2xl font-bold text-zinc-50">{result.summary.radar.accuracy}%</div>
                  <div className="text-xs text-zinc-500">Radar บริสุทธิ์ — {result.summary.radar.predicted}/{result.summary.radar.totalInstruments} ตราสารที่ระบบมีสัญญาณ</div>
                </div>
              </div>
              <p className="text-xs text-zinc-400 mt-2">{result.summary.radar.label}</p>
            </div>
            {result.summary.ai && (
              <div className="card p-5 border-l-4 border-l-sky-500">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-sky-400">{result.summary.ai.grade}</span>
                  <div>
                    <div className="num text-2xl font-bold text-zinc-50">{result.summary.ai.accuracy}%</div>
                    <div className="text-xs text-zinc-500">AI (Gemini) — {result.summary.ai.predicted} ทำนาย</div>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 mt-2">{result.summary.ai.label} · อาจจำอดีตได้ — ดูคะแนน Radar เป็นหลัก</p>
              </div>
            )}
          </div>

          {result.events.map((ev) => {
            const scored = ev.rows.filter((r) => r.radarScore !== null);
            const evAcc = scored.length ? Math.round((scored.reduce((a, r) => a + (r.radarScore ?? 0), 0) / scored.length) * 100) : 0;
            return (
              <div key={ev.id} className="card p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div>
                    <span className="num text-xs text-accent-soft font-semibold">{ev.date}</span>
                    <h3 className="font-bold text-zinc-50 text-sm">{ev.title}</h3>
                  </div>
                  <span className={`chip num ${evAcc >= 80 ? "bg-emerald-500/15 text-emerald-400" : evAcc >= 60 ? "bg-yellow-500/15 text-yellow-400" : "bg-rose-500/15 text-rose-400"}`}>
                    Radar ทำนายถูก {evAcc}% (+{ev.horizonDays} วัน)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="text-[11px] text-zinc-500 border-b border-base-700/60">
                        <th className="text-left py-1.5">ตราสาร</th>
                        <th className="text-left py-1.5">ทำนาย Radar</th>
                        {result.summary.ai && <th className="text-left py-1.5">ทำนาย AI</th>}
                        <th className="text-right py-1.5">ผลจริง</th>
                        <th className="text-right py-1.5 w-14">Radar</th>
                        {result.summary.ai && <th className="text-right py-1.5 w-14">AI</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {ev.rows.map((r) => (
                        <tr key={r.symbol} className="border-b border-base-700/30">
                          <td className="py-1.5">
                            <span className="font-bold text-zinc-100 text-xs">{r.symbol}</span>
                            <span className="text-zinc-500 text-[11px] ml-1.5">{r.name}</span>
                          </td>
                          <td className="py-1.5 text-xs">
                            {r.radar ? (
                              <span className={dirColor(r.radar.direction)}>{DIR_TH[r.radar.direction]} <span className="text-zinc-600">({r.radar.magnitude})</span></span>
                            ) : (
                              <span className="text-zinc-600">ไม่มีสัญญาณ</span>
                            )}
                          </td>
                          {result.summary.ai && (
                            <td className="py-1.5 text-xs">
                              {r.ai ? <span className={dirColor(r.ai.direction)}>{DIR_TH[r.ai.direction]} <span className="text-zinc-600">({r.ai.confidence}%)</span></span> : <span className="text-zinc-600">—</span>}
                            </td>
                          )}
                          <td className="py-1.5 text-right num text-xs">
                            {r.actual ? (
                              <span className={r.actual.pct >= 0 ? "text-up" : "text-down"}>
                                {r.actual.pct >= 0 ? "+" : ""}{r.actual.pct}%
                              </span>
                            ) : (
                              <span className="text-zinc-600">ไม่มีข้อมูล</span>
                            )}
                          </td>
                          <td className="py-1.5 text-right">{r.radarScore === null ? <span className="text-zinc-700 text-xs">—</span> : r.radarScore >= 1 ? <span className="text-up">✓</span> : r.radarScore >= 0.5 ? <span className="text-yellow-400">~</span> : <span className="text-down">✗</span>}</td>
                          {result.summary.ai && (
                            <td className="py-1.5 text-right">{r.aiScore === null ? <span className="text-zinc-700 text-xs">—</span> : r.aiScore >= 1 ? <span className="text-up">✓</span> : r.aiScore >= 0.5 ? <span className="text-yellow-400">~</span> : <span className="text-down">✗</span>}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          <p className="text-[11px] text-zinc-600 leading-relaxed">
            ⚠️ ผลย้อนหลังไม่การันตีอนาคต · ชุดทดสอบเลือกเหตุการณ์ที่อยู่ในขอบเขต Radar (สงคราม/สินค้าโภคภัณฑ์/AI) — เหตุการณ์ประเภทอื่นเช่น บริษัทเฉพาะหรือนโยบายภายในจะมี "ไม่มีสัญญาณ" มากกว่า · ใช้เป็นเครื่องมือสื่อสารความน่าเชื่อถือของ methodology ไม่ใช่คำแนะนำการลงทุน
          </p>
        </div>
      )}
    </div>
  );
}
