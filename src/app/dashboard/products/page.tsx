"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import plansJson from "@/data/plans.json";

interface Plan { id: string; name: string; emoji: string; priceMonthly: number; priceNote: string; tagline: string; features: string[] }
const PLANS = (plansJson as { plans: Plan[] }).plans;

// 👑 สิทธิ์ของฉัน — tier/อายุ/สิ่งที่ได้ + ใส่รหัส SL อัปเกรด + ช่องทางต่ออายุ (เทียบ "ผลิตภัณฑ์ของฉัน" ของคู่แข่ง แต่ผูก tier จริง)
export default function MyProductsPage() {
  const { member, refresh } = useAuth();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [promptpay, setPromptpay] = useState("");

  useEffect(() => {
    // PromptPay/ช่องทางต่ออายุจาก public env (แอดมินตั้งใน .env.local ได้)
    setPromptpay(process.env.NEXT_PUBLIC_PROMPTPAY || "");
  }, []);

  const applyCode = async () => {
    if (busy || !code.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.trim() }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "รหัสไม่ถูกต้อง");
      await refresh?.();
      setMsg("✓ สิทธิ์อัปเดตแล้ว — ยินดีต้อนรับ!");
      setCode("");
    } catch (e) {
      setMsg("⚠️ " + (e as Error).message);
    }
    setBusy(false);
  };

  const myPlan = PLANS.find((p) => p.id === (member ? (member.tier === "pro" ? "pro" : "starter") : "free"));
  const daysLeft = member?.paidUntil ? Math.ceil((new Date(member.paidUntil).getTime() - Date.now()) / 864e5) : null;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">👑 สิทธิ์ของฉัน</h1>
        <p className="text-sm text-zinc-400 mt-1">แพ็กเกจ สิ่งที่ได้ และการต่ออายุ — ที่เดียวจบ</p>
      </div>

      {member ? (
        <div className="card p-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold text-zinc-50">{member.name}</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                แพ็กเกจ <b className={member.tier === "pro" ? "text-accent-soft" : "text-zinc-300"}>{member.tier === "pro" ? "🥇 Pro" : "🥉 Starter"}</b>
                {member.paidUntil && <> · ถึง {new Date(member.paidUntil).toLocaleDateString("th-TH")}</>}
              </p>
            </div>
            {daysLeft !== null && (
              <span className={`chip num border ${daysLeft <= 7 ? "bg-down/10 text-down border-down/30" : "bg-up/10 text-up border-up/30"}`}>
                เหลือ {daysLeft} วัน
              </span>
            )}
          </div>

          {myPlan && (
            <div className="mt-4">
              <p className="text-xs text-zinc-500 mb-2">สิ่งที่คุณได้ตามแพ็กเกจนี้:</p>
              <ul className="space-y-1.5">
                {myPlan.features.map((f, i) => (
                  <li key={i} className="text-xs text-zinc-300 flex gap-1.5"><span className="text-up">✓</span>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {daysLeft !== null && daysLeft <= 14 && (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs text-amber-400 font-semibold mb-1">⏳ ใกล้หมดอายุ — ต่ออายุง่ายๆ:</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                โอนค่าสมาชิก 199฿ (Starter/เดือน) หรือ 499฿ (Pro/เดือน)
                {promptpay ? <> ที่ PromptPay <b className="num text-zinc-200">{promptpay}</b></> : " ทาง PromptPay (ดูเบอร์ที่หน้า /pricing)"} แล้วส่งสลิปทางช่องทางใน <Link href="/contact" className="text-accent-soft underline">หน้าติดต่อ</Link> — แอดมินต่ออายุให้ภายในวันเดียวกัน
              </p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-base-700/50">
            <p className="text-xs text-zinc-500 mb-2">มีรหัสสมาชิกใหม่? ใส่เพื่อสลับ/อัปเกรดสิทธิ์:</p>
            <div className="flex gap-2">
              <input className="input !w-48 num" placeholder="SL-XXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              <button className="btn-primary text-xs" onClick={applyCode} disabled={busy || !code.trim()}>{busy ? "กำลังตรวจ…" : "ใช้รหัสนี้"}</button>
            </div>
            {msg && <p className="text-xs text-zinc-400 mt-2">{msg}</p>}
          </div>
        </div>
      ) : (
        <div className="card p-5">
          <p className="text-sm text-zinc-300">คุณกำลังใช้แพ็กเกจ 🆓 ฟรี — ทุกหน้าข้อมูลใช้ได้</p>
          <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
            มีรหัสสมาชิก SL-XXXXXX? <Link href="/login" className="text-accent-soft underline">เข้าสู่ระบบ</Link> เพื่อเปิด AI วิเคราะห์ + Daily Brief + ซิงก์พอร์ตข้ามเครื่อง
            หรือดูรายละเอียดแพ็กเกจที่ <Link href="/pricing" className="text-accent-soft underline">หน้าราคา</Link>
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-3">
        {PLANS.map((p) => (
          <div key={p.id} className={`card p-4 ${member && ((member.tier === "pro" && p.id !== "free") || (member.tier === "starter" && p.id === "starter")) ? "border-accent/40" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-zinc-100">{p.emoji} {p.name}</span>
              <span className="num text-xs text-zinc-400">{p.priceMonthly === 0 ? "ฟรี" : p.priceMonthly + "฿"}</span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1 leading-snug">{p.tagline}</p>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-zinc-600">พบปัญหาการใช้สิทธิ์? <Link href="/dashboard/support" className="text-accent-soft underline">แจ้งที่ศูนย์ช่วยเหลือ</Link></p>
    </div>
  );
}
