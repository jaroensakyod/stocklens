# คู่มือต่อบริการภายนอก (5-10 นาทีต่อตัว)

โค้ดทุกอย่างเตรียมพร้อมแล้ว — ใส่ env ตามนี้เมื่อไหร่ ฟีเจอร์เปิดทันที ไม่ต้องแก้โค้ด

## 1) LINE Push — Flash Report อัตโนมัติ (แนะนำทำก่อน)

ระบบ LINE มีอยู่แล้วในเว็บ (broadcast + ส่งหาสมาชิก Pro) ขาดแค่ token:

1. เข้า https://developers.line.biz → ล็อกอินด้วย LINE ของคุณ
2. **Create a new provider** (ชื่ออะไรก็ได้ เช่น StockLens) → **Create a Messaging API channel**
3. แท็บ **Messaging API** → กด **Issue** ที่ Channel access token (long-lived) → คัดลอก
4. ใส่ env (ทั้ง `.env.local` และ Vercel → Settings → Environment Variables):

```
LINE_CHANNEL_ACCESS_TOKEN=<token จากข้อ 3>
```

5. หา **LINE User ID ของคุณ** (ขึ้นต้น U...): เพิ่มบอทเป็นเพื่อน (สแกน QR ในหน้า channel) แล้วดูที่ LINE Official Account Manager → แชท → คลิกชื่อคุณ → คัดลอก User ID → นำไปกรอกช่อง **lineUserId** ของสมาชิกในหน้า `/admin`
6. ทดสอบ Flash Report อัตโนมัติ:

```
curl -H "Authorization: Bearer <CRON_SECRET>" https://<เว็บคุณ>/api/cron/flash
```

มีธีมร้อนเกิน 75 จะส่งเข้า LINE ทันที (ตอบ `sent: [...], line: true`)

**การทำงานอัตโนมัติบน Vercel**: `vercel.json` ตั้ง cron รายชั่วโมงไว้แล้ว — deploy เสร็จใช้เลย
**ค่าใช้จ่าย**: แผนฟรี 200 ข้อความ/เดือน (Flash Report ~30-60 ข้อความ/เดือน อยู่ในเพดานสบาย)

## 2) CRON_SECRET — กันคนแปลกหน้ายิง flash report

สร้างข้อความสุ่ม (`openssl rand -hex 16`) แล้วใส่ทั้ง `.env.local` และ Vercel:

```
CRON_SECRET=<ข้อความสุ่ม>
```

Vercel Cron จะแนบ `Authorization: Bearer <CRON_SECRET>` ให้อัตโนมัติ

## 3) Alpaca — ราคาหุ้น US real-time (เผื่ออนาคต)

1. สมัคร https://alpaca.markets (แบบ Paper Trading ฟรี ไม่ต้องฝากเงิน)
2. Dashboard → **Generate API Keys** → ใส่ env:

```
ALPACA_KEY_ID=<key>
ALPACA_SECRET_KEY=<secret>
```

หมายเหตุ: ยังไม่ได้ต่อใช้งาน (เผื่อไว้) — เมื่อจะเปิดจริงให้บอก AI ให้ต่อ IEX real-time feed ที่หน้าราคาฝั่ง US

## สรุป env ที่เกี่ยวข้อง

| Env | ทำอะไร | สถานะ |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | เปิด LINE ทั้งระบบ (broadcast/admin + Flash Report cron) | **ต้องใส่** |
| `CRON_SECRET` | ล็อก `/api/cron/flash` | แนะนำใส่ตอน deploy |
| `ALPACA_KEY_ID` + `ALPACA_SECRET_KEY` | real-time US | ใส่แล้ว (paper) |
| `FRED_API_KEY` | macro ทางการ US (ดอกเบี้ย/เงินเฟ้อ/ว่างงาน) เสริมคลัง kb | optional — สมัครฟรี 5 นาที ด้านล่าง |

## 4) FRED — macro ทางการสหรัฐฯ (optional, แนะนำ)

คลัง `kb:macro` ใช้ Yahoo indexes ได้อยู่แล้ว — ใส่ FRED key เมื่อไหร่จะได้ **ตัวเลขทางการ** (อัตรา 10 ปี/2 ปี, เงินเฟ้อ CPI YoY, อัตราว่างงาน) เข้าแชท AI ทันที:

1. สมัครฟรี: https://fredaccount.stlouisfed.org/apikeys → ขอ API Key (กรอกว่าใช้ทำ research)
2. ใส่ env: `FRED_API_KEY=<key>` (ทั้งเครื่องและ Vercel)

ไม่มีค่าใช้จ่าย ไม่จำกัดโดย practical (อยู่ใน fair use สบาย)

## 5) BOT API — macro ไทยทางการ (optional รอสมัคร)

ธนาคารแห่งประเทศไทยมี API ฟรี (ดอกเบี้ยนโยบาย/อัตราแลกเปลี่ยน/เงินเฟ้อไทย) — ตอนนี้คลัง `kb:macro` ใช้ THB/SET จาก Yahoo ไปก่อน:

1. สมัคร developer: https://apiportal.bot.or.th → สร้าง subscription key ฟรี
2. เลือก dataset ที่อยากได้ (เช่น อัตราดอกเบี้ยนโยบาย, ค่าเงินบาท) แล้วส่งชื่อ endpoint + key มาให้ AI ต่อเข้า `src/lib/macro.ts` (โครงรองรับ env เพิ่มได้ทันทีแบบ FRED)

## 6) KB Prewarm — อุ่นคลังความรู้

- **อัตโนมัติ**: Vercel Cron `/api/cron/kb` รายวัน 01:30 เวลาไทย อุ่นหุ้นไทย top 25 (ผู้ใช้คนแรกของวันไม่ต้องรอโหลด)
- **มือ (แอดมิน)**: `curl -X POST -H "x-admin-code: <ADMIN_CODE>" -H "Content-Type: application/json" -d '{"market":"us","n":15}' https://<เว็บ>/api/admin/kb-warm` — อุ่นหุ้น US พร้อม EDGAR ลึกขึ้น (ช้า ~13 วิ/ตัว)
