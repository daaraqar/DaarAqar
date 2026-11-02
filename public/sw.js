// Service Worker for Dar Al Aqar — performance-tuned (v2)
// Strategies:
//  - Immutable build assets & fonts: Cache-First (instant repeat loads)
//  - Map tiles & remote images: Stale-While-Revalidate (fast + self-healing)
//  - Navigations: Network-Only with offline fallback (always fresh data)
//  - Web Push: real notification support with focus-or-open click handling
const CACHE_NAME = "aqarpulse-v2.0.0";
const OFFLINE_URL = "/offline.html";
const TILE_CACHE = "aqarpulse-tiles-v2";
const IMG_CACHE = "aqarpulse-img-v2";

const STATIC_PRECACHE = [
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  OFFLINE_URL,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_PRECACHE).catch((err) => {
        console.warn("[SW] Precache skipped non-critical files:", err);
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== TILE_CACHE && key !== IMG_CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

/** Cache-first, then network, cache successful clones. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.status === 200 && response.type !== "opaque") {
    cache.put(request, response.clone());
  }
  return response;
}

/** Stale-while-revalidate: serve cached instantly, refresh in background. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && (response.status === 200 || response.type === "opaque")) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || !url.protocol.startsWith("http")) return;

  // Never cache APIs, auth, or geolocation services
  if (url.pathname.startsWith("/api/")) return;

  // Immutable build output: hash filenames guarantee freshness → Cache-First
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Google Fonts: Cache-First (immutable content by URL)
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Map tiles (OSM/CARTO/Esri): SWR with dedicated LRU-ish tile cache
  if (
    url.hostname.includes("tile.openstreetmap.org") ||
    url.hostname.includes("basemaps.cartocdn.com") ||
    url.hostname.includes("arcgisonline.com") ||
    url.hostname.includes("nominatim.openstreetmap.org")
  ) {
    event.respondWith(staleWhileRevalidate(request, TILE_CACHE));
    return;
  }

  // Remote images: SWR
  if (
    request.destination === "image" ||
    /\.(?:png|jpe?g|webp|avif|gif|svg)$/i.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request, IMG_CACHE));
    return;
  }

  // Navigations: strict network-only with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offlinePage = await caches.match(OFFLINE_URL);
        return (
          offlinePage ||
          new Response("تطبيق دار العقار بدون اتصال بالإنترنت", {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          })
        );
      })
    );
  }
});

/* ============================================================
   Web Push — real system notifications from the administration
   ============================================================ */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "إشعار جديد", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "دار العقار";
  const options = {
    body: payload.body || "لديك تحديث جديد من إدارة المنصة",
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    dir: "rtl",
    lang: "ar",
    tag: payload.tag || "aqar-update", // collapse duplicates
    renotify: true,
    data: { url: payload.url || "/dashboard" },
    actions: payload.actions || [{ action: "open", title: "فتح" }],
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if (client.navigate && targetUrl) {
            try {
              await client.navigate(targetUrl);
            } catch {
              /* already open */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});
