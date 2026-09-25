"use client";

import { useEffect, useState } from "react";
import MacroChain from "@/components/MacroChain";
import ImpactGraph from "@/components/ImpactGraph";
import type { EventAnalysis } from "@/lib/types";

interface RadarData {
  themes: { id: string; name: string; emoji: string; desc: string; heat: number; avgChange: number; quotes: { symbol: string; name: string; price: number; changePct: number }[] }[];
}

const EXAMPLES = [
  "ฝนตกหนักมากที่ไอวอรีโสต์และกานา โกโก้อาจขาดแคลน",
  "เกิดสงครามที่ช่องแคบฮอร์มุซ น้ำมันอาจพุ่ง",
  "จีนประกาศคว่ำบัตรส่งออก rare earth",
  "นาซาให้สัญญาใหญ่กับ Rocket Lab",
  "เอลนีโญแรงปีนี้ กาแฟบราซิลเสียหาย",
  "นาโตประกาศขึ้นงบกลาโหมเป็น 5% GDP",
];

export default function RadarPage() {
  const [data, setData] = useState<RadarData | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<EventAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [news, setNews] = useState<{ title: string; publisher: string }[]>([]);

  useEffect(() => {
    fetch("/api/radar").then((r) => r.json()).then(setData).catch(() => {});
    // ข่าวสดวันนี้ — แตะปุ๊บวิเคราะห์กราฟความเชื่อมโยงได้ทันที
    fetch("/api/news?q=oil&count=6").then((r) => r.json()).then((j) => setNews((j.news ?? []).slice(0, 5))).catch(() => {});
  }, []);

  const analyze = async (t?: string) => {
    const input = (t ?? text).trim();
    if (input.length < 4) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/radar/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      setResult(await res.json());
    } catch {
      alert("วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-50">🌍 Global Radar</h1>
        <p className="text-sm text-zinc-400 mt-2 max-w-3xl leading-relaxed">
          เล่าเหตุการณ์เป็นภาษาไทย แล้วให้ระบบถอดรหัสเป็น <span className="text-accent-soft">ห่วงโซ่ผลกระทบ</span>:
          เหตุการณ์ → สินค้าโภคภัณฑ์/อุตสาหกรรม → หุ้นที่ได้ ✅ / เสีย ❌ ประโยชน์ พร้อมราคาจริงตอนนี้ และช่องทางซื้อ (Dime! / โบรกเกอร์ไทย / InnovestX)
        </p>
      </section>

      {/* กล่องเล่าเหตุการณ์ */}
      <section className="card p-5">
        <label className="text-sm font-bold text-zinc-100">เล่าเหตุการณ์ที่คุณได้ยินมา…</label>
        <div className="flex gap-2 mt-2">
          <input
            className="input"
            placeholder="เช่น ปีนี้ฝนมากที่แอฟริกาตะวันตก โกโก้อาจขาดแคลน"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
          />
          <button className="btn-primary shrink-0" onClick={() => analyze()} disabled={busy}>
            {busy ? "กำลังวิเคราะห์…" : "⚡ วิเคราะห์"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className="text-xs text-zinc-600 self-center mr-1">ลองตัวอย่าง:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} className="chip bg-base-800 text-zinc-400 hover:text-zinc-100 border border-base-700" onClick={() => { setText(ex); analyze(ex); }}>
              {ex.length > 34 ? ex.slice(0, 34) + "…" : ex}
            </button>
          ))}
        </div>

        {/* ข่าวสดวันนี้ — แตะแล้วเห็นกราฟความเชื่อมโยงทันที */}
        {news.length > 0 && (
          <div className="mt-4 pt-3 border-t border-base-700/60">
            <p className="text-xs text-zinc-500 mb-2">📰 เหตุการณ์จากข่าวจริงวันนี้ — กดเพื่อดู "ส่งผลถึงใคร":</p>
            <div className="space-y-1.5">
              {news.map((n, i) => (
                <button
                  key={i}
                  className="w-full text-left text-[11px] text-zinc-400 hover:text-accent-soft leading-snug flex gap-1.5"
                  onClick={() => { setText(n.title); analyze(n.title); }}
                >
                  <span className="text-zinc-600 shrink-0">⚡</span>
                  <span>{n.title.length > 90 ? n.title.slice(0, 88) + "…" : n.title} <span className="text-zinc-600">({n.publisher})</span></span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {result && (
        <div className="space-y-4">
          <ImpactGraph result={result} />
          <MacroChain result={result} />
        </div>
      )}

      {/* ความร้อน 8 ธีม */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">🌡️ ธีมไหนร้อนวันนี้ — จัดอันดับจากการเคลื่อนไหวจริงของตัวชี้วัด</h2>
        {!data ? (
          <p className="text-sm text-zinc-500">กำลังโหลด…</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {data.themes.map((t, i) => (
              <div key={t.id} className="card card-hover p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-600 num">#{i + 1}</span>
                      <span className="text-lg">{t.emoji}</span>
                      <h3 className="font-bold text-zinc-100 text-sm">{t.name}</h3>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{t.desc}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`num text-lg font-bold ${t.heat >= 60 ? "text-down" : t.heat >= 35 ? "text-accent" : "text-zinc-400"}`}>{t.heat}</div>
                    <div className="text-[10px] text-zinc-600">ความร้อน /100</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.quotes.map((q) => (
                    <span key={q.symbol} className={`chip num ${q.changePct >= 0 ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}>
                      {(q.name || q.symbol).slice(0, 14)} {q.changePct >= 0 ? "+" : ""}{q.changePct.toFixed(1)}%
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
