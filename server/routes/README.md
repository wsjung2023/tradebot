# Routes

## 도메인별 라우터

- **auth.routes.ts** — 로그인, 로그아웃, OAuth (Google, Kakao)
- **account.routes.ts** — 키움 계좌 관리, 잔고/보유종목 조회
- **trading.routes.ts** — 주문, 주문 취소, 거래 이력
- **ai.routes.ts** — AI 분석 요청, 자동매매 추천
- **watchlist.routes.ts** — 관심종목 추가/삭제/조회
- **formula.routes.ts** — 차트수식 관리
- **autotrading.routes.ts** — 자동매매 전략 설정
- **admin.routes.ts** — 관리자 전용 엔드포인트
- **settings.routes.ts** — 서버 정보 조회 (IP 감지 등)

## 라우트 등록

모든 라우트는 `index.ts`의 `registerRoutes()` 함수에서 등록됩니다.
