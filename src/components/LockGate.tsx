"use client";

import Link from "next/link";
import { useAuth } from "@/lib/authContext";

// 🔒 กล่องล็อกฟีเจอร์ตามสิทธิ์สมาชิก — free เห็นว่ามีอะไรเพิ่ม แต่ใช้ต้อง login/อัปเกรด
export default function LockGate({ need = "pro", title, desc }: { need?: "starter" | "pro"; title: string; desc?: string }) {
  const { tier } = useAuth();
  const ok = need === "pro" ? tier === "pro" : tier === "starter" || tier === "pro";
  if (ok) return null;
  return (
    <div className="border border-dashed border-base-600 rounded-xl p-5 text-center bg-base-850/60">
      <p className="text-sm font-bold text-zinc-200">🔒 {title}</p>
      <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
        {desc ?? `สงวนสิทธิ์สมาชิก${need === "pro" ? "🥇 Pro" : "สมาชิก Starter/Pro"}`} — {tier === "free" ? "เข้าสู่ระบบด้วยรหัสสมาชิกก่อน" : "อัปเกรดแพ็กเกจเพื่อปลดล็อก"}
      </p>
      <div className="flex gap-2 justify-center mt-3">
        {tier === "free" && (
          <Link href="/login" className="btn-primary !py-1.5 !px-3 text-xs">🔐 เข้าสู่ระบบ</Link>
        )}
        <Link href="/pricing" className="btn-ghost !py-1.5 !px-3 text-xs">ดูแพ็กเกจ</Link>
      </div>
    </div>
  );
}
