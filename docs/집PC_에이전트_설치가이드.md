# 집 PC 에이전트 설치 가이드

> 이 문서는 새 PC를 구입했거나 에이전트를 처음 설치할 때 따라하는 안내서입니다.
> 
> 컴퓨터를 잘 모르셔도 순서대로 따라하시면 됩니다.

---

## 에이전트가 뭔가요?

키움증권은 고정된 IP 주소에서만 API 호출을 허용합니다.  
이 서비스는 클라우드(Replit)에서 동작하는데, 클라우드는 IP가 매번 바뀌어서 키움 API를 직접 호출할 수 없습니다.

그래서 **집 PC**에 에이전트를 설치해두면:
- 에이전트가 2~4초마다 Replit 서버에 "할 일 있어?" 하고 물어봅니다
- "잔고 조회해줘" 같은 작업이 있으면 집 PC에서 키움에 직접 물어보고 결과를 보냅니다

**집 PC가 꺼져 있으면 키움 관련 기능은 동작하지 않습니다.**

---

## 설치 전 준비사항

### 키움증권 앱키 확인

아래 정보를 미리 준비해 두세요.

1. **키움증권 Open API 포털** 접속: https://openapi.kiwoom.com
2. 로그인 후 **"앱 관리"** 메뉴 이동
3. 사용할 앱의 **앱키(APP KEY)** 와 **앱시크릿(APP SECRET)** 확인
   - 실계좌용, 모의투자용 앱키가 각각 다를 수 있습니다

---

## 방법 1. 자동 설치 (권장 — 한 번에 끝)

### Step 1. PowerShell 실행

Windows 버튼을 누르고 **"PowerShell"** 을 검색합니다.  
**"Windows PowerShell"** 을 마우스 오른쪽 클릭 → **"관리자 권한으로 실행"** 클릭

### Step 2. 설치 스크립트 실행

아래 명령어를 PowerShell 창에 붙여넣고 Enter를 누릅니다:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://kiwoom-stock-ai-mainstop3.replit.app/api/kiwoom-agent/install-script'))
```

> 만약 위 명령어가 동작하지 않으면 아래 방법 2(수동 설치)를 따라해 주세요.

### Step 3. 앱키 입력

설치 스크립트가 실행되면 앱키를 입력하라고 묻습니다.  
준비해둔 앱키와 앱시크릿을 입력합니다.

### Step 4. 완료

설치가 끝나면 PC를 켤 때마다 자동으로 에이전트가 실행됩니다.

---

## 방법 2. 수동 설치 (자동 설치가 안 될 때)

### Step 1. 설치 폴더 만들기

1. **내 PC** (파일 탐색기) 열기
2. **C 드라이브** 클릭
3. 빈 곳에서 마우스 오른쪽 클릭 → **"새 폴더"** → 이름을 `kiwoom-agent` 로 입력

결과: `C:\kiwoom-agent` 폴더가 만들어집니다.

---

### Step 2. Python 설치 확인

1. Windows 버튼 → **"cmd"** 검색 → **"명령 프롬프트"** 실행
2. 아래를 입력하고 Enter:

```
python --version
```

- `Python 3.x.x` 가 나오면 이미 설치되어 있습니다 → Step 3으로 이동
- `'python'은(는) 내부 또는 외부 명령이 아닙니다` 가 나오면 아래에서 Python 설치

#### Python 설치 방법

1. https://www.python.org/downloads/ 접속
2. **"Download Python 3.x.x"** 노란 버튼 클릭
3. 다운로드된 파일 실행
4. **중요**: 설치 화면 맨 아래 **"Add Python to PATH"** 체크박스에 반드시 체크하고 설치
5. 설치 완료 후 명령 프롬프트를 닫았다가 다시 열고 `python --version` 재확인

---

### Step 3. 필요한 라이브러리 설치

명령 프롬프트에서 아래 명령어 입력 후 Enter:

```
pip install requests python-dotenv websocket-client
```

설치가 완료될 때까지 기다립니다 (1~2분 소요).

---

### Step 4. 에이전트 파일 복사

`agent/kiwoom-agent.py` 파일을 `C:\kiwoom-agent\` 폴더에 복사합니다.

- 이 파일은 **이 서비스의 GitHub 또는 Replit에서 받으면 됩니다**
- 또는 기존 PC에서 `C:\kiwoom-agent\kiwoom-agent.py` 를 복사해서 가져옵니다

---

### Step 5. .env 파일 만들기

> `.env` 파일은 에이전트에게 비밀 설정값을 알려주는 설정 파일입니다.  
> 메모장으로 만들 수 있습니다.

1. **메모장** 실행 (Windows 버튼 → "메모장" 검색)
2. 아래 내용을 메모장에 붙여넣기:

```
REPLIT_URL=https://kiwoom-stock-ai-mainstop3.replit.app
AGENT_KEY=여기에_AGENT_KEY_값_입력

KIWOOM_APP_KEY_REAL=실계좌_앱키
KIWOOM_APP_SECRET_REAL=실계좌_앱시크릿
KIWOOM_APP_KEY_MOCK=모의계좌_앱키
KIWOOM_APP_SECRET_MOCK=모의계좌_앱시크릿

KIWOOM_IS_MOCK=false
POLL_INTERVAL=2
```

3. 각 항목을 실제 값으로 채웁니다:
   - `AGENT_KEY`: 관리자(개발자)에게 받은 비밀 키
   - `KIWOOM_APP_KEY_REAL`: 키움 포털에서 확인한 실계좌 앱키
   - `KIWOOM_APP_SECRET_REAL`: 키움 포털에서 확인한 실계좌 앱시크릿
   - `KIWOOM_APP_KEY_MOCK`: 모의계좌 앱키 (없으면 실계좌와 동일하게)
   - `KIWOOM_APP_SECRET_MOCK`: 모의계좌 앱시크릿 (없으면 실계좌와 동일하게)

4. **파일 저장**:
   - 메모장에서 **파일** → **다른 이름으로 저장**
   - 저장 위치: `C:\kiwoom-agent`
   - 파일 이름: `.env` (점이 앞에 있습니다)
   - 파일 형식: **모든 파일 (\*.\*)** 선택 (중요!)
   - **저장** 클릭

> 저장 후 `C:\kiwoom-agent\.env` 파일이 생성되었으면 성공입니다.

---

### Step 6. 키움증권 IP 등록

새 PC의 IP 주소를 키움증권에 등록해야 합니다.

#### 내 IP 확인 방법

1. 명령 프롬프트에서 입력:
```
curl ifconfig.me
```
2. 나타나는 숫자가 내 외부 IP 주소입니다 (예: `121.xxx.xxx.xxx`)

#### 키움 포털에서 IP 등록

1. https://openapi.kiwoom.com 접속 → 로그인
2. **"앱 관리"** → 사용 중인 앱 클릭
3. **"허용 IP 관리"** 또는 **"IP 등록"** 메뉴
4. 확인한 IP 주소 입력 후 저장
5. 적용까지 수 분이 걸릴 수 있습니다

---

### Step 7. 에이전트 실행

명령 프롬프트에서:

```
cd C:\kiwoom-agent
python kiwoom-agent.py
```

아래와 같은 로그가 나오면 정상입니다:

```
2026-03-27 10:00:00 [INFO] 키움 에이전트 시작
2026-03-27 10:00:00 [INFO] 지원 jobType: watchlist.get, price.get, balance.get, ...
2026-03-27 10:00:02 [INFO] 폴링 중... (작업 없음)
```

---

### Step 8. PC 시작 시 자동 실행 설정 (선택)

매번 수동으로 실행하기 번거로우면 Windows 시작 프로그램에 등록합니다.

1. `C:\kiwoom-agent\` 폴더에 `start.bat` 파일을 만듭니다 (메모장으로 작성)

```bat
@echo off
cd /d C:\kiwoom-agent
python kiwoom-agent.py
pause
```

2. 저장 후 파일 형식 **모든 파일**, 파일명 `start.bat`
3. Windows 버튼 → **"실행"** (또는 Win+R) → `shell:startup` 입력 → Enter
4. 열린 폴더에 `start.bat` 의 **바로 가기** 를 만들어 넣기
   - `start.bat` 오른쪽 클릭 → **"보내기"** → **"바탕 화면에 바로 가기 만들기"**
   - 만들어진 바로 가기를 `shell:startup` 폴더로 이동

---

## 설치 후 확인

브라우저에서 서비스 접속 후:

- 대시보드에서 **"에이전트 연결됨"** 표시 확인
- **"잔고 조회"** 버튼 클릭 후 잔고가 정상 표시되면 성공

---

## 문제 발생 시

### "토큰 발급 실패" 오류

- 앱키/앱시크릿이 잘못 입력되었습니다
- `.env` 파일의 값을 다시 확인하세요

### "Connection refused" 또는 API 오류

- 키움증권 포털에서 이 PC의 IP가 등록되어 있는지 확인하세요
- IP가 바뀌었을 수 있습니다 (`curl ifconfig.me` 로 재확인)

### 에이전트는 실행되는데 화면에 데이터가 안 나옴

- `AGENT_KEY` 값이 서버와 일치하는지 확인하세요
- 관리자에게 현재 AGENT_KEY 값을 다시 확인하세요

### 로그가 전혀 안 나옴 / 즉시 꺼짐

- `REPLIT_URL` 주소가 정확한지 확인하세요
- 인터넷 연결을 확인하세요

---

## 파일 구조 요약

설치가 완료되면 `C:\kiwoom-agent\` 폴더 안에 이것들이 있어야 합니다:

```
C:\kiwoom-agent\
├── kiwoom-agent.py   ← 에이전트 실행 파일
├── .env              ← 비밀 설정값 (앱키, 서버 주소 등)
└── start.bat         ← 실행 버튼 (선택)
```
