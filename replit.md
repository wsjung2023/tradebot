# 키움 AI 자동매매 플랫폼

## 프로젝트 개요
키움증권 REST API와 OpenAI GPT-4를 활용한 프로페셔널 AI 기반 자동매매 플랫폼

## 프로젝트 목표
- 키움증권 REST API를 활용한 실시간 매매
- OpenAI GPT-4 AI 투자 분석 및 자동매매 추천
- Google/Kakao OAuth + 이메일/비밀번호 인증
- 실시간 WebSocket 시세
- PWA 지원 및 모바일 최적화
- 상업용 품질의 완성도

## 기술 스택

### 백엔드
- Node.js + Express + TypeScript
- PostgreSQL (Neon) - Session Store 및 데이터 저장
- Passport.js - 다중 인증 (Local, Google OAuth, Kakao OAuth)
- Drizzle ORM
- WebSocket - 실시간 시세

### 프론트엔드
- React + TypeScript
- Vite
- Wouter - 라우팅
- TanStack Query - 서버 상태 관리
- Shadcn UI - UI 컴포넌트
- Tailwind CSS

### 외부 API
- 키움증권 REST API - 주식 거래
- OpenAI API (GPT-4) - AI 분석
- Google OAuth
- Kakao OAuth

## 아키텍처

### 데이터베이스 스키마
1. `users` - 사용자 정보 및 OAuth 프로필
2. `kiwoom_accounts` - 키움증권 계좌 정보
3. `holdings` - 포트폴리오 보유 종목
4. `orders` - 주문 내역
5. `ai_models` - AI 투자 모델
6. `ai_recommendations` - AI 추천
7. `watchlist` - 관심종목
8. `alerts` - 가격 알림
9. `user_settings` - 사용자 설정
10. `trading_logs` - 거래 로그

### API 엔드포인트
- `/api/auth/*` - 인증 (회원가입, 로그인, 로그아웃, OAuth)
- `/api/accounts/*` - 키움 계좌 관리
- `/api/orders/*` - 주문 관리 (POST /api/orders)
- `/api/all-orders` - 전체 주문 내역 조회 (GET)
- `/api/trading-logs` - 거래 로그 조회 (GET)
- `/api/stocks/*` - 주식 정보 조회
- `/api/ai/*` - AI 분석 및 모델 관리 (GPT-4 분석, 포트폴리오 최적화, 모델 CRUD)
- `/api/watchlist/*` - 관심종목
- `/api/alerts/*` - 알림 설정
- `/api/settings/*` - 사용자 설정

## 현재 구현 상태

### ✅ 완료
1. 데이터베이스 스키마 설계
2. Storage 인터페이스 (MemStorage - 개발용)
3. Passport.js 인증 시스템 (Local + Google/Kakao/Naver OAuth)
4. 로그인/회원가입 페이지 (이메일/비밀번호 + OAuth)
5. Protected Routes 및 인증 가드
6. 키움증권 계좌 연동 (CRUD, 잔고/보유종목 조회)
7. 실시간 대시보드 (Recharts: 포트폴리오 파이차트, 30일 자산 추이)
8. WebSocket 실시간 시세 시스템 (MarketDataHub, useMarketStream hook)
9. 거래 화면 (실시간 가격, 일봉 차트, 호가 10단, 주문 패널)
10. 키움증권 API 서비스 (stub - 실제 API 키 필요)
11. OpenAI AI 서비스 (stub - GPT-4 분석 준비)

### ✅ 완료 (계속)
12. AI 분석 대시보드 (Task #5: GPT-4 종목 분석, 포트폴리오 최적화, 신뢰도 점수)
13. 자동매매 시스템 (Task #6: AI 모델 CRUD, 활성화/비활성화, 추천 생성)
14. 거래 내역 및 로그 (Task #7: 주문/체결 내역, 거래 로그, 통계 대시보드)
15. 관심종목 및 알림 (Task #8)

### ✅ 완료: 키움 조건검색 시스템 백엔드 (2025-11-13)

**데이터베이스 확장 (6개 테이블):**
- `condition_formulas` - 조건검색 공식 (화면 0105)
- `condition_results` - 실시간 스크리닝 결과
- `chart_formulas` - 차트 수식 (7색 시그널)
- `watchlist_signals` - 관심종목 매매신호 (화면 0130)
- `financial_snapshots` - 3년 재무제표 캐시
- `market_issues` - 시장이슈종목

**KiwoomService 확장 (7개 메소드):**
- `getConditionList()` - HTS 저장 조건식 가져오기
- `getConditionSearchResults()` - 조건검색 실행
- `getFinancialStatements()` - 재무제표 조회
- `getFinancialRatios()` - 재무비율 (ROE, ROA, 부채비율)
- `getMarketIssues()` - 당일 시장이슈종목
- `getThemeStocks()` - 테마/섹터 종목
- `getHighVolumeStocks()` - 고유동성 종목

**수식 평가 엔진:**
- `formula/parser.ts` - 차트 수식 → AST 파싱
- `formula/evaluator.ts` - OHLCV 데이터 기반 시그널 계산
- 지원 함수: highest(), lowest(), valuewhen(), h(), l(), c(), o(), v(), avg(), sum()
- 7색 시그널 라인 생성 (매수/매도 지표)

**API 엔드포인트 (19개 추가):**
1. 조건검색 (6개): CRUD + 결과조회
2. 차트수식 (6개): CRUD + 평가 (OHLCV → 시그널)
3. 재무데이터 (2개): 조회 + 동기화
4. 관심종목 시그널 (3개): CRUD
5. 시장이슈 (2개): 당일조회 + 종목별 조회

**데이터 정규화:**
- Kiwoom API 응답 → OHLCVData 변환
- 차트 평가 시 SignalLine 구조체 반환
- 재무 데이터 캐싱 준비 완료

### 🚧 진행 중
1. **조건검색 프론트엔드** (Tasks condition-9~12):
   - 화면 0105: 조건식 관리
   - 화면 0156: 실시간 스크리닝
   - 화면 0130: 차트 시그널 관심종목
   - 차트수식 에디터
2. 실시간 조건검색 프로세서 (WebSocket)
3. 재무데이터 배치 캐싱 시스템
4. PWA 설정 (Task #9: Service Worker, 오프라인 모드)
5. 보안 강화 (Task #10: API 키 암호화, rate limiting)
6. 전체 시스템 테스트 (Task #11)
7. 최종 배포 준비 (Task #12)

## 개발 가이드

### 환경 변수
- `DATABASE_URL` - PostgreSQL 연결 문자열
- `SESSION_SECRET` - Session 암호화 키
- `KIWOOM_APP_KEY` - 키움증권 API 키
- `KIWOOM_APP_SECRET` - 키움증권 API 시크릿
- `OPENAI_API_KEY` - OpenAI API 키
- `GOOGLE_CLIENT_ID` - Google OAuth 클라이언트 ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth 클라이언트 시크릿
- `KAKAO_CLIENT_ID` - Kakao OAuth 클라이언트 ID
- `NAVER_CLIENT_ID` - Naver OAuth 클라이언트 ID (선택)
- `NAVER_CLIENT_SECRET` - Naver OAuth 클라이언트 시크릿 (선택)

### 서버 실행
```bash
npm run dev
```

### 데이터베이스 마이그레이션
```bash
npm run db:push
```

## 보안
- Session-based 인증 (PostgreSQL session store)
- CSRF 보호 (sameSite='lax' cookie)
- API 키 환경 변수 관리
- Passport.js OAuth 인증

## 다음 단계
1. 실시간 차트 및 호가창 구현
2. 주문 기능 완성
3. AI 분석 대시보드 완성
4. WebSocket 실시간 시세 구현
5. PWA manifest 및 service worker
6. 모바일 반응형 최적화
7. 프로덕션 배포 준비

## 최근 변경사항 (2025-11-13)

### ✨ Neo-Fintech Storm UI 대개편 완료 (2025-11-13 오후)

**Task UI-1: 디자인 시스템 구축**
- 사이버펑크 컬러 팔레트 (네온 시안/퍼플/그린/레드)
- CSS 애니메이션 시스템:
  - `gradient-flow`: 배경 그라디언트 흐름 (10초 루프)
  - `pulse-glow`: 네온 글로우 펄스 (2초 루프)
  - `price-pulse`: 가격 변동 플래시 (500ms)
  - `float-particle`: 부유 파티클 (3초)
- 유틸리티 클래스:
  - `.glass-card`: 글래스모피즘 + 백드롭 블러
  - `.text-glow-cyan`, `.text-glow-purple`: 네온 텍스트 글로우
  - `.text-gradient-cyber`: 그라디언트 텍스트
- `prefers-reduced-motion` 접근성 지원

**Task UI-2: 로그인/회원가입 Hero 변신**
- 풀 블리드 AI 트레이딩 배경 이미지 + 다크 그라디언트 워시
- 글래스모피즘 카드 (backdrop-blur, rgba 투명도)
- 애니메이션 그라디언트 흐름 오버레이
- CSS 부유 파티클 효과 (4개, 지연 시간 차등)
- 그라디언트 헤드라인 + 네온 글로우
- 네온 액센트 입력 필드 (커스텀 포커스 링)
- 특징 하이라이트 카드 (AI 자동매매, 실시간 분석, 폭풍 스캐일)

**Task UI-3: 대시보드 비주얼 업그레이드**
- Fixed 애니메이션 그라디언트 배경 (-z-10 레이어)
- 그라디언트 타이틀 (`.text-gradient-cyber`)
- 메트릭 카드 강화:
  - 네온 보더 컬러 (cyan/green/purple, 20% 투명도)
  - `.hover-elevate` 리프트 효과
  - 네온 컬러 아이콘 (Wallet, TrendingUp, Target)
  - `.text-glow-cyan` 총자산 글로우
  - `.animate-price-pulse` 수익 변동 시 펄스
  - `.animate-pulse-glow` 실전 모드 아이콘
- 모든 카드에 펄싱 닷 인디케이터
- 실시간 비주얼 피드백

### Task #8 완료 (관심종목 & 알림)
- 엄격한 정규식 검증 (`/^\d+(\.\d{1,2})?$/`)
- Canonical decimal 직렬화 (`.toFixed(2)`)
- `Number.isFinite` + 범위 체크
- Backend 에러 메시지 표면화

### Task #1-7 완료
- 키움 계좌 연동, 실시간 대시보드, WebSocket 시세
- 거래 화면, 인증 시스템, AI 분석 대시보드
- 자동매매 시스템, 거래 내역/로그

### 기술적 개선
- MemStorage ID counter 충돌 수정
- WebSocket schema 변환 (market-data-hub.ts)
- Alert validation pipeline 강화
- Neon color system with HSL tokens

### 사용 가이드 페이지 추가 (2025-11-13)
- **7단계 사용 가이드**: 회원가입부터 자동매매까지 전체 프로세스 설명
- **단계별 설명**:
  1. 회원가입 및 로그인 (이메일/Google OAuth)
  2. 키움증권 계좌 연동 (실계좌/모의투자)
  3. 대시보드 활용 (총자산, 수익, 포트폴리오, 자산추이)
  4. 주식 거래하기 (종목 검색, 실시간 정보, 주문)
  5. AI 분석 활용 (GPT-4 종목 분석, 포트폴리오 최적화)
  6. AI 자동매매 시작 (모델 생성/활성화, 모니터링)
  7. 거래 내역 및 설정 (이력 조회, 관심종목, 설정)
- **접근성**: 로그인/회원가입 페이지에 가이드 링크, 사이드바 메뉴 추가
- **Neo-Fintech 디자인**: 애니메이션 배경, 단계별 색상 구분, 경고/팁 표시

### ✅ 필수 기능 완료 (2025-11-13 저녁)

**WebSocket 안정화 (WS-2, WS-3)**
- 클라이언트 resilience: exponential backoff with jitter, max 10 retries, navigator.onLine 감지
- ConnectionStatus UI 컴포넌트 (5가지 상태)
- 서버 heartbeat: 30초마다 ws.ping(), 90초 idle timeout
- lastActivity 추적, pong 이벤트 자동 갱신

**PWA 구축 (PWA-1, PWA-2)**
- manifest.json: 512x512/192x192 아이콘, 테마 컬러, shortcuts
- Service Worker: Vite 에셋 패턴 캐싱 (/assets/*.js, CSS, 폰트, 이미지)
- 캐싱 전략:
  * API: Network-first, cache fallback
  * Static assets: Cache-first
  * Navigation: Network-first, 오프라인 시 SPA root fallback (deep link 지원)
- 자동 업데이트 감지 및 알림

**보안 강화 (SEC-1, SEC-2, SEC-3)**
- API 키 암호화: AES-256-GCM, PBKDF2 (100k iterations), salt/IV/tag 분리
- Rate Limiting:
  * API 전체: 15분 100회/IP
  * 인증: 15분 5회/IP (skipSuccessfulRequests)
- Security Headers (helmet.js):
  * CSP: 프로덕션 strict policy (개발 환경 Vite HMR용 비활성화)
  * XSS, clickjacking 방어
  * HTTPS 강제

### 다음 단계
- 조건검색 프론트엔드 완성 (차트수식 에디터)
- Task UI-4: 동적 데이터 시각화
- Task UI-5: 마이크로 인터랙션
- 최종 QA 및 배포 준비
