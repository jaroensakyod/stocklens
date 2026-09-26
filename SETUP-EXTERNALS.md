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
| `ALPACA_KEY_ID` + `ALPACA_SECRET_KEY` | real-time US (อนาคต) | เผื่อไว้ |
