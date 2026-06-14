# TradeBot 구성 및 외부 서비스 현황

> 점검일: 2026-06-14  
> 판정 기준: 저장소 코드/설정/Git 이력과 로컬 `.env`의 값 존재 여부  
> `가입 여부 확인 필요`는 소스코드만으로 해당 서비스 콘솔의 실제 계정 상태를 확정할 수 없다는 뜻이다.

## 1. 상태 정의

| 상태 | 의미 |
|---|---|
| 활성/확정 | 코드와 현재 로컬 설정 또는 배포 파이프라인 모두 확인 |
| 부분 구성 | 코드 또는 배포 설정은 있으나 현재 로컬 설정/운영 연결이 불완전 |
| 미설정 | 코드 지원은 있으나 현재 로컬 환경변수가 비어 있음 |
| 레거시 | 과거 사용 흔적은 있으나 현재 주 실행 경로가 아님 |
| 증거 없음 | 저장소에서 이 프로젝트와 연결된 흔적을 찾지 못함 |

## 2. 외부 서비스 인벤토리

| 서비스 | 용도 | 저장소 판정 | 현재 로컬 설정 | 근거 및 메모 |
|---|---|---|---|---|
| GitHub | 소스 저장소, CI/CD | 활성/확정 | 연결됨 | `origin=https://github.com/wsjung2023/tradebot.git`, `dev/main` CI |
| GitHub Actions | typecheck, Railway Staging 배포 | 활성/확정 | 해당 없음 | `ci.yml`, `deploy-staging.yml`; `dev` push 시 `railway up --detach` |
| Railway Staging | Node 앱 배포 | 부분 구성, 배포 이력 강함 | 로컬 토큰 확인 불가 | `railway.toml`, Actions, 다수 Railway 배포 커밋 |
| Railway Production | 향후 운영 배포 | 가입 여부 확인 필요 | 미확인 | 저장소에 production 전용 workflow/연결 증거 없음 |
| Railway PostgreSQL | 향후/스테이징 DB | 가입 여부 확인 필요 | 현재 로컬 DB는 localhost 계열 | Railway 설정은 있으나 DB 콘솔 상태는 소스에서 확인 불가 |
| Vercel | 프론트 배포 후보 | 증거 없음 | 미설정 | `vercel.json`, Vercel env, Vercel URL, adapter 모두 없음 |
| Replit | 과거 앱 배포/개발 | 레거시 | 현재 로컬 런타임 아님 | `.replit.example`, Replit 문서/과거 Published App 커밋 |
| Cloudflare Tunnel | 로컬 서버 외부 공개 | 레거시 설치 스크립트 흔적 | 미확인 | `install.ps1`이 `cloudflared` 시작 파일 생성 |
| PostgreSQL | 주 데이터베이스/세션 | 활성/확정 | 설정됨 | Drizzle + pg, 현재 `.env`의 DB는 localhost 계열 |
| Kiwoom REST API | 시세, 계좌, 주문, 조건검색 | 활성/확정 | 실/모의 및 계좌별 키 설정 | 서버 직접 호출 방식 |
| OpenAI API | AI 분석/학습/의사결정 | 활성/확정 | 설정됨 | `openai` SDK, AI 서비스 |
| Google OAuth | 소셜 로그인 | 활성/확정 | 설정됨 | Passport Google Strategy |
| Naver Search API | 뉴스 검색 | 활성/확정 | 설정됨 | `news.service.ts`; Naver OAuth 로그인은 비활성 |
| OpenDART | 공시/재무/위험공시 | 활성/확정 | 설정됨 | `dart.service.ts` |
| Paddle | SaaS 구독 결제 | 미설정 | API/Webhook/Price ID 없음 | 코드와 DB 스키마만 구현, 실제 플랜 집행도 미연결 |
| Resend | 가입 인증 메일/알림 | 미설정 | API 키 없음 | 코드 구현됨; 현재 신규 로컬 회원 인증 흐름 차단 가능 |
| Sentry | 서버 에러 추적 | 미설정 | DSN 없음 | 서버 연동 코드만 있음 |
| SendGrid | 에이전트 알림 메일 대안 | 미설정 | API 키 없음 | `agent-alert.service.ts`에서 선택 지원 |
| SMTP | 에이전트 알림 메일 대안 | 미설정 | SMTP 설정 없음 | `agent-alert.service.ts`에서 선택 지원 |
| Aligo KakaoTalk | 알림톡 | 부분 구성 | 환경 설정 미확인 | HTTP 연동 코드 존재 |
| api.ipify.org | 서버 공인 IP 확인 | 활성 코드 | 별도 키 불필요 | `/api/server-info`에서 호출 |
| Google Fonts | 웹 폰트 | 활성 코드 | 별도 키 불필요 | `client/index.html` |

## 3. 현재 로컬 환경변수 현황

### 3.1 설정됨

- `PORT`
- `VITE_APP_ENV`
- `SESSION_SECRET`
- `DATABASE_URL`
- `AGENT_KEY`
- `ENCRYPTION_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
- `DART_API_KEY`
- 키움 공통/실계좌/모의계좌 및 일부 계좌별 키
- `ENABLE_ADVANCED_LEARNING`

### 3.2 없거나 비어 있음

- `NODE_ENV`: 일반 실행 시 기본 `development`
- `DEPLOYMENT_TIER`: 기본 `on_prem`
- `DATABASE_READONLY_URL`: 쓰기 DB URL 재사용
- `RESEND_API_KEY`, `EMAIL_FROM`
- `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`
- `PADDLE_PRICE_BASIC`, `PADDLE_PRICE_PRO`, `PADDLE_PRICE_ENTERPRISE`
- `SENTRY_DSN`
- `ALLOWED_ORIGINS`
- `DIRECT_AGENT_URL`
- `SENDGRID_API_KEY`, `SMTP_HOST`
- `ENABLE_AI_COUNCIL`: 기본 OFF
- `ENABLE_ENTRY_POINT_ENGINE`: 기본 OFF
- `ENABLE_PRICE_ALERTS_IN_TRADING_CYCLE`: 기본 ON

## 4. 배포 및 운영 구성

| 구성 | 현재 상태 | 설명 |
|---|---|---|
| 로컬 개발 | 활성 | `tradebot-dev`, `npm run dev` |
| 로컬 운영 | 활성 흔적 | `D:\Projects\tradebot`, port 5000, Windows 작업 스케줄러 |
| dev → 로컬 운영 배포 | 활성 흔적 | `deploy.bat`가 파일 복사, Git push, 서버 재시작 수행 |
| GitHub CI | 활성 | `dev`, `main` push/PR에서 `npm run check` |
| Railway Staging CD | 활성 구성 | `dev` push 후 typecheck 성공 시 Railway CLI 배포 |
| Railway Production CD | 없음 | 자동 배포 workflow 없음 |
| DB 마이그레이션 | Railway 시작 시 자동 | `scripts/migrate-prod.mjs`가 SQL 파일 순차 적용 |
| Healthcheck | 구성됨 | Railway `/api/healthz`, 앱에는 `/api/health`도 존재 |
| Docker | 없음 | Dockerfile/Compose 없음 |
| Vercel 배포 | 없음 | 프론트/백엔드 모두 Express 단일 배포 구조 |

## 5. 기능별 제품화 준비도

| 영역 | 준비도 | 현재 판단 |
|---|---|---|
| 핵심 자동매매 | 높음 | 스캔, 판단, 주문, 잔고, 학습, 매도계획 구현 |
| 멀티 사용자 데이터 구조 | 중상 | userId 기반 격리 구현, 별도 조직/테넌트 모델은 없음 |
| 관리자 운영 | 중상 | Job/사용자 UI, RBAC, 모니터링 구현 |
| 보안 기본기 | 중상 | 암호화, 세션, Helmet, rate limit, audit log 구현 |
| SaaS 결제 | 낮음 | Paddle 코드/스키마만 있고 실제 설정과 제한 집행 미완성 |
| 신규 가입 | 낮음 | Resend 미설정 상태에서는 이메일 인증 흐름이 막힘 |
| 수평 확장 | 낮음 | in-process cron/worker 때문에 단일 인스턴스 전제 |
| 장애 복구 | 중하 | DB 영속 데이터는 있으나 Job/모니터 상태 일부는 메모리 |
| 설치형 배포 | 중 | PowerShell 설치 스크립트가 있으나 현재 구조와 오래된 내용 혼재 |
| 문서/구성 관리 | 중 | 자료는 많지만 Replit/Agent/직접 호출 시대 문서가 섞여 있음 |

## 6. 출시 전 구성 확인 체크리스트

### 즉시 확인할 외부 콘솔

- [ ] Railway 프로젝트 목록에서 Staging 서비스와 PostgreSQL 실제 존재 여부 확인
- [ ] Railway Staging의 환경변수와 `DEPLOYMENT_TIER` 값 확인
- [ ] Railway Staging의 현재 도메인, outbound 고정 IP 제공 여부 확인
- [ ] GitHub Repository Secrets의 `RAILWAY_TOKEN` 존재 및 권한 확인
- [ ] Google Cloud OAuth callback URL에 현재 운영/스테이징 도메인 등록 확인
- [ ] Kiwoom에 허용된 공인 IP가 로컬 운영 IP인지 Railway IP인지 확인
- [ ] Paddle 계정/상품/Price ID/Webhook 생성 여부 확인
- [ ] Resend 계정/API Key/발신 도메인 생성 여부 확인
- [ ] Sentry 프로젝트/DSN 생성 여부 확인
- [ ] Vercel에 TradeBot 프로젝트가 있다면 미사용 프로젝트인지 확인 후 정리
- [ ] Replit에 과거 TradeBot 앱이 실행 중이면 비용/노출 여부 확인 후 중지 또는 폐기

### 코드에서 먼저 막아야 할 항목

- [ ] `/api/master-settings`에 `requireAdmin` 적용
- [ ] 이메일 인증 재발송 흐름과 Resend 미설정 시 동작 정리
- [ ] Public SaaS의 플랜 제한 미들웨어를 실제 유료 기능에 연결
- [ ] 자동매매 워커 단일 실행 잠금과 주문 idempotency 보강
- [ ] Railway 운영 시 `.kiwoom_token_cache.json` 의존 제거
- [ ] `ALLOWED_ORIGINS`와 실제 도메인 확정
- [ ] 레거시 Agent/Replit 문서와 코드의 유지/삭제 결정
- [ ] Kakao/Naver 로그인 라우트 제거 또는 Strategy 정상 구성

## 7. 지금 가장 현실적인 판매 형태

현재 코드 상태에서 가장 빠르고 안전한 첫 제품 형태는 완전 공용 SaaS보다 **관리형 Private Cloud**다.

권장 초기 판매 패키지:

1. 고객별 Railway 프로젝트 또는 전용 서버 1개
2. 고객별 PostgreSQL 1개
3. 고객 키움 API 키와 허용 공인 IP 설정 지원
4. 단일 자동매매 워커 인스턴스
5. 월 구독 + 초기 설치/온보딩 비용
6. 소스코드는 제공하지 않고 운영/업데이트는 판매자가 관리

이 방식은 현재 단일 프로세스 구조를 거의 그대로 활용하면서 소스 유출, 다중 사용자 장애 전파, 결제 자동화 부담을 줄인다. Public SaaS는 인증, 플랜 집행, 워커 분리, 운영 관측을 보강한 뒤 다음 단계로 전환하는 편이 적합하다.

