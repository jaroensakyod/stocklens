export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      <h1 className="text-2xl font-bold text-zinc-50">เกี่ยวกับ StockLens</h1>

      <section className="card p-6 space-y-3">
        <h2 className="font-bold text-zinc-100">🔬 เราทำอะไร</h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          StockLens เป็นสื่อบทวิเคราะห์หุ้นเชิงข้อมูล (research &amp; education) ที่รวมเครื่องมือมืออาชีพไว้ในที่เดียว:
          คะแนนปัจจัย 5 มิติ สัญญาณเทคนิค การวิเคราะห์ด้วย AI ภาษาไทย การคัดกรองหุ้น Global Radar
          ที่แปลงเหตุการณ์โลกเป็นห่วงโซ่หุ้นที่ได้/เสียประโยชน์ และการติดป้ายช่องทางซื้อสำหรับนักลงทุนไทย (Dime! / โบรกเกอร์ไทย / InnovestX)
        </p>
      </section>

      <section className="card p-6 space-y-3">
        <h2 className="font-bold text-zinc-100">📐 Methodology — คะแนนคำนวณยังไง</h2>
        <ul className="text-sm text-zinc-300 space-y-2 list-disc ml-5">
          <li><strong>ข้อมูลดิบ:</strong> ราคา/งบการเงิน/ข่าว จาก Yahoo Finance (ฟรี ไม่มี key) — ราคา delay ~15 นาที เหมาะกับการวิเคราะห์ ไม่ใช่การเทรดความเร็วสูง</li>
          <li><strong>Valuation (0-100):</strong> จาก P/E, P/B, P/S, EV/EBITDA — ยิ่งถูกเทียบเพดานยิ่งคะแนนสูง</li>
          <li><strong>Growth:</strong> การเติบโตของรายได้และกำไร YoY</li>
          <li><strong>Profitability:</strong> มาร์จิ้นขั้นต้น/ดำเนินงาน/สุทธิ + ROE/ROA</li>
          <li><strong>Momentum:</strong> ผลตอบแทนจริง 3/6/12 เดือนจากกราฟราคา</li>
          <li><strong>Financial Health:</strong> Debt/Equity, Current Ratio, FCF, เงินสดเทียบหนี้</li>
          <li><strong>เทคนิค:</strong> SMA 20/50/200, RSI(14), MACD(12,26,9), Bollinger(20,2) คำนวณเองจากข้อมูลราคา</li>
          <li><strong>ข้อมูลขาด = บอกว่าขาด:</strong> ตลาดนอกสหรัฐฯ บางตัว Yahoo ให้ข้อมูลไม่ครบ ระบบจะระบุจุดที่ขาดเสมอ แทนที่จะเดา</li>
        </ul>
      </section>

      <section className="card p-6 space-y-3">
        <h2 className="font-bold text-zinc-100">🤖 บทวิเคราะห์ AI</h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          บทวิเคราะห์สร้างจากข้อมูลจริงที่ส่งให้โมเดล ณ ขณะนั้น (ราคา ปัจจัย สัญญาณ ข่าว) — ไม่มีการเดาตัวเลข
          หากยังไม่ได้ตั้งค่า AI key ระบบจะแสดง &ldquo;โหมดตัวอย่าง&rdquo; ที่ประกอบจากคะแนนจริงอัตโนมัติแทน
        </p>
      </section>

      <section className="card p-6 space-y-3 border-rose-500/30">
        <h2 className="font-bold text-rose-300">⚠️ Disclaimer สำคัญ</h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          StockLens เป็นสื่อบทวิเคราะห์เชิงข้อมูลเพื่อการศึกษา <strong>ไม่ใช่คำแนะนำการลงทุนเฉพาะบุคคล</strong>
          และไม่ใช่บริการจัดการเงินลงทุน ข้อมูลอาจล้าหลัง ผิดพลาด หรือไม่ครบถ้วน ผู้ใช้ควรตรวจสอบข้อมูลจากแหล่งทางการ
          และปรึกษาผู้เชี่ยวชาญก่อนตัดสินใจลงทุน การลงทุนมีความเสี่ยง ผลตอบแทนในอดีตไม่การันตีอนาคต
        </p>
        <p className="text-xs text-zinc-500">
          เว็บนี้ไม่ได้เชื่อมต่อหรือได้รับการรับรองจาก Yahoo Finance, Dime!, InnovestX หรือบริษัทใดๆ — ชื่อตราสาร/โบรกเกอร์ที่กล่าวถึงเพื่อประโยชน์ในการอ้างอิงเท่านั้น
        </p>
      </section>
    </div>
  );
}
