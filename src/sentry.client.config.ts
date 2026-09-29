// ===== Sentry (ฝั่ง browser) — DSN-gated เหมือนฝั่ง server (ไม่มีค่า = ไม่โหลดอะไรเลย) =====
// Next 14 App Router: import ไฟล์นี้ที่ app/layout.tsx ครั้งเดียว (side-effect)
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0,
      environment: process.env.NODE_ENV,
    });
  });
}
