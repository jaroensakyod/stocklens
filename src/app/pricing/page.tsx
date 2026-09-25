import plansJson from "@/data/plans.json";
import Link from "next/link";

// ตารางเทียบสิทธิ์ 3 ระดับ — "คนจ่ายต้องได้มากกว่าเห็นชัด"
const COMPARE: { label: string; free: string; starter: string; pro: string }[] = [
  { label: "ข้อมูลตลาด 30 ประเทศ · ทุกหน้าเว็บ · พอร์ตมือใหม่รายวัน", free: "✓", starter: "✓", pro: "✓" },
  { label: "Watchlist + พอร์ต + แจ้งเตือนราคา (เก็บในเครื่อง)", free: "✓", starter: "✓", pro: "✓" },
  { label: "💬 แชท AI ถามได้ทุกอย่าง (12 หัวข้อ ตอบจากข้อมูลจริง)", free: "—", starter: "✓", pro: "✓ เจาะลึก" },
  { label: "AI วิเคราะห์หุ้นรายตัว มุมมองนักวิเคราะห์ + สรุปข่าวไทย", free: "—", starter: "✓", pro: "✓" },
  { label: "Daily Brief ภาคเช้า + Weekly ย่อ + กลุ่ม Facebook", free: "—", starter: "✓", pro: "✓" },
  { label: "🦈 AI 5 มุมมอง (Burry · Buffett · Lynch · ภูมิรัฐศาสตร์)", free: "—", starter: "—", pro: "✓" },
  { label: "🤖 AI ปรับพอร์ตส่วนตัว + พิสูจน์ผลย้อนหลัง 3 ปี", free: "—", starter: "—", pro: "✓" },
  { label: "⚡ Flash Report 24 ชม. + LINE ส่วนตัว (เหตุการณ์ + watchlist รายวัน)", free: "—", starter: "—", pro: "✓" },
  { label: "Deep Dive PDF + Weekly เต็ม + Live Q&A + Track Record เต็ม", free: "—", starter: "—", pro: "✓" },
];

function Cell({ v }: { v: string }) {
  if (v === "✓") return <span className="text-up">✓</span>;
  if (v === "—") return <span className="text-zinc-600">—</span>;
  return <span className="text-accent font-bold text-[11px]">{v}</span>;
}

export default function PricingPage() {
  const { plans, disclaimer } = plansJson as {
    plans: { id: string; name: string; emoji: string; priceMonthly: number; priceNote: string; tagline: string; features: string[]; notFeatures: string[] }[];
    disclaimer: string;
  };
  const promptpayName = process.env.NEXT_PUBLIC_PROMPTPAY_NAME || "StockLens";
  const promptpayId = process.env.NEXT_PUBLIC_PROMPTPAY_ID || "08x-xxx-xxxx";
  const fbStarter = process.env.NEXT_PUBLIC_FB_STARTER_URL;
  const fbPro = process.env.NEXT_PUBLIC_FB_PRO_URL;

  return (
    <div className="space-y-10">
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-50">🔓 StockLens VIP</h1>
        <p className="text-sm text-zinc-400 mt-2 max-w-2xl mx-auto leading-relaxed">
          สมาชิกได้ <span className="text-accent-soft">ทั้ง AI บนเว็บ + รายงานรายวันในกลุ่ม Facebook ปิด</span> — จ่ายด้วย PromptPay แล้วแอดมินออกรหัสเข้าเว็บ + เชิญเข้ากลุ่มภายใน 24 ชม.
        </p>
      </div>

      {/* ฟรีได้อะไรก่อน — ทำให้เห็นว่าจ่ายแล้วได้ "เพิ่ม" อะไร */}
      <div className="card p-4 max-w-4xl mx-auto text-center">
        <p className="text-xs text-zinc-400">
          🆓 <b className="text-zinc-200">ไม่จ่ายก็ใช้ได้:</b> ข้อมูล 30 ตลาด · พอร์ตตัวอย่างมือใหม่รายวัน · watchlist/แจ้งเตือนราคา — แต่ไม่มี AI วิเคราะห์และรายงานประจำวัน
        </p>
      </div>

      {/* การ์ดแพ็กเกจ */}
      <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
        {plans.map((p) => (
          <div key={p.id} className={`card p-6 flex flex-col ${p.id === "pro" ? "border-accent/50 relative" : ""}`}>
            {p.id === "pro" && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 chip bg-accent text-zinc-950 font-bold">แนะนำ · คุ้มสุด</span>
            )}
            <div className="flex items-center gap-2">
              <span className="text-2xl">{p.emoji}</span>
              <h2 className="text-xl font-bold text-zinc-50">{p.name}</h2>
            </div>
            <p className="text-sm text-zinc-400 mt-1">{p.tagline}</p>
            <div className="mt-4 flex items-end gap-2">
              <span className="num text-4xl font-bold text-accent-soft">{p.priceMonthly.toLocaleString()}</span>
              <span className="text-sm text-zinc-500 mb-1">{p.priceNote}</span>
              <span className="text-[11px] text-zinc-500 mb-1">≈ {(p.priceMonthly / 30).toFixed(0)}฿/วัน</span>
            </div>
            <ul className="mt-5 space-y-2 flex-1">
              {p.features.map((f) => (
                <li key={f} className="text-sm text-zinc-300 flex gap-2">
                  <span className="text-up shrink-0">✓</span>
                  {f}
                </li>
              ))}
              {p.notFeatures.map((f) => (
                <li key={f} className="text-sm text-zinc-600 flex gap-2">
                  <span className="shrink-0">✕</span>
                  {f}
                </li>
              ))}
            </ul>
            {p.id === "pro" ? (
              fbPro ? (
                <a href={fbPro} className="btn-primary mt-6">🥇 สมัคร Pro</a>
              ) : (
                <span className="btn-primary mt-6 cursor-default">🥇 สมัคร Pro</span>
              )
            ) : fbStarter ? (
              <a href={fbStarter} className="btn-ghost mt-6">สมัคร Starter</a>
            ) : (
              <span className="btn-ghost mt-6 cursor-default">สมัคร Starter</span>
            )}
          </div>
        ))}
      </div>

      {/* ตารางเทียบ — เห็นชัดว่าจ่ายแล้วได้อะไรเพิ่ม */}
      <section className="max-w-4xl mx-auto">
        <h2 className="text-sm font-bold text-zinc-400 mb-3 text-center">เทียบทุกระดับก่อนตัดสินใจ</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-xs min-w-[560px]">
            <thead>
              <tr className="border-b border-base-700 text-zinc-500">
                <th className="text-left py-2.5 px-3 font-medium">ฟีเจอร์</th>
                <th className="py-2.5 px-3 font-medium">🆓 ฟรี</th>
                <th className="py-2.5 px-3 font-medium">🥉 Starter</th>
                <th className="py-2.5 px-3 font-medium">🥇 Pro</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.label} className="border-b border-base-700/40">
                  <td className="py-2.5 px-3 text-zinc-300">{row.label}</td>
                  <td className="py-2.5 px-3 text-center"><Cell v={row.free} /></td>
                  <td className="py-2.5 px-3 text-center"><Cell v={row.starter} /></td>
                  <td className="py-2.5 px-3 text-center"><Cell v={row.pro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="card p-6 max-w-4xl mx-auto">
        <h3 className="font-bold text-zinc-100">💳 วิธีชำระเงิน (PromptPay)</h3>
        <ol className="list-decimal ml-5 mt-3 space-y-1.5 text-sm text-zinc-300">
          <li>โอนเงินผ่าน PromptPay: <span className="num text-accent-soft font-semibold">{promptpayId}</span> ({promptpayName})</li>
          <li>ส่งสลิป + ชื่อ Facebook ของคุณมาที่ Inbox เพจ (หรือช่องทางที่แจ้งไว้)</li>
          <li>แอดมินออก <b className="text-zinc-100">รหัสสมาชิกเข้าเว็บ</b> ให้ทันที + เชิญเข้ากลุ่มสมาชิกตามแพ็กเกจภายใน 24 ชม.</li>
          <li>หมดอายุทุกสิ้นเดือนถัดไป — ต่ออายุเช่นเดิม (ราคาเดิมลูกค้าเก่าถามแอดมิน)</li>
        </ol>
        <p className="text-xs text-zinc-500 mt-4 leading-relaxed">{disclaimer}</p>
      </div>

      <p className="text-center text-sm text-zinc-500">
        อยากเห็นฝีมือก่อนจ่าย? ดู <Link href="/track-record" className="link">Track Record สาธารณะ</Link> หรือลองเครื่องมือฟรีทั้งหมดบนเว็บ
      </p>
    </div>
  );
}
