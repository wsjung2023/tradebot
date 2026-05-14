# VIBE_GUIDE.md — tradebot 바이브코딩 가이드

> 이 파일은 tradebot 프로젝트의 개발 규칙과 변경 계획을 담고 있다.
> 매 대화 시작 전 반드시 읽을 것.

---

## 1. 핵심 규칙 (상황 → 행동 짝)

| 상황 | 행동 |
|------|------|
| 코드가 30줄 넘어갈 것 같으면 | 함수/파일로 나누고 시작해 |
| 에러가 날 수 있는 부분이면 | try-catch 반드시 감싸라 |
| 새 파일 만들면 | 맨 위에 한 줄 설명 주석 달아라 |
| 새 폴더 만들면 | 그 폴더 안에 README.md 넣어라 |
| 기능이 2개 이상 섞이면 | 파일을 분리해라 |
| DB에 접근하면 | 읽기 전용 연결 원칙 지켜라 |
| 기획/설계가 불분명하면 | 먼저 시간 써서 정리하고 코딩 시작해 |

---

## 2. 파일 규칙

- 파일 크기: 250~400줄 제한 (최대 500줄 초과 금지)
- 파일 상단: 반드시 한 줄 설명 주석
- 에러처리: try-catch 필수 (async 함수 전체)
- 폴더 구조: 모노레포 방식 유지 (client / server / shared)
- 파일 분리 기준: 기능 단위로 (auth, api, ui, utils 등)

---

## 3. Hooks (트리거 자동 시스템)

| 트리거 | 자동 행동 |
|--------|-----------|
| 새 API 엔드포인트 추가 | routes/ 하위에 별도 파일로 분리 |
| DB 쿼리 작성 | storage.ts 가 아닌 해당 도메인 storage 파일로 |
| 500줄 초과 감지 | 즉시 분리 계획 수립 후 진행 |
| .env 값 사용 | 반드시 타입/기본값 정의 (config.ts 에서 관리) |
| 새 서비스 로직 추가 | server/services/ 하위에 별도 파일 |

---

## 4. 폴더 구조 목표

tradebot/
  client/src/
    pages/        - 페이지 단위 (400줄 이하)
    components/   - 재사용 UI
    hooks/        - 커스텀 훅
    lib/          - 유틸, API 클라이언트
  server/
    routes/       - 도메인별 라우터 분리
    services/     - 비즈니스 로직
    utils/        - 공통 유틸
    index.ts      - 진입점만 (설정 최소화)
  shared/
    schema.ts     - DB 스키마 & 타입 공유

---

## 5. 변경 계획안 (우선순위 순)

### [긴급] 500줄 초과 파일 분리

[1] server/routes.ts (1377줄) → server/routes/ 폴더
  routes/index.ts          - 라우터 등록만 (50줄 이하)
  routes/auth.routes.ts    - 인증 관련 API
  routes/trading.routes.ts - 주문/거래 API
  routes/market.routes.ts  - 시세/종목 API
  routes/account.routes.ts - 계좌/잔고 API
  routes/formula.routes.ts - 조건식 API
  routes/ai.routes.ts      - AI 분석 API

[2] server/storage.ts (862줄) → server/storage/ 폴더
  storage/index.ts
  storage/user.storage.ts
  storage/trade.storage.ts
  storage/watchlist.storage.ts
  storage/formula.storage.ts
  storage/setting.storage.ts

[3] server/services/kiwoom.service.ts (842줄) → kiwoom/ 폴더
  services/kiwoom/index.ts
  services/kiwoom/kiwoom.auth.ts
  services/kiwoom/kiwoom.order.ts
  services/kiwoom/kiwoom.market.ts
  services/kiwoom/kiwoom.account.ts

[4] server/auto-trading-worker.ts (525줄) → server/worker/ 폴더
  worker/index.ts
  worker/worker.engine.ts
  worker/worker.condition.ts
  worker/worker.order.ts

### [중요] 페이지 파일 정리 (400줄 초과)

  chart-formula-editor.tsx  562줄 → 에디터/미리보기 분리
  settings.tsx              507줄 → 탭별 컴포넌트 분리
  condition-formulas.tsx    483줄 → 에디터/목록 분리
  auto-trading.tsx          430줄 → 설정/상태/로그 분리
  ai-analysis.tsx           414줄 → 분석/결과 분리

### [개선] 환경변수 관리
  server/config.ts 생성 - .env 값 타입 정의 + 기본값 관리

---

## 6. 작업 순서

1. server/routes.ts 분리 (가장 위험도 높음)
2. server/storage.ts 분리
3. kiwoom.service.ts 분리
4. 페이지 컴포넌트 정리
5. config.ts 생성 + .env 세팅

---

## 7. 프로젝트 핵심 정보

- 스택: TypeScript, React, Express, Drizzle ORM, PostgreSQL
- 증권사 연동: 키움증권 REST API
- AI: AI 분석 기능 포함
- 인증: Passport.js (세션 기반)
- 실시간: WebSocket (market-data-hub.ts)
- DB: PostgreSQL (Neon)
- 배포: Replit (현재) → 로컬 이관 예정
