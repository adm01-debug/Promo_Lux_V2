const CACHE_NAME = "lux-ia-v2";
const STATIC_CACHE = "lux-ia-static-v2";
const PRECACHE = ["/", "/manifest.json"];

// Offline fallback
const OFFLINE_PAGE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([...PRECACHE, OFFLINE_PAGE]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Skip Supabase, Lovable gateway, and external API calls
  if (
    url.hostname.includes("supabase") ||
    url.hostname.includes("lovable") ||
    url.hostname.includes("googleapis") ||
    url.hostname !== self.location.hostname
  ) return;

  // Navigation requests: network-first with offline fallback
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request).then((cached) => cached || caches.match(OFFLINE_PAGE)))
    );
    return;
  }

  // Static assets: cache-first
  if (url.pathname.match(/\.(js|css|woff2?|png|jpg|svg|ico)$/)) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(e.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Other requests: stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
