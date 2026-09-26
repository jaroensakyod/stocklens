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

---

## TypeSafe Jev — ให้คะแนนข่าวด้วย AI ตัดสิน (แนะนำ เริ่มต้น $10 ใช้ได้เกือบปี)

**ใช้ทำอะไรใน StockLens:** อ่านพาดหัวข่าวแล้วตอบเป็น decision — sentiment (bullish/neutral/bearish) + ความสำคัญ (0-2) → mood ธีมใน radar, ป้ายข่าวรายหุ้น, บริบทแชท (ไม่ใช่ตัวเขียนบทวิเคราะห์ — นั่นยังเป็นหน้าที่ Gemini)

**ราคา:** $0.042/ล้าน input token (output ฟรี) — ทดสอบจริงได้ ~541 token/ข่าว = **$0.000023/ข่าว** (สแกน 600 ข่าว/วัน ≈ $0.41/เดือน) · เร็ว ~0.3 วิ/เรียก · ลิมิต 1,200 เรียก/นาที

**วิธีเปิด:**
1. สมัคร https://console.typesafe.ai (Google login ได้)
2. **Billing → Add funds** — ต้องเติมจริงครั้งแรก ถึงจะปลดล็อก (เครดิตฟรี $5/เดือนอย่างเดียวยังกดใช้ไม่ได้ ณ ก.ย. 2026 — เจอตรงๆ)
3. API Keys → Create key → เอามาใส่ `TYPESAFE_API_KEY` ใน `.env.local` และ Vercel Environment Variables
4. ไม่ต้องทำอย่างอื่น — ระบบ auto-detect: มี key = ข่าวมี sentiment, ไม่มี = ใช้ระบบเดิม

**ตรวจสอบว่าทำงาน:** `curl -s localhost:3000/api/radar | jq '.themes[0].mood'` → ได้ `{"dir":"bullish"|"bearish"|"neutral",...}` (null = key ยังไม่ทำงาน/ยังไม่อุ่น)

**ทดสอบคุณภาพซ้ำได้:** `TS_KEY=<key> node scripts/test-typesafe-thai.mjs` — ยิงข่าวจริง 30 ชิ้นจาก radar เรา + วัด latency/ต้นทุน/ความนิ่ง (ผลรอบ 26 ก.ย. 2026: sentiment ถูก ~93-97%, จับภาษาไทย 0.99, 333ms, $0.000023/ข่าว)

**หมายเหตุ:** คะแนนแคช 24 ชม./พาดหัว (Redis `jev:*` + memory 1 ชม.) — ข่าวเดียวกันไม่ยิงซ้ำ

---

## 📅 ปฏิทินงบรายไตรมาส (แผนรองบ — ยังไม่ลงมือ)

**สถานะข้อมูล (ตรวจแล้ว ก.ย. 2026):** Yahoo `earningsTrend` คืน `earningsDate = null` ทั้ง PTT.BK และ NVDA → ทางฟรีไม่พอจริง

**แผนเมื่อมีทุน — FMP Starter ~$19-22/เดือน:**
- Endpoint: `financialmodelingprep.com/stable/earning-calendar` (รายวันทั้งตลาด) + `earnings-calendar-confirmed` — ครบ US + ตลาดหลัก
- โครงสร้างไฟล์ที่เจอะไว้แล้ว: `src/lib/earnings.ts` (fetch + cache Redis 24 ชม. ต่อวัน) + `/api/earnings-calendar?week=` + การ์ด "📅 งบสัปดาห์นี้" ในหน้าแรก + chip ในหน้าหุ้น (ต่อยอด nextEarnings ที่เตรียมไว้ใน `/api/analyst` แล้ว)
- ตัวเลือกเสริมเมื่อออกงบจริง: ดึง actual EPS vs estimate จาก FMP + ให้ Jev สรุป "ดีกว่า/แย่กว่าคาด" ต่อหุ้น → ปรับเสา News/Street ของ StockLens Score อัตโนมัติ
- ทางเลือกฟรีที่ยังไม่ได้ลองทั้งหมด: Nasdaq.com earnings calendar (scrape ได้แต่เปราะ), Alpha Vantage earnings calendar (ฟรี 25 req/วัน — น้อยไปสำหรับทั้งตลาด)
