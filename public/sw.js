// StockLens Service Worker — network-first + หน้า offline fallback + push notification
const CACHE = "stocklens-v2";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([OFFLINE_URL])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;
  // API เสมอ network (ข้อมูลสด)
  if (new URL(req.url).pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(req).catch(() =>
      caches.match(req).then((hit) => hit || caches.match(OFFLINE_URL))
    )
  );
});

// ===== Push แจ้งเตือนราคาแม้ปิดเว็บ (payload: {title, body, tag, url}) =====
self.addEventListener("push", (event) => {
  let data = { title: "🔔 StockLens", body: "", tag: "stocklens", url: "/portfolio?tab=alerts" };
  try {
    data = Object.assign(data, event.data.json());
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.indexOf(self.location.origin) !== -1 && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
