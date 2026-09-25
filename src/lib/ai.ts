// ===== AI Adapter — OpenAI-compatible (GLM ของ Z.ai / OpenAI / ค่ายอื่น) =====
// ไม่ใส่ AI_API_KEY = ทุกหน้ายังใช้ได้ (โหมดตัวอย่างจากคะแนนปัจจัย + ระบบคีย์เวิร์ด)

export function aiConfig() {
  return {
    baseUrl: process.env.AI_BASE_URL || "https://api.openai.com/v1",
    apiKey: process.env.AI_API_KEY || "",
    model: process.env.AI_MODEL || "gpt-4o-mini",
  };
}

export function hasAI(): boolean {
  return !!aiConfig().apiKey;
}

/** แปลง error จาก LLM เป็นข้อความไทยที่บอกวิธีแก้จริง */
export function friendlyAIError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("1113") || (msg.includes("429") && /balance|resource/i.test(msg))) {
    return "AI key ถูกต้อง แต่บัญชียังไม่มียอดเงิน — ไปที่ console ของผู้ให้บริการ (เช่น z.ai) เติมเงินหรือรับ resource package ฟรี แล้วใช้ได้ทันที ไม่ต้องรีสตาร์ทอะไร";
  }
  if (msg.startsWith("AI 401") || msg.includes("Unauthorized") || msg.includes("invalid_api_key")) {
    return "AI key ไม่ถูกต้อง (401) — ตรวจ AI_API_KEY ใน .env.local";
  }
  if (msg.startsWith("AI 404")) {
    return "ชื่อโมเดลอาจไม่ถูกต้อง (404) — ตรวจ AI_MODEL ใน .env.local";
  }
  return msg.slice(0, 140);
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** เรียก LLM แบบ stream — คืน ReadableStream ของข้อความ (text ตามลำดับ) */
export async function chatStream(messages: ChatMessage[], temperature = 0.4, maxTokens?: number): Promise<ReadableStream<Uint8Array>> {
  const { baseUrl, apiKey, model } = aiConfig();
  const res = await fetch(baseUrl.replace(/\/$/, "") + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature, stream: true, ...(maxTokens ? { max_tokens: maxTokens } : {}) }),
  });
  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`AI ${res.status}: ${errText.slice(0, 300)}`);
  }
  const upstream = res.body;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const s = line.trim();
            if (!s.startsWith("data:")) continue;
            const payload = s.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // ข้ามบรรทัดที่ parse ไม่ได้
            }
          }
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

/** เรียก LLM แบบรอผลทั้งก้อน (สำหรับงานสั้น เช่น คัดหุ้น แปลงเป็น JSON) */
export async function chatOnce(messages: ChatMessage[], temperature = 0.2): Promise<string> {
  const { baseUrl, apiKey, model } = aiConfig();
  const res = await fetch(baseUrl.replace(/\/$/, "") + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

export const SYSTEM_ANALYST = `คุณคือ "นักวิเคราะห์หุ้นมืออาชีพ" ของ StockLens — สื่อวิเคราะห์การลงทุนภาษาไทย
หลักการเขียน:
- วิเคราะห์จาก "ข้อมูลจริง" ที่ผู้ใช้ส่งให้เท่านั้น ห้ามเดาตัวเลขที่ไม่มีให้ ถ้าข้อมูลขาดให้บอกว่าขาด
- เขียนภาษาไทยเป็นระยะๆ อ่านง่ายแบบคนเก่งเล่าให้คนทั่วไปฟัง ใช้ตัวเลขกำกับเสมอ
- โครงสร้าง: ภาพรวม → จุดแข็ง → ความเสี่ยง → มุมมองพื้นฐาน/เทคนิค → สรุป (สั้น กระชับ)
- ใช้ markdown หัวข้อ ## และรายการ - ได้ แต่ห้ามใช้ตาราง
- ปิดท้ายทุกครั้งด้วยบรรทัด: "⚠️ บทวิเคราะห์เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน การลงทุนมีความเสี่ยง"
- ห้ามใช้คำว่า "ควรซื้อ/ควรขาย" โดยตรง ใช้ "มีปัจจัยหนุน/มีแรงกดดัน/น่าติดตาม" แทน`;

export const SYSTEM_EVENT = `คุณคือนักวิเคราะห์มหภาค (macro analyst) ของ StockLens ภาษาไทย
หน้าที่: รับ "เหตุการณ์" ที่ผู้ใช้เล่าเป็นภาษาไทย แล้ววิเคราะห์ห่วงโซ่ผลกระทบสู่สินค้าโภคภัณฑ์/อุตสาหกรรม/หุ้น
ตอบเป็น JSON เท่านั้น รูปแบบ:
{"headline":"สรุปเหตุการณ์+ความเชื่อมโยง 1 ประโยค","narrative":"วิเคราะห์ 3-5 ประโยค เป็นภาษาไทย","chains":[{"nodeId":"<id จาก impact map ถ้าตรง>","name":"ชื่อสินค้า/อุตสาหกรรมไทย","direction":"up หรือ down (ทิศทางราคา/ความรุนแรง)","stocks":[{"ticker":"SYMBOL","market":"US|TH|HK|JP|EU","direction":"positive|negative","strength":"strong|medium|weak","reason":"เหตุผลภาษาไทย"}]}]}
กติกา: เลือกหุ้น US/ไทย ที่มีสภาพคล่องเท่านั้น 5-12 ตัวรวมกันทุก chain · ถ้าไม่แน่ใจตัวไหนให้ตัดออก · ห้ามเดาตัวเลขราคา`;

export const SYSTEM_NEWS = `คุณคือบรรณาธิการข่าวการเงินภาษาไทยของ StockLens สรุปข่าวอังกฤษเป็นไทย 2-3 ประโยค กระชับ คงตัวเลขสำคัญ บอกว่ากระทบใคร (ถ้าระบุได้) ไม่ต้องแปลชื่อเฉพาะทั้งหมด ตอบเป็นข้อความธรรมดาเท่านั้น ห้าม markdown`;
