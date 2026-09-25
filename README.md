# 🔬 StockLens — เว็บวิเคราะห์หุ้น Multi-Market + Global Radar + ระบบ VIP

เว็บวิเคราะห์หุ้นภาษาไทยระดับมืออาชีพ: คะแนนปัจจัย 5 มิติ · สัญญาณเทคนิค · AI วิเคราะห์ภาษาไทย · **Global Radar** ที่แปลง "เหตุการณ์โลก" เป็นห่วงโซ่หุ้นที่ได้/เสียประโยชน์ · Screener · พอร์ตกูรู · ระบบสมาชิก VIP พร้อมเครื่องออกรายงาน PDF

> ⚠️ เป็นสื่อบทวิเคราะห์เชิงข้อมูล (research/education) ไม่ใช่คำแนะนำการลงทุนเฉพาะบุคคล

---

## 🚀 เริ่มใช้งาน (สำหรับเครื่องนี้)

```bash
cd C:\Users\ASUS\Desktop\newdata
npm run dev        # โหมดพัฒนา → เปิด http://localhost:3000
# หรือ
npm run build && npm start
```

**ไม่ต้องมี API key ใดๆ ก็ใช้ได้ทันที** — ข้อมูลราคา/งบ/ข่าวดึงจาก Yahoo Finance โดยตรง (ฟรี, delay ~15 นาที)

---

## ✨ ฟีเจอร์หลัก

| หน้า | ทำอะไร |
|---|---|
| **/** หน้าแรก | ดัชนี 6 ตลาด · ข่าวสด 48 ชม.+ปุ่ม "สรุปไทย" · **Top Movers แยกตามตลาด** (🇺🇸🇹🇭🇭🇰🇯🇵🇰🇷🇹🇼) · ปฏิทิน Fed/CPI |
| **💬 แชท AI (ทุกหน้า)** | ปุ่มลอยมุมขวาล่าง — ถามได้ 3 แบบ: **"วันนี้มีอะไรน่าสนใจ"** (สรุปตลาดสด: ดัชนี/movers ทั้งตลาด/พรีมาร์เก็ต/ธีมร้อน/ข่าว 48 ชม.) · พิมพ์ชื่อหุ้น (ดึงข้อมูลจริง) · เล่าเหตุการณ์ (ห่วงโซ่ Radar) — หลักการ truth-packet ไม่ให้ AI เดาเลข |
| **/stock/[TICKER]** | กราฟแท่งเทียน (TradingView) · **คะแนนปัจจัย 5 มิติ** (คำนวณจากงบ filings จริง) · สัญญาณเทคนิค (RSI/MACD/SMA/Bollinger) · **AI วิเคราะห์ภาษาไทย 4 มุมมอง** (นักวิเคราะห์ / 🦈Burry / 🍦Buffett / 🕵️Lynch) · **🎯 สถานการณ์ Bull/Base/Bear + ราคาเป้าหมายจาก EPS จริง** · **🔍 แผง Trust** (ข้อมูลครบกี่ % ขาดอะไร) · ป้าย "ซื้อได้ใน Dime!" + ราคาบาท + เครื่องคำนวณเศษหุ้น · 📝 บันทึกสมมติฐานลง Track Record |
| **/radar** Global Radar | พิมพ์เหตุการณ์ภาษาไทย เช่น *"ฝนตกหนักที่แอฟริกาตะวันตก"* → แสดงห่วงโซ่ เหตุการณ์→สินค้า→หุ้น ✅/❌ พร้อมราคาจริง + ช่องทางซื้อ + ความร้อน 8 ธีม (สงคราม/สงครามการค้า/อาหาร/อากาศ/น้ำ/อวกาศ/อาวุธ/ดีลใหม่) |
| **/screener** | **คัดกรองทั้งตลาด 30 ประเทศ** (🇺🇸1,000+ ตัว · ตลาดอื่น 400/ตลาด จาก TradingView scanner แบบเดียวกับ bazi-investor-guide) — **หมวดหมู่จริง 18-20 sectors + อุตสาหกรรมย่อย 60-70 รายการ** · IPO ใหม่ ≤1 ปี · 🌅 Premarket เด่น · ค้นหา · ทุกตัวคลิกเข้าหน้าวิเคราะห์เต็ม (หุ้นหมวด/อุตสาหกรรมจริงแสดงบนหน้าหุ้นด้วย และป้อนเข้า AI) |
| **/gurus** | **13F สดจาก SEC EDGAR โดยตรง** — 7 สำนัก LIVE (Buffett $299B / Simons / Dalio / Ackman / Tiger / Klarman / Druckenmiller งวดล่าสุด + cache 12 ชม.) + 2 snapshot (Burry — Scion เลิกยื่นแล้ว, ARK) · % พอร์ต · มูลค่า · PUT/CALL · 💡เหตุผลคัดสรร · 🧠 ปุ่ม "ทำไมเขาถึงเลือก (AI ถอดรหัสจาก holdings จริง)" |
| **/portfolio** พอร์ตของฉัน | **⭐ Watchlist** (กดดาวที่หน้าหุ้น · ราคาสดทุก 90 วิ) · **💼 พอร์ต** (ใส่จำนวนหุ้น+ราคาซื้อ รับเศษหุ้นได้ → กำไร/ขาดทุน $ + ฿ + **การ์ด "เหตุการณ์โลกที่กระทบพอร์ตคุณ"** เรียงตามความร้อนธีม) · **🔔 แจ้งเตือนราคา** (ตั้ง "NVDA ลงถึง 200 บอกฉัน" → แจ้งผ่านเบราว์เซอร์) — เก็บในเครื่อง ไม่ต้องสมัคร |
| **/backtest** | 🧪 พิสูจน์กลยุทธ์ด้วยข้อมูลจริง ~5 ปี (RSI Oversold / Golden Cross / SMA200 Filter) — win rate, รวม, ± vs Buy&Hold, drawdown, กราฟ equity · รันกับชุดสำเร็จหรือ "พอร์ตของฉัน" ได้เลย |
| **/compare** | เทียบ 2–4 ตัว ข้ามตลาด ในตารางเดียว |
| **/pricing** | หน้าขาย VIP 2 ระดับ (Starter/Pro) + PromptPay |
| **/track-record** | Track Record สาธารณะ — หัวใจการสร้างความเชื่อใจ |
| **/admin** | Admin Console: จัดการสมาชิก/ต่ออายุ + **โพสต์ Facebook พร้อมโพสต์ (Daily Brief Starter/Pro)** |
| **/report/print** | รายงานพร้อมพิมพ์ PDF (A4 + watermark ระดับสมาชิก): `?type=brief&tier=pro` / `?type=deepdive&t=AAPL&tier=pro` |

---

## 🤖 เปิดใช้ AI จริง (แนะนำ — GLM ของ Z.ai ราคาถูก)

ไม่ใส่ key: ทุกหน้าใช้ได้ปกติ แต่ AI จะเป็น "โหมดตัวอย่าง" (ประกอบจากคะแนนจริงอัตโนมัติ)

```bash
copy .env.local.example .env.local   # แล้วแก้ไขไฟล์
```

```ini
AI_BASE_URL=https://api.z.ai/api/paas/v4     # GLM (Z.ai) หรือ https://api.openai.com/v1
AI_API_KEY=<ใส่ key ของคุณ>
AI_MODEL=glm-4.7                              # หรือ gpt-4o-mini

ADMIN_CODE=<เปลี่ยนรหัสหน้า /admin>
NEXT_PUBLIC_PROMPTPAY_NAME=<ชื่อบัญชี>
NEXT_PUBLIC_PROMPTPAY_ID=<เบอร์พร้อมเพย์>
NEXT_PUBLIC_FB_STARTER_URL=<ลิงก์กลุ่ม FB Starter>
NEXT_PUBLIC_FB_PRO_URL=<ลิงก์กลุ่ม FB Pro>
```

รองรับทุกค่ายที่ใช้ schema OpenAI-compatible (GLM, OpenAI, DeepSeek, Ollama ท้องถิ่น ฯลฯ) — แก้ 3 บรรทัดแรกเป็นของค่ายนั้น

---

## 💼 Workflow ประจำวันของแอดมิน (~10 นาที/วัน)

1. เปิด **/admin** → ดูคนใกล้หมดอายุ (แถบแดง) → ทวง PromptPay
2. กด **"📄 Daily Brief (Starter)"** / **"(Pro)"** → หน้ารายงานขึ้น → `Ctrl+P → Save as PDF` (A4, watermark อยู่แล้ว)
3. กลับมาที่ /admin → กด **"คัดลอก"** โพสต์ FB → ไปแปะในกลุ่ม Facebook ตามระดับ
4. เกิดเหตุการณ์ใหญ่ → รับแจ้ง → เปิด /radar พิมพ์เหตุการณ์ → ออก **Flash Report** ส่งกลุ่ม Pro ใน 24 ชม.
5. เหตุการณ์สำคัญ/งบรายไตรมาส → `/stock/TICKER` → ปุ่ม "📄 รายงาน PDF" → Deep Dive
6. เมื่อสมมติฐานเป็นจริง/พลาด → บันทึกที่ `src/data/track-record.json` (หน้า Track Record อัปเดตทันที)

**หลักการแบ่ง 2 กลุ่ม**: Starter (Daily Brief + Weekly ย่อ) / Pro (+Flash 24 ชม. + Deep Dive + Live Q&A) — ต่างกันที่ *ชนิดของข้อมูล* ไม่ใช่แค่ความถี่ จะกันแคปหน้าจอข้ามกลุ่ม

---

## 📁 โครงสร้างสำคัญ

```
src/
├── app/            # หน้าเว็บ + API routes (/api/quote, /api/analysis, /api/radar/analyze, /api/ai/*, /api/brief, /api/admin/*)
├── lib/
│   ├── yahoo.ts    # ดึงข้อมูล Yahoo ตรงๆ (spark/chart/timeseries/search/news) + cache + คำนวณ ratios
│   ├── factors.ts  # คะแนนปัจจัย 5 มิติ
│   ├── indicators.ts # RSI/MACD/SMA/Bollinger
│   ├── radar.ts    # จับคู่เหตุการณ์→ธีม→ห่วงโซ่
│   ├── ai.ts       # adapter OpenAI-compatible + system prompts
│   └── brief.ts    # Daily Brief + โพสต์ FB
├── data/           # ⭐ ฐานความรู้ทั้งหมด — แก้ไขได้ไม่ต้องแตะโค้ด
│   ├── impact-map.json      # ห่วงโซ่ สินค้า/เหตุการณ์ → หุ้น (+เหตุผลไทย) เพิ่มของใหม่ที่นี่!
│   ├── radar-themes.json    # 8 ธีม + คีย์เวิร์ด
│   ├── universe.json        # รายชื่อหุ้น US สำหรับ screener
│   ├── set-watchlist.json   # รายชื่อหุ้นไทย
│   ├── guru-portfolios.json # พอร์ตกูรู (อัปเดตเมื่อ 13F ใหม่ออก)
│   ├── calendar.json        # ปฏิทินเหตุการณ์
│   ├── plans.json           # ราคา/สิ่งที่ได้ของ VIP
│   ├── track-record.json    # Track Record
│   └── members.json         # ทะเบียนสมาชิก (/admin ใช้)
└── components/     # PriceChart, FactorRadar, MacroChain, BrokerBadge, BudgetCalc, ...
```

---

## 🧠 วิธีคำนวณ (Methodology)

- **ข้อมูลดิบ**: Yahoo Finance (spark / v8 chart / fundamentals-timeseries / search) — งบมาจาก filings รายไตรมาสจริง แล้วคำนวณเอง: TTM รายได้/กำไร, EPS, ROE, มาร์จิ้น, D/E, Current Ratio, FCF, P/E, P/B, P/S, EV/EBITDA
- **Valuation** = P/E, P/B, P/S, EV/EBITDA (ยิ่งถูกยิ่งคะแนนสูง) · **Growth** = รายได้/กำไร YoY · **Profitability** = มาร์จิ้น+ROE/ROA · **Momentum** = ผลตอบแทนจริง 3/6/12 เดือน · **Health** = หนี้/สภาพคล่อง/FCF
- **ตลาดนอกสหรัฐฯ**: ราคา+กราฟ+AI เต็ม แต่ข้อมูลงบอาจขาด — ระบบระบุ "ข้อมูลขาด" ตรงๆ ไม่เดา
- **Radar**: มี AI key = LLM วิเคราะห์ + ฐานความรู้ · ไม่มี = จับคู่คีย์เวิร์ดไทย-อังกฤษกับ `impact-map.json`

## ⚠️ ข้อควรรู้

- ราคา delay ~15 นาที (เหมาะกับการวิเคราะห์ ไม่ใช่เทรดความเร็วสูง)
- พอร์ตกูรู = snapshot มีความล้าหลัง/เปลี่ยนแปลงเสมอ (13F ล่าหลัง 45 วัน, notional ไม่ใช่เงินจริง)
- การขาย "คำแนะนำการลงทุนเฉพาะบุคคล" เป็นกิจกรรมที่ ก.ล.ต. ควบคุม — ระบบทุกหน้าวางตำแหน่งเป็น **สื่อบทวิเคราะห์เชิงข้อมูล + disclaimer** อยู่แล้ว ถ้าธุรกิจโตควรปรึกษาผู้เชี่ยวชาญด้านกฎหมายเพิ่ม
- หาก Yahoo เปลี่ยน API ในอนาคต: แก้ที่ `src/lib/yahoo.ts` จุดเดียว
