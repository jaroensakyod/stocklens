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
  matcher: ["/api/:path*"],
};
