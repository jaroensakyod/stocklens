import plansJson from "@/data/plans.json";
import Link from "next/link";

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
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-50">🔓 StockLens VIP</h1>
        <p className="text-sm text-zinc-400 mt-2 max-w-2xl mx-auto leading-relaxed">
          รับการวิเคราะห์ระดับมืออาชีพทุกวันผ่าน <span className="text-accent-soft">กลุ่ม Facebook ปิด</span> — จ่ายด้วย PromptPay แล้วแอดมินเชิญเข้ากลุ่มภายใน 24 ชม.
        </p>
      </div>

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
            <div className="mt-4">
              <span className="num text-4xl font-bold text-accent-soft">{p.priceMonthly.toLocaleString()}</span>
              <span className="text-sm text-zinc-500 ml-1">{p.priceNote}</span>
            </div>
            <ul className="mt-5 space-y-2 flex-1">
              {p.features.map((f) => (
                <li key={f} className="text-sm text-zinc-300 flex gap-2">
                  <span className="text-up">✓</span>
                  {f}
                </li>
              ))}
              {p.notFeatures.map((f) => (
                <li key={f} className="text-sm text-zinc-600 flex gap-2">
                  <span>✕</span>
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

      <div className="card p-6 max-w-4xl mx-auto">
        <h3 className="font-bold text-zinc-100">💳 วิธีชำระเงิน (PromptPay)</h3>
        <ol className="list-decimal ml-5 mt-3 space-y-1.5 text-sm text-zinc-300">
          <li>โอนเงินผ่าน PromptPay: <span className="num text-accent-soft font-semibold">{promptpayId}</span> ({promptpayName})</li>
          <li>ส่งสลิป + ชื่อ Facebook ของคุณมาที่ Inbox เพจ (หรือช่องทางที่แจ้งไว้)</li>
          <li>แอดมินตรวจสอบและเชิญเข้ากลุ่มสมาชิกตามแพ็กเกจภายใน 24 ชม.</li>
          <li>หมดอายุทุกสิ้นเดือนถัดไป — ต่ออายุเช่นเดิม</li>
        </ol>
        <p className="text-xs text-zinc-500 mt-4 leading-relaxed">{disclaimer}</p>
      </div>

      <p className="text-center text-sm text-zinc-500">
        อยากเห็นฝีมือก่อนจ่าย? ดู <Link href="/track-record" className="link">Track Record สาธารณะ</Link> หรือลองเครื่องมือฟรีทั้งหมดบนเว็บ
      </p>
    </div>
  );
}
