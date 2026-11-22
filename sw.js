const CACHE_NAME = "noor-quran-shell-v7";
const QURAN_DATA_CACHE_NAME = "noor-quran-data-v1";
const QURAN_API_ORIGIN = "https://api.alquran.cloud";
const MAX_QURAN_DATA_ENTRIES = 60;
const AUDIO_CACHE_NAME = "noor-quran-surah-audio-v1";
const AUDIO_PATH_PREFIX = "/quran/audio-surah/128/ar.shahriarparhizgar/";
const CORE_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./app-icon-192.png",
  "./admin.html",
  "./app-icon.svg",
  "./favicon.png",
  "./offline.html",
  "./privacy.html"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(CORE_FILES.map(async path => {
      try { await cache.add(path); } catch (error) { /* keep install resilient if one item is temporarily unavailable */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("noor-quran-shell-") && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);


  // Network-first Quran text/translation with a bounded local fallback cache.
  // Only public Quran API responses are cached; no personal notes or user data.
  if (url.origin === QURAN_API_ORIGIN && url.pathname.startsWith("/v1/")) {
    event.respondWith((async () => {
      const cache = await caches.open(QURAN_DATA_CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          try {
            await cache.put(request, response.clone());
            const keys = await cache.keys();
            const excess = keys.length - MAX_QURAN_DATA_ENTRIES;
            for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
          } catch (cacheError) {
            // A cache quota error must never block the online Quran response.
          }
          return response;
        }
        const cached = await cache.match(request);
        return cached || response;
      } catch (error) {
        const cached = await cache.match(request);
        return cached || new Response(JSON.stringify({
          code: 503,
          status: "این متن یا ترجمه قبلاً روی این دستگاه ذخیره نشده و در حال حاضر آفلاین در دسترس نیست."
        }), {
          status: 503,
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
        });
      }
    })());
    return;
  }

  // Cache full-surah recitation files for offline listening in the installed app.
  if (url.origin === "https://cdn.islamic.network" && url.pathname.startsWith(AUDIO_PATH_PREFIX)) {
    event.respondWith((async () => {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const cached = await cache.match(request.url);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && (response.ok || response.type === "opaque")) {
          try { await cache.put(request, response.clone()); } catch (cacheError) { /* online audio still plays if cache storage is full */ }
        }
        return response;
      } catch (error) {
        const saved = await cache.match(request.url);
        return saved || new Response("فایل صوتی آفلاین در این دستگاه ذخیره نشده است.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          try { await cache.put(request, response.clone()); } catch (cacheError) { /* online navigation remains available */ }
        }
        return response;
      } catch (error) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) ||
          (await cache.match("./index.html")) ||
          (await cache.match("./offline.html"));
      }
    })());
    return;
  }

  const isAppAsset = ["app-icon.svg", "app-icon-192.png", "favicon.png", "offline.html", "manifest.webmanifest"].some(name => url.pathname.endsWith("/" + name));
  if (!isAppAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        try { await cache.put(request, response.clone()); } catch (cacheError) { /* cached assets are optional; keep the online response */ }
      }
      return response;
    } catch (error) {
      return new Response("منبع آفلاین در دسترس نیست.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});