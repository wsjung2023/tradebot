// 키움 AI 트레이딩 Service Worker — 캐싱 비활성화 (패스스루 모드)
// 실시간 트레이딩 앱은 항상 최신 데이터가 필요하므로 캐싱을 사용하지 않습니다.

const CACHE_VERSION = 'kiwoom-ai-v4-passthrough';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 이전 버전 캐시 전부 삭제
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// 모든 요청을 네트워크로 직접 전달 — 캐시 미사용
self.addEventListener('fetch', () => {
  // 아무것도 하지 않음 → 브라우저 기본 네트워크 동작 사용
});
