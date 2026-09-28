// ⚠️ คำเตือนมาตรฐานหน้า "แนะนำ/แสดงรายชื่อหุ้น" — แนวปฏิบัติตามกฎหมายไทย (แนว ก.ล.ต.) + อังกฤษกำกับ
// ใช้: <InvestWarn /> วางใต้หัวเรื่องของหน้าที่โชว์รายชื่อหุ้น/พอร์ต/สัญญาณ
export default function InvestWarn() {
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3.5 py-2.5 text-[11px] leading-relaxed text-zinc-400">
      <span className="text-amber-400 font-semibold">⚠️ คำเตือน:</span> ข้อมูลบนหน้านี้จัดทำเพื่อ{" "}
      <b className="text-zinc-300">การศึกษาและเป็นสื่อบทวิเคราะห์เชิงข้อมูลเท่านั้น</b> มิใช่คำเชิงชวนให้ซื้อขายหลักทรัพย์ และมิใช่คำแนะนำการลงทุนเฉพาะบุคคล
      ผู้จัดทำมิได้เป็นที่ปรึกษาการลงทุนที่ขึ้นทะเบียนกับสำนักงาน ก.ล.ต. การลงทุนมีความเสี่ยง ผู้ลงทุนอาจสูญเสียเงินต้นทั้งจำนวนหรือบางส่วน
      และผลการดำเนินงานในอดีตไม่เป็นสิ่งยืนยันถึงผลในอนาคต — เราไม่รับผิดชอบต่อความเสียหายใด ๆ ที่เกิดจากการนำข้อมูลนี้ไปใช้
      <span className="text-zinc-600">
        {" "}· For educational and informational purposes only — not investment advice, not a solicitation to buy or sell securities. We are not a
        SEC-registered investment adviser and assume no liability for any loss arising from the use of this information.
      </span>
    </div>
  );
}
