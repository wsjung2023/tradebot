const CACHE_NAME = 'ai-trading-v1';

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // API requests: network-first, cache fallback
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
  // Static assets: cache-first with pattern matching for Vite assets
  else if (event.request.url.match(/\.(js|css|woff2?|ttf|png|jpg|jpeg|svg|ico)$/)) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) return response;
          return fetch(event.request).then((response) => {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return response;
          });
        })
    );
  }
  // Navigation: network-first, fallback to root for SPA
  else {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/') || fetch('/'))
    );
  }
});
