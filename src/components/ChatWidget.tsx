"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import { mdToHtml } from "@/lib/markdown";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const GREETING = `สวัสดีครับ 👋 ผมคือผู้ช่วย StockLens — ถามได้ทุกอย่าง ตอบจากข้อมูลจริง ณ ตอนนี้
- พิมพ์**ชื่อหุ้น** (NVDA, PTT.BK หรือแค่ "ปตท.", "Apple") — ดึงราคา/คะแนน/กรอบราคามาตอบ
- **มือใหม่ไม่รู้อะไรเลย** — บอกงบได้เลย เช่น "มีเงิน 1 หมื่น จัดพอร์ตให้หน่อย"
- **วิเคราะห์พอร์ตฉัน** — อ่าน holdings จริงจากหน้า /portfolio
- **กูรูถืออะไร** (13F สด) · **หุ้นซิ่งวันนี้** · **backtest หุ้นย้อนหลัง** · **หุ้นปันผล** · **เหตุการณ์โลกกระทบอะไร**
หรือถามความรู้ทั่วไปเรื่องการลงทุนได้เลยครับ`;

const SUGGESTIONS = [
  "มือใหม่ มีเงิน 1 หมื่น จัดพอร์ตให้หน่อย",
  "วันนี้มีอะไรน่าสนใจ",
  "NVDA กับ AMD ตัวไหนดีกว่า",
  "บัฟเฟต์ถืออะไรอยู่",
  "หุ้นซิ่งวันนี้มีตัวไหน",
  "หุ้นปันผลต่างชาติตัวไหนน่าสนใจ",
  "TSM ซื้อผ่านที่ไหนได้",
  "เว็บนี้ใช้ทำอะไรได้บ้าง",
];

// อ่านพอร์ต + watchlist จริงจาก localStorage → ส่งเป็นข้อมูลมีโครงสร้างให้เซิร์ฟเวอร์ (ไม่ใช่แปลงเป็นข้อความ)
function readCtx(): { portfolio: { ticker: string; qty: number; avgCost: number }[]; watchlist: string[] } {
  try {
    const p = JSON.parse(localStorage.getItem("sl-portfolio") || "[]");
    const w = JSON.parse(localStorage.getItem("sl-watchlist") || "[]");
    return {
      portfolio: (Array.isArray(p) ? p : []).filter(
        (h) => h && typeof h.ticker === "string" && isFinite(h.qty) && isFinite(h.avgCost)
      ),
      watchlist: Array.isArray(w) ? w.filter((x) => typeof x === "string") : [],
    };
  } catch {
    return { portfolio: [], watchlist: [] };
  }
}

function hasPortfolio(): boolean {
  try {
    const p = JSON.parse(localStorage.getItem("sl-portfolio") || "[]");
    return Array.isArray(p) && p.length > 0;
  } catch {
    return false;
  }
}

// แชทลอยติดทุกหน้า — ถามได้ทุกเรื่อง ตอบจากข้อมูลจริง (grounded)
export default function ChatWidget() {
  const { tier } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const historyLoaded = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // โหลดประวัติแชทของสมาชิก (Redis) ตอนเปิดแชทครั้งแรก — ข้ามถ้าเริ่มคุยแล้ว
  useEffect(() => {
    if (!open || tier === "free" || historyLoaded.current || messages.length > 1) return;
    historyLoaded.current = true;
    fetch("/api/chat/history")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.messages?.length) setMessages(j.messages as Msg[]);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tier]);

  const saveHistory = (msgs: Msg[]) => {
    if (tier === "free") return;
    fetch("/api/chat/history", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: msgs.slice(-40) }),
    }).catch(() => {});
  };

  const clearHistory = () => {
    setMessages([{ role: "assistant", content: GREETING }]);
    if (tier !== "free") fetch("/api/chat/history", { method: "DELETE" }).catch(() => {});
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "" }]);
    const ctx = readCtx();
    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, portfolio: ctx.portfolio, watchlist: ctx.watchlist }),
        signal: ac.signal,
      });
      if (res.status === 401) {
        acc = "🔒 การใช้ AI เป็นสิทธิ์สมาชิก Starter ขึ้นไป — เข้าสู่ระบบที่หน้า /login ครับ";
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      } else {
        if (!res.body) throw new Error("no body");
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: acc };
            return copy;
          });
        }
        saveHistory([...next, { role: "assistant", content: acc }]);
      }
    } catch (e) {
      const stopped = e instanceof DOMException && e.name === "AbortError";
      const msg = stopped ? (acc || "_หยุดการตอบแล้ว_") : "เกิดข้อผิดพลาด ลองใหม่อีกครั้งครับ";
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: acc ? acc + (stopped ? "\n\n_(หยุดแล้ว)_" : "") : msg };
        return copy;
      });
      if (acc) saveHistory([...next, { role: "assistant", content: acc }]);
    }
    abortRef.current = null;
    setBusy(false);
  };

  const copyLast = () => {
    const last = [...messages].reverse().find((m) => m.role === "assistant" && m.content);
    if (!last) return;
    navigator.clipboard?.writeText(last.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  const chips = hasPortfolio() ? ["💼 วิเคราะห์พอร์ตฉันหน่อย", ...SUGGESTIONS] : SUGGESTIONS;

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
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-zinc-50">ผู้ช่วย StockLens</div>
              <div className="text-[10px] text-zinc-500">ถามได้ทุกอย่าง · ตัวเลขจริงจากข้อมูลสด · ไม่ใช่คำแนะนำการลงทุน</div>
            </div>
            <button onClick={copyLast} className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-zinc-100 text-[10px]" title="คัดลอกคำตอบล่าสุด">
              {copied ? "✓ คัดลอกแล้ว" : "📋 คัดลอก"}
            </button>
            {messages.length > 1 && (
              <button onClick={clearHistory} className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-red-400 text-[10px]" title="ล้างประวัติแชท">
                🗑
              </button>
            )}
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
              {chips.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-zinc-100 text-[11px]"
                  title={s}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {tier === "free" ? (
            <div className="p-4 border-t border-base-700/60 text-center space-y-2">
              <p className="text-xs text-zinc-400">🔒 ผู้ช่วย AI เป็นสิทธิ์สมาชิก Starter ขึ้นไป</p>
              <div className="flex gap-2 justify-center">
                <Link href="/login" className="btn-primary !py-1.5 !px-3 text-xs">🔐 เข้าสู่ระบบ</Link>
                <Link href="/pricing" className="btn-ghost !py-1.5 !px-3 text-xs">ดูแพ็กเกจ</Link>
              </div>
            </div>
          ) : (
            <div className="p-3 border-t border-base-700/60 flex gap-2">
              <input
                className="input"
                placeholder="ถามอะไรก็ได้ เช่น ปตท. น่าดูไหม / วิเคราะห์พอร์ตฉัน…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                disabled={busy}
              />
              {busy ? (
                <button className="btn-ghost !px-3" onClick={() => abortRef.current?.abort()} title="หยุดการตอบ">
                  ⏹
                </button>
              ) : (
                <button className="btn-primary !px-3.5" onClick={() => send()} disabled={!input.trim()}>
                  ส่ง
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
