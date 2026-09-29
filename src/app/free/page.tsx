"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/authContext";

// 🎁 ของแจกฟรี — เทียบหน้า indicator ฟรีของคู่แข่ง แต่ของเราคือเครื่องมือดิจิทัลของเราเอง (เก็บ lead ลง Redis เมื่อมี DB)
export default function FreePage() {
  const { login } = useAuth();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  const claim = async () => {
    if (!code.trim()) return;
    const r = await login(code.trim());
    setMsg(r.ok ? "✓ เปิดใช้แล้ว! เริ่มที่หน้าพอร์ตของฉันได้เลย" : "⚠️ " + (r.error ?? "รหัสไม่ถูกต้อง"));
  };

  const GIFTS = [
    { emoji: "📡", title: "Radar Cheat Sheet", desc: "คู่มือ 1 หน้า: อ่านเหตุการณ์โลก → ห่วงโซ่สินค้า → หุ้นที่ได้/เสียประโยชน์", href: "/radar", cta: "เปิด Global Radar" },
    { emoji: "🧑‍🎓", title: "พอร์ตมือใหม่รายวัน", desc: "ไอเดียพอร์ตเริ่มต้นปรับทุกวัน + AI ผสมพอร์ตตามใจคุณ", href: "/starter", cta: "ดูพอร์ตวันนี้" },
    { emoji: "🐋", title: "ส่องพอร์ตเซียนโลก", desc: "13F สดจาก SEC — Buffett/Dalio/19 สถาบัน ถืออะไร เพิ่ม-ลดอะไรไตรมาสนี้", href: "/gurus", cta: "ดูพอร์ตกูรู" },
    { emoji: "🗓️", title: "ปฏิทินเศรษฐกิจ + งบ Q", desc: "CPI/NFP/FOMC พยากรณ์ vs จริง + วันแถลงงบหุ้นใหญ่ ~170 ตัว เวลาไทย", href: "/calendar", cta: "เปิดปฏิทิน" },
    { emoji: "🧭", title: "คัดกรองหุ้น 30 ตลาด", desc: "preset กลยุทธ์ 16 แบบ + ธีมร้อนวันนี้ — กดแล้วได้ผลทันที ไม่ต้องตั้งค่า", href: "/screener", cta: "เปิด Screener" },
    { emoji: "⚖️", title: "เทียบหุ้น 70+ เมตริก", desc: "เทียบข้ามตลาด พร้อม radar คะแนนปัจจัยจากงบจริง + AI สรุป", href: "/compare", cta: "ลองเทียบหุ้น" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="text-center py-4">
        <h1 className="text-3xl font-bold text-zinc-50">🎁 ของดีแจกฟรี</h1>
        <p className="text-sm text-zinc-400 mt-2">เครื่องมือเต็มรูปแบบที่ StockLens ให้ใช้ฟรี — ไม่มีเงื่อนไขซ่อน ไม่ต้องรอโหลด</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {GIFTS.map((g) => (
          <Link key={g.title} href={g.href} className="card p-5 hover:border-accent/40 transition-colors">
            <span className="text-2xl">{g.emoji}</span>
            <h2 className="text-sm font-bold text-zinc-100 mt-2">{g.title}</h2>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{g.desc}</p>
            <span className="text-[11px] text-accent-soft mt-3 inline-block">{g.cta} →</span>
          </Link>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="text-base font-bold text-zinc-100 mb-1">มีรหัสสมาชิกฟรี/อีเวนต์?</h2>
        <p className="text-xs text-zinc-500 mb-3">ใส่รหัส SL เพื่อเปิด AI วิเคราะห์ + Daily Brief + ซิงก์พอร์ตข้ามเครื่องทันที</p>
        <div className="flex gap-2 flex-wrap">
          <input className="input num !w-48" placeholder="SL-XXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="btn-primary text-xs" onClick={claim}>เปิดใช้งาน</button>
          {msg && <span className="text-xs text-zinc-300 self-center">{msg}</span>}
        </div>
      </div>

      <p className="text-[11px] text-zinc-600 text-center leading-relaxed">
        ของแจกทั้งหมดสร้างจากข้อมูลสาธารณะ (SEC EDGAR · Yahoo Finance · TradingView) · ราคา delay ~15 นาที ·
        เครื่องมือเชิงการศึกษา ไม่ใช่คำแนะนำการลงทุน
      </p>
    </div>
  );
}
