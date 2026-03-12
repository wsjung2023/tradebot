# 키움 AI 자동매매 플랫폼

## Overview
키움 AI 자동매매 플랫폼은 키움증권 REST API와 OpenAI GPT-4를 활용하여 전문가급 AI 기반 자동매매를 제공하는 플랫폼입니다. 실시간 거래, AI 기반 투자 분석, 자동매매 추천 기능을 통합합니다. 고신뢰성과 우수한 사용자 경험을 목표로 하며, 강력한 인증 시스템, 실시간 WebSocket 시장 데이터, PWA 지원, 모바일 최적화를 통해 상용 수준의 품질을 제공합니다.

## User Preferences
- 자세한 설명을 선호합니다
- 반복적 개발을 원합니다
- 주요 변경 전 확인 필요
- 폴더 Z 변경 금지
- 파일 Y 변경 금지

## System Architecture

### UI/UX 디자인 결정사항
플랫폼은 "Neo-Fintech Storm UI" 디자인 시스템을 사용하며, 사이버펑크 색상 팔레트(네온 시안/퍼플/그린/레드)를 특징으로 합니다. `gradient-flow`, `pulse-glow`, `price-pulse`, `float-particle` 같은 CSS 애니메이션을 통해 동적인 시각적 피드백을 제공합니다. 글래스모피즘 카드, 네온 글로우 효과, 그라디언트 텍스트 등 디자인 요소를 포함하며, `prefers-reduced-motion` 접근성을 지원합니다.

### 기술 구현

#### 백엔드
- **프레임워크**: Node.js + Express + TypeScript
- **데이터베이스**: PostgreSQL (Neon)
- **인증**: Passport.js (로컬, Google/Kakao OAuth)
- **ORM**: Drizzle ORM
- **실시간**: WebSocket

#### 프론트엔드
- **프레임워크**: React + TypeScript + Vite
- **라우팅**: Wouter
- **상태 관리**: TanStack Query
- **UI 컴포넌트**: Shadcn UI
- **스타일링**: Tailwind CSS

#### 데이터베이스 스키마
사용자, 계좌, 보유 종목, 주문, AI 모델 및 추천, 관심종목, 알림, 사용자 설정, 거래 로그, 조건 검색 관련 데이터를 포함하는 스키마를 사용합니다.

#### API 엔드포인트
인증, 계좌 관리, 주문 실행, 주식 정보(실시간 시세, 차트, 재무제표), AI 분석, 관심종목 관리, 사용자 설정, 거래 로그, 조건 검색 기능을 지원합니다.

#### AI 분석
GPT-4를 활용하여 주식 분석, 포트폴리오 최적화, 신뢰도 점수 산출을 수행하며, 재무제표, 유동성, 레인보우 차트 분석, 테마 분석, 뉴스 분석, 기관 투자자 추적 기능을 통합합니다.

#### AI 투자자문 위원회 (AI Council) — shadow 모드
`server/services/ai-council.service.ts`에 구현. 기술·기본·감성 3인 AI 애널리스트가 독립적으로 분석 후 다수결로 최종 투자 의견(매수/매도/보유)을 결정한다. 현재 shadow 모드(실거래 미연동)로만 동작하며, `ENABLE_AI_COUNCIL=true` 환경변수 설정 시 자동매매 워커에 연동된다.

#### 피처 플래그 시스템
`server/config/feature-flags.ts`에 구현. 환경변수로 실험적 기능을 ON/OFF 제어한다.
- `ENABLE_AI_COUNCIL` (기본: false) — AI 위원회 자동매매 연동
- `ENABLE_ENTRY_POINT_ENGINE` (기본: false) — 진입점 탐색 엔진
- `ENABLE_ADVANCED_LEARNING` (기본: false) — 고급 학습 시스템
- `ENABLE_PRICE_ALERTS_IN_TRADING_CYCLE` (기본: true) — 가격 알림 자동 체크

#### 자동매매 시스템
AI 모델의 CRUD, 활성화/비활성화, 추천 생성 및 10선 레인보우 차트 전략 기반 자동 실행을 지원합니다. 거래 성과 분석 및 AI 모델 파라미터 자동 최적화 학습 시스템을 포함합니다. 매 1분 사이클마다 가격 알림 자동 체크(`checkPriceAlerts`) 실행.

#### 실시간 시스템
지수 백오프 및 하트비트 기능을 갖춘 WebSocket을 통해 실시간 시장 데이터를 제공합니다.

#### PWA
`manifest.json`과 서비스 워커(v4-passthrough, 캐싱 없음)를 통해 PWA 지원. 빈 화면 버그 방지를 위해 캐싱을 비활성화함.

#### 보안
세션 기반 인증, CSRF 방어, API 키의 AES-256-GCM 암호화, 속도 제한, XSS/클릭재킹 방어 및 HTTPS 강제를 위한 보안 헤더를 구현합니다.

#### 조건 검색 시스템
**백엔드**: 수식 파싱 및 평가 엔진, 차트 시그널 생성, 재무 데이터 조회, 시장 이슈 추적, 키움 조건식 직접 연동(`/api/kiwoom/conditions`)
**프론트엔드**: 커스텀/키움 조건식 탭 전환 UI, 실시간 스크리닝, 차트 시그널 오버레이, 조건 편집기

#### 레인보우 차트 시스템
2년 고가/저가 기준의 10선 레인보우 차트를 구현하며, 5번 라인은 50% 되돌림(주력 매수 구간)을 나타냅니다. 주력 매수/매도 구간 식별 및 자동 추천을 생성합니다.

#### 차트 시그널 오버레이
`GET /api/stocks/:code/chart-signals` — 사용자 조건식 결과를 차트에 매수/보유 시그널로 표시. matchScore ≥ 70이면 buy 시그널.

#### 관심종목 HTS 동기화
`POST /api/watchlist/sync/kiwoom` — 키움 HTS에서 관심종목을 직접 받아와 `watchlist_sync_snapshots` 테이블에 저장.
`GET /api/watchlist/sync-snapshots` — 동기화된 스냅샷 목록 조회.

#### 뉴스+재무+기술 통합 분석
`POST /api/ai/integrated-analysis` — 네이버 뉴스 API 감성 분석 + 재무지표 + 기술적 분석을 GPT-4로 통합하여 종합 점수 산출.

### 기능 사양
- **사용자 인증**: 로컬 이메일/비밀번호, Google OAuth, Kakao OAuth
- **키움 계좌 연동**: CRUD 작업, 잔고/보유종목 조회
- **실시간 대시보드**: 포트폴리오 파이 차트, 30일 자산 추이
- **거래 인터페이스**: 실시간 시세, 일봉 차트 + 시그널 오버레이, 10단계 호가창, 주문 패널
- **AI 분석 대시보드**: GPT-4 종목 분석, 포트폴리오 최적화, 신뢰도 점수, 뉴스+재무+기술 통합 분석
- **AI 투자자문 위원회**: 기술/기본/감성 3인 다수결 분석 (shadow 모드)
- **자동매매 시스템**: AI 모델 CRUD, 활성화/비활성화, 추천 생성, 학습 시스템, 피처 플래그 제어
- **거래 내역 및 로그**: 주문/체결 상세, 거래 로그, 통계 대시보드
- **관심종목**: 실시간 시세 병합, 키움 HTS 동기화, 가격 알림
- **조건검색**: 커스텀/키움 조건식 양방향, 차트 시그널 오버레이
- **PWA 모바일 최적화**

### 주요 파일 구조 (핵심)
```
server/
  config/feature-flags.ts        # 피처 플래그 ON/OFF
  services/
    ai-council.service.ts        # AI 3인 위원회
    ai.service.ts                # GPT-4 분석
    news.service.ts              # 네이버 뉴스 + 감성분석
    kiwoom/
      kiwoom.condition.ts        # 조건검색 WebSocket
      kiwoom.market.ts           # 시세·차트·관심종목
      kiwoom.financial.ts        # 재무지표
  routes/
    trading.routes.ts            # 차트 시그널 포함
    watchlist.routes.ts          # HTS 동기화 포함
    ai.routes.ts                 # Council 분석 포함
    formula.routes.ts            # 키움 조건식 연동
  auto-trading-worker.ts         # 자동매매 루프
shared/schema.ts                 # DB 스키마 (watchlist_sync_snapshots 포함)
```

### 주의사항
- `getFinancialRatios()` 반환값: `output`이 단일 객체 `{ per, pbr, eps, bps, roe, roa, debt_ratio, reserve_ratio }` (배열 아님)
- `conditionSeq`로 통일 (conditionName 아님)
- `client/public/sw.js`는 v4-passthrough (fetch 핸들러 없음, 캐싱 없음)
- DB 읽기/쓰기 풀 분리: `server/db.ts`의 `readonlyPool`(SELECT) vs `db`(DML)

## External Dependencies
- **키움증권 REST API**: 주식 거래 및 시장 데이터
- **OpenAI API (GPT-4)**: AI 기반 투자 분석
- **Google OAuth**: 사용자 인증
- **Kakao OAuth**: 사용자 인증
- **Neon (PostgreSQL)**: 관리형 PostgreSQL 데이터베이스