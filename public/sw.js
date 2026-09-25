// StockLens Service Worker — network-first + หน้า offline fallback
const CACHE = "stocklens-v1";
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
