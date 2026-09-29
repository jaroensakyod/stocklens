"use client";

// global-error (App Router) — ทุก error ที่ไม่มี error.tsx รับไว้ จะมาที่นี่: ส่งเข้า Sentry + แสดงหน้ากู้คืน
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
  }
  return (
    <html lang="th">
      <body style={{ background: "#09090b", color: "#e4e4e7", fontFamily: "inherit", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <p style={{ fontSize: 48, margin: 0 }}>🛠️</p>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "12px 0 8px" }}>เกิดข้อผิดพลาดชั่วคราว</h1>
          <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6, margin: 0 }}>
            หน้านี้พังตอนแสดงผล — ระบบบันทึกปัญหาอัตโนมัติแล้ว (แอดมินจะเห็นใน Sentry)
            {error.digest ? <> · รหัสอ้างอิง <code style={{ color: "#eab308" }}>{error.digest}</code></> : null}
          </p>
          <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={reset} style={{ background: "#eab308", color: "#18181b", border: 0, borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer" }}>
              ลองใหม่
            </button>
            <a href="/" style={{ background: "#27272a", color: "#e4e4e7", border: 0, borderRadius: 8, padding: "8px 16px", fontWeight: 700, textDecoration: "none" }}>
              กลับหน้าแรก
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
