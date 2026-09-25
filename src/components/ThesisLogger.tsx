"use client";

import { useState } from "react";

// บันทึกสมมติฐานจากหน้าหุ้นลง Track Record สาธารณะ (ปิดวงจร: วิเคราะห์ → เดิมพัน → ติดตามผล)
export default function ThesisLogger({ ticker, prefilled }: { ticker: string; prefilled: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(true);
  const [thesis, setThesis] = useState(prefilled);
  const [stance, setStance] = useState<"bullish" | "bearish" | "neutral">("bullish");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  const save = async () => {
    setState("saving");
    try {
      const res = await fetch("/api/admin/track-record", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-code": code },
        body: JSON.stringify({ thesis, tickers: [ticker], stance }),
      });
      if (res.status === 401) {
        setState("error");
        return;
      }
      if (!res.ok) throw new Error();
      sessionStorage.setItem("sl-admin", code);
      setState("done");
      setTimeout(() => setOpen(false), 1500);
    } catch {
      setState("error");
    }
  };

  return (
    <div className="card p-4">
      <button className="text-sm font-bold text-zinc-100 w-full text-left" onClick={() => setOpen((v) => !v)}>
        📝 บันทึกสมมติฐานลง Track Record {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {needCode && (
            <div className="flex gap-2">
              <input
                className="input"
                type="password"
                placeholder="รหัสแอดมิน (ค่าเริ่มต้น stocklens-admin)"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (sessionStorage.getItem("sl-admin")) setNeedCode(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code) {
                    if (sessionStorage.getItem("sl-admin") === code) setNeedCode(false);
                    else save();
                  }
                }}
              />
            </div>
          )}
          <textarea
            className="input min-h-20"
            placeholder="สมมติฐาน: ถ้าอะไรเกิดขึ้น หุ้นนี้จะไปทางไหน"
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
          />
          <div className="flex gap-2 items-center">
            <select className="input !w-36" value={stance} onChange={(e) => setStance(e.target.value as "bullish" | "bearish" | "neutral")}>
              <option value="bullish">มองบวก</option>
              <option value="bearish">มองลบ</option>
              <option value="neutral">กลาง/เฝ้าดู</option>
            </select>
            <button className="btn-primary flex-1" onClick={save} disabled={state === "saving" || !thesis.trim()}>
              {state === "saving" ? "กำลังบันทึก…" : state === "done" ? "✓ บันทึกแล้ว — ไป Track Record" : "บันทึก (status: ยังเปิด)"}
            </button>
          </div>
          {state === "error" && <p className="text-xs text-down">รหัสไม่ถูกต้อง หรือบันทึกไม่สำเร็จ</p>}
          <p className="text-[10px] text-zinc-600">
            บันทึกแล้วจะขึ้นหน้า /track-record ทันทีในฐานะ &ldquo;ยังเปิดอยู่&rdquo; — เมื่อถึงเวลาอัปเดตผล (win/loss) ที่ src/data/track-record.json · นี่คือเครื่องมือสร้างความน่าเชื่อถือสาธารณะ
          </p>
        </div>
      )}
    </div>
  );
}
