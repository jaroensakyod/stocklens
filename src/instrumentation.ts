// ===== Sentry (ฝั่ง server/edge) — เปิดเฉพาะเมื่อมี NEXT_PUBLIC_SENTRY_DSN (ไม่มี = ทำงานเหมือนไม่มี Sentry) =====
// วิธีใช้: สมัคร sentry.io (ฟรี 5,000 error/เดือน) → สร้าง project Next.js → คัดลอก DSN ใส่ .env.local:
//   NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/123
// Next 14 ต้องเปิด experimental.instrumentationHook ใน next.config.js (เปิดไว้แล้ว)
export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME !== "nodejs" && process.env.NEXT_RUNTIME !== "edge") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0, // ฟรี tier: เก็บ error อย่างเดียว ไม่กิน performance quota
    environment: process.env.NODE_ENV,
  });
}
