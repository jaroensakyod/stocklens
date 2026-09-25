"use client";

// ===== ที่เก็บข้อมูลส่วนตัวผู้ใช้ (localStorage — ไม่ต้องมีระบบสมาชิก) =====
// watchlist / แจ้งเตือนราคา / พอร์ต — sync ข้าม component ผ่าน custom event

import { useCallback, useEffect, useState } from "react";

export interface PriceAlert {
  id: string;
  ticker: string;
  direction: "above" | "below";
  target: number;
  createdAt: number;
  triggeredAt?: number;
}

export interface Holding {
  ticker: string;
  qty: number;
  avgCost: number;
}

const KEYS = {
  watchlist: "sl-watchlist",
  alerts: "sl-alerts",
  portfolio: "sl-portfolio",
};

export const STORE_EVENT = "sl-store-update";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: key }));
}

/** hook: อ่าน-เขียน store พร้อม sync ทุก component ที่ใช้ key เดียวกัน */
export function useStore<T>(key: keyof typeof KEYS, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setValue(read(KEYS[key], fallback));
    setReady(true);
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail === KEYS[key]) setValue(read(KEYS[key], fallback));
    };
    window.addEventListener(STORE_EVENT, onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener(STORE_EVENT, onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: T) => {
      write(KEYS[key], next);
      setValue(next);
    },
    [key]
  );

  return [value, set, ready] as const;
}

// ---------- watchlist ----------
export function useWatchlist() {
  const [list, setList] = useStore<string[]>("watchlist", []);
  const toggle = useCallback(
    (ticker: string) => {
      const t = ticker.toUpperCase();
      setList(list.includes(t) ? list.filter((x) => x !== t) : [...list, t]);
    },
    [list, setList]
  );
  return { list, toggle, has: (t: string) => list.includes(t.toUpperCase()) };
}

// ---------- alerts ----------
export function useAlerts() {
  const [alerts, setAlerts] = useStore<PriceAlert[]>("alerts", []);
  const add = useCallback(
    (ticker: string, direction: "above" | "below", target: number) => {
      setAlerts([
        ...alerts.filter((a) => !(a.ticker === ticker.toUpperCase() && !a.triggeredAt)),
        { id: "A" + Date.now().toString(36), ticker: ticker.toUpperCase(), direction, target, createdAt: Date.now() },
      ]);
    },
    [alerts, setAlerts]
  );
  const markTriggered = useCallback(
    (id: string) => setAlerts(alerts.map((a) => (a.id === id ? { ...a, triggeredAt: Date.now() } : a))),
    [alerts, setAlerts]
  );
  const remove = useCallback((id: string) => setAlerts(alerts.filter((a) => a.id !== id)), [alerts, setAlerts]);
  const reset = useCallback((id: string) => setAlerts(alerts.map((a) => (a.id === id ? { ...a, triggeredAt: undefined } : a))), [alerts, setAlerts]);
  return { alerts, add, remove, markTriggered, reset, setAlerts };
}

// ---------- portfolio ----------
export function usePortfolio() {
  const [holdings, setHoldings] = useStore<Holding[]>("portfolio", []);
  const upsert = useCallback(
    (ticker: string, qty: number, avgCost: number) => {
      const t = ticker.toUpperCase();
      const rest = holdings.filter((h) => h.ticker !== t);
      if (qty > 0) setHoldings([...rest, { ticker: t, qty, avgCost }]);
      else setHoldings(rest);
    },
    [holdings, setHoldings]
  );
  const remove = useCallback((ticker: string) => setHoldings(holdings.filter((h) => h.ticker !== ticker.toUpperCase())), [holdings, setHoldings]);
  return { holdings, upsert, remove };
}
