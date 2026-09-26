import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StockLens — วิเคราะห์หุ้น + Global Radar",
    short_name: "StockLens",
    description: "เว็บวิเคราะห์หุ้นภาษาไทย: คะแนนปัจจัย 5 มิติ · AI วิเคราะห์ · Global Radar เหตุการณ์โลก→หุ้น · พอร์ต/แจ้งเตือน",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#eab308",
    lang: "th",
    icons: [
      // PNG สำหรับเกณฑ์ install (Chrome/Android ต้องการ 192+512) — สร้างด้วย scripts/gen-icons.mjs
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
