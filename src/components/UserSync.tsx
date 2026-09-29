"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/authContext";
import { STORE_EVENT } from "@/lib/store";
import { onBasketChange } from "@/lib/compareBasket";

// 🔄 ซิงก์ข้อมูลผู้ใช้ข้ามเครื่อง (สมาชิก login ด้วยรหัส SL)
// ตอน login: ถ้าเครื่องนี้ยังว่าง → ดึงจากบัญชีมาใส่ · หลังจากนั้นทุกการแก้ = auto-save ขึ้นบัญชี (debounce 1.5 วิ)
// ไม่ได้ login หรือไม่มี Redis → ทำงานเงียบๆ ไม่รบกวน (localStorage ใช้ได้เหมือนเดิม)

const LOCAL_KEYS: Record<string, string> = {
  watchlist: "sl-watchlist",
  alerts: "sl-alerts",
  favorites: "sl-favorites",
  radars: "sl-radars",
  basket: "sl-compare-basket",
};

export default function UserSync() {
  const { member } = useAuth();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pulled = useRef(false);

  // โหลดครั้งแรกเมื่อ login: เครื่องว่าง key ไหน → ใช้ของบัญชี
  useEffect(() => {
    if (!member || pulled.current) return;
    pulled.current = true;
    (async () => {
      try {
        const r = await fetch("/api/user-data");
        if (!r.ok) return;
        const j = await r.json();
        if (!j.persisted || !j.data) return;
        for (const [key, localKey] of Object.entries(LOCAL_KEYS)) {
          const server = j.data[key];
          if (!Array.isArray(server) || !server.length) continue;
          const raw = localStorage.getItem(localKey);
          const localEmpty = !raw || JSON.stringify(JSON.parse(raw)) === "[]";
          if (localEmpty) localStorage.setItem(localKey, JSON.stringify(server));
        }
        window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: null }));
        window.dispatchEvent(new CustomEvent("sl-compare-update", { detail: getBasketSafe() }));
      } catch {}
    })();
  }, [member]);

  // auto-save: ฟังทุกการเปลี่ยนแปลง แล้ว debounce push
  useEffect(() => {
    if (!member) return;
    const push = (key: string) => {
      const localKey = LOCAL_KEYS[key];
      if (!localKey) return;
      if (timers.current[key]) clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => {
        try {
          const value = JSON.parse(localStorage.getItem(localKey) ?? "[]");
          fetch("/api/user-data", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) }).catch(() => {});
        } catch {}
      }, 1500);
    };
    const onStore = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | null;
      if (!detail) return; // pull ครั้งแรก — ไม่ต้อง push กลับ
      const key = Object.entries(LOCAL_KEYS).find(([, lk]) => lk === detail)?.[0];
      if (key) push(key);
    };
    const onBasket = () => push("basket");
    window.addEventListener(STORE_EVENT, onStore);
    const off = onBasketChange(onBasket);
    return () => {
      window.removeEventListener(STORE_EVENT, onStore);
      off();
    };
  }, [member]);

  return null;
}

function getBasketSafe(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem("sl-compare-basket") ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
