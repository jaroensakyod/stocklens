// 🧺 ตะกร้าเปรียบเทียบหุ้น (สูงสุด 4 ตัว) — เก็บใน localStorage + sync ผ่าน custom event
// ใช้ร่วมกันทุกหน้า: ปุ่ม ⚔️ บนการ์ดหุ้น → floating panel → /compare
"use client";

const KEY = "sl-compare-basket";
const EVT = "sl-compare-update";
export const BASKET_MAX = 4;

export function getBasket(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, BASKET_MAX) : [];
  } catch {
    return [];
  }
}

function persist(list: string[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, BASKET_MAX)));
  window.dispatchEvent(new CustomEvent(EVT, { detail: list }));
}

/** เพิ่มหุ้นเข้าตะกร้า — คืนสถานะผลลัพธ์ */
export function addToBasket(sym: string): "added" | "exists" | "full" {
  const s = sym.toUpperCase();
  const cur = getBasket();
  if (cur.includes(s)) return "exists";
  if (cur.length >= BASKET_MAX) return "full";
  persist([...cur, s]);
  return "added";
}

export function removeFromBasket(sym: string) {
  persist(getBasket().filter((x) => x !== sym.toUpperCase()));
}

export function clearBasket() {
  persist([]);
}

/** hook แบบง่ายสำหรับ subscribe การเปลี่ยนแปลง (ใช้ใน useEffect) */
export function onBasketChange(cb: (list: string[]) => void): () => void {
  const h = (e: Event) => cb((e as CustomEvent<string[]>).detail ?? getBasket());
  window.addEventListener(EVT, h);
  // ข้าม tab เดียวกันไม่ได้ แต่ storage event ช่วยกรณีหลายแท็บ
  const s = () => cb(getBasket());
  window.addEventListener("storage", s);
  return () => {
    window.removeEventListener(EVT, h);
    window.removeEventListener("storage", s);
  };
}
