"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";

// 🔐 เข้าสู่ระบบสมาชิก — ด้วยรหัสที่แอดมินออกให้ (SL-XXXXXX) ไม่ต้องมีรหัสผ่าน
export default function LoginPage() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setErr("");
    const r = await login(code);
    setBusy(false);
    if (r.ok) router.push("/");
    else setErr(r.error || "เข้าสู่ระบบไม่สำเร็จ");
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
    </div>
  );
}
