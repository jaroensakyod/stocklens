import { ImageResponse } from "next/og";
import { getQuotes } from "@/lib/yahoo";
import type { Quote } from "@/lib/types";

// ไพ่หุ้นอัตโนมัติ — แชร์ลิงก์หุ้นตัวไหน ภาพ preview ก็โชว์ ticker+ราคา+%(ขึ้นเขียว/ลงแดง) ของตัวนั้นทันที
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export const runtime = "edge";

export default async function OpenGraphImage({ params }: { params: { ticker: string } }) {
  const ticker = decodeURIComponent(params.ticker || "").toUpperCase();
  const quotes = await getQuotes([ticker]).catch(() => ({}) as Record<string, Quote>);
  const q = quotes[ticker];
  const price = q && isFinite(q.price) ? q.price : null;
  const change = q && isFinite(q.changePct) ? q.changePct : null;
  const up = (change ?? 0) >= 0;
  const name = q?.name && /^[\x20-\x7E]*$/.test(q.name) ? q.name : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px",
          background: up
            ? "linear-gradient(135deg, #0d1512 0%, #0f1f1a 55%, #123027 100%)"
            : price
              ? "linear-gradient(135deg, #170d10 0%, #1f0f13 55%, #301218 100%)"
              : "linear-gradient(135deg, #0d0d17 0%, #141a2e 55%, #1b2440 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 52,
                height: 52,
                borderRadius: 13,
                background: "#14b8a6",
                color: "#04110f",
                fontSize: 27,
                fontWeight: 800,
                marginRight: 16,
              }}
            >
              SL
            </div>
            <div style={{ display: "flex", color: "#fafafa", fontSize: 34, fontWeight: 800 }}>StockLens</div>
          </div>
          <div style={{ display: "flex", color: "#71717a", fontSize: 26, fontWeight: 600 }}>5-FACTOR · GLOBAL RADAR · AI</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: "#fafafa", fontSize: 110, fontWeight: 800, lineHeight: 1 }}>
            {ticker || "STOCK"}
          </div>
          {name ? (
            <div style={{ display: "flex", color: "#a1a1aa", fontSize: 34, maxWidth: 1000, marginTop: 16 }}>
              {name.slice(0, 48)}
            </div>
          ) : null}
          {price !== null ? (
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 22 }}>
              <div style={{ display: "flex", color: "#fafafa", fontSize: 72, fontWeight: 800 }}>
                {price.toFixed(2)} {q.currency}
              </div>
              {change !== null ? (
                <div
                  style={{
                    display: "flex",
                    color: up ? "#34d399" : "#fb7185",
                    fontSize: 52,
                    fontWeight: 800,
                    padding: "6px 24px",
                    borderRadius: 14,
                    background: up ? "rgba(52,211,153,0.12)" : "rgba(251,113,133,0.12)",
                    marginLeft: 24,
                  }}
                >
                  {up ? "+" : ""}
                  {change.toFixed(2)}%
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", color: "#52525b", fontSize: 24 }}>Data: Yahoo Finance · delay ~15 min</div>
          <div style={{ display: "flex", color: "#52525b", fontSize: 24 }}>Not investment advice</div>
        </div>
      </div>
    ),
    size
  );
}
