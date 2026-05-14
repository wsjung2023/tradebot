# TradeBot 설치 가이드

이 문서를 순서대로 따라하면 TradeBot을 새 PC에 설치할 수 있습니다.

---

## 사전 준비 (설치 전에 준비해야 할 것들)

아래 항목들을 미리 준비해 두세요.

| 항목 | 설명 |
|------|------|
| GitHub 계정 | 코드를 받아오기 위해 필요 |
| PostgreSQL 비밀번호 | 본인이 원하는 비밀번호 (예: `1qaz@WSX`) |
| OpenAI API 키 | chat.openai.com → API 키 발급 |
| Google OAuth 클라이언트 ID/시크릿 | Google Cloud Console에서 발급 |
| Naver API 키 | developers.naver.com에서 발급 |
| Kiwoom API 키 | 키움증권 Open API 신청 후 발급 |
| Cloudflare 계정 | cloudflare.com 무료 가입 |
| 도메인 | name.com 등에서 구매 (예: wsj-aitradebot.live) |

---

## 1단계: 기본 프로그램 설치

PowerShell을 **관리자 권한**으로 열고 아래 명령어를 실행하세요.
(시작 메뉴 → PowerShell 우클릭 → "관리자 권한으로 실행")

```powershell
# Git 설치
winget install Git.Git

# Node.js 설치 (v20 이상)
winget install OpenJS.NodeJS.LTS

# Python 설치 (3.11 이상)
winget install Python.Python.3.11

# PostgreSQL 설치
winget install PostgreSQL.PostgreSQL
```

설치 후 PowerShell을 **닫고 다시** 열어주세요.

---

## 2단계: 코드 받기

```powershell
cd D:\
mkdir Projects
cd Projects
git clone https://github.com/wsjung2023/tradebot.git
cd tradebot
```

---

## 3단계: 자동 설치 스크립트 실행

```powershell
.\install.ps1
```

스크립트가 실행되면서 아래 항목들을 순서대로 물어봅니다:
- PostgreSQL 비밀번호
- 각종 API 키

모두 입력하면 자동으로:
- npm 패키지 설치
- 데이터베이스 생성 및 테이블 생성
- 시작 프로그램 등록

까지 완료됩니다.

---

## 4단계: Cloudflare Tunnel 설정

### 4-1. cloudflared 설치
```powershell
winget install Cloudflare.cloudflared
mkdir C:\cloudflared
copy "C:\Program Files\cloudflared\cloudflared.exe" C:\cloudflared\
```

### 4-2. Cloudflare 로그인
```
C:\cloudflared\cloudflared.exe tunnel login
```
브라우저가 열리면 Cloudflare 계정으로 로그인하세요.

### 4-3. 터널 생성
```
C:\cloudflared\cloudflared.exe tunnel create tradebot
```
명령어 실행 후 출력되는 **터널 ID** (예: `a74e28d3-b40a-...`)를 메모해 두세요.

### 4-4. config.yml 작성
`C:\cloudflared\config.yml` 파일을 메모장으로 만들고 아래 내용 입력:

```yaml
tunnel: 여기에-터널-ID-입력
credentials-file: C:\Users\본인계정명\.cloudflared\여기에-터널-ID-입력.json

ingress:
  - hostname: 여기에-도메인-입력
    service: http://localhost:5000
  - service: http_status:404
```

예시:
```yaml
tunnel: a74e28d3-b40a-4931-ad00-3b3d31d23970
credentials-file: C:\Users\wjddn\.cloudflared\a74e28d3-b40a-4931-ad00-3b3d31d23970.json

ingress:
  - hostname: wsj-aitradebot.live
    service: http://localhost:5000
  - service: http_status:404
```

---

## 5단계: 도메인 → Cloudflare 연결

### 5-1. Cloudflare에 도메인 추가
1. cloudflare.com 로그인
2. "Add a domain" 클릭
3. 구매한 도메인 입력
4. Free 플랜 선택
5. Cloudflare가 알려주는 **네임서버 2개**를 메모

### 5-2. 도메인 등록사이트에서 네임서버 변경
name.com 기준:
1. My Domains → 도메인 클릭
2. Manage Nameservers
3. 기존 네임서버 모두 삭제
4. Cloudflare 네임서버 2개 추가 (예: `ken.ns.cloudflare.com`, `virginia.ns.cloudflare.com`)
5. 저장

### 5-3. Cloudflare 활성화 확인
1-2시간 후 Cloudflare에서 활성화 이메일이 옵니다.
이메일 수신 후 Cloudflare DNS 탭에서 Tunnel 레코드가 자동 생성된 것을 확인하세요.

---

## 6단계: Google OAuth redirect URI 업데이트

1. console.cloud.google.com 접속
2. APIs & Services → Credentials
3. OAuth 2.0 클라이언트 클릭
4. Authorized redirect URIs에 추가:
   ```
   https://도메인주소/api/auth/google/callback
   ```
5. 저장

---

## 7단계: 동작 확인

브라우저에서 `https://도메인주소` 접속 후 로그인이 되면 완료입니다.

---

## 문제 해결

| 증상 | 해결 방법 |
|------|-----------|
| 사이트 접속 안 됨 | cloudflared가 실행 중인지 확인 (`tasklist \| findstr cloudflared`) |
| DB 연결 오류 | PostgreSQL 서비스 실행 중인지 확인 (서비스 앱에서 확인) |
| Google 로그인 오류 `redirect_uri_mismatch` | 6단계 redirect URI 확인 |
| 에이전트 실행 안 됨 | `D:\Projects\tradebot\agent\.env` 파일 확인 |

---

## 자동 시작 프로그램 위치

PC 로그인 시 자동 실행되는 파일들:
```
C:\Users\본인계정명\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\
  - start-server.bat       (웹 서버)
  - start-agent.bat        (키움 에이전트)
  - start-cloudflared.bat  (Cloudflare 터널)
```

수동으로 재시작하려면 `D:\Projects\tradebot\restart-all.bat` 실행.
