"use client";

// 🚧 Disclaimer Gate — popup แจ้งเตือนครั้งแรกที่เข้าเว็บ (ไทย + อังกฤษ) ตามมาตรฐานเว็บการเงินไทย
// ยอมรับครั้งเดียวต่อเบราว์เซอร์ (localStorage) — กด "คำเตือนการลงทุน" ท้ายหน้าเว็บเพื่อเปิดซ้ำได้
import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "sl-disclaimer-ok-v1";

export default function DisclaimerGate() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // เปิดเองถ้ายังไม่เคยยอมรับ / หรือถูกขอผ่าน custom event จาก footer
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {}
    setReady(true);
    const onAsk = () => setOpen(true);
    window.addEventListener("sl-show-disclaimer", onAsk);
    return () => window.removeEventListener("sl-show-disclaimer", onAsk);
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setOpen(false);
  };

  if (!ready || !open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="คำเตือนการลงทุน">
      <div className="card max-w-lg w-full p-6 border border-amber-500/30 max-h-[90vh] overflow-y-auto">
        <div className="text-center">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-bold text-zinc-50 mt-2">คำเตือนก่อนใช้งาน StockLens</h2>
          <p className="text-[11px] text-zinc-600">Investment Disclaimer & Cookie Notice</p>
        </div>

        <div className="mt-4 space-y-3 text-[12.5px] leading-relaxed">
          <div className="text-zinc-300">
            <b className="text-zinc-100">🇹🇭 เว็บไซต์นี้เป็นสื่อบทวิเคราะห์ข้อมูลเพื่อการศึกษาเท่านั้น</b> มิใช่คำแนะนำการลงทุนเฉพาะบุคคล
            และมิใช่คำเชิงชวนให้ซื้อหรือขายหลักทรัพย์ใด ๆ ผู้จัดทำมิได้เป็นบริษัทหลักทรัพย์ ตัวแทนจำหน่ายหลักทรัพย์ หรือที่ปรึกษาการลงทุนที่ขึ้นทะเบียนกับสำนักงาน
            ก.ล.ต. (Thai SEC)
            <br />
            <span className="text-zinc-400">
              การลงทุนมีความเสี่ยง ผู้ลงทุนอาจสูญเสียเงินต้นทั้งจำนวนหรือบางส่วน ผลการดำเนินงานในอดีตไม่เป็นสิ่งยืนยันถึงผลในอนาคต การตัดสินใจลงทุนทั้งหมดเป็นดุลยพินิจของท่านเอง
              และเราจะไม่รับผิดชอบต่อความเสียหายใด ๆ ทั้งทางตรงและทางอ้อม ที่เกิดจากการใช้ข้อมูลบนเว็บไซต์นี้
            </span>
          </div>
          <div className="text-zinc-400 border-t border-base-700/60 pt-3">
            <b className="text-zinc-200">🇬🇧 This website provides data-driven educational content only</b> — it is not personalized investment advice and not a
            solicitation to buy or sell any securities. We are not a licensed securities dealer or a SEC-registered investment adviser.
            <br />
            <span className="text-zinc-500">
              Investing involves risk, including possible loss of principal. Past performance does not guarantee future results. All investment decisions are your
              own, and we assume no liability, direct or indirect, for any loss arising from the use of this website.
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 border-t border-base-700/60 pt-3">
            🍪 เราใช้เพียงคุกกี้และพื้นที่จัดเก็บในเครื่อง (localStorage) ที่จำเป็นต่อการทำงานของเว็บ เช่น การจำสถานะเข้าสู่ระบบและ watchlist ไม่มีการเก็บข้อมูลเพื่อโฆษณา ·
            We use only strictly necessary cookies/localStorage (e.g. login session, watchlist). No advertising trackers.{" "}
            <Link href="/privacy" className="text-accent-soft underline underline-offset-2">
              อ่านนโยบายความเป็นส่วนตัว PDPA / Privacy Policy
            </Link>
          </div>
        </div>

        <button onClick={accept} className="btn-primary w-full mt-5">
          ฉันเข้าใจและยอมรับ · I understand and agree
        </button>
        <p className="text-[10px] text-zinc-600 text-center mt-2">กดยอมรับครั้งเดียวต่อเบราว์เซอร์นี้ — เปิดอ่านซ้ำได้ที่ลิงก์ &ldquo;คำเตือนการลงทุน&rdquo; ด้านล่างของทุกหน้า</p>
      </div>
    </div>
  );
}
