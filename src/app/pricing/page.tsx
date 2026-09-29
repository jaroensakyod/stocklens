import plansJson from "@/data/plans.json";
import Link from "next/link";

// ตารางเทียบสิทธิ์ 3 ระดับ — บอก "ได้เท่าไหร่" เป็นตัวเลข (แนวการใช้งานปกติ ไม่ใช่มิเตอร์ตัดกลางคัน)
const COMPARE: { label: string; free: string; starter: string; pro: string }[] = [
  { label: "ข้อมูล 30 ตลาด · Screener 16 preset + ธีมร้อนวันนี้ · กราฟเทคนิคเต็ม · ปฏิทินเศรษฐกิจ+งบ Q", free: "✓", starter: "✓", pro: "✓" },
  { label: "📰 ข่าวสด แปลไทยอัตโนมัติ + ป้าย 🟢บวก/🔴ลบ (Jev) + หุ้นที่กระทบ", free: "✓", starter: "✓", pro: "✓" },
  { label: "🧭 เทียบหุ้นกับอุตสาหกรรมเดียวกัน (เกรด S-D · 19 เมตริก · ได้ทั้งในตลาด/ทั่วโลก)", free: "✓", starter: "✓", pro: "✓" },
  { label: "🐋 พอร์ตกูรู 13F สดจาก SEC 19 สถาบัน + เซียนถือร่วมกัน + ใครถือหุ้นตัวไหน", free: "✓", starter: "✓", pro: "✓" },
  { label: "⚔️ เทียบหุ้น 70+ เมตริก + radar คะแนนปัจจัย + 🧭 Balance Score + แผนปรับสมดุลพอร์ต", free: "✓", starter: "✓", pro: "✓" },
  { label: "Watchlist + 💜 หุ้นโปรด + พอร์ต + แจ้งเตือนราคา", free: "✓ เครื่องเดียว", starter: "✓ ซิงก์ข้ามเครื่อง", pro: "✓ ซิงก์ข้ามเครื่อง" },
  { label: "🧑‍🎓 AI ผสมพอร์ตมือใหม่ (Jev คัดตัว + AI อธิบาย)", free: "~10 ครั้ง/วัน", starter: "✓", pro: "✓" },
  { label: "🧠 AI สรุปอ่านง่าย 8 จุดบนหน้าหุ้น (Gemini เขียน + Jev ตรวจ)", free: "ลองได้ (จำกัดอัตรา)", starter: "✓", pro: "✓" },
  { label: "💬 แชท AI ถามได้ทุกอย่าง (ตอบจากข้อมูลจริง รวมเกรดเทียบกลุ่ม+เซียนที่ถือ)", free: "—", starter: "~100 คำถาม/เดือน", pro: "~300/เดือน + โหมดเจาะลึก" },
  { label: "AI วิเคราะห์หุ้นรายตัวเต็ม + สรุปข่าวละเอียด", free: "—", starter: "~60 ครั้ง/เดือน", pro: "~200 ครั้ง/เดือน" },
  { label: "Daily Brief ภาคเช้า + Weekly + กลุ่ม Facebook + 🎫 ตั๋วสนับสนุน", free: "—", starter: "✓ ทุกวันทำการ", pro: "✓ + Weekly เต็ม" },
  { label: "🦈 AI 5 มุมมอง (Burry · Buffett · Lynch · ภูมิรัฐศาสตร์)", free: "—", starter: "—", pro: "~40 หุ้น/เดือน" },
  { label: "🤖 AI ปรับพอร์ตส่วนตัว + พิสูจน์ย้อนหลัง 3 ปี · 🧪 ตามกูรูย้อนหลัง 3 ปี", free: "—", starter: "—", pro: "✓" },
  { label: "⚡ Flash Report 24 ชม. + Deep Dive PDF + Live Q&A", free: "—", starter: "—", pro: "✓" },
  { label: "📲 LINE ส่วนตัว: Flash + สรุป watchlist รายวันพร้อม 🐋 ท่าทีเซียน 13F", free: "—", starter: "—", pro: "✓" },
];

function Cell({ v }: { v: string }) {
  if (v === "✓") return <span className="text-up">✓</span>;
  if (v === "—") return <span className="text-zinc-600">—</span>;
  return <span className="text-accent font-bold text-[11px] whitespace-nowrap">{v}</span>;
}

const FAQ: [string, string][] = [
  [
    "ฟรีได้จริงไหม หรือแค่ล่อ?",
    "ได้จริง — ทุกหน้าข้อมูล 30 ตลาด เทียบหุ้นกับอุตสาหกรรม พอร์ตกูรู 13F สด เทียบหุ้น 70+ เมตริก Balance Score ข่าวแปลไทยอัตโนมัติ และลอง AI ได้เลย ไม่ต้องสมัคร ไม่ต้องรหัส ของที่เป็นของสมาชิกคือ AI ตัวหลัก (แชท/วิเคราะห์รายตัว) ที่ต้นทุนต่อครั้งสูงกว่า",
  ],
  [
    "เว็บนี้ต่างจากเว็บข่าวหุ้นทั่วไปยังไง?",
    "ทุกตัวเลขดึงจากแหล่งจริง (SEC EDGAR · Yahoo Finance · TradingView) ไม่มีมนุษย์เลือกข่าวให้คุณเห็น · ทุกชิ้นข่าวผ่าน AI 2 ชั้น: Gemini แปล/สรุป + Jev ตรวจว่าตรงตัวเลขไหม โทนเอียงไปไหน · และทุกคำแนะนำของระบบมี Track Record สาธารณะให้ตรวจ",
  ],
  [
    "ตัวเลข \"~100 คำถาม/เดือน\" คืออะไร เกินแล้วโดนตัดไหม?",
    "เป็นแนวการใช้งานปกติ (fair use) ไม่ใช่มิเตอร์นับถอยหลัง ไม่มีการตัดกลางคัน — คนใช้เองแทบไม่มีทางแตะเพดาน ตั้งไว้กันสคริปต์/bot ยิงรัวเท่านั้น ถ้าใช้เกินปกติมากเราจะทักไปคุยก่อนเสมอ",
  ],
  [
    "ราคาคิดมาจากอะไร?",
    "คิดจากต้นทุน AI จริงต่อการใช้งาน (ดูกล่อง \"ทำไมราคานี้คุ้ม\" ด้านบน) — งานตรวจคะแนนใช้ Jev ที่ถูกมาก งานเขียนบทใช้ Gemini เฉพาะจุดที่คุ้ม และแปลข่าวแบบแชร์แคชทั้งเว็บ สมาชิกใช้หนักทั้งเดือนต้นทุนยังต่ำกว่าค่าสมาชิก 3-5 เท่า ราคาจึงยั่งยืนโดยไม่ต้องอั้นการใช้งานของคนจริง",
  ],
  ["จ่ายยังไง ต่ออายุยังไง?", "PromptPay ตามขั้นตอนด้านล่าง แอดมินออกรหัสภายใน 24 ชม. · หมดอายุทุกสิ้นเดือนถัดไป ต่ออายุเช่นเดิม (ราคาเดิมลูกค้าเก่าถามแอดมิน) · ใส่รหัสใหม่ได้เองที่หน้า 👑 สิทธิ์ของฉัน"],
];

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
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-50">เลือกใช้ตามจริง — <span className="text-accent">ฟรีก็ครบเครื่องมือ จ่ายเพื่อ AI</span></h1>
        <p className="text-sm text-zinc-400 mt-2 max-w-2xl mx-auto leading-relaxed">
          ข้อมูลตลาดทั้งเว็บใช้ฟรีถาวร — <span className="text-zinc-200">เทียบหุ้นกับอุตสาหกรรม · พอร์ตกูรู 13F สด 19 สถาบัน · เทียบหุ้น 70+ เมตริก · Balance Score + แผนปรับสมดุล · ข่าวแปลไทยอัตโนมัติ</span> ·
          สมาชิกได้ <span className="text-accent-soft">AI ตัวหลัก + ซิงก์ข้ามเครื่อง + รายงานรายวันในกลุ่ม Facebook ปิด</span> — จ่ายด้วย PromptPay แล้วแอดมินออกรหัสเข้าเว็บภายใน 24 ชม.
        </p>
      </div>

      {/* การ์ด 3 แพ็กเกจ */}
      <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto items-start">
        {plans.map((p) => (
          <div key={p.id} className={`card p-6 flex flex-col ${p.id === "pro" ? "border-accent/50 relative" : ""}`}>
            {p.id === "pro" && <span className="absolute -top-3 left-1/2 -translate-x-1/2 chip bg-accent text-zinc-950 font-bold">แนะนำ · คุ้มสุด</span>}
            {p.id === "starter" && <span className="absolute -top-3 left-1/2 -translate-x-1/2 chip bg-base-800 text-zinc-300 border border-base-700 font-bold">ยอดนิยม</span>}
            <div className="flex items-center gap-2">
              <span className="text-2xl">{p.emoji}</span>
              <h2 className="text-xl font-bold text-zinc-50">{p.name}</h2>
            </div>
            <p className="text-sm text-zinc-400 mt-1 min-h-[40px]">{p.tagline}</p>
            <div className="mt-4 flex items-end gap-2">
              <span className="num text-4xl font-bold text-accent-soft">{p.priceMonthly.toLocaleString()}</span>
              <span className="text-sm text-zinc-500 mb-1">{p.priceNote}</span>
              {p.priceMonthly > 0 && <span className="text-[11px] text-zinc-500 mb-1">≈ {(p.priceMonthly / 30).toFixed(0)}฿/วัน</span>}
            </div>
            <ul className="mt-5 space-y-2 flex-1">
              {p.features.map((f) => (
                <li key={f} className="text-sm text-zinc-300 flex gap-2 leading-snug">
                  <span className="text-up shrink-0">✓</span>
                  {f}
                </li>
              ))}
              {p.notFeatures.map((f) => (
                <li key={f} className="text-sm text-zinc-600 flex gap-2 leading-snug">
                  <span className="shrink-0">✕</span>
                  {f}
                </li>
              ))}
            </ul>
            {p.id === "free" ? (
              <Link href="/starter" className="btn-ghost mt-6">เริ่มใช้ฟรี ไม่ต้องสมัคร</Link>
            ) : p.id === "pro" ? (
              fbPro ? (
                <a href={fbPro} className="btn-primary mt-6">🥇 สมัคร Pro</a>
              ) : (
                <span className="btn-primary mt-6 cursor-default">🥇 สมัคร Pro</span>
              )
            ) : fbStarter ? (
              <a href={fbStarter} className="btn-primary mt-6">สมัคร Starter</a>
            ) : (
              <span className="btn-primary mt-6 cursor-default">สมัคร Starter</span>
            )}
          </div>
        ))}
      </div>

      {/* กล่องความคุ้มทุน — ซื่อสัตย์กับต้นทุนจริง */}
      <section className="max-w-4xl mx-auto">
        <div className="card p-6 border border-base-700">
          <h2 className="font-bold text-zinc-100 text-center">🧮 ทำไมราคานี้คุ้ม — คิดจากต้นทุนจริง ไม่ใช่ตั้งลอยๆ</h2>
          <p className="text-xs text-zinc-500 text-center mt-1">ทุกฟีเจอร์ AI มีค่าตัวจริงต่อครั้งที่เราจ่ายให้โมเดล — เราเปิดให้ดูเลย เพื่อให้มั่นใจว่าราคายั่งยืน ไม่มีวันต้องปิดตัวแล้วเอาค่าสมาชิกคืนไม่ได้</p>
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            {[
              ["ต้นทุนต่อการใช้ 1 ครั้ง", ["💬 แชท AI ≈ 0.15฿", "🔬 วิเคราะห์หุ้น 1 ตัว ≈ 0.25฿", "🦈 5 มุมมอง 1 หุ้น ≈ 0.70฿", "📰 สรุปข่าวไทย 1 ชิ้น ≈ 0.05฿"]],
              ["สมาชิกใช้ \"หนัก\" ทั้งเดือน", ["Starter: ต้นทุน AI ≈ 50฿ → เหลือ 150฿ ดูแลข้อมูล+รายงาน", "Pro: ต้นทุน AI ≈ 100฿ → เหลือ 400฿ คุ้คุณภาพรายงาน/LINE", "ฟรี: ถูกจำกัด+แคชหนัก → ต่อหัว < 1฿/เดือน"]],
              ["แปลว่าอะไรสำหรับคุณ", ["ไม่มีมิเตอร์ตัดกลางคัน — ใช้จริงไม่มีทางขาดทุนเพราะคุณ", "แนวปฏิบัติ \"~กี่ครั้ง\" ไว้กัน bot ยิงรัว ไม่ใช่กับคน", "ราคานิ่ง — ไม่มีขึ้นเงียบๆ ราคาเดิมลูกค้าเก่าตลอด"]],
            ].map(([h, rows]) => (
              <div key={h as string} className="rounded-xl bg-base-900 border border-base-700 p-4">
                <div className="text-xs font-bold text-accent-soft mb-2">{h as string}</div>
                <ul className="space-y-1.5">
                  {(rows as string[]).map((r) => (
                    <li key={r} className="text-[11px] text-zinc-300 leading-snug flex gap-1.5">
                      <span className="text-zinc-600 shrink-0">·</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ตารางเทียบ */}
      <section className="max-w-4xl mx-auto">
        <h2 className="text-sm font-bold text-zinc-400 mb-3 text-center">เทียบทุกระดับ — ใช้อะไรได้บ้าง ได้เท่าไหร่</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-xs min-w-[620px]">
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
          <p className="px-3 py-2 text-[10px] text-zinc-600">ตัวเลข ~ คือแนวการใช้งานปกติ (fair use) ป้องกัน bot/สคริปต์ — คนใช้เองไม่มีมิเตอร์ตัดกลางคัน</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto space-y-2">
        <h2 className="text-sm font-bold text-zinc-400 mb-3 text-center">คำถามที่เจอบ่อย</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="card p-4 group">
            <summary className="text-sm font-semibold text-zinc-200 cursor-pointer list-none flex items-center justify-between gap-2">
              {q}
              <span className="text-zinc-600 group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <p className="text-xs text-zinc-400 leading-relaxed mt-2.5">{a}</p>
          </details>
        ))}
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
