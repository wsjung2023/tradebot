# 키움 에이전트 (집 PC 실행용)

집 PC의 고정 공인 IP에서 키움 REST API를 호출하는 폴링 에이전트입니다.

## 아키텍처

```
사용자 브라우저 → Replit (작업 등록) → DB 저장
집 PC 에이전트 → Replit (작업 조회) → 키움 API 호출 → Replit (결과 저장)
사용자 브라우저 → Replit (결과 조회) → 화면 표시
```

## 설치 및 실행

```bash
pip install requests python-dotenv
```

`.env` 파일을 `agent/` 폴더 또는 프로젝트 루트에 생성:

```
REPLIT_URL=https://your-replit-app.replit.app
AGENT_KEY=랜덤_비밀키_여기에_입력
KIWOOM_APP_KEY=키움_앱키
KIWOOM_APP_SECRET=키움_앱시크릿
KIWOOM_IS_MOCK=false
POLL_INTERVAL=2
```

실행:

```bash
python agent/kiwoom-agent.py
```

## 지원 작업 타입

| jobType | 설명 |
|---------|------|
| `ping` | 연결 테스트 |
| `watchlist.get` | 관심종목 시세 조회 |
| `balance.get` | 계좌 잔고 조회 |
| `order.buy` | 매수 주문 |
| `order.sell` | 매도 주문 |

## 키움 IP 등록

집 PC 공인 IP를 [키움증권 포털](https://www1.kiwoom.com/)에 등록해야 합니다.
- 로그인 → OpenAPI → 사용신청/관리 → 지정단말기 IP 등록

## Replit 설정

Replit Secrets에 `AGENT_KEY` 추가 (집 PC `.env`와 동일한 값 입력)
