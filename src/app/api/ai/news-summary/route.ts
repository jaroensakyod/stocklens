import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { chatOnce, hasAI, SYSTEM_NEWS } from "@/lib/ai";

export const dynamic = "force-dynamic";

// POST /api/ai/news-summary { title, publisher } — สรุปข่าวอังกฤษเป็นไทย (ถ้าไม่มี key คืนค่าว่างเปล่า)
export async function POST(req: NextRequest) {
  // 🔒 AI = สิทธิ์สมาชิก Starter ขึ้นไป (free ใช้ไม่ได้)
  const guard = requireMember(req);
  if (!guard.ok) return Response.json({ error: "🔒 การใช้ AI เป็นสิทธิ์สมาชิก Starter ขึ้นไป — เข้าสู่ระบบด้วยรหัสสมาชิกที่หน้า /login" }, { status: 401 });
  if (!hasAI()) return NextResponse.json({ summary: "", aiAvailable: false });
  const { title, publisher } = (await req.json().catch(() => ({}))) as { title?: string; publisher?: string };
  if (!title) return NextResponse.json({ error: "missing title" }, { status: 400 });
  try {
    const summary = await chatOnce(
      [
        { role: "system", content: SYSTEM_NEWS },
        { role: "user", content: `ข่าวจาก ${publisher ?? "สำนักข่าว"}: ${title}` },
      ],
      0.3
    );
    return NextResponse.json({ summary, aiAvailable: true });
  } catch (e) {
    return NextResponse.json({ summary: "", aiAvailable: true, error: (e as Error).message.slice(0, 120) });
  }
}
