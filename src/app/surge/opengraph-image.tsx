import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "edge";

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
          background: "linear-gradient(135deg, #17100d 0%, #231408 55%, #40230a 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 13,
              background: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1a1005",
              fontSize: 27,
              fontWeight: 800,
            }}
          >
            SL
          </div>
          <div style={{ color: "#fafafa", fontSize: 34, fontWeight: 800 }}>StockLens</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ color: "#fbbf24", fontSize: 96, fontWeight: 800, lineHeight: 1 }}>SURGE RADAR</div>
          <div style={{ color: "#fafafa", fontSize: 40, fontWeight: 700 }}>Today&apos;s Fastest Movers — With Evidence</div>
          <div style={{ color: "#a1a1aa", fontSize: 30 }}>Price +3% or more · Volume vs 20-day avg · 52-week high proximity</div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {["US + THAILAND", "VOLUME SPIKE", "BREAKOUT 52W", "PREMARKET"].map((t) => (
            <div
              key={t}
              style={{
                padding: "12px 22px",
                borderRadius: 999,
                border: "2px solid #5c3a12",
                color: "#fbbf24",
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
