# 키움 AI 자동매매 플랫폼

## Overview
키움증권 REST API + OpenAI GPT-4 기반 AI 자동매매 플랫폼.
실시간 거래, AI 투자 분석, 자동매매 추천, 조건검색, 차트 분석 기능 포함.

## Tech Stack
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **Auth**: Passport.js (Local, Google/Kakao OAuth)
- **Realtime**: WebSocket
- **Frontend**: React + TypeScript + Vite + Wouter + TanStack Query + Shadcn UI

## Key Features
1. **실시간 거래**: WebSocket 기반 실시간 시세 및 호가
2. **조건검색**: 키움 WebSocket API (ka10171~ka10174)로 사용자 조건검색식 실행
3. **AI 분석**: GPT-4 기반 종목 분석 및 포트폴리오 최적화
4. **자동매매**: AI 모델 기반 자동매매 (shadow 모드 지원)
5. **차트수식**: 사용자 정의 차트 지표 (MA, RSI, MACD 등)
6. **관심종목**: 실시간 시세 모니터링

---

## ⚠️ 키움 API 고정 IP 아키텍처 — 절대 변경 금지

### 핵심 제약 조건
- **Replit은 유동 IP** → 키움 REST API 직접 호출 불가 (IP 등록 불가)
- **집 PC가 고정 IP** → 키움 포털에 집 PC 공인 IP 등록 → 실계좌 API 호출 가능
- **절대 Replit 서버에서 키움 API를 직접 호출하지 말 것**

### 폴링 아키텍처 흐름
```
사용자 브라우저
  → POST /api/kiwoom-agent/jobs (작업 등록)
  → kiwoom_jobs 테이블 (Replit DB)

집 PC 에이전트 (kiwoom-agent.py)
  → GET /api/kiwoom-agent/jobs/next (폴링, 2~5초)
  → 키움 REST API 호출 (집 PC IP 사용)
  → POST /api/kiwoom-agent/jobs/:id/result (결과 업로드)

사용자 브라우저
  → GET /api/kiwoom-agent/jobs/:id/status (결과 조회)
```

### 앱키 분리 구조 (v2.5 이후 확정)

**키움 앱키는 실계좌/모의계좌가 완전히 별개다.**
같은 앱키로 실계좌 API(api.kiwoom.com)와 모의계좌 API(mockapi.kiwoom.com)를 동시에 사용 불가.

| Replit Secret 이름 | 용도 | API URL |
|---|---|---|
| `KIWOOM_APP_KEY_REAL` | 실계좌 전용 앱키 | api.kiwoom.com |
| `KIWOOM_APP_SECRET_REAL` | 실계좌 전용 시크릿 | api.kiwoom.com |
| `KIWOOM_APP_KEY` | 모의계좌 앱키 (구버전 호환) | mockapi.kiwoom.com |
| `KIWOOM_APP_SECRET` | 모의계좌 시크릿 (구버전 호환) | mockapi.kiwoom.com |
| `KIWOOM_KEY_59190647` | 실계좌 앱키 fallback (계좌번호 기반 명칭) | api.kiwoom.com |

**앱키 우선순위 (서버 `/api/kiwoom-agent/appkeys` 기준):**
- 실계좌: `KIWOOM_APP_KEY_REAL` → `KIWOOM_KEY_59190647` → `KIWOOM_APP_KEY`
- 모의계좌: `KIWOOM_APP_KEY_MOCK` → `KIWOOM_APP_KEY`

### 키움 API 오류 코드 해석

| 코드 | 의미 | 원인 | 해결 |
|---|---|---|---|
| **8030** | 투자구분 불일치 | 모의계좌 앱키로 실계좌 API 호출 | 실계좌 전용 앱키 사용 |
| **8050** | 지정단말기 인증 실패 | 미등록 IP에서 실계좌 API 호출 | 키움 포털에서 집 PC IP 등록 |
| **8005** | 토큰 유효하지 않음 | 만료된 토큰 또는 잘못된 앱키 | 토큰 재발급 |

**⚠️ 8030이 나오면 반드시 앱키 투자구분 확인 (앱키 자체가 모의계좌용)**
**⚠️ 8050이 나오면 IP 등록 문제 (앱키는 실계좌용이 맞음)**

### 에이전트 앱키 수신 로직 — 변경 금지

집 PC `.env`에 `KIWOOM_APP_KEY_REAL`이 없으면 **반드시** 서버에서 받아와야 한다.
아래 조건을 절대 `if not KIWOOM_APP_KEY_REAL or not KIWOOM_APP_KEY_MOCK:` 형태로 바꾸지 말 것.
`KIWOOM_APP_KEY`만 있어도 조건이 False가 되어 서버에서 앱키를 받지 않게 됨.

```python
# agent/kiwoom-agent.py main() 함수 내 — 올바른 조건
_has_real_specific = bool(os.getenv("KIWOOM_APP_KEY_REAL"))   # 전용 변수만 체크
_has_mock_specific = bool(os.getenv("KIWOOM_APP_KEY_MOCK"))   # 전용 변수만 체크
if not _has_real_specific or not _has_mock_specific:
    fetch_appkeys_from_server()   # 서버에서 분리된 앱키를 받아옴
```

**❌ 절대 이렇게 하지 말 것:**
```python
if not KIWOOM_APP_KEY_REAL or not KIWOOM_APP_KEY_MOCK:   # WRONG
    fetch_appkeys_from_server()
# → KIWOOM_APP_KEY가 있으면 KIWOOM_APP_KEY_REAL에 복사되어 조건이 False가 됨
# → 서버에서 실계좌 앱키를 받지 않고 모의계좌 앱키로 실계좌 API 호출 → 8030
```

---

## ⚠️ 잔고 파싱 로직 — 절대 변경 금지

키움 API 응답은 필드명이 두 가지(실계좌/모의계좌)다. 파싱 우선순위를 임의로 변경하면 특정 계좌에서 0원이 표시된다.

**account.routes.ts의 parseNum 우선순위:**
```
raw.tot_evlt_amt        (실계좌 주식 평가금액)
raw.tot_evlu_amt        (모의계좌 주식 평가금액)
raw.acnt_tot_evlu_amt   (모의계좌 전체 평가금액)
output1.xxx             (구버전 에이전트 호환)
result.totalEvaluationAmount  (에이전트 계산값 최후 fallback)
```

**보유종목 파싱 필드 매핑:**
```
종목코드: acnt_pdno / pdno / stk_cd / stockCode
종목명:   prdt_name / stk_nm / stockName
수량:     hldg_qty / rmnd_qty / quantity
평균가:   pchs_avg_pric / avg_pric / averagePrice
현재가:   prpr / cur_prc / currentPrice
```

**총 자산 계산식:**
```
totalAssets = 주식평가금액(tot_evlt_amt) + 예수금(prsm_dpst_aset_amt)
```
주식평가금액만 totalAssets로 쓰지 말 것. 예수금이 빠진다.

---

## ⚠️ KIS API 절대 금지

이 프로젝트는 **키움증권 REST API**를 사용한다. 한국투자증권(KIS) API가 아님.

KIS API 패턴이 코드에 있으면 즉시 삭제:
- `/uapi/` 경로
- `tr_id` 파라미터
- `TTTC`, `FHKST`, `CTPF` 접두어
- `approval_key` 발급 로직

---

## Environment Variables Required

```
DATABASE_URL=
SESSION_SECRET=
OPENAI_API_KEY=
KIWOOM_APP_KEY=          # 모의계좌 앱키 (또는 공통 fallback)
KIWOOM_APP_SECRET=       # 모의계좌 시크릿
KIWOOM_APP_KEY_REAL=     # 실계좌 전용 앱키 (필수 — 없으면 에이전트가 서버에서 받음)
KIWOOM_APP_SECRET_REAL=  # 실계좌 전용 시크릿
KIWOOM_IS_MOCK=false
DART_API_KEY=
AGENT_KEY=               # 에이전트 인증키 (랜덤 문자열)
ENABLE_AI_COUNCIL=false
ENABLE_ENTRY_POINT_ENGINE=false
ENABLE_ADVANCED_LEARNING=false
```

---

## API Endpoints

### 키움 에이전트 (집 PC 폴링)
- `POST /api/kiwoom-agent/jobs` — 작업 등록
- `GET /api/kiwoom-agent/jobs/next?agent_key=xxx` — 에이전트 폴링 (AGENT_KEY 필요)
- `POST /api/kiwoom-agent/jobs/:jobId/result` — 결과 업로드 (AGENT_KEY 필요)
- `GET /api/kiwoom-agent/jobs/:jobId/status` — 결과 조회
- `GET /api/kiwoom-agent/appkeys` — 에이전트에 앱키 제공 (AGENT_KEY 필요)
- `GET /api/kiwoom-agent/download` — 에이전트 최신 파일 다운로드 (AGENT_KEY 필요)

### 계좌/잔고
- `GET /api/accounts` — 계좌 목록
- `GET /api/accounts/:id/balance` — 잔고 조회 (에이전트 경유)
- `GET /api/accounts/:id/holdings` — 보유종목

### 기타
- `GET /api/kiwoom/conditions` — 조건검색식 목록
- `GET /api/chart-formulas` — 차트수식 목록
- `GET /api/stocks/search?q=keyword` — 종목 검색
- `GET /api/watchlist` — 관심종목

---

## 에이전트 설정 및 실행

### 집 PC agent/.env
```
REPLIT_URL=https://your-app.replit.app
# 개발 서버도 동시 폴링하려면:
REPLIT_URLS=https://your-app.replit.app,https://xxxx.spock.replit.dev

AGENT_KEY=Replit_Secrets의_AGENT_KEY_와_동일값

# 실계좌/모의계좌 앱키가 다를 경우:
KIWOOM_APP_KEY_REAL=실계좌_앱키
KIWOOM_APP_SECRET_REAL=실계좌_앱시크릿
KIWOOM_APP_KEY_MOCK=모의계좌_앱키
KIWOOM_APP_SECRET_MOCK=모의계좌_앱시크릿

# 위 전용 변수 없으면 자동으로 서버에서 받아옴 (KIWOOM_APP_KEY만 있어도 OK)
KIWOOM_IS_MOCK=false
POLL_INTERVAL=2
```

### 집 PC 에이전트 실행
```bash
pip install requests python-dotenv
# 최신 버전 자동 다운로드 후 실행:
curl "https://your-app.replit.app/api/kiwoom-agent/download" \
  -H "x-agent-key: YOUR_AGENT_KEY" -o kiwoom-agent.py && python kiwoom-agent.py
# 또는 래퍼 스크립트:
python agent/run-agent.py
```

### 에이전트 지원 job 타입
| job_type | 설명 |
|---|---|
| `ping` | 연결 확인 및 버전 확인 |
| `token.test` | 실계좌/모의계좌 토큰 발급 테스트 |
| `balance.get` | 잔고 + 보유종목 조회 |
| `price.get` | 현재가 조회 |
| `order.buy` / `order.sell` | 매수/매도 주문 |
| `conditions.list` | 조건검색식 목록 |

---

## Architecture
```
server/
  routes/
    account.routes.ts      # 잔고/보유종목 (파싱 로직 변경 금지)
    kiwoom-agent.routes.ts # 에이전트 작업 큐 + appkeys/download 엔드포인트
    ai.routes.ts
    auth.routes.ts
    autotrading.routes.ts
    formula.routes.ts
    trading.routes.ts
    watchlist.routes.ts
  services/
    agent-proxy.service.ts # callViaAgent() — 작업 등록 후 결과 대기
    kiwoom/                # 키움 API (base, account, market, order, condition)
    ai.service.ts
    dart.service.ts
  storage/                 # DB 접근 레이어 (interface, postgres-core, postgres)
  config/
    feature-flags.ts
  job-manager.ts
  auto-trading-worker.ts

agent/
  kiwoom-agent.py          # 집 PC 에이전트 v2.5 (앱키 수신 로직 변경 금지)
  run-agent.py             # 래퍼 스크립트 (자동 업데이트 후 실행)
  .env                     # 집 PC 전용 설정 (git 제외)
  README.md

client/src/
  pages/                   # 17개 페이지
  components/
  hooks/
  lib/
```

## Deployment (Replit)
- `npm run dev` — 개발 서버 (Vite + Express)
- `npm run build` — 프로덕션 빌드
- `npm start` — 프로덕션 서버

## Vibe Coding Rules (필수)
- 파일 크기: 250~400줄 (최대 500줄)
- 모든 파일 첫 줄: 파일 역할 한줄 주석
- 모든 폴더: README.md 필수
- 에러 핸들링: try-catch 필수
- DB 접근: storage 함수 통해서만
- 삭제 금지: _OLD 접미사로 이름 변경
- 여러 파일 쓰기: 반드시 하나의 exec 호출로 배치 처리
