import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import ChatWidget from "@/components/ChatWidget";
import AlertWatcher from "@/components/AlertWatcher";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { AuthProvider } from "@/lib/authContext";
import UserWatermark from "@/components/UserWatermark";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "StockLens" },
  title: {
    default: "StockLens — วิเคราะห์หุ้น + Global Radar ด้วย AI",
    template: "%s | StockLens",
  },
  description:
    "เว็บวิเคราะห์หุ้นสหรัฐฯ/ไทย/ฮ่องกง/ญี่ปุ่น/ยุโรป พร้อมคะแนนปัจจัย 5 มิติ สัญญาณเทคนิค AI วิเคราะห์ภาษาไทย และ Global Radar ที่แปลงเหตุการณ์โลกเป็นหุ้นที่ได้/เสียประโยชน์",
  openGraph: {
    type: "website",
    locale: "th_TH",
    siteName: "StockLens",
    title: "StockLens — วิเคราะห์หุ้น + Global Radar ด้วย AI",
    description: "คะแนนปัจจัย 5 มิติจากงบจริง · Global Radar แปลงเหตุการณ์โลกเป็นหุ้น · AI วิเคราะห์ภาษาไทย · 30 ตลาด · ซื้อผ่าน Dime ได้",
  },
  twitter: {
    card: "summary_large_image",
    title: "StockLens — Global Stock Intelligence",
    description: "AI stock analysis in Thai · Global Radar · 30 markets",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <AuthProvider>
          <Header />
          <TickerTape />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">{children}</main>
          <Footer />
          <ChatWidget />
          <AlertWatcher />
          <UserWatermark />
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
