import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import ChatWidget from "@/components/ChatWidget";
import AlertWatcher from "@/components/AlertWatcher";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "StockLens — วิเคราะห์หุ้น + Global Radar ด้วย AI",
  description:
    "เว็บวิเคราะห์หุ้นสหรัฐฯ/ไทย/ฮ่องกง/ญี่ปุ่น/ยุโรป พร้อมคะแนนปัจจัย 5 มิติ สัญญาณเทคนิค AI วิเคราะห์ภาษาไทย และ Global Radar ที่แปลงเหตุการณ์โลกเป็นหุ้นที่ได้/เสียประโยชน์",
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
        <Header />
        <TickerTape />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">{children}</main>
        <Footer />
        <ChatWidget />
        <AlertWatcher />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
