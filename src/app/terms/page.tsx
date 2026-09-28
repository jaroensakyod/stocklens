import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ข้อกำหนดการใช้บริการ & คำเตือนการลงทุน (Terms of Service)",
  description: "ข้อกำหนดการใช้บริการ StockLens พร้อมคำเตือนการลงทุนฉบับเต็ม — ทั้งภาษาไทยและอังกฤษ",
};

const EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@stocklens.app";
const UPDATED = "28 กันยายน 2569 (28 September 2026)";

function H({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-base font-bold text-zinc-100 mt-7 mb-2 scroll-mt-20">
      {children}
    </h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-zinc-400 leading-relaxed mb-2">{children}</p>;
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-2">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">ข้อกำหนดการใช้บริการ / Terms of Service</h1>
        <p className="text-xs text-zinc-500 mt-1">ฉบับปรับปรุงล่าสุด / Last updated: {UPDATED}</p>
      </div>

      <P>
        การเข้าใช้งานเว็บไซต์ StockLens (&ldquo;เว็บไซต์&rdquo;) ถือว่าผู้ใช้ได้อ่าน เข้าใจ และยอมรับข้อกำหนดทั้งหมดในเอกสารนี้แล้ว หากไม่ยอมรับ กรุณาหยุดใช้บริการ
      </P>

      <H>1. ลักษณะของบริการ (Nature of Service)</H>
      <P>
        StockLens เป็น<b className="text-zinc-200">สื่อบทวิเคราะห์ข้อมูลเพื่อการศึกษา (educational research media)</b> ที่รวบรวมและประมวลผลข้อมูลสาธารณะ
        (เช่น ราคาหลักทรัพย์ งบการเงิน ข่าว) มานำเสนอในรูปแบบต่างๆ รวมถึงการวิเคราะห์โดยระบบอัตโนมัติและปัญญาประดิษฐ์ (AI) เพื่อประกอบการศึกษาของผู้ใช้เท่านั้น
      </P>
      <P>
        เว็บไซต์นี้<b className="text-zinc-200">มิใช่</b>บริษัทหลักทรัพย์ ตัวแทนจำหน่ายหลักทรัพย์ ที่ปรึกษาการลงทุน หรือผู้ให้คำแนะนำการลงทุนเฉพาะบุคคลที่ขึ้นทะเบียนกับสำนักงาน
        ก.ล.ต. (Thai SEC) หรือหน่วยงานกำกับดูแลใด ๆ และมิได้ให้บริการรับฝากเงิน รับฝากซื้อขายหลักทรัพย์ หรือบริหารสินทรัพย์แทนผู้ใช้ไม่ว่ากรณีใด
      </P>

      <H id="disclaimer">2. คำเตือนการลงทุน (Investment Disclaimer)</H>
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 space-y-2">
        <P>
          <b className="text-zinc-200">ข้อมูลและเนื้อหาทั้งหมดบนเว็บไซต์ รวมถึงแต่ไม่จำกัดถึง รายชื่อหุ้น พอร์ตตัวอย่าง พอร์ตจำลอง คะแนน สัญญาณ ข่าว และบทวิเคราะห์โดย AI —
          จัดทำเพื่อการศึกษาและเป็นสื่อบทวิเคราะห์เชิงข้อมูลเท่านั้น</b> มิใช่คำเชิงชวนให้ซื้อหรือขายหลักทรัพย์ (ไม่ใช่เอกสารโฆษณาการชักชวนซื้อขายหลักทรัพย์)
          และมิใช่คำแนะนำการลงทุนเฉพาะบุคคล เนื่องจากไม่ได้คำนึงถึงวัตถุประสงค์การลงทุน สถานะทางการเงิน และความต้องการรับความเสี่ยงของผู้ใช้แต่ละบุคคล
        </P>
        <P>
          <b className="text-zinc-200">การลงทุนมีความเสี่ยง ผู้ลงทุนอาจสูญเสียเงินต้นทั้งจำนวนหรือบางส่วน</b> ผลการดำเนินงานหรือผลย้อนหลังในอดีต (backtest, track record)
          ไม่เป็นสิ่งยืนยันถึงผลการดำเนินงานในอนาคต ผลการจำลองไม่คิดค่าธรรมเนียม ภาษี และผลกระทบจากสภาพคล่องจริง
        </P>
        <P>
          <b className="text-zinc-200">ผู้ใช้ควรศึกษาข้อมูลให้ครบถ้วน ตรวจสอบกับแหล่งทางการ (เช่น แบบ 246-1/56-1 ของบริษัทจดทะเบียน และประกาศของตลาดหลักทรัพย์)
          และ/หรือปรึกษาผู้แนะนำการลงทุนที่ขึ้นทะเบียนอย่างถูกกฎหมายก่อนตัดสินใจลงทุน</b> การตัดสินใจลงทุนทั้งหมดเป็นดุลยพินิจและความรับผิดชอบของผู้ใช้เองแต่เพียงผู้เดียว
        </P>
      </div>

      <H>3. การจำกัดความรับผิด (Limitation of Liability)</H>
      <P>
        เว็บไซต์ให้บริการตามสภาพที่เป็นอยู่ (as is) และตามความพร้อมใช้งาน (as available) โดยไม่มีการรับประกันใด ๆ ทั้งสิ้น ไม่ว่าโดยชัดแจ้งหรือโดยปริยาย
        เช่น ความถูกต้อง ความครบถ้วน ความทันเวลา หรือความเหมาะสมเพื่อวัตถุประสงค์ใด ๆ ของผู้ใช้
      </P>
      <P>
        <b className="text-zinc-200">
          ในกรณีใด ๆ ก็ตาม ผู้จัดทำเว็บไซต์ ทีมงาน และผู้เกี่ยวข้อง จะไม่รับผิดชอบต่อความเสียหาย ค่าสูญเสีย หรือค่าใช้จ่ายใด ๆ ทั้งทางตรง ทางอ้อม โดยบังเอิญ
          ต่อเนื่อง หรือเป็นผลสืบเนื่อง — รวมถึงแต่ไม่จำกัดถึง กำไรที่ควรได้รับแต่มิได้รับ หรือการสูญเสียเงินต้นจากการลงทุน — ที่เกิดจากการใช้หรือการไม่สามารถใช้เว็บไซต์
          ความคลาดเคลื่อนของข้อมูล หรือการกระทำใด ๆ ที่เกิดจากการพึ่งพาข้อมูลบนเว็บไซต์ แม้จะได้แจ้งถึงความเป็นไปได้ของความเสียหายนั้นแล้วก็ตาม
        </b>
      </P>

      <H>4. แหล่งข้อมูลและลิขสิทธิ์ (Data Sources & Intellectual Property)</H>
      <P>
        ข้อมูลราคา งบการเงิน และข่าว ได้มาจากแหล่งสาธารณะ เช่น Yahoo Finance, SEC EDGAR, Google News และตลาดหลักทรัพย์ฯ ซึ่งอาจมีความล่าช้าหรือคลาดเคลื่อนได้
        ลิขสิทธิ์ของเนื้อหาที่เว็บไซต์จัดทำเองเป็นของ StockLens ห้ามคัดลอกเพื่อการค้าโดยไม่ได้รับอนุญาต ผู้ใช้ต้องไม่ดึงข้อมูลจากเว็บโดยอัตโนมัติ (scraping/bot) ในอัตราที่กระทบการให้บริการ
      </P>

      <H>5. AI และความผิดพลาดของระบบ (AI Output)</H>
      <P>
        บทวิเคราะห์ที่สร้างโดย AI (รวมถึงการตรวจทานโดยระบบช่วย) อาจมีความคลาดเคลื่อนหรือไม่ตรงความเป็นจริงเสมอไป (AI can be wrong) ผู้ใช้ต้องตรวจสอบข้อเท็จจริงสำคัญ
        กับแหล่งทางการก่อนใช้ประกอบการตัดสินใจเสมอ และยอมรับว่าเนื้อหาดังกล่าวอยู่ภายใต้ข้อจำกัดความรับผิดในข้อ 3
      </P>

      <H>6. สมาชิกภาพและการชำระเงิน (Membership)</H>
      <P>
        ค่าสมาชิกเป็นค่าสนับสนุนการดำเนินงานของสื่อบทวิเคราะห์เพื่อการศึกษา มิใช่ค่าธรรมเนียมการลงทุนหรือค่าจัดการสินทรัพย์ การชำระเงินผ่านช่องทางที่ประกาศ
        และสิทธิ์ใช้งานตามแพ็กเกจ — ดูรายละเอียดที่ <Link href="/pricing" className="text-accent-soft underline underline-offset-2">หน้าสมาชิก</Link>
      </P>

      <H>7. การเปลี่ยนแปลงและกฎหมายที่ใช้บังคับ (Changes & Governing Law)</H>
      <P>
        เราอาจปรับปรุงข้อกำหนดนี้และประกาศบนเว็บไซต์ โดยถือว่าการใช้งานต่อเนื่องหลังประกาศคือการยอมรับ ข้อกำหนดนี้อยู่ภายใต้กฎหมายไทย ติดต่อเรื่องใด ๆ ที่{" "}
        <span className="text-accent-soft num">{EMAIL}</span>
      </P>

      <div className="border-t border-base-700/60 mt-8 pt-6">
        <h2 className="text-base font-bold text-zinc-100 mb-2">Terms of Service — English Summary</h2>
        <P>
          Last updated: {UPDATED}. By using StockLens you accept these terms. StockLens is an educational data-analysis media service. It is <b>not</b> a licensed
          securities dealer, broker, or SEC-registered investment adviser, holds no client funds, and executes no trades. All content — including stock lists, model
          portfolios, scores, signals, news, and AI-generated analysis — is provided for educational purposes only, is not a solicitation to buy or sell securities, and
          is not personalized investment advice.
        </P>
        <P>
          <b className="text-zinc-200">
            Investing involves risk, including total loss of principal. Past performance and backtested results do not guarantee future results. All investment decisions
            are solely your own responsibility.
          </b>
        </P>
        <P>
          The service is provided &ldquo;as is&rdquo; without warranty of any kind. To the maximum extent permitted by law, we shall not be liable for any damages,
          direct or indirect, incidental, consequential, or otherwise — including lost profits or lost principal — arising from the use of, or inability to use, this
          website or reliance on its information, even if advised of the possibility of such damages. Data may be delayed or inaccurate; verify material facts with
          official sources. Thai law governs these terms. Contact: <span className="text-accent-soft num">{EMAIL}</span>
        </P>
      </div>
    </div>
  );
}
