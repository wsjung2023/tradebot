# 키움 AI 자동매매 플랫폼

## 개요
키움 AI 자동매매 플랫폼은 키움증권 REST API와 OpenAI GPT-4를 활용한 전문가급 AI 기반 자동매매 플랫폼입니다. 실시간 거래, AI 기반 투자 분석, 자동매매 추천 기능을 제공합니다. 강력한 인증 시스템, 실시간 WebSocket 시장 데이터, PWA 지원, 모바일 최적화를 통해 상용 수준의 품질을 목표로 합니다. 핵심 목적은 고신뢰성과 우수한 사용자 경험을 갖춘 AI 기반 자동 주식거래 및 투자 분석 솔루션을 제공하는 것입니다.

## 사용자 선호사항
- 자세한 설명을 선호합니다
- 반복적 개발을 원합니다
- 주요 변경 전 확인 필요
- 폴더 Z 변경 금지
- 파일 Y 변경 금지

## 시스템 아키텍처

### UI/UX 디자인 결정사항
플랫폼은 사이버펑크 색상 팔레트(네온 시안/퍼플/그린/레드)를 사용하는 "Neo-Fintech Storm UI" 디자인 시스템을 활용합니다. `gradient-flow`, `pulse-glow`, `price-pulse`, `float-particle` 같은 CSS 애니메이션을 통해 동적인 시각적 피드백을 제공합니다. 디자인 요소로는 글래스모피즘 카드, 텍스트 및 테두리의 네온 글로우 효과, 그라디언트 텍스트가 포함됩니다. `prefers-reduced-motion`에 대한 접근성도 지원합니다.

### 기술 구현

#### 백엔드
- **프레임워크**: Node.js + Express + TypeScript
- **데이터베이스**: PostgreSQL (Neon) - 데이터 저장 및 세션 관리
- **인증**: Passport.js (로컬, Google/Kakao OAuth)
- **ORM**: Drizzle ORM
- **실시간**: WebSocket (시장 데이터)

#### 프론트엔드
- **프레임워크**: React + TypeScript + Vite
- **라우팅**: Wouter
- **상태 관리**: TanStack Query (서버 상태)
- **UI 컴포넌트**: Shadcn UI
- **스타일링**: Tailwind CSS

#### 데이터베이스 스키마
주요 테이블: `users`, `kiwoom_accounts`, `holdings`, `orders`, `ai_models`, `ai_recommendations`, `watchlist`, `alerts`, `user_settings`, `trading_logs`, `condition_formulas`, `condition_results`, `chart_formulas`, `watchlist_signals`, `financial_snapshots`, `market_issues`, `auto_trading_settings`, `trading_performance`

#### API 엔드포인트
인증, 계좌 관리, 주문 실행, 주식 정보(실시간 시세, 차트, 재무제표), AI 분석, 관심종목 관리, 사용자 설정, 거래 로그, 조건 검색 기능을 포괄합니다.

#### AI 분석
GPT-4를 활용하여 주식 분석, 포트폴리오 최적화, 신뢰도 점수 산출을 수행합니다. 재무제표, 유동성, 레인보우 차트 분석, 테마 분석, 뉴스 분석, 기관 투자자 추적을 통합합니다.

#### 자동매매 시스템
AI 모델의 CRUD 작업, 활성화/비활성화, 추천 생성, 10선 레인보우 차트 전략 기반 자동 실행을 지원합니다. 학습 시스템이 거래 성과를 분석하고 성공/실패 패턴을 학습하며 매일 AI 모델 파라미터를 자동 최적화합니다.

#### 실시간 시스템
지수 백오프(exponential backoff) 및 하트비트 같은 복원력 기능을 갖춘 WebSocket을 활용하여 실시간 시장 데이터를 제공합니다.

#### PWA
`manifest.json`과 서비스 워커를 통해 오프라인 지원, 캐싱 전략(API는 Network-first, 정적 자산은 Cache-first), 자동 업데이트를 구현합니다.

#### 보안
세션 기반 인증(PostgreSQL 저장), CSRF 방어, API 키의 AES-256-GCM 암호화, 속도 제한, XSS/클릭재킹 방어 및 HTTPS 강제를 위한 보안 헤더(helmet.js)가 구현되어 있습니다.

#### 조건 검색 시스템
**백엔드**: 수식 파싱 및 평가 엔진, 차트 시그널 생성, 재무 데이터 조회, 시장 이슈 추적 기능 제공
**프론트엔드**: 조건 관리 UI, 실시간 스크리닝, 차트 시그널 관심목록, 조건 편집기 제공

#### 레인보우 차트 시스템
2년 고가/저가 기준의 10선 레인보우 차트를 구현합니다. 5번 라인은 정확히 50% 되돌림(주력 매수 구간)을 나타냅니다. 시스템은 주력 매수/매도 구간을 식별하고 자동 추천(강력매수, 매수, 매도, 강력매도)을 생성합니다.

### 기능 사양
- **사용자 인증**: 로컬 이메일/비밀번호, Google OAuth, Kakao OAuth
- **키움 계좌 연동**: CRUD 작업, 잔고/보유종목 조회
- **실시간 대시보드**: 포트폴리오 파이 차트, 30일 자산 추이
- **거래 인터페이스**: 실시간 시세, 일봉 차트, 10단계 호가창, 주문 패널
- **AI 분석 대시보드**: GPT-4 종목 분석, 포트폴리오 최적화, 신뢰도 점수
- **자동매매 시스템**: AI 모델 CRUD, 활성화/비활성화, 추천 생성, 학습 시스템
- **거래 내역 및 로그**: 주문/체결 상세, 거래 로그, 통계 대시보드
- **관심종목 및 가격 알림**
- **PWA 모바일 최적화**

## 외부 종속성
- **키움증권 REST API**: 주식 거래 및 시장 데이터
- **OpenAI API (GPT-4)**: AI 기반 투자 분석
- **Google OAuth**: 사용자 인증
- **Kakao OAuth**: 사용자 인증
- **Neon (PostgreSQL)**: 관리형 PostgreSQL 데이터베이스

## 최근 업데이트 (2026-03-09)

### 키움 REST API 전체 엔드포인트 교정 ✅
- **문제**: 모든 서비스 파일이 한국투자증권(KIS) API (`/uapi/...`, `tr_id`) 사용 → 전체 실패
- **원인**: 키움증권과 KIS는 완전히 다른 API 스펙을 사용
- **8030 오류 해결**: `getKiwoomService()` 싱글톤에 `accountType: "mock"` 기본값 추가 (env: `KIWOOM_ACCOUNT_TYPE`)
- **자동 서버 감지**: 8030 오류 수신 시 실서버↔모의서버 자동 전환 후 재시도

#### 교정된 키움 REST API 엔드포인트 (공식 .NET wrapper 기준)
| 파일 | 기능 | 엔드포인트 | api-id |
|------|------|-----------|--------|
| kiwoom.market.ts | 현재가 시세 | POST /api/dostk/mrkcond | ka10007 |
| kiwoom.market.ts | 호가창 | POST /api/dostk/mrkcond | ka10004 |
| kiwoom.market.ts | 일봉 차트 | POST /api/dostk/chart | ka10081 |
| kiwoom.market.ts | 주봉 차트 | POST /api/dostk/chart | ka10082 |
| kiwoom.market.ts | 월봉 차트 | POST /api/dostk/chart | ka10083 |
| kiwoom.market.ts | 종목기본정보 | POST /api/dostk/stkinfo | ka10001 |
| kiwoom.order.ts | 매수주문 | POST /api/dostk/ordr | kt10000 |
| kiwoom.order.ts | 매도주문 | POST /api/dostk/ordr | kt10001 |
| kiwoom.order.ts | 취소주문 | POST /api/dostk/ordr | kt10003 |
| kiwoom.order.ts | 체결내역 | POST /api/dostk/acnt | kt00007 |
| kiwoom.financial.ts | 재무비율/기본정보 | POST /api/dostk/stkinfo | ka10001 |

#### REST API 미지원 기능 (HTS/WebSocket 전용)
- **조건검색(kiwoom.condition.ts)**: 키움 REST API 미지원 → 명확한 에러 반환
- **autotrading 백어택2 스캔**: HTS 조건검색 대신 `stockCodes` 직접 전달 방식으로 변경
- **상세 재무제표**: 분기별 재무제표는 REST API 미지원 → ka10001 기본정보로 대체

#### 주문 거래구분(trde_tp) 코드
- "00" = 지정가(보통), "03" = 시장가, "05" = 조건부지정가, "06" = 최유리, "07" = 최우선

## 최근 업데이트 (2025-11-14)

### GPT-5.1 모델 전체 업그레이드 ✅
- **OpenAI API 모델명 검증**: 공식 문서 기반 정확한 모델 식별자 적용
  - `gpt-5.1`: 최신 추론 모델 (권장, 환각 45% 감소)
  - `gpt-5.1-chat-latest`: 빠른 대화형 분석, 실시간 스캔용
  - `gpt-5-mini`: 비용 효율적인 대량 분석
  - `gpt-4.1`: 멀티모달 지원 (차트, PDF 분석)
  - `gpt-4o`: 레거시 (빠른 채팅, 곧 지원 종료 예정)
- **스키마 업데이트**: `ai_model` enum을 정확한 API 모델명으로 변경
- **AI 서비스 전체 리팩토링**: 모든 메서드의 기본값을 `gpt-5.1`로 변경
- **설정 페이지 UI 개선**: 각 모델별 상세 설명 추가, 사용자 친화적인 선택 인터페이스
- **전체 시스템 일관성**: routes.ts 등 모든 파일에서 `gpt-5.1` 기본값 적용

## 최근 업데이트 (2025-11-14 이전)

### 레인보우 차트 시스템 구현 완료 ✅
- **BackAttackLine.md 문서 작성**: HTS 수식 완전 해석, 11개 라인 수식, 뒷차기2 조건 분석
- **RainbowChartAnalyzer 클래스**: CL 동적 계산, 11개 라인 생성, CL폭 계산, 투자 신호 생성
- **API 엔드포인트**:
  - POST /api/rainbow/analyze - 종목 코드로 레인보우 차트 분석
  - GET /api/rainbow/:stockCode - 간편 조회
- **뒷차기2 자동 스캔 API**:
  - POST /api/auto-trading/backattack-scan
  - HTS 조건식 자동 실행 → 종목 검색 → 레인보우 차트 분석 → 추천 생성
  - 필터링: 40-60% 구간(주력 매수), CL폭 10%+, 추천 buy 이상

### PostgreSQL Storage 완전 전환 ✅
- **MemStorage → PostgreSQLStorage 마이그레이션 완료**
  - 500+ 라인의 PostgreSQLStorage 클래스 구현
  - IStorage 인터페이스의 모든 메서드 완벽 구현
  - Drizzle ORM 기반 타입 안전한 쿼리
  - 재시작 시 데이터 영구 보존 가능

### 데이터베이스 테이블 정비 ✅
- **누락된 테이블 추가**
  - `auto_trading_settings`: 자동매매 설정 저장
  - `trading_performance`: 거래 성과 추적

### 학습 시스템 통계 정확도 개선 ✅
- **Sharpe Ratio 계산**: 표본 표준편차 사용 (n-1로 나눔)
- **Max Drawdown 계산**: 복리 수익률 기반 누적 equity 추적
- **자동 최적화 안전장치**:
  - 최소 50건 거래 필요
  - 승률 ≥ 45%
  - 총 수익 > 0
  - 최대 낙폭 < 30%

### 키움 API 호환성 강화 ✅
- **응답 형식 처리**: `output1` 우선 사용, `output` fallback
- **필드명 호환성**: `stck_cd`와 `stock_code` 모두 지원
- **견고한 에러 처리**: 다양한 API 응답 형식 대응

### 데이터 정리 서비스 준비 완료 ✅
- **자동 삭제 정책**:
  - 조건검색 결과: 30일
  - 거래 로그: 90일
  - 시장 이슈/재무제표: 3년
  - 트리거된 알림: 1년
- PostgreSQL 전환 완료로 활성화 가능

### 백그라운드 서비스 상태
- ✅ **Auto Trading Worker**: 1분마다 실행 중
- ✅ **Learning System**: 매일 16:00 실행
- 🔄 **Data Cleanup Service**: 준비 완료 (활성화 대기)

### 데이터베이스 안전 규칙
- **ID 타입 변경 금지**: 기존 데이터 보호
- **users 테이블**: VARCHAR (UUID) ID 유지
- **기타 테이블**: SERIAL ID 유지
- **마이그레이션**: `npm run db:push --force` 사용

### 레인보우 차트 공식 (확정)
```
Line N = 저가 + (고가 - 저가) × (N × 0.1)
Line 5 = 정확히 50% 되돌림 (주력 매수 구간)
```

### 기술 스택 요약
- **백엔드**: Node.js + Express + TypeScript + Drizzle ORM + PostgreSQL
- **프론트엔드**: React + Vite + TanStack Query + Shadcn UI + Tailwind CSS
- **AI**: OpenAI GPT-4
- **실시간**: WebSocket
- **인증**: Passport.js (Local + OAuth)
- **보안**: AES-256-GCM, Helmet.js, CSRF, Rate Limiting

## ⛔ 절대 금지 — KIS API 패턴 사용 금지 (위반 시 git hook이 커밋 차단)

이 프로젝트는 **키움증권 REST API**만 사용합니다. **한국투자증권(KIS) API는 완전히 다른 시스템**이며 절대 사용하지 않습니다.

### 금지된 KIS API 패턴 (server/services/kiwoom/ 내 사용 불가)
| 패턴 | 이유 |
|------|------|
| `/uapi/` | KIS API 경로 — 키움과 무관 |
| `tr_id` | KIS 트랜잭션 ID 필드 — 키움은 `api-id` 사용 |
| `TTTC`, `FHKST`, `CTPF` | KIS 전용 tr_id 코드 |
| `Authorization: Bearer` | KIS 인증 방식 — 키움은 `token` 헤더 사용 |
| `appkey` + `appsecret` as KIS headers | 키움도 같은 필드명이지만 경로/구조가 다름 |

### 올바른 키움 REST API 패턴
```
베이스 URL:  https://mockapi.kiwoom.com (모의) / https://api.kiwoom.com (실서버)
인증:        POST /oauth2/token → { token_type, access_token }
요청 헤더:   Content-Type: application/json
             authorization: Bearer {access_token}
             appkey: {APP_KEY}
             appsecret: {APP_SECRET}
             api-id: {요청별 코드}  ← tr_id 아님!
주요 경로:
  /api/dostk/mrkcond   시세/호가
  /api/dostk/chart     차트(일/주/월봉)
  /api/dostk/ordr      주문(매수/매도/취소)
  /api/dostk/acnt      계좌/체결
  /api/dostk/stkinfo   종목정보/재무
```

---

## 바이브코딩 규칙 (필수)
1. 중요한 내용 발견 → **파일에 먼저 기록** → 다음 대화에서도 유지
2. 에러 처리 방식: **try-catch 필수**
3. 파일 주석: **상단에 파일 기능 한 줄 설명** 반드시 명시
4. 코드 길이: **파일당 250~400줄 제한**, 기능별로 파일 분리
   - 예: auth.ts, api.ts, ui.tsx, utils.ts 등 기능 단위 분리
5. 모노레포 폴더 구성 유지 (client / server / shared)
6. **폴더마다 가이드 파일(README.md)** 필수
7. **기획에 더 많은 시간과 노력**을 투자하고, 충분히 설계 후 구현
