"use client";

import { useEffect, useRef } from "react";
import { useAlerts } from "@/lib/store";
import type { Quote } from "@/lib/types";

// ตัวเฝ้าแจ้งเตือนกลาง (mount ใน layout): เช็คราคาทุก 90 วิ ถ้า alert ถึงเป้า → แจ้งเตือนเบราว์เซอร์ + ทำเครื่องหมาย triggered
export default function AlertWatcher() {
  const { alerts, markTriggered } = useAlerts();
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const lastCheck = useRef(0);

  useEffect(() => {
    const check = async () => {
      // กัน spam: เช็คห่างกันอย่างน้อย 60 วิ
      if (Date.now() - lastCheck.current < 60_000) return;
      lastCheck.current = Date.now();
      const active = alertsRef.current.filter((a) => !a.triggeredAt);
      if (!active.length) return;
      const symbols = [...new Set(active.map((a) => a.ticker))];
      try {
        const res = await fetch("/api/quote?s=" + symbols.join(","));
        const json = (await res.json()) as { quotes: Quote[] };
        for (const a of active) {
          const q = json.quotes.find((x) => x.symbol === a.ticker);
          if (!q || !isFinite(q.price)) continue;
          const hit = a.direction === "above" ? q.price >= a.target : q.price <= a.target;
          if (hit) {
            markTriggered(a.id);
            const msg = `${a.ticker} ${a.direction === "above" ? "ขึ้นถึง" : "ลงถึง"} ${a.target.toFixed(2)} (ล่าสุด ${q.price.toFixed(2)})`;
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("🔔 StockLens Alert", { body: msg, tag: a.id });
            } else {
              console.log("[StockLens Alert]", msg);
            }
          }
        }
      } catch {}
    };
    check();
    const id = setInterval(check, 90_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
