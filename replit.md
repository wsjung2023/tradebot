# 키움 AI 자동매매 플랫폼

## Overview
키움 AI 자동매매 플랫폼은 키움증권 REST API와 OpenAI GPT-4를 활용하여 실시간 주식 거래, AI 기반 투자 분석, 자동매매 추천, 조건검색, 그리고 차트 분석 기능을 제공하는 서비스입니다. 이 플랫폼은 사용자가 개인 투자 전략을 자동화하고, AI의 분석을 통해 시장 변화에 효과적으로 대응할 수 있도록 돕습니다. 주요 목표는 투자 의사결정의 효율성을 높이고, 개인 투자자에게 전문적인 투자 도구를 제공하는 것입니다.

## User Preferences
- 파일 크기: 250~400줄 (최대 500줄)
- 모든 파일 첫 줄: 파일 역할 한줄 주석
- 모든 폴더: README.md 필수
- 에러 핸들링: try-catch 필수
- DB 접근: storage 함수 통해서만
- 삭제 금지: _OLD 접미사로 이름 변경
- 여러 파일 쓰기: 반드시 하나의 exec 호출로 배치 처리

## System Architecture

### Core Architecture
이 플랫폼은 Replit 서버(Node.js + Express + TypeScript)와 사용자 집 PC에 설치된 Python 에이전트(`kiwoom-agent.py`) 간의 폴링 메커니즘을 통해 키움증권 REST API와 통신합니다. Replit 서버는 유동 IP를 가지므로 키움 API에 직접 접근할 수 없으며, 고정 IP를 가진 집 PC의 에이전트가 키움 API 호출을 담당합니다.

**기술 스택:**
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **Auth**: Passport.js (Local, Google/Kakao OAuth)
- **Realtime**: WebSocket
- **Frontend**: React + TypeScript + Vite + Wouter + TanStack Query + Shadcn UI

### Feature Specifications
1.  **실시간 거래**: WebSocket 기반 실시간 시세 및 호가 정보 제공.
2.  **조건검색**: 키움 WebSocket API를 활용한 사용자 정의 조건검색식 실행.
3.  **AI 분석**: GPT-4 기반 종목 분석 및 포트폴리오 최적화.
4.  **자동매매**: AI 모델 기반 자동매매 시스템 (shadow 모드 지원).
5.  **차트수식**: 사용자 정의 차트 지표 (MA, RSI, MACD 등).
6.  **관심종목**: 실시간 시세 모니터링 기능.

### Design Decisions
-   **키움 API 연동**: Replit의 유동 IP 제약사항을 극복하기 위해, 키움 API 호출은 고정 IP를 가진 집 PC 에이전트를 통해 이루어집니다. Replit 서버는 작업 큐를 관리하고, 에이전트는 이 큐를 폴링하여 작업을 수행한 후 결과를 서버에 업로드합니다.
-   **앱키 관리**: 실계좌(`KIWOOM_APP_KEY_REAL`)와 모의계좌(`KIWOOM_APP_KEY_MOCK`) 앱키는 완전히 분리되어 사용되며, 에이전트는 서버로부터 필요한 앱키를 동적으로 받아올 수 있습니다. 서버 환경변수는 `KIWOOM_KEY_59190647`(앱키) + `KIWOOM_SECRET_59190647`(시크릿). `/api/kiwoom-agent/appkeys` 엔드포인트에서 에이전트에 전달.
-   **잔고 파싱 로직**: 키움 API의 다양한 응답 필드명을 처리하기 위해 일관된 파싱 우선순위를 적용하여 정확한 잔고 및 보유종목 정보를 표시합니다. `server/routes/account.routes.ts` 내 "변경 금지" 주석 구간 절대 수정 금지.
-   **총 자산 계산**: 주식평가금액과 예수금을 합산하여 총 자산을 계산합니다.

### File Structure
-   `server/`: Express API, 서비스 로직, 키움 API 래퍼, 스토리지 계층.
-   `agent/`: 집 PC에서 실행되는 Python 에이전트.
-   `client/src/`: React 기반 프론트엔드 코드.

---

## ⚠️ 절대 건드리지 말 것 (버그 수정 이력)

### 1. 키움 토큰 발급 파라미터 필드명
**파일**: `agent/kiwoom-agent.py` `refresh_kiwoom_token()`, `handle_token_test()`  
**규칙**: 키움 OAuth 토큰 발급 요청 body의 필드명은 반드시 `secretkey`여야 함.  
`appsecretkey`는 키움 API가 인식 못 함 → 빈 응답 → JSONDecodeError 발생.

```python
# ✅ 올바른 것
payload = {"grant_type": "client_credentials", "appkey": app_key, "secretkey": app_secret}

# ❌ 절대 쓰면 안 되는 것
payload = {"grant_type": "client_credentials", "appkey": app_key, "appsecretkey": app_secret}
```

### 2. 모의계좌 앱키 없을 때 토큰 갱신 스킵
**파일**: `agent/kiwoom-agent.py` `refresh_kiwoom_token()`  
**규칙**: `app_key`나 `app_secret`이 비어있으면 키움 API 호출 자체를 하지 않아야 함.  
빈 앱키로 호출하면 키움 서버가 빈 응답 반환 → JSONDecodeError.  
서버에 모의계좌 앱키(`KIWOOM_APP_KEY_MOCK`)가 없는 경우 흔히 발생.

```python
# ✅ 함수 진입 직후 필수 체크
if not app_key or not app_secret:
    logger.warning(f"[토큰갱신] {mode} 앱키 없음 — 스킵")
    return False
```

### 3. system.status 중복 요청 방지
**파일**: `server/routes/kiwoom-agent.routes.ts`  
**규칙**: `_sysStatusPending` 플래그로 동시 중복 요청 차단. 캐시 TTL: 성공/점검 시 10분, 타임아웃/오류 시 2분.  
**클라이언트** (`client/src/pages/dashboard.tsx`): system-status 쿼리에 `refetchInterval: false`, `refetchOnMount: false`, `refetchOnWindowFocus: false` 필수. 자동 refetch 절대 금지 — 탭 전환마다 에이전트에 작업이 쌓임.

### 4. balance.get 중복 요청 방지 (deduplication)
**파일**: `server/services/agent-proxy.service.ts`  
**규칙**: `callViaAgent()` 호출 시 `dedupeKey`를 전달하면 같은 키로 진행 중인 요청이 있을 때 새 job을 등록하지 않고 기존 Promise를 공유함.  
**파일**: `server/routes/account.routes.ts`  
`fetch-balance` 엔드포인트는 반드시 `dedupeKey = "balance.get:${accountId}"` 전달.  
대시보드 `useEffect`가 계좌 선택 시 자동으로 잔고 조회를 트리거하므로, dedupeKey 없으면 동시 요청이 여러 개 생성됨.

### 5. 오래된 에이전트 작업 스킵 (stale job)
**파일**: `agent/kiwoom-agent.py` `process_job()`  
**규칙**: 에이전트가 꺼져 있는 동안 DB에 쌓인 단순 조회 작업들은 에이전트 재시작 후 한꺼번에 처리하면 로그 폭발 + 의미 없는 키움 API 호출 발생.  
`_STALE_SKIP_JOB_TYPES` 목록에 있는 jobType은 생성 후 30초 이상 경과 시 즉시 error 처리하고 스킵.  
클라이언트는 이미 타임아웃을 받은 상태이므로 스킵해도 무방.

```python
_STALE_SKIP_JOB_TYPES = {
    "balance.get", "watchlist.get", "price.get", "stock.info",
    "system.status", "financials.get", "chart.get", "orderbook.get",
}
_STALE_THRESHOLD_SEC = 30
```

### 6. 에이전트 자동 재시작
**파일**: `agent/kiwoom-agent.py` `__main__` 블록  
**규칙**: `if __name__ == "__main__"` 아래에 while 루프가 있어야 함. `main()`이 예외로 종료되면 10초 후 자동 재시작. `SystemExit`(Ctrl+C)만 완전 종료.  
이 구조 없애면 에이전트가 한번 오류나면 영구 종료됨.

### 7. 에이전트 앱키 수신 로직
**파일**: `server/routes/kiwoom-agent.routes.ts` `/api/kiwoom-agent/appkeys` 엔드포인트  
**규칙**: 이 엔드포인트는 에이전트가 시작 시 서버 Secrets에서 앱키를 가져오는 핵심 경로. 환경변수 우선순위:  
`KIWOOM_APP_KEY_REAL` > `KIWOOM_KEY_59190647` > `KIWOOM_APP_KEY`  
수신 로직(에이전트 `fetch_appkeys_from_server()`) 절대 변경 금지.

### 8. 잔고 파싱 로직
**파일**: `server/routes/account.routes.ts`  
**규칙**: `# ⚠️ 잔고 파싱 로직 — 변경 금지` 주석이 있는 구간은 절대 수정 금지.  
`depositAmount` 필드는 `pchs_avg_pric` 대신 전용 필드(`dnca_tot_amt` 등)를 우선 사용.  
`average_price` DB 값 "0.00"은 키움 API가 빈 문자열을 주는 것이 원인 — 서버 파싱에서 `cleanStr()` 헬퍼로 폴백 처리됨.

### 9. 실계좌 보유종목 API 필드명 (2026-03-28 확정)
**파일**: `server/routes/account.routes.ts` (216~229번 줄 holdings 루프)  
**규칙**: 키움 실계좌 `acnt_evlt_remn_indv_tot` 배열의 실제 필드명은 아래와 같음. 폴백 순서 변경 금지.

| 항목 | 실계좌 필드명 | 모의계좌 필드명 (폴백 유지) |
|------|------------|--------------------------|
| 평균매수가 | `pur_pric` | `pchs_avg_pric`, `avg_pric` |
| 수익률(%) | `prft_rt` | `evlu_pfls_rt`, `pfls_rt` |
| 평가손익(원) | `evltv_prft` | `evlu_pfls_amt`, `evlu_pfls` |
| 현재가 | `cur_prc` | `prpr` |

실계좌 응답 예시: `"pur_pric": "000000000006336"`, `"prft_rt": "-26.71"`, `"evltv_prft": "-00000000863228"`  
모의계좌 필드명은 폴백으로 유지해야 모의계좌 호환이 깨지지 않음. 어느 쪽 필드명도 삭제 금지.

---

## External Dependencies
-   **키움증권 REST API**: 주식 시세, 주문, 계좌 정보 조회 등 핵심 거래 기능 연동.
-   **OpenAI GPT-4 API**: AI 기반 종목 분석 및 투자 자문 기능 제공.
-   **PostgreSQL (Neon)**: 모든 사용자 데이터, 거래 내역, 설정 등을 저장하는 주 데이터베이스.
-   **DART API**: 기업 공시 정보 및 재무 데이터 연동 (활성화 시).
-   **Passport.js**: 사용자 인증 (로컬, Google/Kakao OAuth).

---

## 집 PC 에이전트 관련

### 경로 및 접속 정보
- 에이전트 파일: `D:\Projects\trdebot\agent\kiwoom-agent.py`
- 서버 도메인: `1c838101-cb18-45bf-91c0-01f8a4836e2e-00-r6x4z40uc9yn.spock.replit.dev`
- 에이전트 최신 파일 수령 명령:
  ```
  curl -o D:\Projects\trdebot\agent\kiwoom-agent.py https://1c838101-cb18-45bf-91c0-01f8a4836e2e-00-r6x4z40uc9yn.spock.replit.dev/api/kiwoom-agent/script
  ```

### 에이전트 재시작 절차
1. 실행 중인 에이전트 Ctrl+C 종료
2. (필요 시) 최신 파일 수령
3. `python kiwoom-agent.py` 실행
4. 로그에 "키움 토큰 갱신 완료 (실계좌)" + "폴링 시작" 확인

### 에이전트가 죽었는지 확인하는 법
DB에서 최근 job의 `agent_id`가 계속 `null`이면 에이전트가 폴링을 안 하는 상태:
```sql
SELECT id, job_type, status, agent_id,
  EXTRACT(EPOCH FROM (NOW()-updated_at))::int as age_sec
FROM kiwoom_jobs ORDER BY id DESC LIMIT 10;
```
`agent_id = null`인 pending 작업만 쌓이면 에이전트 재시작 필요.

### 테스트 계정
- 이메일: `test@test.com` / 비밀번호: `123456`
