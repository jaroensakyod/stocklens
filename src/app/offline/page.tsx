import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
      <span className="text-5xl">📡</span>
      <h1 className="text-xl font-bold text-zinc-50">ออฟไลน์อยู่</h1>
      <p className="text-sm text-zinc-400 max-w-sm leading-relaxed">
        ราคาหุ้นต้องใช้อินเทอร์เน็ตสด — เชื่อมต่อเน็ตแล้วลองใหม่ หน้าที่เคยเปิดจะยังใช้ได้บางส่วนจาก cache
      </p>
      <Link href="/" className="btn-primary">กลับหน้าแรก</Link>
    </div>
  );
}
