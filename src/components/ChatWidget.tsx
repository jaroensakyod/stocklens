"use client";

import { useEffect, useRef, useState } from "react";
import { mdToHtml } from "@/lib/markdown";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = ["NVDA ตอนนี้เป็นยังไง", "ฝนตกหนักที่แอฟริกา กระทบหุ้นอะไร", "RKLB กับ ASTS ต่างกันยังไง", "PTT.BK น่าดูไหม"];

// อ่าน holdings จริงจาก localStorage → สร้างคำถาม "วิเคราะห์พอร์ตฉัน"
function portfolioQuestion(): string | null {
  try {
    const raw = localStorage.getItem("sl-portfolio");
    const holdings = raw ? (JSON.parse(raw) as { ticker: string; qty: number; avgCost: number }[]) : [];
    if (!holdings.length) return null;
    const list = holdings.slice(0, 4).map((h) => `${h.ticker} ${h.qty}@${h.avgCost}`).join(", ");
    return `วิเคราะห์พอร์ตฉันหน่อย: ถือ ${list} — มีความเสี่ยงอะไร ควรจับตาอะไร`;
  } catch {
    return null;
  }
}

// แชทลอยติดทุกหน้า — ถามเรื่องหุ้น/เหตุการณ์ ตอบจากข้อมูลจริง (grounded)
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "สวัสดีครับ 👋 ผมคือผู้ช่วย StockLens\nถามอะไรก็ได้เกี่ยวกับหุ้น — พิมพ์ชื่อหุ้น (เช่น NVDA, PTT.BK) ผมจะดึงราคา/คะแนน/สัญญาณจริงมาตอบ หรือเล่าเหตุการณ์ (เช่น \"สงคราม น้ำมันแพง\") ผมจะวิเคราะห์ห่วงโซ่ผลกระทบให้" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + chunk };
          return copy;
        });
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "เกิดข้อผิดพลาด ลองใหม่อีกครั้งครับ" };
        return copy;
      });
    }
    setBusy(false);
  };

  return (
    <>
      {/* ปุ่มลอย */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="no-print fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-accent text-zinc-950 text-2xl shadow-lg shadow-accent/20 hover:bg-accent-soft transition-colors flex items-center justify-center"
        aria-label="เปิดแชทผู้ช่วย"
      >
        {open ? "✕" : "💬"}
      </button>

      {/* หน้าต่างแชท */}
      {open && (
        <div className="no-print fixed bottom-24 right-5 z-50 w-[92vw] max-w-md h-[600px] max-h-[75vh] card flex flex-col overflow-hidden shadow-2xl animate-fadeUp">
          <div className="px-4 py-3 border-b border-base-700/60 flex items-center gap-2 bg-base-850">
            <span className="text-lg">🤖</span>
            <div>
              <div className="text-sm font-bold text-zinc-50">ผู้ช่วย StockLens</div>
              <div className="text-[10px] text-zinc-500">ตอบจากข้อมูลจริง ณ ตอนนี้ · เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน</div>
            </div>
          </div>

          <div ref={boxRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.role === "user" ? "bg-accent text-zinc-950 rounded-br-sm" : "bg-base-800 text-zinc-200 rounded-bl-sm"
                  }`}
                >
                  {m.role === "assistant" ? (
                    m.content ? (
                      <div className="ai-chat" dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} />
                    ) : (
                      <span className="inline-flex gap-1 items-center text-zinc-500">
                        <span className="animate-pulse">●</span>
                        <span className="animate-pulse [animation-delay:150ms]">●</span>
                        <span className="animate-pulse [animation-delay:300ms]">●</span>
                      </span>
                    )
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* คำถามแนะนำ (แสดงตอนแชทเริ่มต้น) */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {(() => {
                const pq = portfolioQuestion();
                const chips = pq ? [`💼 ${pq.slice(0, 28)}…`, ...SUGGESTIONS.slice(0, 3)] : SUGGESTIONS;
                return chips.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => send(i === 0 && pq ? pq : s)}
                    className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-zinc-100 text-[11px]"
                    title={i === 0 && pq ? pq : s}
                  >
                    {s}
                  </button>
                ));
              })()}
            </div>
          )}

          <div className="p-3 border-t border-base-700/60 flex gap-2">
            <input
              className="input"
              placeholder="พิมพ์คำถาม เช่น AAPL น่าซื้อไหม…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={busy}
            />
            <button className="btn-primary !px-3.5" onClick={() => send()} disabled={busy || !input.trim()}>
              ส่ง
            </button>
          </div>
        </div>
      )}
    </>
  );
}
