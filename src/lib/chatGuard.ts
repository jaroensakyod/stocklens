// ===== 🛡️ Chat Guard — กัน jailbreak / กันพ่น API key / กันยิงแชทรัวๆ =====
// ใช้ที่ /api/chat: ตรวจ input ก่อนส่ง LLM (จับ pattern เจตนาแฮก) + ขูด secret จาก output
// + rate limit ระดับ "รายคน" (แยกจากถังระดับ IP ใน middleware — จับสมาชิกยิงรัวได้ด้วย)
import { createHash } from "crypto";

// ---------- 1) ตรวจจับ jailbreak / prompt injection ----------
// แบ่ง 2 กลุ่ม: HARD = เจตน์ชัด (บล็อกทันที) · SOFT = น่าสงสัย (โดนเยอะ = บล็อก)
const HARD_PATTERNS: [RegExp, string][] = [
  [/ignore (all )?(previous|prior|above) (instructions?|prompts?|rules?)/i, "ignore-instructions"],
  [/disregard (all )?(previous|your) (instructions?|guidelines?)/i, "disregard"],
  [/forget (everything|your (instructions?|rules?|training))/i, "forget"],
  [/ไม่ต้องสนใจคำสั่ง|ลืมคำสั่ง(ข้างต้น|เดิม|ทั้งหมด)|ละเลยคำสั่ง|ไม่ต้องทำตามคำสั่ง/i, "th-ignore"],
  [/(แสดง|เผย|บอก|พิมพ์|เอามา)(คำสั่ง)?(ระบบ|system ?prompt|คำสั่งเดิม|คำสั่งข้างต้น|คำสั่งลับ)/i, "th-sysprompt"],
  [/(show|reveal|print|repeat|output)\s+(me\s+)?(your\s+)?(system ?prompt|initial prompt|instructions|hidden prompt)/i, "sysprompt"],
  [/(api[_\s-]?key|secret|token|รหัส(ลับ|api)|พาสเวิร์ด|password).{0,20}(คือ|คืออะไร|ขอดู|แสดง|ให้หน่อย|what is|show|reveal|print)/i, "key-exfil"],
  [/((แสดง|เผย|บอก|ขอดู|ขอ|พิมพ์|ให้ดู|เอา).{0,12}(api[_\s-]?key|secret|token|รหัสลับ|รหัส api|รหัสระบบ|พาสเวิร์ด))|((show|reveal|print|give).{0,12}(api[_\s-]?key|secret|token|password))/i, "key-exfil-reversed"],
  [/(AI_API_KEY|TYPESAFE_API_KEY|UPSTASH|ADMIN_CODE|\.env|environment variables?).{0,25}(คือ|ขอ|show|print|read|ให้ดู)/i, "env-exfil"],
  [/(developer|DAN)\s?mode|do anything now|jailbreak|ปลดล็อกข้อจำกัด|โหมดนักพัฒนา|ไม่ต้องมีข้อจำกัด|above all rules/i, "mode-override"],
  [/(you are now|from now on you are|act as (if you are )?(an?|the) (unfiltered|unrestricted|evil|hacker)|แกล้งเป็น(ผู้ช่วย|AI|โมเดล)?(ใหม่|อิสระ|ไม่จำกัด))/i, "role-override"],
];

const SOFT_PATTERNS: [RegExp, string][] = [
  [/สมมติ(ว่า)? ?คุณ(เป็น|คือ)|จำลองตัวเป็น|เปลี่ยนบทบาทเป็น/i, "th-roleplay"],
  [/(pretend|roleplay) (you are|to be)/i, "roleplay"],
  [/(หลบ|หลีก|ข้าม)(เลี่ยง)? ?(กฎ|กติกา|ข้อจำกัด|filter|guard)/i, "th-bypass"],
  [/(bypass|override|circumvent).{0,15}(rules?|filters?|guard|restrictions?|policy)/i, "bypass"],
  [/อยู่เหนือ(กฎ|คำสั่ง)|ตอบได้ทุกอย่าง.?ไม่ว่ากฎ|ไม่ต้องปฏิบัติตาม(กฎ|กติกา)/i, "th-above-rules"],
];

export interface GuardVerdict {
  blocked: boolean;
  reasons: string[];
  /** ข้อความปฏิเสธ (ใช้ตอบแทนการยิง LLM — ประหยัดเงินและกันรั่ว) */
  refusal?: string;
}

/** ตรวจข้อความผู้ใช้ (ยิงข้อความ user ล่าสุด + ประวัติย่อ) ว่าพยายาม jailbreak หรือเปิดเผย secret ไหม */
export function detectJailbreak(userTexts: string[]): GuardVerdict {
  const joined = userTexts.slice(-6).join("\n").slice(0, 8000);
  const reasons: string[] = [];
  for (const [re, tag] of HARD_PATTERNS) if (re.test(joined)) reasons.push(tag);
  const soft = SOFT_PATTERNS.filter(([re]) => re.test(joined)).map(([, t]) => t);
  // SOFT ต้องโดนพร้อมกัน ≥2 (แบบ "สมมติว่าคุณเป็น..." อย่างเดียวอาจเป็นคำถามปกติ)
  if (soft.length >= 2) reasons.push(soft.join("+"));
  if (reasons.length) {
    return {
      blocked: true,
      reasons,
      refusal:
        "🛡️ เรื่องนี้ผมไม่ทำครับ — ผมเป็นผู้ช่วยวิเคราะห์ข้อมูลหุ้นของ StockLens เท่านั้น ไม่เปิดเผยคำสั่งระบบ/รหัสภายใน และไม่เปลี่ยนบทบาทไม่ว่ากรณีใด\n\nถามเรื่องหุ้น/พอร์ต/กูรู/เหตุการณ์โลกได้เลยครับ เช่น **NVDA ตอนนี้เป็นไง** หรือ **วิเคราะห์พอร์ตฉันหน่อย**",
    };
  }
  return { blocked: false, reasons: soft };
}

// ---------- 2) ขูด secret ออกจาก output (กัน "พ่น API") ----------
const SECRET_RES: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/g, // OpenAI-style
  /\bAIza[0-9A-Za-z_-]{30,}/g, // Google-style
  /Bearer\s+[A-Za-z0-9._-]{16,}/gi,
  /\b(api[_-]?key|secret|token|password|รหัสลับ)\s*[:=]\s*["']?[A-Za-z0-9._-]{12,}/gi,
  /\b(ghp|gho|xox[bposa])_[A-Za-z0-9]{20,}/g,
];
// วลีเฉพาะจากคำสั่งระบบ — ถ้าโมเดลทำการ "ทวนคำสั่งระบบ" ให้ตัดทิ้ง
const SYS_MARKERS = [
  "คุณกำลังเป็น \"ผู้ช่วยแชท\" ของ StockLens",
  "ห้ามเดาเลขหุ้น/ราคา/คะแนนที่ไม่มีให้เด็ดขาด",
  "SYSTEM_ANALYST",
];

export function scrubSecrets(text: string): string {
  let out = text;
  for (const re of SECRET_RES) out = out.replace(re, "[🔒 ถูกปิดบัง]");
  for (const m of SYS_MARKERS) {
    const idx = out.indexOf(m);
    if (idx >= 0) out = out.slice(0, idx) + "[…ส่วนคำสั่งระบบไม่เปิดเผย]" + out.slice(idx + m.length);
  }
  return out;
}

/** TransformStream ที่ขูด secret ระหว่าง stream ออกไปหาผู้ใช้ */
export function scrubStream(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(enc.encode(scrubSecrets(dec.decode(chunk, { stream: true }))));
      },
    })
  );
}

// ---------- 3) Rate limit รายคน (Redis INCR — ทำงานบน Vercel หลังใส่ env แล้ว) ----------
const RU = process.env.UPSTASH_REDIS_REST_URL;
const RT = process.env.UPSTASH_REDIS_REST_TOKEN;

async function incrWindow(key: string, windowSec: number): Promise<number | null> {
  if (!RU || !RT) return null;
  try {
    const res = await fetch(`${RU}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${RT}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(windowSec + 1), "NX"],
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    const j = (await res.json()) as { result?: { result?: unknown }[] };
    const n = Number(j.result?.[0]?.result);
    return isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

const memChat = new Map<string, number[]>();

/** ลิมิตแชทรายคน: ห่างกันอย่างน้อย 2 วิ + ไม่เกิน 12 ข้อความ/10 นาที + 60/วัน (ทับถัง IP ใน middleware) */
export async function chatRateLimit(userId: string): Promise<{ ok: boolean; retryAfterSec: number; reason?: string }> {
  const id = createHash("sha1").update(userId).digest("hex").slice(0, 16);
  // cooldown 2 วิ
  const cd = await incrWindow(`chatg:cd:${id}`, 2);
  if (cd !== null && cd > 1) return { ok: false, retryAfterSec: 2, reason: "cooldown" };
  if (cd === null) {
    const now = Date.now();
    const arr = (memChat.get("cd" + id) ?? []).filter((t) => now - t < 2000);
    if (arr.length >= 1) return { ok: false, retryAfterSec: 2, reason: "cooldown" };
    arr.push(now);
    memChat.set("cd" + id, arr);
  }
  // 12 / 10 นาที
  const slot10 = Math.floor(Date.now() / 600_000);
  const n10 = await incrWindow(`chatg:w10:${id}:${slot10}`, 600);
  if (n10 !== null && n10 > 12) return { ok: false, retryAfterSec: 600, reason: "burst" };
  // 60 / วัน
  const slotD = Math.floor(Date.now() / 86_400_000);
  const nD = await incrWindow(`chatg:day:${id}:${slotD}`, 86400);
  if (nD !== null && nD > 60) return { ok: false, retryAfterSec: 3600, reason: "daily" };
  return { ok: true, retryAfterSec: 0 };
}
