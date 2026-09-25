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
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
