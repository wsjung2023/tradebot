# 키움 에이전트 설치 가이드

집 PC에서 키움 REST API를 호출하는 에이전트 설치 방법입니다.

---

## 구조

```
사용자 → Replit 앱 → 집 PC 에이전트 → 키움 REST API
```

- **Replit**: UI / 작업 접수
- **집 PC**: 키움 REST 전용 호출기 (이 에이전트)

---

## 사전 준비

### 1. 키움 오픈API 허용 IP 등록

1. [키움 오픈API 포털](https://openapi.kiwoom.com) 로그인
2. **마이페이지 → 앱 관리 → 허용 IP** 에 집 공인IP 등록
3. 집 공인IP 확인: [https://api.ipify.org](https://api.ipify.org)

> ⚠️ 인터넷 공유기 교체 시 공인IP가 바뀔 수 있으므로 재등록 필요

---

## 에이전트 설치 (신규 PC)

### PowerShell 한 줄로 설치

1. Windows 키 + X → **Windows PowerShell (관리자)** 실행
2. 아래 명령어 붙여넣기 후 엔터:

```powershell
irm https://raw.githubusercontent.com/wsjung2023/tradebot/main/agent/install-agent.ps1 | iex
```

설치가 완료되면:
- ✅ Python 자동 설치
- ✅ 에이전트 최신버전 자동 다운로드
- ✅ PC 시작 시 자동 실행 등록 (Task Scheduler)
- ✅ 에이전트 즉시 가동

---

## OpenClaw 설치 (Joy AI 어시스턴트)

Joy는 에이전트를 원격으로 관리하고 모니터링하는 AI 어시스턴트입니다.

### 1. OpenClaw 설치

```powershell
npm install -g openclaw
```

> Node.js가 없으면 먼저 설치: https://nodejs.org

### 2. OpenClaw 설정

```powershell
openclaw setup
```

설정 항목:
- Anthropic API 키 입력
- Telegram 봇 토큰 입력 (선택)

### 3. OpenClaw 시작

```powershell
openclaw gateway start
```

### 4. 에이전트 원격 제어 (Telegram)

OpenClaw가 실행되면 Telegram에서:
- `"에이전트 상태 확인해줘"` → 실행 여부 확인
- `"깃풀하고 재기동해"` → 최신버전으로 업데이트
- `"로그 확인해줘"` → 최근 로그 조회

---

## PC 교체 / 네트워크 변경 시

| 상황 | 해야 할 일 |
|------|-----------|
| PC 교체 | PowerShell 한 줄 재실행 |
| 공인IP 변경 | 키움 포털 허용 IP 재등록 |
| 에이전트 업데이트 | Joy에게 "깃풀하고 재기동해" |

---

## 파일 위치

```
C:\kiwoom-agent\
├── kiwoom-agent.py   ← 에이전트 본체 (서버에서 자동 다운로드)
├── .env              ← 설정 파일 (REPLIT_URLS, AGENT_KEY)
└── agent.log         ← 실행 로그
```

---

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| 토큰 발급 실패 8030 | 허용 IP 미등록 | 키움 포털에서 IP 등록 |
| 에이전트 연결 안됨 | Replit 서버 다운 | 잠시 후 재시도 |
| PC 시작 후 안 돌아감 | Task Scheduler 오류 | install-agent.ps1 재실행 |
