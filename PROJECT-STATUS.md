# 📋 PROJECT STATUS — StockLens (ฉบับละเอียด ครบทุกเรื่อง)

> อัปเดต: 25 ก.ย. 2569 · โค้ดทั้งหมดอยู่ที่ `C:\Users\ASUS\Desktop\newdata` · รันได้ที่ http://localhost:3000 (`npx next start -p 3000` หลัง `npx next build`)
> สรุปสำหรับเปิดเซสชันใหม่ทำต่อ หรือส่งต่อให้ใครก็อ่านรู้เรื่องทันที

---

## 1️⃣ สถานะโดยรวด

| หัวข้อ | สถานะ |
|---|---|
| เว็บแอป (19 หน้า/ฟีเจอร์ + 16 API) | ✅ เสร็จ ใช้งานจริงบน localhost |
| AI (Gemini 3.8 Flash) | ✅ ใช้งานจริงทุกจุด (key อยู่ใน `.env.local` ซึ่ง gitignore แล้ว) |
| ข้อมูลตลาด | ✅ Yahoo (ราคา/งบ/ข่าว) + TradingView scanner (universe 30 ตลาด) + SEC EDGAR (13F สด) |
| ธุรกิจ (VIP/PromptPay/LINE) | 🟡 ระบบพร้อม แต่ยังไม่เริ่มใช้จริง (รายละเอียดหัวข้อ 3) |
| Deploy ขึ้น internet | ❌ ยังไม่ได้ (ทำตาม DEPLOY.md ~10 นาที) |

---

## 2️⃣ ทำแล้วทั้งหมด (Features เสร็จสมบูรณ์ + ทดสอบจริงแล้ว)

### หน้าเว็บ (เมนูบนแถบบน)
| หน้า | สิ่งที่มี |
|---|---|
| **/ หน้าแรก** | 🔒 ประโยคสร้างความเชื่อใจ (ไม่ใช่โบรกฯ ไม่มีรับฝากเงิน) · **🎯 Daily Picks "หุ้นน่าสนใจวันนี้"** (คัดจาก movers+คะแนนปัจจัยจริง 390px-safe · US+ไทย 5 ตัว พร้อมเหตุผล+ป้ายประเภท+บรรทัด Dime) · ดัชนี 6 ตลาด · ⭐ Watchlist strip · **Top Movers 6 ตลาด** (🇺🇸🇹🇭🇭🇰🇯🇵🇰🇷🇹🇼) · ข่าวสด 48 ชม.+สรุปไทย AI · ปฏิทิน Fed/CPI · Ticker tape |
| **/stock/[TICKER]** | กราฟแท่งเทียน 1D–5Y (TradingView) · **คะแนนปัจจัย 5 มิติ** (จากงบ filings จริง 17 ฟิลด์) · เทคนิค (RSI/MACD/SMA/BB+สัญญาณ) · **🎯 Bull/Base/Bear + ราคาเป้าหมาย** (EPS จริง×สมมติ P/E) · **🔍 Trust panel** (ข้อมูลครบกี่%) · **AI 5 มุมมอง** (นักวิเคราะห์/🦈Burry/🍦Buffett/🕵️Lynch/**🌏ภูมิรัฐศาสตร์** — สังเคราะห์จาก อ.ทวีสุข+Zeihan/Friedman/Brzezinski/Marshall/Bremmer/Dalio) · **chip หมวด/อุตสาหกรรมจริง** (มี ADR map TSM/SONY/BABA ฯลฯ) · ป้าย Dime/โบรก+ราคาบาท+เครื่องคำนวณเศษหุ้น 50฿ · 📝 บันทึกสมมติฐาน→Track Record · 📄 ปุ่มรายงาน PDF · 🎬 Story Card (สร้างคอนเทนต์ไวรัลจากหุ้นตัวนี้) |
| **/radar Global Radar** | พิมพ์เหตุการณ์ไทย→ห่วงโซ่ เหตุการณ์→สินค้า→หุ้น ✅/❌ พร้อมราคาสด+ป้ายช่องซื้อ · **11 ธีม / 32 โหนด / ~120 ความสัมพันธ์** (สงคราม/สงครามการค้า/อาหาร/อากาศ/น้ำ/อวกาศ/อาวุธ/ดีลใหม่/พลังงาน-ซัพพลาย/ดอกเบี้ย/วิกฤตธนาคาร) · ความร้อนธีมเรียงจริง |
| **/screener** | **30 ประเทศ** (🇺🇸 1,000 ตัว · ตลาดอื่น 400/ตลาด) · หมวดจริง 18-20 + **อุตสาหกรรมย่อย 60-70/ตลาด** · IPO ≤1 ปี · 🌅 Premarket · ค้นหา · ลิงก์ต่อ suffix Yahoo ทุกตลาด (จีนแยก .SS/.SZ) |
| **/portfolio** | ⭐ Watchlist · 💼 พอร์ต (**เพิ่ม Position ด้วย TickerPicker — ค้นหาแล้วกดเลือกจากรายการจริงเท่านั้น กรอง INDEX/OTC ออก กันพิมพ์ผิดจนดึงข้อมูลไม่ได้**, รับเศษหุ้น, P/L $+฿) · **🌍 "เหตุการณ์โลกที่กระทบพอร์ตคุณ"** เรียงตามความร้อนธีม · 🔔 แจ้งเตือนราคา (ฟอร์มเลือกหุ้นแบบค้นหาเหมือนกัน + notification เบราว์เซอร์ + AlertWatcher เฝ้าทุก 90 วิทุกหน้า) — เก็บใน localStorage ไม่ต้องสมัคร |
| **/backtest** | 3 กลยุทธ์ (RSI Oversold/Golden Cross/SMA200 Filter) ย้อนหลัง ~5 ปี · win rate/รวม/±vs Buy&Hold/drawdown/กราฟ equity · รันกับพอร์ต/Watchlist ได้ |
| **/timemachine ไทม์แมชชีน** | ย้อนเวลาทำนาย 10 เหตุการณ์จริง (2022-2024) → เทียบราคาจริง → **เกรด S-D** · ผลล่าสุด: Radar บริสุทธิ์ **78% (B)** coverage 29/30 · แยกคะแนน AI (โปร่งใสเรื่อง AI จำอดีต) |
| **/gurus** | **13F สดจาก SEC EDGAR** — 7 LIVE (Buffett $299B/Simons/Dalio/Ackman/Tiger/Klarman/Druckenmiller) + 2 snapshot (Burry, ARK) · % พอร์ต/มูลค่า/หุ้น/PUT · 💡เหตุผลคัดสรร · 🧠 AI ถอดรหัส "ทำไมเขาถึงเลือก" จาก holdings จริง |
| **/compare** | 2–4 ตัว ข้ามตลาด ตาราง+คะแนนเทียบ |
| **/pricing · /track-record · /about** | หน้าขาย VIP · Track Record สาธารณะ (win rate) · methodology+disclaimer |
| **/admin** (รหัส default: stocklens-admin) | **✅ เช็คลิสต์ประจำวัน** (Brief 2 tier ออกหรือยัง + ใครใกล้หมดอายุ + Pro ยังไม่ผูก LINE) · **📥 ส่งออกสมาชิก CSV** (Excel เปิดไทยได้) · **🧪 ทดสอบส่ง LINE หาตัวเอง** · สมาชิก/ต่ออายุ/MRR · **📲 LINE ส่วนตัว VIP** (ผูก lineUserId ต่อสมาชิก: ⚡ multicast Flash หา Pro ทุกคน + 📲 push สรุปวอตช์ลิสต์รายคน ธงขยับ≥2% + แก้ watch inline) · **🎬 Story Card Generator** (หุ้น→คอนเทนต์ไวรัล + storyboard) · **โพสต์ FB พร้อมคัดลอก Starter+Pro** · 📣 LINE Broadcast · 🌍 Geopolitical Weekly · ⚡ Flash Builder · ปุ่ม Daily Brief PDF |
| **/report/print** | **รายงานระดับสิ่งพิมพ์ (ออกแบบใหม่)**: หัวกระดาษแบรนด์ไล่เฉดสีตาม tier (Pro ทอง/Starter น้ำเงิน) + ป้าย tier + เลขอ้างอิง · **📈 sparkline SVG ราคา 1 ปี** ใน deepdive (พิมพ์คมทุก DPI) · ตารางมีหัวซ้ำทุกหน้า + แถบคะแนนปัจจัย · section ไม่ขาดกลางหน้า (break-inside) · สีติดพิมพ์ (print-color-adjust) · footer ทุกหน้า · watermark กันแชร์ไฟล์ · 4 แบบ: brief/deepdive(+persona=geo)/flash(ev=เหตุการณ์)/flash ticker · starter มีกล่อง 🔒 ชวนอัปเกรด |
| **💬 แชท AI (ทุกหน้า)** | Grounded 3 โหมด: "วันนี้มีอะไรน่าสนใจ" (ดัชนี+movers+premarket+ธีม+ข่าวสด) / พิมพ์หุ้น (สูงสุด 4 ตัว, portfolio mode) / เล่าเหตุการณ์ · ปุ่ม "วิเคราะห์พอร์ตฉัน" อ่าน holdings จริง |

### โครงสร้างใต้ผิว
- **Data layer** (`src/lib/yahoo.ts`): Yahoo ตรงๆ ไม่ใช้ lib (spark batch ราคา / v8 chart / **fundamentals-timeseries งบรายไตรมาสจริง** → คำนวณ P/E,P/B,ROE,margins,FCF เอง / search / ข่าวกรองสด) + cache TTL + fallback query1↔query2
- **📱 มือถือผ่านทุกหน้า** (ทดสอบจริง viewport 390px ด้วยเบราว์เซอร์ 10 หน้า ไม่มี horizontal overflow + hamburger menu มีแล้วใน Header)
- **Daily Picks engine** (`/api/picks`): universe TV (US+ไทย) → กรองสภาพคล่อง (ticker ≤4 ตัวอักษร ตัด OTC foreign ordinary) → buildAnalysis คะแนนปัจจัยจริง → จัดอันดับ+กระจายหมวด → cache 30 นาที
- **LINE personal** (`/api/admin/line-personal`): mode=flash (multicast หา Pro) / mode=digest (push รายคน สรุปวอตช์+ธง ≥2%) — ต้องมี LINE_CHANNEL_ACCESS_TOKEN และ lineUserId ของสมาชิก
- **PWA**: manifest+icon+service worker+หน้า offline (สมบูรณ์หลัง deploy)
- **ฐานความรู้เป็นไฟล์ data** แก้ไม่ต้องแตะโค้ด: `impact-map.json` (32 โหนด) · `radar-themes.json` (11 ธีม) · `historical-events.json` (10 เหตุการณ์) · `universe.json`/`set-watchlist.json` (เดิม) · `guru-portfolios.json` (snapshot) · `calendar.json` · `plans.json` · `track-record.json` · `members.json`
- **คู่มือ**: README.md (ไทยครบ) · DEPLOY.md (Vercel 10 นาที)

---

## 3️⃣ ❌ ยังไม่ได้ทำ — แยกเป็น 2 กลุ่ม

### ก. ต้องเป็น "คุณ" ทำ (ระบบรออยู่แล้ว)
| # | งาน | ใช้เวลา | อ้างอิง |
|---|---|---|---|
| 1 | **Deploy ขึ้น Vercel** (ใส่ env: Gemini key+ADMIN_CODE ฯลฯ) | ~10 นาที | DEPLOY.md มี step-by-step |
| 2 | **เลือก+ซื้อโดเมน** (ยืนยันว่างแล้ว: hunradar.com / hunlens.com / monghun.com หรือเก็บชื่อ stocklens.app) | ~5 นาที | รายงานเช็ค RDAP ในแชท |
| 3 | **เปลี่ยน ADMIN_CODE** จาก default | 1 นาที | .env.local |
| 4 | ใส่ **PromptPay จริง+ลิงก์กลุ่ม FB** (ตอนนี้เป็น placeholder 08x-xxx) | 5 นาที | .env.local → NEXT_PUBLIC_* |
| 5 | **สร้างกลุ่ม FB Starter/Pro + LINE Official Account** เอา token มาใส่ `LINE_CHANNEL_ACCESS_TOKEN` | ~30 นาที | ใน /admin มีคำแนะนำ |
| 6 | **โพสต์ Daily Brief วันแรก** + บันทึก Track Record จริง (ตัวอย่าง 3 รายการยังเป็น demo) | เริ่มรันธุรกิจ | /admin |
| 7 | (แนะนำ) **หมุน GLM key** ตัวเดิมที่เคยวางในแชท | 2 นาที | console Z.ai |

### ข. ฟีเจอร์/งานเทคนิคที่ค้าง (ให้ ZCode ทำต่อได้)

> **อัปเดตรอบ 2 (25 ก.ย. 2569 เย็น): ทำเพิ่มแล้ว 6 ข้อ** — ① Flash Monitor (ปุ่ม📡 ใน /admin: สแกนข่าว 12 ชม.→จับคู่ธีม→เปิด Flash Report ทันที) ② Gurus QoQ (🆕เพิ่ม▼ลด🚪ขายออก เทียบ filing ก่อนหน้า — เช่น Berkshire ขาย BAC ออก) ③ แก้ bug Mkt Cap สกุลท้องถิ่น→USD ผ่าน FX จริง (VIC $67.8B, Samsung $1.34T) ④ rate-limit (AI 20/5นาที + ทั่วไป 120/นาที ตอบ 429) ⑤ ธีมท่องเที่ยวไทย+โลก (AOT/MINT/CENTEL/ERW + RCL/MAR/BKNG/BA.BK) + โหนดจีนกระตุ้น/AI-ถูกลง รวม 36 โหนด/12 ธีม ⑥ ไทม์แมชชีน 15 เหตุการณ์ — **ตรงไปตรงมา: ภาพรวม 69% (C) แต่แยกโดเมนชัด: supply/สงคราม/สินค้าโภคภัณฑ์ ~85% vs เหตุการณ์ narrative AI (DeepSeek 17%) ลากลง** ใช้เลขแยกโดเมนนี้ตอนสื่อสารกับลูกค้า
| # | งานค้าง | รายละเอียด/ขนาดงาน |
|---|---|---|
| 1 | **Flash Monitor อัตโนมัติ** | ตอนนี้ Flash ต้องพิมพ์เหตุการณ์เอง — ยังไม่มีระบบสแกนข่าวใหม่→จับคู่ impact-map→แจ้งแอดมิน "มีเหตุการณ์เข้าเกณฑ์ Flash" (กลาง) |
| 2 | **Backtest บน universe ใหญ่** | ยังต้องเลือกหุ้นเอง/ชุดสำเร็จ — ยังไม่ยิงทั้ง 1,000 ตัวจาก TV + ไม่มี slippage/ปันผล/ค่าธรรมเนียมในสมมติฐาน (เขียนกำกับแล้ว) (เล็ก-กลาง) |
| 3 | **ไทม์แมชชีนยัง B (78%)** | ไม่ถึงเป้า 80-90% — เพิ่มเหตุการณ์ใน `historical-events.json` (ยิ่งเพิ่มยิ่งเสถียร) + ปรับฐานความรู้จุดพลาดซ้ำ (เช่น "export control≠เซมิลงในตลาด AI boom") |
| 4 | **Gurus: QoQ changes** | ยังไม่เห็น เพิ่ม/ลด/ขายออก เทียบไตรมาสก่อน (ต้องดึง 2 filings ล่าสุดเทียบกัน) + ticker map ยังไม่ครบทุก issuer (บางตัวโชว์ชื่อเต็ม ไม่ลิงก์ได้) (กลาง) |
| 5 | **แสดง Mkt Cap สกุลท้องถิ่นผิดสเกล** | VN/ID/KR บางตลาด TV คืน mcap เป็น VND/IDR/KRW — sorting ถูกแต่ **ตัวเลขในคอลัมน์ Mkt Cap แสดงเป็นสกุลท้องถิ่น** ควร normalize เป็น USD หรือกำกับสกุล (เล็ก) |
| 6 | **Universe สหรัฐฯ จำกัด 1,000 ตัว** (top mcap) ไม่ใช่ทั้งตลาด ~6-7k + หุ้นเล็กนอก top ของแต่ละประเทศ sector lookup ไม่เจอ | (กลาง — เพิ่ม targetMax/batches) |
| 7 | **ระบบสมาชิกบนเว็บ (login) ไม่มี** | VIP อยู่บน FB ทั้งหมดตามดีไซน์ — ถ้าอยากให้เว็บ gate เนื้อหาตาม tier ต้องทำ auth+DB (ใหญ่) |
| 8 | **members.json บน Vercel เขียนถาวรไม่ได้** (serverless) | ทางแก้เท่าที่เขียนไว้: ใช้ /admin บนเครื่อง local แล้ว push ไฟล์ หรือต่อ DB ฟรี (Turso/Vercel KV/Supabase) แก้แค่ `src/lib/admin.ts` (กลาง) |
| 9 | **ความปลอดภัย production** | ยังไม่มี rate-limit API / ADMIN_CODE ส่งผ่าน header plaintext / CORS เปิดกว้าง — ควรทำก่อนเปิดให้คนเยอะ (กลาง) |
| 10 | **แจ้งเตือนแม้ปิดเว็บ (web push)** | ตอนนี้แจ้งเตือนเฉพาะตอนเปิดแท็บไว้ — ต้อง PWA push + push service (ใหญ่) |
| 11 | **ข่าวแปลไทยอัตโนมัติทั้งฟีด** | ตอนนี้กด "สรุปไทย" ทีละชิ้น — ไม่ได้แปลทั้งหน้าอัตโนมัติ (เล็ก-กลาง + ต้นทุน AI) |
| 12 | **หุ้นไทยใน impact-map น้อย** (~10 ตัว) | เพิ่ม PTTEP/GULF/DELTA/AOT ฯลฯ ให้ Radar จับคู่ตลาดไทยลึกขึ้น (เล็ก แก้ไฟล์เดียว) |
| 13 | **i18n อังกฤษ** | UI ไทยล้วน (ตามตลาดเป้าหมาย — ทำภายหลังถ้าขยาย) |
| 14 | **Automated tests** | ยังไม่มี test suite (vitest/pytest) — ทดสอบด้วยมือ+script มาตลอด (กลาง) |
| 15 | **Auto-update พอร์ตกูรู/ปฏิทินเหตุการณ์** | พอร์ตกูรู LIVE อัปเดตเอง ✓ แต่ `calendar.json` ต้องใส่มือทุกเดือน (เล็ก) |

---

## 4️⃣ ข้อจำกัด "โดยดีไซน์" (ไม่ใช่บั๊ก — ควรรู้ก่อนใช้/ขาย)
- ราคา delay ~15 นาที — เหมาะวิเคราะห์ ไม่เหมาะเทรดวินาที
- 13F ล่าช้า 45 วัน + เห็นเฉพาะหุ้นสหรัฐฯ + put=notional (เขียนเตือนทุกการ์ดแล้ว)
- สถานการณ์ Bull/Base/Bear และบทวิเคราะห์ AI = กรอบเชิงข้อมูล **ไม่ใช่คำแนะนำการลงทุน** (มี disclaimer ทุกจุดตามแนวทาง ก.ล.ต.)
- ทุกอย่างฟรีทั้งระบบ (Yahoo/TradingView/SEC ไม่มี key) — ถอยหลังไม่มีค่าใช้จ่าย แต่ถ้าแพลตฟอร์มเปลี่ยน API ต้องแก้จุดเดียวใน `src/lib/*`

## 5️⃣ ไฟล์สำคัญสำหรับทำต่อ
```
src/lib/            # yahoo.ts, tvscanner.ts, gurus13f.ts, radar.ts, timemachine.ts, backtest.ts, ai.ts, brief.ts, admin.ts, store.ts
src/data/           # ฐานความรู้ทั้งหมด (แก้ไขไม่ต้องแตะโค้ด)
src/app/            # หน้าเว็บ + api/
.env.local          # Gemini key + ADMIN_CODE + PromptPay (ห้าม push!)
README.md           # คู่มือเต็ม (วิธีรัน/ฟีเจอร์/workflow แอดมิน)
DEPLOY.md           # ขั้นตอนขึ้น Vercel
PROJECT-STATUS.md   # ไฟล์นี้
```
