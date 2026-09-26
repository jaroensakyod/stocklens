"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";

// 🔐 เข้าสู่ระบบสมาชิก — ด้วยรหัสที่แอดมินออกให้ (SL-XXXXXX) ไม่ต้องมีรหัสผ่าน
// (ด้านล่าง: โหมดแอดมินสำหรับเจ้าของเว็บ — ใช้หน้าต่างๆ โดยไม่ติดลายน้ำ เช่น ตอนอัดวิดีโอ/แคปภาพ)
export default function LoginPage() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { login, admin, adminLogin, adminLogout } = useAuth();
  const router = useRouter();

  // โหมดแอดมิน
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [adminErr, setAdminErr] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setErr("");
    const r = await login(code);
    setBusy(false);
    if (r.ok) router.push("/");
    else setErr(r.error || "เข้าสู่ระบบไม่สำเร็จ");
  };

  const submitAdmin = async () => {
    if (!adminCode.trim()) return;
    setAdminBusy(true);
    setAdminErr("");
    const r = await adminLogin(adminCode);
    setAdminBusy(false);
    if (!r.ok) setAdminErr(r.error || "รหัสไม่ถูกต้อง");
    else setAdminCode("");
  };

  return (
    <div className="max-w-sm mx-auto py-16 space-y-5">
      <div className="text-center">
        <div className="text-4xl mb-2">🔐</div>
        <h1 className="text-xl font-bold text-zinc-50">เข้าสู่ระบบสมาชิก</h1>
        <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
          กรอก<b className="text-zinc-300">รหัสสมาชิก</b>ที่แอดมินออกให้ (ขึ้นต้น SL-) — รหัสผูกกับชื่อของคุณและมีวันหมดอายุตามแพ็กเกจ
        </p>
      </div>

      <input
        className="input text-center tracking-widest uppercase"
        placeholder="SL-XXXXXX"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
      />
      <button className="btn-primary w-full" onClick={submit} disabled={busy || !code.trim()}>
        {busy ? "กำลังตรวจรหัส…" : "เข้าสู่ระบบ"}
      </button>
      {err && <p className="text-xs text-down text-center">{err}</p>}

      <div className="card p-4 text-[11px] text-zinc-500 leading-relaxed space-y-1.5">
        <p>ยังไม่มีรหัส? — สมัครสมาชิกและชำระค่าสมาชิกกับแอดมิน แล้วแอดมินจะออกรหัสส่งให้ทาง LINE/FB ของคุณ</p>
        <p>ทุกครั้งที่ใช้งาน หน้าจอจะมีลายน้ำชื่อสมาชิกของคุณกำกับ เพื่อป้องกันการแชร์เนื้อหา</p>
      </div>

      {/* โหมดแอดมิน */}
      <div className="text-center">
        {admin ? (
          <div className="card p-3 space-y-2">
            <p className="text-xs text-accent-soft font-semibold">🛡️ โหมดแอดมินทำงานอยู่ — ลายน้ำไม่แสดงทุกหน้า</p>
            <button className="btn-ghost !py-1 !px-3 text-xs" onClick={() => adminLogout()}>
              ออกจากโหมดแอดมิน
            </button>
          </div>
        ) : showAdmin ? (
          <div className="card p-3 space-y-2">
            <input
              className="input text-center"
              placeholder="รหัสแอดมิน (ของเจ้าของเว็บ)"
              type="password"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAdmin()}
              autoFocus
            />
            <div className="flex gap-2 justify-center">
              <button className="btn-primary !py-1.5 !px-4 text-xs" onClick={submitAdmin} disabled={adminBusy || !adminCode.trim()}>
                {adminBusy ? "กำลังตรวจ…" : "เปิดโหมดแอดมิน"}
              </button>
              <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={() => { setShowAdmin(false); setAdminErr(""); }}>
                ยกเลิก
              </button>
            </div>
            <p className="text-[10px] text-zinc-600">ใช้หน้าเว็บโดยไม่ติดลายน้ำรายสมาชิก (สำหรับอัดวิดีโอ/แคปภาพ)</p>
            {adminErr && <p className="text-xs text-down">{adminErr}</p>}
          </div>
        ) : (
          <button className="text-[11px] text-zinc-700 hover:text-zinc-500 underline underline-offset-2" onClick={() => setShowAdmin(true)}>
            สำหรับแอดมิน
          </button>
        )}
      </div>
    </div>
  );
}
