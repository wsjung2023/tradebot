// ?��? AI ?�레?�딩 Service Worker ??캐싱 비활?�화 (?�스?�루 모드)
// ?�시�??�레?�딩 ?��? ??�� 최신 ?�이?��? ?�요?��?�?캐싱???�용?��? ?�습?�다.
// BUILD_TIMESTAMP: 20260530-183933

const CACHE_VERSION = 'kiwoom-ai-v4-passthrough';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => {
      self.clients.claim();
      // 모든 ?�려?�는 ??PWA �??�로고침
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      });
    })
  );
});

// 모든 ?�청???�트?�크�?직접 ?�달 ??캐시 미사??self.addEventListener('fetch', () => {
  // ?�무것도 ?��? ?�음 ??브라?��? 기본 ?�트?�크 ?�작 ?�용
});
