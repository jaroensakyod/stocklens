"use client";

import { useState } from "react";
import TickerPicker from "@/components/TickerPicker";

interface Scene {
  n: number;
  dur: string;
  text: string;
  visual: string;
}

interface StoryCardResult {
  engine: "ai" | "demo";
  style?: string;
  ticker: string;
  name: string;
  caption: string;
  hashtags: string;
  scenes: Scene[];
  error?: string;
}

const SUGGEST = ["MU", "NVDA", "TSM", "AVGO", "PTT.BK", "DEL"];

// สไตล์คอนเทนต์ — แกะจากคลิปไวรัลจริง 4 สูตร
const STYLES = [
  { id: "classic", label: "🎬 เล่าหุ้น 30 วิ", desc: "hook→เฉลยเลขจริง→ทำไม→3 จุด" },
  { id: "contrarian", label: "🧠 ทุกคนบอกแพง ผมว่าสนใจ", desc: "วาลูเอชั่นครบมุม PEG·3 ฉาก·แนวรับ" },
  { id: "listicle", label: "🏆 5 บริษัท [ธีม] มาแรง", desc: "listicle ตามธีม (437K views)" },
  { id: "story", label: "🕵️ ธุรกิจเบื้องหลัง+คูเมือง", desc: "เล่าเรื่อง→AI แทนได้ไหม?" },
];

const THEMES = ["พลังงาน", "AI", "อวกาศ", "อาวุธ", "ยานยนต์ไฟฟ้า", "ครึ่งตัวนำ"];

// 🎬 Story Card Generator — ผลิตคอนเทนต์สไตล์ "เล่าหุ้น 30 วินาที" จากข้อมูลจริงของหุ้น
// (ใช้ใน Admin console เป็นโรงงานคอนเทนต์ และในหน้าหุ้นแบบย่อ)
export default function StoryCardGen({ defaultTicker = "", compact = false }: { defaultTicker?: string; compact?: boolean }) {
  const [ticker, setTicker] = useState(defaultTicker);
  const [style, setStyle] = useState("classic");
  const [theme, setTheme] = useState("พลังงาน");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StoryCardResult | null>(null);
  const [copied, setCopied] = useState<"caption" | "tags" | null>(null);

  const run = async (t?: string) => {
    const s = (t ?? ticker).trim().toUpperCase();
    if (style === "listicle") {
      if (!theme.trim()) return;
    } else if (!s) return;
    setTicker(s);
    setBusy(true);
    setResult(null);
    try {
      const params = new URLSearchParams({ style });
      if (style === "listicle") params.set("q", theme.trim());
      else params.set("s", s);
      const res = await fetch(`/api/ai/story-card?${params}`);
      setResult(await res.json());
    } catch {
      setResult(null);
    }
    setBusy(false);
  };

  const copy = (what: "caption" | "tags") => {
    if (!result) return;
    navigator.clipboard.writeText(what === "caption" ? result.caption : result.hashtags);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold text-zinc-100 mb-1">🎬 Story Card Generator</h3>
      <p className="text-[11px] text-zinc-500 mb-3">
        สูตรคอนเทนต์ไวรัล: hook คำถาม → เฉลยด้วยตัวเลขจริง → ทำไม? → 3 จุดที่ต้องรู้ → สรุป — ได้ทั้ง caption พร้อมโพสต์ และ storyboard ตัดวิดีโอ (6-7 ฉาก)
      </p>

      {/* เลือกสไตล์ */}
      <div className="flex gap-1.5 flex-wrap mb-2">
        {STYLES.map((st) => (
          <button
            key={st.id}
            title={st.desc}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${style === st.id ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 hover:bg-base-700"}`}
            onClick={() => {
              setStyle(st.id);
              setResult(null);
            }}
          >
            {st.label}
          </button>
        ))}
      </div>

      {style === "listicle" ? (
        <div className="flex gap-2 flex-wrap mb-2">
          {THEMES.map((t) => (
            <button key={t} className={`chip border ${theme === t ? "bg-accent/15 text-accent-soft border-accent/40" : "bg-base-800 text-zinc-400 border-base-700 hover:text-zinc-100"}`} onClick={() => setTheme(t)}>
              {t}
            </button>
          ))}
        </div>
      ) : (
        !compact && (
          <div className="flex gap-2 flex-wrap mb-2">
            {SUGGEST.map((s) => (
              <button key={s} className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-zinc-100" onClick={() => run(s)}>
                {s}
              </button>
            ))}
          </div>
        )
      )}

      {style === "listicle" ? (
        <div className="flex gap-2">
          <input className="input" placeholder="ธีม เช่น พลังงาน, AI, อวกาศ, อาหาร" value={theme} onChange={(e) => setTheme(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
          <button className="btn-primary shrink-0" onClick={() => run()} disabled={busy || !theme.trim()}>
            {busy ? "กำลังเขียน…" : "🏆 สร้างลิสต์ 5 บริษัท"}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex-1">
            <TickerPicker
              placeholder="🔍 ค้นหาหุ้น แล้วกดเลือก เช่น Micron / NVDA / PTT"
              onSelect={(symbol) => setTicker(symbol)}
            />
          </div>
          <button className="btn-primary shrink-0" onClick={() => run()} disabled={busy || !ticker.trim()}>
            {busy ? "กำลังเขียน…" : "🎬 สร้างคอนเทนต์"}
          </button>
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          {result.error && <p className="text-[11px] text-yellow-500">⚠️ AI ขัดข้อง ({result.error}) — แสดงฉบับเทมเพลตจากข้อมูลจริงแทน</p>}
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              {result.ticker} · {result.name}{" "}
              <span className={`chip ${result.engine === "ai" ? "bg-accent/15 text-accent-soft" : "bg-zinc-500/15 text-zinc-400"} ml-1`}>
                {result.engine === "ai" ? "AI เขียน" : "โหมดตัวอย่าง"}
              </span>
            </p>
            <button className="btn-ghost !py-1 !px-2.5 text-xs" onClick={() => copy("caption")}>
              {copied === "caption" ? "คัดลอกแล้ว ✓" : "📋 คัดลอก caption"}
            </button>
          </div>

          <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans bg-base-850 rounded-lg p-3 max-h-96 overflow-y-auto border border-base-700/50">{result.caption}</pre>

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-zinc-500">{result.hashtags}</p>
            <button className="btn-ghost !py-1 !px-2.5 text-[11px]" onClick={() => copy("tags")}>
              {copied === "tags" ? "✓" : "📋 แท็ก"}
            </button>
          </div>

          {result.scenes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-300 mb-2">🎥 Storyboard (ตัดวิดีโอตามนี้)</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {result.scenes.map((sc) => (
                  <div key={sc.n} className="bg-base-850 rounded-lg p-2.5 border border-base-700/50">
                    <p className="text-[10px] text-accent-soft num mb-0.5">
                      ฉาก {sc.n} {sc.dur && `· ${sc.dur}`}
                    </p>
                    <p className="text-xs text-zinc-200 leading-snug">{sc.text}</p>
                    {sc.visual && <p className="text-[10px] text-zinc-500 mt-1">🎥 {sc.visual}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
