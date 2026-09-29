"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";

// 🆘 ศูนย์ช่วยเหลือ — FAQ + แจ้งปัญหาเป็นตั๋ว (สมาชิก ติดตามสถานะได้ · แอดมินตอบใน /admin)
interface Ticket {
  id: string; subject: string; detail: string; createdAt: number; status: "open" | "answered" | "closed";
  replies: { by: "member" | "admin"; at: number; text: string }[];
}

const FAQ: { q: string; a: string }[] = [
  { q: "ราคาหุ้นดึงมาจากไหน ล่าช้าไหม?", a: "ดึงสดจาก Yahoo Finance ทุกหน้า (delay ~15 นาทีตามธรรมเนียมตลาด) เหมาะกับการวิเคราะห์ระยะกลาง-ยาว ไม่เหมาะเทรดวินาที" },
  { q: "ข้อมูลพอร์ตกูรู (13F) ใหม่แค่ไหน?", a: "ดึงตรงจากใบยื่น 13F-HR ล่าสุดที่ SEC รับไว้ — สถาบันยื่นได้ถึง 45 วันหลังสิ้นไตรมาส ระบบ cache 12 ชม. และดึงใหม่อัตโนมัติ" },
  { q: "ข้อมูลของฉันเก็บที่ไหน? เปลี่ยนเครื่องหายไหม?", a: "พอร์ต/Watchlist/แจ้งเตือน/หุ้นโปรด เก็บในเครื่อง (localStorage) — สมาชิกที่ login ด้วยรหัส SL ระบบซิงก์ขึ้นบัญชีอัตโนมัติ เปลี่ยนเครื่องแล้ว login ครั้งเดียวข้อมูลกลับมา" },
  { q: "คะแนน StockLens Score คิดยังไง?", a: "เป็นสูตรเปิดเผย 6 เสา (Quality/Valuation/Momentum/News/Street/Safety) จากงบจริง + ราคา + ข่าว + คอนเซนซัส — ดูน้ำหนักเต็มที่หน้าหุ้น ไม่ใช่คำแนะนำซื้อขาย" },
  { q: "AI วิเคราะห์ใช้ข้อมูลอะไร? เชื่อได้แค่ไหน?", a: "AI อ่านเฉพาะข้อมูลจริงที่ระบบส่งให้ (งบ/ราคา/ข่าว) แบบ grounded — ทุกจุดมี disclaimer และแยกชัดว่าอะไรคือตัวเลขจริง อะไรคือการตีความ" },
  { q: "สมาชิก Starter/Pro ต่างกันตรงไหน?", a: "ดูตารางเปรียบเทียบเต็มที่หน้า /pricing — สรุปสั้น: Starter เปิดงบ 4 ปี+องค์ประกอบคะแนน, Pro เพิ่มรายไตรมาส+CSV+AI พอร์ต+ตามกูรูย้อนหลัง+LINE ส่วนตัว" },
  { q: "จ่ายเงิน/ต่ออายุทำยังไง?", a: "โอน PromptPay ตามหน้า /pricing แล้วส่งสลิปทางช่องทางติดต่อ — แอดมินออกรหัส SL-XXXXXX ให้ ใช้รหัสนี้ login ทุกเครื่อง" },
];

const fmtTime = (t: number) => new Date(t).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function SupportPage() {
  const { member } = useAuth();
  const [open, setOpen] = useState<number | null>(0);
  const [subject, setSubject] = useState("");
  const [detail, setDetail] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyOf, setReplyOf] = useState("");
  const [replyText, setReplyText] = useState("");

  const loadTickets = () => {
    if (!member) return;
    fetch("/api/tickets").then((r) => r.json()).then((j) => setTickets(j.tickets ?? [])).catch(() => {});
  };
  useEffect(loadTickets, [member]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, detail }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || j.hint || "ส่งไม่สำเร็จ");
      setMsg("✓ ส่งเรียบร้อย — ทีมงานจะตอบกลับในตั๋วนี้ (และอีเมล/LINE ถ้าเป็นเรื่องเร่งด่วน)");
      setSubject("");
      setDetail("");
      loadTickets();
    } catch (e) {
      setMsg("⚠️ " + (e as Error).message);
    }
    setBusy(false);
  };

  const reply = async (id: string) => {
    if (!replyText.trim()) return;
    await fetch("/api/tickets", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId: id, text: replyText }) });
    setReplyText("");
    setReplyOf("");
    loadTickets();
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🆘 ศูนย์ช่วยเหลือ</h1>
        <p className="text-sm text-zinc-400 mt-1">คำถามที่พบบ่อย + แจ้งปัญหาเป็นตั๋ว (สมาชิกติดตามสถานะได้ที่นี่)</p>
      </div>

      <div className="card divide-y divide-base-700/50">
        {FAQ.map((f, i) => (
          <div key={i}>
            <button className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setOpen(open === i ? null : i)}>
              <span className="text-sm text-zinc-200">{f.q}</span>
              <span className="text-zinc-500 text-xs">{open === i ? "▲" : "▼"}</span>
            </button>
            {open === i && <p className="px-4 pb-3 text-xs text-zinc-400 leading-relaxed">{f.a}</p>}
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="text-base font-bold text-zinc-100 mb-1">📮 แจ้งปัญหา / สอบถาม</h2>
        {member ? (
          <>
            <p className="text-xs text-zinc-500 mb-3">จากบัญชี {member.name} — ตอบกลับในตั๋วด้านล่าง</p>
            <input className="input mb-2" placeholder="หัวข้อ เช่น ราคาหุ้น XX ไม่อัปเดต" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <textarea className="input mb-3 min-h-24" placeholder="รายละเอียด + ขั้นตอนที่ทำก่อนเจอปัญหา (ยิ่งละเอียดยิ่งแก้เร็ว)" value={detail} onChange={(e) => setDetail(e.target.value)} />
            <button className="btn-primary text-sm" onClick={submit} disabled={busy || subject.length < 3 || detail.length < 5}>
              {busy ? "กำลังส่ง…" : "ส่งตั๋ว"}
            </button>
          </>
        ) : (
          <p className="text-xs text-zinc-400 leading-relaxed">
            ระบบตั๋วสำหรับสมาชิก — <Link href="/login" className="text-accent-soft underline">เข้าสู่ระบบด้วยรหัส SL</Link> ก่อน
            หรือทักช่องทางอื่นได้ที่ <Link href="/contact" className="text-accent-soft underline">หน้าติดต่อ</Link>
          </p>
        )}
        {msg && <p className="text-xs text-zinc-400 mt-2">{msg}</p>}
      </div>

      {member && tickets.length > 0 && (
        <div className="card p-5">
          <h2 className="text-base font-bold text-zinc-100 mb-3">📋 ตั๋วของฉัน ({tickets.length})</h2>
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="rounded-lg border border-base-700 p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-zinc-200">{t.subject}</span>
                  <span className={`chip !text-[10px] ${t.status === "answered" ? "bg-up/10 text-up border border-up/30" : t.status === "closed" ? "bg-base-700/30 text-zinc-500 border border-base-700" : "bg-accent/10 text-accent-soft border border-accent/30"}`}>
                    {t.status === "answered" ? "ตอบแล้ว" : t.status === "closed" ? "ปิดแล้ว" : "รอตอบ"}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {t.replies.map((r, i) => (
                    <div key={i} className={`text-xs leading-relaxed rounded-lg px-2.5 py-1.5 ${r.by === "admin" ? "bg-accent/10 text-zinc-200" : "bg-base-800 text-zinc-400"}`}>
                      <span className="text-[10px] text-zinc-600 block mb-0.5">{r.by === "admin" ? "ทีมงาน" : "ฉัน"} · {fmtTime(r.at)}</span>
                      {r.text}
                    </div>
                  ))}
                </div>
                {t.status !== "closed" && (
                  replyOf === t.id ? (
                    <div className="mt-2 flex gap-2">
                      <input className="input !text-xs" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="ข้อความต่อ..." />
                      <button className="btn-ghost !py-1.5 !text-xs" onClick={() => reply(t.id)}>ส่ง</button>
                    </div>
                  ) : (
                    <button className="text-[11px] text-zinc-500 hover:text-zinc-300 underline mt-2" onClick={() => setReplyOf(t.id)}>ตอบกลับ / ถามต่อ</button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
