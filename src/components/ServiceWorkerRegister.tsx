"use client";

import { useEffect } from "react";

// ลงทะเบียน service worker (PWA — ติดตั้งเป็นแอปได้ + มีหน้า offline)
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
