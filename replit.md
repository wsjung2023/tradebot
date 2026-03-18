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

## Environment Variables Required
```
DATABASE_URL=
SESSION_SECRET=
OPENAI_API_KEY=
KIWOOM_APP_KEY=
KIWOOM_APP_SECRET=
KIWOOM_IS_MOCK=false
DART_API_KEY=
ENABLE_AI_COUNCIL=false
ENABLE_ENTRY_POINT_ENGINE=false
ENABLE_ADVANCED_LEARNING=false
```

## API Endpoints
- `GET /api/kiwoom/conditions` — 키움 HTS 조건검색식 목록 (WebSocket ka10171)
- `POST /api/kiwoom/conditions/:seq/run` — 조건검색 실행 (WebSocket ka10172)
- `GET /api/chart-formulas` — 차트수식 목록
- `POST /api/chart-formulas/:id/evaluate` — 차트수식 계산 및 오버레이 데이터 반환
- `GET /api/stocks/search?q=keyword` — 종목명/코드 검색
- `GET /api/watchlist` — 관심종목 목록 (키움 실시간 시세 포함)
- `POST /api/watchlist/sync-kiwoom` — 관심종목 키움 시세 새로고침

## Vibe Coding Rules (필수)
- 파일 크기: 250~400줄 (최대 500줄)
- 모든 파일 첫 줄: 파일 역할 한줄 주석
- 모든 폴더: README.md 필수
- 에러 핸들링: try-catch 필수
- DB 접근: storage 함수 통해서만
- 삭제 금지: _OLD 접미사로 이름 변경
- 여러 파일 쓰기: 반드시 하나의 exec 호출로 배치 처리

## Architecture
```
server/
  routes/          # 도메인별 라우터 (account, ai, auth, autotrading, formula, trading, watchlist)
  services/
    kiwoom/        # 키움 API (base, account, market, order, condition, financial)
    ai.service.ts
    ai-council.service.ts
    dart.service.ts
    news.service.ts
    trade-executor.service.ts
  storage/         # DB 접근 레이어 (interface, postgres-core, postgres)
  config/
    feature-flags.ts
  job-manager.ts   # 백그라운드 잡 관리
  auto-trading-worker.ts

client/src/
  pages/           # 17개 페이지
  components/      # 도메인별 컴포넌트
  hooks/
  lib/
```

## Deployment (Replit)
- `npm run dev` — 개발 서버 (Vite + Express)
- `npm run build` — 프로덕션 빌드
- `npm start` — 프로덕션 서버

## 키움 API 고정 IP 솔루션 — 집 PC 폴링 에이전트

### 배경
키움 REST API는 허용된 공인 IP에서만 호출 가능. Replit은 유동 IP라 키움을 직접 호출 불가.

### 아키텍처
```
사용자 브라우저 → Replit (작업 등록) → kiwoom_jobs 테이블
집 PC 에이전트 → Replit GET /api/kiwoom-agent/jobs/next → 키움 REST 호출 → Replit POST result
사용자 브라우저 → GET /api/kiwoom-agent/jobs/:id/status → 결과 표시
```

- **Replit**: 화면 + 작업 큐 역할 (고정 IP 불필요)
- **집 PC**: 실제 키움 API 호출 (집 공인 IP를 키움에 등록)
- 포트포워딩/도메인/외부 공개 전혀 불필요

### API 엔드포인트
- `POST /api/kiwoom-agent/jobs` — 작업 등록 (인증된 사용자)
- `GET /api/kiwoom-agent/jobs/next?agent_key=xxx` — 에이전트 작업 폴링
- `POST /api/kiwoom-agent/jobs/:jobId/result` — 에이전트 결과 업로드
- `GET /api/kiwoom-agent/jobs/:jobId/status` — 작업 상태 조회
- `GET /api/kiwoom-agent/jobs` — 최근 작업 목록

### 설정 방법
1. Replit Secrets에 `AGENT_KEY` 추가 (랜덤 문자열)
2. 키움 포털에서 집 PC 공인 IP 등록
3. 집 PC에서 `python agent/kiwoom-agent.py` 실행
4. `agent/.env` 파일에 REPLIT_URL, AGENT_KEY, KIWOOM_APP_KEY/SECRET 설정

### 집 PC 에이전트 실행
```bash
pip install requests python-dotenv
python agent/kiwoom-agent.py
```

자세한 내용: `agent/README.md`
