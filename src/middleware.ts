// 🔒 Security กลาง — 3 ชั้น: (1) บล็อก AI crawler ที่ runtime (2) rate limit Redis-backed กันยิง API
// (3) security headers + noai กัน AI ดึงไปเทรน — ใช้ Upstash Redis ถ้าตั้ง env ไว้ (ข้าม instance ได้จริงบน Vercel)
// fallback in-memory เสมอ — Redis ล่มไม่กระทบผู้ใช้ปกติ
import { NextRequest, NextResponse } from "next/server";

// ---------- ชั้น 1: บล็อก AI bot/crawler ที่ runtime (robots.txt ฝ่ายละเมิดได้ อันนี้บังคับจริง) ----------
const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "Claude-SearchBot", "anthropic-ai",
  "CCBot", "Google-Extended", "Google-Extended-AI", "Bytespider", "Amazonbot", "PerplexityBot", "Perplexity-User",
  "Diffbot", "YouBot", "Omgilibot", "OMGI", "ImagesiftBot", "cohere-ai", "Applebot-Extended", "meta-externalagent",
  "FacebookBot", "VelenPublicWebCrawler", "DuckAssistBot", "Timpibot", "iaskspider", "Panscient", "Rowsagent",
  "Scrapy", "python-requests", "curl/", "wget", "httpx", "node-fetch", "axios/",
];
const AI_UA_RE = new RegExp(`(${AI_BOTS.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "i");
// หมายเหตุ curl/wget/python-requests บล็อกเฉพาะเมื่อไม่ได้แอบอ้าง UA เบราว์เซอร์ — สคริปต์ที่แอบอ้างจะตกไปโดน rate limit แทน

// ---------- ชั้น 2: rate limit — Redis fixed-window (primary) + in-memory (fallback) ----------
type Bucket = { id: string; limit: number; windowSec: number };
const BUCKET_AI: Bucket = { id: "ai", limit: 20, windowSec: 300 }; // AI แพง: 20 ครั้ง/5 นาที
const BUCKET_AUTH: Bucket = { id: "auth", limit: 8, windowSec: 600 }; // login: กัน brute force รหัส
const BUCKET_ADMIN: Bucket = { id: "admin", limit: 10, windowSec: 60 }; // เดารหัสแอดมิน
const BUCKET_GEN: Bucket = { id: "gen", limit: 120, windowSec: 60 }; // API ทั่วไป
const BUCKET_PAGE: Bucket = { id: "page", limit: 240, windowSec: 60 }; // หน้า HTML — กันครอว์เร็วจัง

const AI_PATHS = ["/api/chat", "/api/ai/", "/api/gurus/why", "/api/radar/analyze", "/api/timemachine", "/api/starter-custom-ai", "/api/advisor-backtest", "/api/portfolio-xray"];

const RU = process.env.UPSTASH_REDIS_REST_URL;
const RT = process.env.UPSTASH_REDIS_REST_TOKEN;

/** Redis INCR+EXPIRE (fixed window) — true = เกินลิมิต · null = Redis ใช้ไม่ได้ (ให้ fallback) */
async function redisLimited(key: string, limit: number, windowSec: number): Promise<boolean | null> {
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
    if (!res.ok) return null;
    const j = (await res.json()) as { result?: { result?: unknown }[] };
    const count = Number(j.result?.[0]?.result);
    if (!isFinite(count)) return null;
    return count > limit;
  } catch {
    return null;
  }
}

// in-memory fallback (เอาตัวรอดเมื่อไม่มี Redis / Redis ล่ม)
const hits = new Map<string, number[]>();
function memLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 8000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return false;
}

async function isLimited(ip: string, b: Bucket): Promise<boolean> {
  const slot = Math.floor(Date.now() / (b.windowSec * 1000));
  const rkey = `rl:${b.id}:${ip}:${slot}`;
  const viaRedis = await redisLimited(rkey, b.limit, b.windowSec);
  if (viaRedis !== null) return viaRedis;
  return memLimited(`m:${b.id}:${ip}`, b.limit, b.windowSec * 1000);
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // ชั้น 1: AI bot → 403 ทันที (ทุก path รวมหน้า HTML และ API)
  const ua = req.headers.get("user-agent") ?? "";
  if (ua && AI_UA_RE.test(ua)) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "X-Robots-Tag": "noai, noimageai, noindex, nofollow" },
    });
  }

  // 🚪 โหมดปิดเว็บส่วนตัว: SITE_REQUIRE_LOGIN=true → ทุกหน้าต้อง login
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

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";

  // ชั้น 2: เลือกถังตามชนิด request
  let bucket: Bucket;
  if (path.startsWith("/api/admin")) bucket = BUCKET_ADMIN;
  else if (path.startsWith("/api/auth")) bucket = BUCKET_AUTH;
  else if (AI_PATHS.some((p) => path.startsWith(p)) || (path === "/api/political" && req.method === "POST")) bucket = BUCKET_AI;
  else if (path.startsWith("/api/")) bucket = BUCKET_GEN;
  else bucket = BUCKET_PAGE;

  // หน้า HTML ใช้ in-memory อย่างเดียว (เร็ว ไม่ต้องรอ Redis ทุกคลิก) / API ใช้ Redis
  const limited =
    bucket === BUCKET_PAGE
      ? memLimited(`m:page:${ip}`, bucket.limit, bucket.windowSec * 1000)
      : await isLimited(ip, bucket);
  if (limited) {
    return NextResponse.json(
      { error: "คำขอเยอะเกินไป (rate limit) — พักสักครู่แล้วลองใหม่ หรือลดความถี่การกด" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // ชั้น 3: security headers + บอก AI ว่าห้ามใช้เทรน
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noai, noimageai");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // CSP (กัน XSS) — อนุญาตเฉพาะ origin ของเรา + inline styles (Tailwind ต้องใช้)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${siteUrl ? siteUrl + " " : ""}https://cloud.umami.is https://www.youtube.com https://s.ytimg.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: blob: https:`,
    `connect-src 'self' ${siteUrl ? siteUrl + " " : ""}https://cloud.umami.is https://api.typesafe.ai`,
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);

  // ⚠️ เตือน (ครั้งเดียวต่อ instance) ถ้า ADMIN_CODE ยังเป็น default
  const g = globalThis as unknown as { _warnedAdminCode?: boolean };
  if (process.env.ADMIN_CODE === "stocklens-admin" && !g._warnedAdminCode) {
    g._warnedAdminCode = true;
    console.warn("⚠️  ADMIN_CODE ยังเป็น default ('stocklens-admin') — เปลี่ยนใน Vercel env ก่อนเปิดใช้จริง!");
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
