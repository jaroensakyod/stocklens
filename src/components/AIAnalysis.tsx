"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/lib/authContext";

// แสดงบทวิเคราะห์ AI แบบ stream + แปลง markdown ขั้นต้ำเป็น HTML
function mdToHtml(md: string): string {
  const esc = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = esc.split("\n");
  const out: string[] = [];
  let inList = false;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)/);
    const li = line.match(/^[-*]\s+(.*)/);
    const bold = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    if (h2) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${bold(h2[1])}</h2>`);
    } else if (li) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${bold(li[1])}</li>`);
    } else if (line.trim() === "") {
      if (inList) { out.push("</ul>"); inList = false; }
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${bold(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}

const PERSONAS = [
  { id: "", label: "🤖 นักวิเคราะห์", pro: false },
  { id: "burry", label: "🦈 Burry", pro: true },
  { id: "buffett", label: "🍦 Buffett", pro: true },
  { id: "lynch", label: "🕵️ Lynch", pro: true },
  { id: "geo", label: "🌏 ภูมิรัฐศาสตร์", pro: true },
];

export default function AIAnalysis({ ticker }: { ticker: string }) {
  const { tier } = useAuth();
  const [lockMsg, setLockMsg] = useState("");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"idle" | "loading" | "streaming" | "done" | "error">("idle");
  const [aiMode, setAiMode] = useState("");
  const [persona, setPersona] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const run = async (p: string = persona) => {
    setPersona(p);
    setText("");
    setMode("loading");
    try {
      const res = await fetch(`/api/ai/analyze?s=${encodeURIComponent(ticker)}${p ? `&persona=${p}` : ""}`);
      setAiMode(res.headers.get("X-AI-Mode") ?? "");
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      setMode("streaming");
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((t) => t + dec.decode(value, { stream: true }));
        boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
      }
      setMode("done");
    } catch {
      setMode("error");
    }
  };

  const label =
    mode === "idle" ? "🤖 วิเคราะห์ด้วย AI"
    : mode === "loading" ? "กำลังเตรียมข้อมูล…"
    : mode === "streaming" ? "AI กำลังเขียน…"
    : mode === "done" ? (aiMode === "live" ? "✅ บทวิเคราะห์จาก AI" : "✅ โหมดตัวอย่าง (จากคะแนนปัจจัยจริง)")
    : "เกิดข้อผิดพลาด ลองใหม่";

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <h2 className="text-lg font-bold text-zinc-50">บทวิเคราะห์ {ticker}</h2>
        <div className="flex gap-1 flex-wrap">
          {PERSONAS.map((p) => {
            const locked = p.pro && tier !== "pro";
            return (
              <button
                key={p.id}
                onClick={() => (locked ? setLockMsg("🔒 มุมมองกูรูทั้ง 4 เป็นสิทธิ์สมาชิก 🥇 Pro — เข้าสู่ระบบ/อัปเกรดที่หน้าแพ็กเกจ") : run(p.id))}
                disabled={mode === "loading" || mode === "streaming"}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${locked ? "opacity-50 cursor-not-allowed" : persona === p.id && mode !== "idle" ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 hover:bg-base-700"}`}
                title={locked ? "สิทธิ์สมาชิก Pro" : p.id ? `วิเคราะห์ในสไตล์${p.label.slice(2)}` : "นักวิเคราะห์ปกติ"}
              >
                {locked ? "🔒 " : ""}{p.label.replace("🦈 ", "").replace("🍦 ", "").replace("🕵️ ", "").replace("🌏 ", "")}
              </button>
            );
          })}
        </div>
      </div>
      {lockMsg && <p className="text-[11px] text-amber-400/90 mb-2">{lockMsg}</p>}
      {(mode === "streaming" || mode === "done") && (
        <>
          {aiMode === "demo" && (
            <p className="text-xs text-amber-400/90 mb-3">
              ⓘ ยังไม่ได้ตั้ง AI key — นี่คือโหมดตัวอย่างที่ประกอบจากคะแนนปัจจัย/สัญญาณเทคนิคจริงอัตโนมัติ
            </p>
          )}
          <div ref={boxRef} className="ai-md max-h-[560px] overflow-y-auto text-sm text-zinc-300" dangerouslySetInnerHTML={{ __html: mdToHtml(text) }} />
        </>
      )}
      {mode === "idle" && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-500">
            เลือกมุมมองแล้วกด — AI จะวิเคราะห์จากข้อมูลจริงของ {ticker} (ราคา · ปัจจัยพื้นฐาน · คะแนน 5 มิติ · สัญญาณเทคนิค · ข่าวล่าสุด)
          </p>
          <p className="text-[11px] text-zinc-600">{label}</p>
        </div>
      )}
    </div>
  );
}
