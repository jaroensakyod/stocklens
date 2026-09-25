// Rate-limit กลาง — ก่อนเปิดใช้จริงบน internet (ป้องกันคนยิง AI/ค่าใช้จ่าย/scraper)
import { NextRequest, NextResponse } from "next/server";

// หมายเหตุ: in-memory — พอสำหรับ instance เดียว (Vercel serverless อาจแยก instance,
// ยกฐานะเป็น DB-backed ภายหลังเมื่อคนเยอะ)

const AI_BUCKET = { limit: 20, windowMs: 5 * 60_000 }; // /api/chat, /api/ai/*, /api/gurus/why, /api/radar/analyze, /api/timemachine
const GEN_BUCKET = { limit: 120, windowMs: 60_000 }; // /api/* ทั่วไป

const hits = new Map<string, number[]>();

function limited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  // กันหน่วยความจำโต: ถ้า map ใหญ่เกิน เช็ดของเก่า
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k);
  }
  return false;
}

const AI_PATHS = ["/api/chat", "/api/ai/", "/api/gurus/why", "/api/radar/analyze", "/api/timemachine"];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 🚪 โหมดปิดเว็บส่วนตัว: ตั้ง SITE_REQUIRE_LOGIN=true ใน .env.local → ทุกหน้าต้อง login ก่อน
  // (ค่า default = false เพื่อให้หน้าฟรียังดึงคนเข้าเว็บได้ — เปิดเมื่อพร้อมปิดระบบเต็มตัว)
  if (process.env.SITE_REQUIRE_LOGIN === "true") {
    const isPublic =
      path.startsWith("/login") ||
      path.startsWith("/api/auth") ||
      path.startsWith("/_next") ||
      path === "/favicon.ico" ||
      path === "/manifest.webmanifest" ||
      path === "/sw.js" ||
      path.startsWith("/icons/");
    const hasSession = !!req.cookies.get("sl_token")?.value;
    if (!isPublic && !hasSession) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ error: "ต้องเข้าสู่ระบบสมาชิกก่อน" }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  if (!path.startsWith("/api/")) return NextResponse.next();
  // /api/admin/* ยกเว้น (มีรหัสคุมอยู่แล้ว) และไฟล์ static
  if (path.startsWith("/api/admin")) return NextResponse.next();

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const bucket = AI_PATHS.some((p) => path.startsWith(p)) ? AI_BUCKET : GEN_BUCKET;
  if (limited(ip + ":" + bucket.limit, bucket.limit, bucket.windowMs)) {
    return NextResponse.json(
      { error: "คำขอเยอะเกินไป (rate limit) — พักสักครู่แล้วลองใหม่ หรือลดความถี่การกด" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
