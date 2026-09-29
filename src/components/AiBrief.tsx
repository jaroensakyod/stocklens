"use client";

import { useState } from "react";

// 🧠 สรุปไทยสั้นต่อ section — 2 ชั้นตามมาตรฐานทั้งเว็บ: Gemini เขียน → Jev (TypeSafe) ตรวจเป็นมุมมองที่สอง
// ไม่มี AI key → แสดง rule-based ที่ client สร้างจากตัวเลขจริง (graceful เสมอ)
export default function AiBrief({
  ticker,
  section,
  lines,
  rule,
}: {
  ticker: string;
  section: "peers" | "financials" | "technical" | "score" | "analyst" | "compare" | "guru-holders" | "balance";
  lines: string[];
  rule?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const [jev, setJev] = useState<{ verdictTh: string; cls: string; stance: number | null } | null>(null);
  const [mode, setMode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/ai/section-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, ticker, lines, rule }),
      });
      const j = await r.json();
      if (!r.ok || !j.text) throw new Error(j.error || "สรุปไม่สำเร็จ");
      setText(j.text);
      setJev(j.jev ?? null);
      setMode(j.mode === "ai" ? "AI" : "สรุปอัตโนมัติ");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!lines.length) return null;

  return (
    <div className="mt-3">
      {!text ? (
        <button className="btn-ghost !py-1.5 !text-xs" onClick={run} disabled={busy}>
          {busy ? "กำลังสรุป…" : "🧠 อ่านง่าย 2 ประโยค"}
        </button>
      ) : (
        <div className="rounded-lg border border-accent/25 bg-accent/5 p-3">
          <div className="text-xs text-zinc-300 leading-relaxed">{text}</div>
          {jev && (
            <div className={`text-[10px] mt-1.5 pt-1.5 border-t border-base-700/40 ${jev.cls}`}>
              🧠 Jev ตรวจ: {jev.verdictTh}
              {jev.stance !== null && ` · โทนเอียง ${jev.stance >= 3.5 ? "บวก" : jev.stance <= 1.5 ? "ลบ" : "กลาง"} (${jev.stance.toFixed(1)}/4)`}
            </div>
          )}
          <div className="text-[10px] text-zinc-600 mt-1">โดย {mode === "AI" ? "Gemini จากตัวเลขจริงด้านบน" : "สรุปอัตโนมัติจากตัวเลขจริงด้านบน"}{jev && " + ตรวจสอบโดย Jev"}</div>
        </div>
      )}
      {err && <div className="text-[10px] text-down mt-1">{err}</div>}
    </div>
  );
}
