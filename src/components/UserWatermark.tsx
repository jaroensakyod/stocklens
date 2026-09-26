"use client";

import { useAuth } from "@/lib/authContext";

// 🛡️ ลายน้ำรายสมาชิกทั่วทั้งหน้าจอ — กัน cap จอส่งต่อ: ทุกภาพที่แชร์จะจำชื่อ+รหัส+วันหมดอายุของเจ้าของ
// (ยกเว้นโหมดแอดมิน — เจ้าของเว็บล็อกอินด้วยรหัส /admin เพื่ออัดวิดีโอ/แคปหน้าจอโปรโมท)
export default function UserWatermark() {
  const { member, admin, loading } = useAuth();
  if (!member || admin || loading) return null;
  const label = `StockLens · ${member.name} · ${member.code} · ถึง ${member.paidUntil} · ห้ามแชร์`;
  return (
    <div
      aria-hidden
      className="no-print fixed inset-0 z-[60] pointer-events-none overflow-hidden select-none flex flex-wrap content-around justify-around"
      style={{ transform: "rotate(-22deg) scale(1.35)", opacity: 0.055 }}
    >
      {Array.from({ length: 30 }, (_, i) => (
        <span key={i} className="font-bold text-[15px] text-zinc-100 whitespace-nowrap px-8 py-6">
          {label}
        </span>
      ))}
    </div>
  );
}
