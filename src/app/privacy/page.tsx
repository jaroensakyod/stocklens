import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว (PDPA) & Privacy Policy",
  description: "นโยบายความเป็นส่วนตัวตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) และ Privacy Policy ของ StockLens — ทั้งภาษาไทยและอังกฤษ",
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
function LI({ children }: { children: React.ReactNode }) {
  return <li className="text-[13px] text-zinc-400 leading-relaxed ml-5 list-disc mb-1">{children}</li>;
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-2">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">นโยบายความเป็นส่วนตัว (PDPA) / Privacy Policy</h1>
        <p className="text-xs text-zinc-500 mt-1">ฉบับปรับปรุงล่าสุด / Last updated: {UPDATED}</p>
      </div>

      <div className="card p-5 mt-4 border border-amber-500/25 bg-amber-500/5">
        <p className="text-[12px] text-zinc-400 leading-relaxed">
          <span className="text-amber-400 font-semibold">สรุปสั้น:</span> เราเก็บข้อมูลน้อยที่สุด ส่วนใหญ่เก็บไว้ในเครื่องของคุณเอง (เบราว์เซอร์) เราไม่มีระบบรับฝากเงิน
          ไม่ขอรหัสบัญชี/รหัสโบรกเกอร์ และไม่ขายข้อมูลของคุณให้บุคคลที่สาม
        </p>
      </div>

      <H>1. ผู้ควบคุมข้อมูลส่วนบุคคล (Data Controller)</H>
      <P>
        StockLens (เว็บไซต์สื่อบทวิเคราะห์ข้อมูลการลงทุนเพื่อการศึกษา) เป็นผู้ควบคุมข้อมูลส่วนบุคคลตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) —
        ติดต่อเรื่องข้อมูลส่วนบุคคลได้ที่อีเมล <span className="text-accent-soft num">{EMAIL}</span>
      </P>

      <H>2. ข้อมูลส่วนบุคคลที่เก็บ (Data We Collect)</H>
      <P>เราออกแบบให้เก็บข้อมูลน้อยที่สุดเท่าที่จำเป็น:</P>
      <ul>
        <LI>
          <b className="text-zinc-300">ข้อมูลที่เก็บในเครื่องของคุณ (localStorage/คุกกี้ที่จำเป็น):</b> watchlist หุ้น, พอร์ตสมมติ, การตั้งค่าหน้าเว็บ, สถานะการยอมรับคำเตือน และ session
          การเข้าสู่ระบบสมาชิก — ข้อมูลกลุ่มนี้อยู่ในเบราว์เซอร์ของคุณ ลบได้ตลอดเวลาจากการ Clear site data
        </LI>
        <LI>
          <b className="text-zinc-300">ข้อมูลสมาชิก (เฉพาะผู้สมัคร):</b> ชื่อ/นามแฝง, ช่องทางติดต่อ (เช่น LINE ID/อีเมล), ระดับสมาชิก และวันหมดอายุ — เก็บเพื่อการออกรหัสและบริหารสมาชิกภาพเท่านั้น
        </LI>
        <LI>
          <b className="text-zinc-300">ข้อมูลการใช้งานระบบ:</b> แคชข้อมูลตลาด/ข่าว (ไม่ระบุตัวตน) เพื่อให้เว็บเร็วขึ้น เช่น ราคาหุ้นที่ดึงซ้ำ ไม่ใช่พฤติกรรมการเข้าชมรายบุคคล
        </LI>
      </ul>
      <P>สิ่งที่เราจะไม่ขอโดยเด็ดขาด: รหัสผ่านบัญชีโบรกเกอร์ เลขบัญชีธนาคาร หรือการโอนเงินเพื่อลงทุนผ่านเว็บเรา — เราไม่มีระบบรับฝากเงินและไม่ซื้อขายหุ้นแทนผู้ใช้</P>

      <H>3. วัตถุประสงค์และฐานทางกฎหมาย (Purpose & Legal Basis)</H>
      <ul>
        <LI>ให้บริการเว็บและฟีเจอร์ต่างๆ ตามที่แสดง (ความจำเป็นต่อการให้บริการตามข้อตกลง)</LI>
        <LI>บริหารสมาชิกภาพและการต่ออายุ (การปฏิบัติตามสัญญากับสมาชิก)</LI>
        <LI>ปรับปรุงคุณภาพ/ความเร็วของบริการจากข้อมูลรวมที่ไม่ระบุตัวตน (ผลประโยชน์อันชอบด้วยกฎหมาย)</LI>
      </ul>

      <H>4. การเก็บรักษาและระยะเวลา (Retention)</H>
      <P>ข้อมูลในเครื่องของคุณอยู่จนกว่าคุณจะลบเอง ข้อมูลสมาชิกเก็บไว้ตลอดอายุสมาชิกภาพ และลบ/ทำให้ไม่สามารถระบุตัวตนได้เมื่อหมดสมาชิกภาพติดต่อกัน 1 ปี เว้นแต่กฎหมายกำหนดให้เก็บไว้นานกว่านั้น</P>

      <H>5. สิทธิของคุณตาม PDPA (Your Rights)</H>
      <P>คุณมีสิทธิตามกฎหมายในการ: ขอทราบ/ขอเข้าถึงข้อมูล ขอแก้ไขให้ถูกต้อง ขอลบ (ถอนความยินยอม) ขอจำกัดการประมวลผล ขอโอนย้ายข้อมูล และร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล</P>
      <P>
        ใช้สิทธิเหล่านี้ได้โดยอีเมลถึงเราที่ <span className="text-accent-soft num">{EMAIL}</span> — เราจะดำเนินการภายในระยะเวลาที่กฎหมายกำหนด
      </P>

      <H>6. ผู้ประมวลผลข้อมูลภายนอก (Processors)</H>
      <P>เว็บใช้บริการโครงสร้างพื้นฐานมาตรฐานสากล (เช่น hosting/CDN และระบบแคช) ซึ่งปฏิบัติตามมาตรฐานการคุ้มครองข้อมูล เราไม่ขายหรือให้เช่าข้อมูลส่วนบุคคลของคุณกับบุคคลที่สามเพื่อการโฆษณา</P>

      <H id="cookies">7. นโยบายคุกกี้ (Cookie Policy)</H>
      <ul>
        <LI>
          <b className="text-zinc-300">คุกกี้ที่จำเป็น (Strictly necessary):</b> ใช้เก็บ session สมาชิกและสถานะการทำงานของเว็บ — ไม่ใช้ก็ใช้เว็บไม่ได้
        </LI>
        <LI>
          <b className="text-zinc-300">localStorage:</b> watchlist/พอร์ต/การตั้งค่า/สถานะยอมรับคำเตือน — อยู่ในเครื่องคุณทั้งหมด
        </LI>
        <LI>
          <b className="text-zinc-300">สิ่งที่เราไม่มี:</b> คุกกี้โฆษณา คุกกี้ติดตามพฤติกรรมข้ามเว็บ (third-party advertising/tracking cookies)
        </LI>
      </ul>
      <P>คุณสามารถลบ/บล็อกคุกกี้ได้จากการตั้งค่าเบราว์เซอร์ แต่อาจทำให้บางฟีเจอร์ (เช่น การจำ watchlist) ทำงานไม่เต็มรูปแบบ</P>

      <H>8. ความปลอดภัย (Security)</H>
      <P>เราใช้การเข้ารหัสการเชื่อมต่อมาตรฐาน (HTTPS) และไม่เก็บข้อมูลที่อ่อนไหว เช่น รหัสผ่านโบรกเกอร์หรือข้อมูลบัตร อย่างไรก็ดี ไม่มีระบบใดปลอดภัยสมบูรณ์ 100%</P>

      <H>9. เด็กและผู้เยาว์ (Minors)</H>
      <P>เว็บไซต์นี้จัดทำสำหรับผู้มีอายุ 20 ปีขึ้นไป หรือผู้เยาว์ที่ได้รับความยินยอมจากผู้ปกครองตามกฎหมาย</P>

      <H>10. การไม่รับผิด (Disclaimer)</H>
      <P>
        ข้อมูลทั้งหมดจัดทำเพื่อการศึกษา เราไม่รับประกันความถูกต้อง ครบถ้วน หรือทันเวลาของข้อมูล และจะไม่รับผิดชอบต่อความเสียหายใด ๆ ทั้งทางตรงและทางอ้อมที่เกิดจากการใช้เว็บไซต์ —
        อ่านฉบับเต็มได้ที่ <Link href="/terms#disclaimer" className="text-accent-soft underline underline-offset-2">ข้อกำหนดการใช้บริการ</Link>
      </P>

      <div className="border-t border-base-700/60 mt-8 pt-6">
        <h2 className="text-base font-bold text-zinc-100 mb-2">Privacy Policy (English Summary)</h2>
        <P>
          Last updated: {UPDATED}. StockLens is an educational data-analysis website. We collect the minimum data necessary: strictly necessary cookies/localStorage
          (login session, watchlist, preferences, disclaimer acknowledgment) stored on your device; member records (name/alias, contact, tier, expiry) for membership
          administration; and anonymous market-data caches for performance.
        </P>
        <P>
          We never request brokerage passwords, bank accounts, or money transfers — we hold no client funds and execute no trades. We do not sell or rent personal data,
          and we use no advertising or cross-site tracking cookies. You may exercise your rights (access, rectification, erasure, restriction, portability, objection) by
          emailing <span className="text-accent-soft num">{EMAIL}</span>. Member data is deleted or de-identified one year after membership lapses, unless a longer
          retention is required by law. The website is provided “as is” without warranty of accuracy or completeness, and we assume no liability, direct or indirect, for
          any loss arising from its use. Thai law governs this policy.
        </P>
      </div>

      <p className="text-[11px] text-zinc-600 pt-4">
        เอกสารฉบับนี้จัดทำเพื่อสื่อสารนโยบายของเว็บไซต์ให้ชัดเจน มิใช่คำแนะนำทางกฎหมาย หากต้องการความเข้าใจสิทธิตามกฎหมายอย่างเต็มที่ โปรดปรึกษาทนายความ /
        This document communicates our policy and is not legal advice.
      </p>
    </div>
  );
}
