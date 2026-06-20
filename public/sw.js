// Service Worker DietQ — minimal & aman.
// Tujuan: bikin app installable (PWA) + caching aset statis, TANPA mengganggu
// auth/Supabase/AI (cross-origin & /api selalu lewat jaringan).

const CACHE = "dietq-v1";

self.addEventListener("install", () => {
  // Aktif segera tanpa nunggu tab lama tertutup
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Biarkan request lintas-origin (Supabase, arkoda) apa adanya
  if (url.origin !== self.location.origin) return;
  // API selalu fresh — jangan di-cache
  if (url.pathname.startsWith("/api/")) return;

  // Navigasi halaman: network-first (online = selalu data terbaru),
  // fallback ke cache kalau offline.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Aset statis (_next/static, ikon, dll): cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      });
    })
  );
});
