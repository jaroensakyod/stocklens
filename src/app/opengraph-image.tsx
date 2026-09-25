import { ImageResponse } from "next/og";

// ภาพตัวอย่างเมื่อแชร์ลิงก์ StockLens ลง Facebook/LINE/X (1200×630)
// ใช้ตัวอักษรอังกฤษ+ตัวเลขในภาพเท่านั้น — ปลอดภัยกับทุก font ของ image renderer
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "edge"; // @vercel/og บน Windows ล้มตอน prerender ใน nodejs runtime — edge ใช้ได้ทั้ง local และ Vercel

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #0d0d17 0%, #141a2e 55%, #1b2440 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* บน: แบรนด์ */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#14b8a6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#04110f",
              fontSize: 38,
              fontWeight: 800,
            }}
          >
            SL
          </div>
          <div style={{ color: "#fafafa", fontSize: 52, fontWeight: 800 }}>StockLens</div>
        </div>

        {/* กลาง: สิ่งที่เว็บทำ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ color: "#fafafa", fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>Global Stock Intelligence</div>
          <div style={{ color: "#a1a1aa", fontSize: 34 }}>AI Analysis in Thai · Global Radar · 30 Markets</div>
        </div>

        {/* ล่าง: แถบฟีเจอร์ */}
        <div style={{ display: "flex", gap: 16 }}>
          {["5-FACTOR SCORE", "GLOBAL RADAR", "AI x 5 VIEWS", "DIME READY", "LIVE 13F"].map((t) => (
            <div
              key={t}
              style={{
                padding: "12px 22px",
                borderRadius: 999,
                border: "2px solid #2b3550",
                color: "#14b8a6",
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 1,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
