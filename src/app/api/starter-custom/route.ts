import { NextRequest, NextResponse } from "next/server";
import { getStarterCustom, type StarterCustomOptions } from "@/lib/starterCustom";

// 🛠️ POST /api/starter-custom — ประกอบพอร์ตจากตัวเลือกของผู้ใช้ (สัดส่วนตลาด/จำนวนตัว/ธีม/เกรด/หุ้นซิ่ง)
// กติกาเดียวกับ /api/starter: rule-based ไม่มี AI ฟรีสำหรับทุกคน — ตัวอย่างเพื่อการเรียนรู้ ไม่ใช่คำแนะนำการลงทุน
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COUNTS = [3, 5, 8, 10, 12];
const GRADES = ["all", "AAA", "AA", "A", "B"] as const;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Partial<StarterCustomOptions> | null;
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

  try {
    const result = await getStarterCustom(opts);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[starter-custom] build failed:", e);
    return NextResponse.json({ error: "สร้างพอร์ตไม่สำเร็จ — ลองอีกครั้ง" }, { status: 500 });
  }
}
