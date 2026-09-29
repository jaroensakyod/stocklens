"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";

// 📲 เปิด push ถึงมือถือแม้ปิดเว็บ (สมาชิก Starter+) — subscribe ผ่าน service worker → เก็บอุปกรณ์บนบัญชี
// cron push-alerts จะยิงแจ้งเตือนตามรายการ 🔔 ที่ตั้งไว้ในแท็บนี้ (แม้ปิดเว็บ/ปิดเครื่องคอม)
interface PushInfo {
  publicKey: string;
  enabled: boolean;
  persisted: boolean;
  devices: { endpoint: string; device: string; createdAt: number }[];
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function PushSetup() {
  const { member } = useAuth();
  const [info, setInfo] = useState<PushInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    fetch("/api/push")
      .then((r) => r.json())
      .then((j) => setInfo(j))
      .catch(() => {});
  };
  useEffect(load, [member]);

  const enable = async () => {
    if (busy || !info?.publicKey) return;
    setBusy(true);
    setMsg("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("เบราว์เซอร์นี้ไม่รองรับ push (แนะนำ Chrome/Safari ล่าสุด และ iOS ต้อง 'เพิ่มไปที่หน้าจอโฮม' ก่อน)");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("ไม่ได้รับอนุญาตให้แจ้งเตือน — เปิดใน settings ของเบราว์เซอร์แล้วลองอีกครั้ง");
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(info.publicKey),
        });
      }
      const device = (navigator.userAgent.match(/\(([^)]+)\)/) ?? [])[1]?.slice(0, 60) || "อุปกรณ์นี้";
      const r = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), device }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "บันทึกไม่สำเร็จ");
      setMsg("✓ เปิดแล้ว — ทดสอบส่งจริง 1 ครั้งเดี๋ยวนี้");
      load();
      // ทดสอบส่งจริงทันที (ยืนยันว่าคู่ key+อุปกรณ์ใช้ได้)
      setTimeout(() => {
        fetch("/api/push/test", { method: "POST" }).catch(() => {});
      }, 600);
    } catch (e) {
      setMsg("⚠️ " + (e as Error).message);
    }
    setBusy(false);
  };

  const removeDevice = async (endpoint: string) => {
    await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint }) });
    load();
  };

  if (!member) {
    return (
      <div className="card p-4 border-accent/20">
        <p className="text-xs text-zinc-400 leading-relaxed">
          📲 <b className="text-zinc-200">แจ้งเตือนถึงมือถือแม้ปิดเว็บ</b> — เป็นสิทธิ์สมาชิก Starter ขึ้นไป (push ผ่าน PWA ไม่ต้องติดแอป) ·{" "}
          <Link href="/pricing" className="text-accent-soft underline">ดูแพ็กเกจ</Link>
        </p>
      </div>
    );
  }
  if (info && (!info.enabled || !info.persisted)) {
    return (
      <div className="card p-4">
        <p className="text-xs text-zinc-500">📲 แจ้งเตือนมือถือแม้ปิดเว็บ — ยังไม่พร้อมใช้งานช่วงนี้ (แอดมินยังไม่ตั้ง VAPID keys / Redis) — ตอนนี้ใช้แจ้งเตือนเบราว์เซอร์ตอนเปิดเว็บได้ปกติ</p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-zinc-100">📲 แจ้งเตือนถึงมือถือ <span className="text-zinc-500 font-normal">แม้ปิดเว็บ (สมาชิก)</span></h3>
        {info?.devices.length ? (
          <span className="chip bg-up/10 text-up border border-up/30 !text-[10px] num">เปิดอยู่ · {info.devices.length} อุปกรณ์</span>
        ) : null}
      </div>
      <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
        เปิดครั้งเดียวบนอุปกรณ์ที่ต้องการ (มือถือ/แท็บเล็ต/คอม ได้สูงสุด 5 เครื่อง) — ระบบจะส่ง push ตามรายการ 🔔 ด้านบนโดยไม่ต้องเปิดเว็บ · หมายเหตุ iPhone/iPad ต้องกด Share → <b className="text-zinc-400">เพิ่มไปที่หน้าจอโฮม</b> ก่อน (iOS ≥ 16.4)
      </p>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <button className="btn-primary text-xs !py-1.5" onClick={enable} disabled={busy}>
          {busy ? "กำลังเปิด…" : info?.devices.length ? "เพิ่มอุปกรณ์เครื่องนี้" : "🔔 เปิดแจ้งเตือนมือถือ"}
        </button>
        {msg && <span className="text-xs text-zinc-400">{msg}</span>}
      </div>
      {info?.devices.length ? (
        <div className="mt-3 space-y-1.5">
          {info.devices.map((d) => (
            <div key={d.endpoint} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-zinc-400 truncate flex-1">
                💻 {d.device || "อุปกรณ์"} · <span className="text-zinc-600 num">{new Date(d.createdAt).toLocaleDateString("th-TH")}</span>
              </span>
              <button className="text-zinc-600 hover:text-down" onClick={() => removeDevice(d.endpoint)}>เลิกใช้อุปกรณ์นี้</button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
