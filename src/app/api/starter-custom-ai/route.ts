import { NextRequest, NextResponse } from "next/server";
import { getStarterCustomAI } from "@/lib/starterCustomAI";
import type { StarterCustomOptions } from "@/lib/customThemes";

// 🧠 POST /api/starter-custom-ai — โหมด "ให้ Jev จัดให้" บนพอร์ตมือใหม่
// Jev คัดตัวจากคลังจริง (ถูกมาก) + GLM เขียนวิเคราะห์ + Jev ตรวจซ้ำ — ฟรีสำหรับทุกคนตามแพตเทิร์น /api/political
// ทุกขั้นมี fallback เป็นเครื่องยนต์กฎเสมอ — ตัวอย่างเพื่อการเรียนรู้ ไม่ใช่คำแนะนำการลงทุน
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COUNTS = [3, 5, 8, 10, 12];
const GRADES = ["all", "AAA", "AA", "A", "B"] as const;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as (Partial<StarterCustomOptions> & { brief?: unknown }) | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
  const mixRaw = (body.mix ?? {}) as Record<string, unknown>;
  const opts: StarterCustomOptions = {
    mix: { th: num(mixRaw.th), us: num(mixRaw.us), fund: num(mixRaw.fund), intl: num(mixRaw.intl) },
    count: COUNTS.includes(Number(body.count)) ? Number(body.count) : 5,
    themes: Array.isArray(body.themes) ? body.themes.filter((t) => typeof t === "string").slice(0, 15) : [],
    regions: Array.isArray(body.regions) ? body.regions.filter((r) => typeof r === "string").slice(0, 8) : [],
    minGrade: (GRADES as readonly string[]).includes(String(body.minGrade)) ? (body.minGrade as StarterCustomOptions["minGrade"]) : "all",
    momentum: body.momentum === true,
  };
  if (opts.mix.th + opts.mix.us + opts.mix.fund + opts.mix.intl <= 0) {
    return NextResponse.json({ error: "mix ต้องมีอย่างน้อย 1 ส่วน > 0" }, { status: 400 });
  }
  // โจทย์ภาษาอิสระของผู้ใช้ — ตัดตัวควบคุม + จำกัดความยาว ก่อนส่งเข้า AI
  const brief = typeof body.brief === "string" ? body.brief.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 300) : "";

  try {
    const result = await getStarterCustomAI(opts, brief);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[starter-custom-ai] build failed:", e);
    return NextResponse.json({ error: "สร้างพอร์ตไม่สำเร็จ — ลองอีกครั้ง หรือใช้ปุ่มประกอบด้วยเครื่องยนต์ก่อน" }, { status: 500 });
  }
}
