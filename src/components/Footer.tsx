import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-base-700/60 mt-10">
      <div className="max-w-7xl mx-auto px-4 py-6 text-xs text-zinc-500 space-y-2">
        <div className="flex flex-wrap gap-4">
          <Link href="/about" className="hover:text-zinc-300">เกี่ยวกับ & Methodology</Link>
          <Link href="/pricing" className="hover:text-zinc-300">สมัคร VIP</Link>
          <Link href="/track-record" className="hover:text-zinc-300">Track Record</Link>
        </div>
        <p>
          ข้อมูลราคา/งบการเงินจาก Yahoo Finance (delay ~15 นาที) · StockLens เป็นสื่อบทวิเคราะห์เชิงข้อมูลเพื่อการศึกษา
          ไม่ใช่คำแนะนำการลงทุนเฉพาะบุคคล การลงทุนมีความเสี่ยง ผู้ลงทุนควรศึกษาข้อมูลให้ครบถ้วนก่อนตัดสินใจ
        </p>
      </div>
    </footer>
  );
}
