import Link from "next/link";

// 404 ระดับ app — ชี้นำไปหน้าที่คนใช้บ่อยแทนการทิ้งไว้แบบเปล่า (แนวเดียวกับคู่แข่ง แต่เพิ่มค้นหา)
export default function NotFound() {
  const links = [
    { href: "/", label: "หน้าแรก", desc: "สรุปตลาด + ข่าว + Daily Picks ล่าสุด" },
    { href: "/screener", label: "คัดกรองหุ้น", desc: "preset กลยุทธ์ 16 แบบ + ธีมร้อน 30 ตลาด" },
    { href: "/portfolio", label: "พอร์ตของฉัน", desc: "จัดสมดุล + X-ray + AI ปรับพอร์ต + แจ้งเตือน" },
    { href: "/compare", label: "เปรียบเทียบหุ้น", desc: "70+ ตัวชี้วัด ข้ามตลาด พร้อม AI สรุป" },
    { href: "/gurus", label: "พอร์ตกูรู 13F", desc: "ส่องหุ้นที่เซียนโลกถือ สดจาก SEC" },
    { href: "/calendar", label: "ปฏิทินเศรษฐกิจ", desc: "CPI · NFP · FOMC เวลาไทย" },
  ];
  return (
    <div className="max-w-2xl mx-auto py-10 text-center">
      <p className="text-6xl mb-3">🧭</p>
      <h1 className="text-2xl font-bold text-zinc-50">ไม่พบหน้าที่คุณกำลังมองหา</h1>
      <p className="text-sm text-zinc-400 mt-2">หน้านี้อาจย้ายไปแล้ว หรือพิมพ์ URL คลาดเคลื่อน — ลองค้นหาจากช่องค้นหาด้านบน หรือไปหน้ายอดนิยมเหล่านี้</p>
      <div className="grid sm:grid-cols-2 gap-3 mt-6 text-left">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="card p-4 hover:border-accent/40 transition-colors">
            <div className="text-sm font-bold text-zinc-100">{l.label}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{l.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
