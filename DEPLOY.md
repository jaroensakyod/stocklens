# 🚀 คู่มือ Deploy StockLens ขึ้น Internet (Vercel — ฟรี)

ทำตามนี้ ~10 นาที เว็บจะออนไลน์ได้ URL จริง ใช้เปิดให้คนอื่นดู/สมัคร VIP ได้ทันที

## 0. สิ่งที่ต้องมี
- บัญชี [GitHub](https://github.com) (คุณมีแล้ว ✓)
- บัญชี [Vercel](https://vercel.com) — สมัครด้วย GitHub ได้ฟรี

## 1. push โค้ดขึ้น GitHub
```bash
cd C:\Users\ASUS\Desktop\newdata
# (ถ้ายังไม่เคย init ในโฟลเดอร์นี้)
git init
git add .
git commit -m "StockLens v1"
# สร้าง repo ใหม่ชื่อ stocklens บน GitHub แล้ว:
git remote add origin https://github.com/<username>/stocklens.git
git branch -M main
git push -u origin main
```
> ⚠️ ตรวจว่า `.gitignore` มี `.env.local` อยู่แล้ว (มี) — ลับจะไม่หลุดขึ้น repo

## 2. สร้างโปรเจกต์บน Vercel
1. เข้า [vercel.com/new](https://vercel.com/new) → Import  repo `stocklens`
2. Framework: Next.js (ตรวจเจออัตโนมัติ) → ไม่ต้องแตะค่าอื่น
3. ก่อนกด Deploy เปิด **Environment Variables** แล้วเพิ่ม:

| Name | Value |
|---|---|
| `AI_BASE_URL` | `https://api.z.ai/api/paas/v4` (GLM) หรือ `https://api.openai.com/v1` |
| `AI_API_KEY` | key ของคุณ |
| `AI_MODEL` | `glm-4.7` หรือ `gpt-4o-mini` |
| `ADMIN_CODE` | รหัสหน้า /admin (ตั้งเอง ห้ามใช้ค่า default!) |
| `NEXT_PUBLIC_PROMPTPAY_NAME` | ชื่อบัญชีรับเงิน |
| `NEXT_PUBLIC_PROMPTPAY_ID` | เบอร์/เลข PromptPay |
| `NEXT_PUBLIC_FB_STARTER_URL` | ลิงก์กลุ่ม FB Starter |
| `NEXT_PUBLIC_FB_PRO_URL` | ลิงก์กลุ่ม FB Pro |

4. Deploy → ได้ URL `https://stocklens-xxx.vercel.app` 🎉

## 3. ของที่รู้ก่อน deploy
- **ทะเบียนสมาชิก (/admin) บน Vercel**: Vercel เป็น serverless — ไฟล์ `members.json` **เขียนถาวรไม่ได้** (รีเซ็ตหลัง deploy) วิธีใช้งานจริง:
  - ใช้ /admin บนเครื่องตัวเอง (`npm run dev`) แล้ว push ไฟล์ members.json ขึ้น repo เมื่อมีสมาชิกใหม่ **หรือ**
  - อัปเกรดเป็น DB ฟรี เช่น Vercel KV / Turso / Supabase ภายหลัง (โครงสร้าง API พร้อมแล้ว แก้แค่ `src/lib/admin.ts`)
- **แจ้งเตือนเบราว์เซอร์** ทำงานเมื่อเปิดเว็บค้างไว้ (แจ้งเตือนแม้ปิดแท็บ = PWA + push server คือเฟสถัดไป)
- **โดเมนเอง**: Vercel → Settings → Domains → เชื่อมโดเมนที่ซื้อ (~300฿/ปี) เช่น stocklens.co.th

## 4. เช็กลิสต์หลัง deploy
- [ ] เปิดหน้าแรกเห็นดัชนี/ข่าวจริง
- [ ] กด "วิเคราะห์ด้วย AI" แล้ว badge ขึ้น "จาก AI" (ไม่ใช่โหมดตัวอย่าง)
- [ ] ลองแชท 💬 ถามหุ้น
- [ ] /radar พิมพ์เหตุการณ์ไทยได้
- [ ] หน้า /pricing ขึ้น PromptPay ถูกต้อง
- [ ] เปลี่ยน ADMIN_CODE แล้ว

## 5. ค่าใช้จ่าย
- Vercel Hobby: **ฟรี** (พอสำหรับคนเข้าหลักพัน/วัน)
- Yahoo data: ฟรี
- AI: จ่ายตามการใช้ (GLM ถูกมาก — ประมาณไม่กี่บาท/วันสำหรับ Daily Brief + แชทเล็กน้อย)
- เมื่อคนเยอะขึ้นค่อยอัป Vercel Pro ($20/เดือน) เมื่อรายได้ VIP คุ้มแล้ว
