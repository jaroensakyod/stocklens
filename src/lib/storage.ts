// ===== Storage 2 ชั้น: Upstash Redis (ใช้บน Vercel) / ไฟล์ JSON (dev ที่เครื่อง) =====
// ทำไมต้องมีนี้: Vercel เป็น serverless — เขียนไฟล์ไม่คงอยู่ (reset ทุก deploy/instance)
// วิธีใช้บน Vercel: สมัคร upstash.com (ฟรี) → สร้าง Redis → ใส่ env 2 ตัว:
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN  → ระบบสลับไปใช้ DB อัตโนมัติ
// ใช้ REST API ตรงๆ ผ่าน fetch — ไม่ต้องติดตั้ง dependency เพิ่ม

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export function hasDB(): boolean {
  return !!(URL_ && TOKEN);
}

/** อ่าน JSON จาก Redis (คืน null ถ้าไม่มี key / ไม่ได้ตั้ง DB) */
export async function kvGet<T>(key: string): Promise<T | null> {
  if (!hasDB()) return null;
  try {
    // cache: "no-store" สำคัญมาก — Redis เป็น cache ของตัวเองแล้ว ถ้าปล่อยให้ Next แคช fetch นี้
    // เราจะอ่านได้แต่ค่าเก่าหลังมีการเขียนใหม่ (เจอจริงตอนทดสอบ track-record อัตโนมัติ)
    const res = await fetch(`${URL_}/get/${key}`, { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" });
    const j = (await res.json()) as { result?: string | null };
    if (!j.result) return null;
    return JSON.parse(j.result) as T;
  } catch {
    return null;
  }
}

/** เขียน JSON ลง Redis (ttlSec = อายุ key แบบหมดเวลา เช่น cache 10 นาที = 600) */
export async function kvSet(key: string, value: unknown, ttlSec?: number): Promise<boolean> {
  if (!hasDB()) return false;
  try {
    const res = await fetch(`${URL_}/set/${key}${ttlSec ? `?EX=${ttlSec}` : ""}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** ลบ key ออกจาก Redis */
export async function kvDel(key: string): Promise<boolean> {
  if (!hasDB()) return false;
  try {
    const res = await fetch(`${URL_}/del/${key}`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` } });
    return res.ok;
  } catch {
    return false;
  }
}
