// Service Worker 등록 — 새 버전 감지 시 자동 업데이트

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none', // 브라우저 HTTP 캐시 우회 — 항상 서버에서 최신 SW 확인
    });

    // 새 SW 설치 감지 → 즉시 활성화 (confirm 없이 자동 업데이트)
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    // 1시간마다 SW 업데이트 체크
    setInterval(() => registration.update(), 60 * 60 * 1000);

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

// SW 교체(controllerchange) 시 페이지 자동 새로고침
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
