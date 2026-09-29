import Link from "next/link";
import LogoMark from "./LogoMark";

// Footer มาตรฐานเว็บการเงิน — คอลัมน์ลิงก์ + คำเตือนครบ (ไทย/อังกฤษ) + copyright
const COLS: { title: string; links: { href: string; label: string; ext?: boolean }[] }[] = [
  {
    title: "เครื่องมือ",
    links: [
      { href: "/", label: "หน้าแรก · ภาพรวมตลาด" },
      { href: "/starter", label: "พอร์ตมือใหม่รายวัน" },
      { href: "/screener", label: "คัดกรองหุ้น" },
      { href: "/radar", label: "🌍 Global Radar" },
      { href: "/dividend", label: "ปฏิทินปันผล/XD" },
      { href: "/politics", label: "ข่าวการเมือง × หุ้น" },
    ],
  },
  {
    title: "วิเคราะห์",
    links: [
      { href: "/surge", label: "🚀 เรดาร์หุ้นซิ่ง" },
      { href: "/value", label: "🤿 หุ้นใต้น้ำ vs แพงเกินตัว" },
      { href: "/model-portfolio", label: "💼 พอร์ตจำลอง AI" },
      { href: "/supernova", label: "🛰️ Supernova มหภาค" },
      { href: "/gurus", label: "🐋 กูรู 13F" },
      { href: "/timemachine", label: "⏳ Time Machine" },
    ],
  },
  {
    title: "เกี่ยวกับเรา",
    links: [
      { href: "/about", label: "เกี่ยวกับ & Methodology" },
      { href: "/pricing", label: "สมัครสมาชิก VIP" },
      { href: "/dashboard/products", label: "👑 สิทธิ์ของฉัน" },
      { href: "/track-record", label: "🏆 Track Record สาธารณะ" },
      { href: "/login", label: "เข้าสู่ระบบสมาชิก" },
      { href: "/dashboard/support", label: "🆘 ศูนย์ช่วยเหลือ" },
      { href: "/contact", label: "📮 ติดต่อเรา" },
    ],
  },
  {
    title: "ข้อกฎหมาย & ความเป็นส่วนตัว",
    links: [
      { href: "/privacy", label: "นโยบายความเป็นส่วนตัว (PDPA)" },
      { href: "/privacy#cookies", label: "นโยบายคุกกี้" },
      { href: "/terms", label: "ข้อกำหนดการใช้บริการ" },
      { href: "/terms#disclaimer", label: "⚠️ คำเตือนการลงทุน" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-base-700/60 mt-10 bg-base-900/40">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* แถวบน: แบรนด์ + คอลัมน์ลิงก์ */}
        <div className="grid gap-8 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <LogoMark size={28} />
              <span className="font-bold text-zinc-100">StockLens</span>
            </Link>
            <p className="text-[11px] text-zinc-500 leading-relaxed mt-3">
              สื่อบทวิเคราะห์หุ้นเชิงข้อมูล 30 ตลาด — คะแนนปัจจัย 5 มิติจากงบจริง · AI วิเคราะห์ภาษาไทย · Global Radar แปลงเหตุการณ์โลกเป็นหุ้นที่ได้/เสียประโยชน์
            </p>
            <p className="text-[10px] text-zinc-600 mt-3">แหล่งข้อมูล: Yahoo Finance · SET · SEC EDGAR · Google News</p>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <div className="text-xs font-bold text-zinc-300 mb-2.5">{c.title}</div>
              <ul className="space-y-1.5">
                {c.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="text-[11.5px] text-zinc-500 hover:text-zinc-200 transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* แถบคำเตือน */}
        <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[10.5px] text-zinc-500 leading-relaxed space-y-1.5">
          <p>
            <span className="text-amber-400 font-semibold">⚠️ คำเตือน:</span> StockLens เป็นสื่อบทวิเคราะห์เชิงข้อมูลเพื่อการศึกษา มิใช่คำแนะนำการลงทุนเฉพาะบุคคลและมิใช่คำเชิงชวนซื้อขายหลักทรัพย์
            ผู้จัดทำมิได้เป็นบริษัทหลักทรัพย์ ตัวแทนจำหน่ายหลักทรัพย์ หรือที่ปรึกษาการลงทุนที่ขึ้นทะเบียนกับสำนักงาน ก.ล.ต. การลงทุนมีความเสี่ยง
            ผู้ลงทุนอาจสูญเสียเงินต้น และผลในอดีตไม่รับประกันผลในอนาคต — เราไม่รับผิดชอบต่อความเสียหายใด ๆ ที่เกิดจากการใช้ข้อมูลบนเว็บไซต์นี้
          </p>
          <p className="text-zinc-600">
            This website is for educational and informational purposes only and is not personalized investment advice or a solicitation to trade securities. We are
            not a licensed securities dealer or SEC-registered investment adviser. Investing involves risk of loss; we assume no liability for any damages arising
            from use of this website.
          </p>
        </div>

        {/* แถวล่าง */}
        <div className="mt-5 pt-4 border-t border-base-700/50 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-zinc-600">
          <span>
            © {new Date().getFullYear()} StockLens · จัดทำในประเทศไทย เพื่อการศึกษา · ไม่มีระบบรับฝากเงิน/ซื้อขายหุ้นแทนผู้ใช้ และจะไม่ขอรหัสบัญชีหรือรหัสโบรกเกอร์ทุกกรณี
          </span>
          <span className="num">Data delayed ~15 min · ข้อมูลอ้างอิงอาจคลาดเคลื่อน — ตรวจสอบกับแหล่งทางการก่อนตัดสินใจ</span>
        </div>
      </div>
    </footer>
  );
}
