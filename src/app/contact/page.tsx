import Link from "next/link";

export const metadata = { title: "ติดต่อเรา" };

// 📮 ติดต่อเรา — ช่องทางหลัก (คู่แข่งมีหน้านี้ เราเพิ่ม + ชี้ไปศูนย์ช่วยเหลือ/ตั๋วของเราที่ลึกกว่า)
export default function ContactPage() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@stocklens.app";
  const facebook = process.env.NEXT_PUBLIC_FB_GROUP_URL || "https://www.facebook.com/";
  const line = process.env.NEXT_PUBLIC_LINE_ADD_URL;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">📮 ติดต่อเรา</h1>
        <p className="text-sm text-zinc-400 mt-1">มีคำถามหรือข้อเสนอแนะ? เลือกช่องทางที่สะดวก</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <a href={facebook} target="_blank" rel="noopener noreferrer" className="card p-5 hover:border-accent/40 transition-colors">
          <h2 className="text-base font-bold text-zinc-100">👥 Facebook</h2>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">ช่องทางหลัก — ตอบเร็วสุด + กลุ่มสมาชิกพูดคุยกัน + Daily Brief ประจำวัน</p>
          <span className="chip bg-base-800 text-accent-soft border border-base-700 mt-3 inline-block">ทักแชทเพจ →</span>
        </a>
        <a href={`mailto:${email}`} className="card p-5 hover:border-accent/40 transition-colors">
          <h2 className="text-base font-bold text-zinc-100">✉️ อีเมล</h2>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">เรื่องที่ต้องการรายละเอียดยาว แนบสลิป/เอกสารได้</p>
          <span className="chip bg-base-800 text-accent-soft border border-base-700 mt-3 num inline-block">{email}</span>
        </a>
        {line && (
          <a href={line} target="_blank" rel="noopener noreferrer" className="card p-5 hover:border-accent/40 transition-colors">
            <h2 className="text-base font-bold text-zinc-100">💬 LINE</h2>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">สมาชิก Pro — เพิ่ม LINE Official เพื่อรับ Flash Report + สรุป watchlist รายวัน</p>
            <span className="chip bg-base-800 text-accent-soft border border-base-700 mt-3 inline-block">เพิ่มเพื่อน →</span>
          </a>
        )}
        <Link href="/dashboard/support" className="card p-5 hover:border-accent/40 transition-colors">
          <h2 className="text-base font-bold text-zinc-100">🆘 ศูนย์ช่วยเหลือ</h2>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">คำถามที่พบบ่อย + แจ้งปัญหาเป็นตั๋ว (สมาชิกติดตามสถานะได้)</p>
          <span className="chip bg-base-800 text-accent-soft border border-base-700 mt-3 inline-block">เข้าศูนย์ช่วยเหลือ →</span>
        </Link>
      </div>

      <p className="text-[11px] text-zinc-600 leading-relaxed">
        StockLens เป็นสื่อวิเคราะห์ข้อมูลการลงทุน ไม่ใช่โบรกเกอร์ ไม่มีรับฝากเงิน/คำสั่งซื้อขาย —
        ตัวเลขทั้งหมดมาจากแหล่งสาธารณะ (SEC EDGAR · Yahoo Finance · TradingView) · การลงทุนมีความเสี่ยง
      </p>
    </div>
  );
}
