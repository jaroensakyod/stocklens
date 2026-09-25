import { useState } from "react";

// 🗄️ ไฟสถานะ storage: ตอนนี้เก็บที่ไหน + ปุ่มย้ายข้อมูลไฟล์ขึ้น Database (ครั้งเดียวหลังต่อ Upstash)
export default function StorageBar({ storage, code }: { storage: string; code: string }) {
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);
  const migrate = async () => {
    if (!confirm("ย้ายข้อมูลจากไฟล์ขึ้น Database? (ข้อมูลที่มีใน DB แล้วจะไม่ถูกเขียนทับ)")) return;
    setBusy(true);
    setState("");
    try {
      const res = await fetch("/api/admin/migrate-db", { method: "POST", headers: { "x-admin-code": code } });
      const j = await res.json();
      setState(res.ok ? `✓ ย้ายแล้ว: เพิ่มสมาชิก ${j.membersAdded} คน · Track Record ${j.trackAdded} รายการ (ข้ามซ้ำ ${j.skipped}) — รวมบน DB สมาชิก ${j.totalMembers} คน` : j.error);
    } catch {
      setState("ย้ายไม่สำเร็จ (network)");
    }
    setBusy(false);
  };
  const isDB = storage === "db";
  return (
    <div className={`card p-3 flex items-center justify-between gap-3 flex-wrap ${isDB ? "border-emerald-500/30" : "border-amber-500/30"}`}>
      <p className="text-xs text-zinc-400 flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${isDB ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
        ที่เก็บข้อมูล: <b className={isDB ? "text-emerald-400" : "text-amber-400"}>{isDB ? "🗄️ Database (Upstash Redis) — ใช้บน Vercel ได้" : "📄 ไฟล์ JSON (โหมดเครื่องตัวเอง) — deploy Vercel ต้องต่อ DB ก่อน (ดู DEPLOY.md)"}</b>
      </p>
      <div className="flex items-center gap-2">
        <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={migrate} disabled={busy}>
          {busy ? "กำลังย้าย…" : "📤 ย้ายข้อมูลไฟล์ขึ้น Database"}
        </button>
        {state && <span className={`text-[11px] ${state.startsWith("✓") ? "text-up" : "text-down"}`}>{state}</span>}
      </div>
    </div>
  );
}
