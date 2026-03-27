# 집 PC 에이전트 설치 가이드

> 이 문서는 에이전트를 처음 설치하거나, 업데이트하거나, 재시작할 때 따라하는 안내서입니다.
>
> 컴퓨터를 잘 모르셔도 순서대로 따라하시면 됩니다.

---

> ### ⚠️ 설치 폴더 경로 주의
>
> 이 가이드의 예시는 `C:\kiwoom-agent` 폴더를 기준으로 작성되었습니다.
> **이미 다른 폴더에 설치하셨다면, 아래 모든 명령어의 경로를 본인 폴더로 바꿔서 사용하세요.**
>
> 예시:
> - 예시 경로: `C:\kiwoom-agent`
> - 내 경로 예: `D:\Projects\trdebot\agent`
>
> 에이전트 파일 업데이트 예시 (내 경로로 변경):
> ```
> curl -o "D:\Projects\trdebot\agent\kiwoom-agent.py" https://kiwoom-stock-ai-mainstop3.replit.app/api/kiwoom-agent/script
> ```

---

## 목차

1. [에이전트가 뭔가요?](#에이전트가-뭔가요)
2. [설치 전 준비사항](#설치-전-준비사항)
3. [방법 1. 자동 설치 (권장)](#방법-1-자동-설치-권장)
4. [방법 2. 수동 설치](#방법-2-수동-설치)
5. [에이전트 재시작 방법](#에이전트-재시작-방법)
6. [에이전트 업데이트 방법](#에이전트-업데이트-방법)
7. [설치 확인](#설치-확인)
8. [문제 발생 시](#문제-발생-시)
9. [파일 구조 요약](#파일-구조-요약)

---

## 에이전트가 뭔가요?

키움증권은 고정된 IP 주소에서만 API 호출을 허용합니다.
이 서비스는 클라우드(Replit)에서 동작하는데, 클라우드는 IP가 매번 바뀌어서 키움 API를 직접 호출할 수 없습니다.

그래서 **집 PC**에 에이전트를 설치해두면:
- 에이전트가 2~4초마다 Replit 서버에 "할 일 있어?" 하고 폴링합니다
- "잔고 조회해줘", "조건검색 실행해줘" 같은 작업이 있으면 집 PC에서 키움에 직접 연결하고 결과를 서버로 보냅니다

**집 PC가 꺼져 있으면 키움 관련 기능은 동작하지 않습니다.**

> **조건검색(HTS 조건식 실행)의 경우**: 키움 WebSocket에 연결해서 매칭 종목을 실시간으로 수집합니다.
> 결과가 나오기까지 약 **5~10초** 소요됩니다 (정상입니다).

---

## 설치 전 준비사항

### 키움증권 앱키 확인

아래 정보를 미리 준비해 두세요.

1. **키움증권 Open API 포털** 접속: https://openapi.kiwoom.com
2. 로그인 후 **"앱 관리"** 메뉴 이동
3. 사용할 앱의 **앱키(APP KEY)** 와 **앱시크릿(APP SECRET)** 확인
   - 실계좌용 앱과 모의투자용 앱키가 각각 다를 수 있습니다

### AGENT_KEY 확인

- 관리자(개발자)에게 **AGENT_KEY** 값을 받아두세요
- 이 키가 없으면 에이전트가 서버와 연결되지 않습니다

---

## 방법 1. 자동 설치 (권장)

### Step 1. PowerShell 관리자 권한으로 실행

Windows 버튼을 누르고 **"PowerShell"** 을 검색합니다.
**"Windows PowerShell"** 을 마우스 오른쪽 클릭 → **"관리자 권한으로 실행"** 클릭

### Step 2. 설치 스크립트 실행

아래 명령어를 PowerShell 창에 붙여넣고 Enter를 누릅니다:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://kiwoom-stock-ai-mainstop3.replit.app/api/kiwoom-agent/install-script'))
```

> 위 명령어가 동작하지 않으면 아래 **방법 2(수동 설치)** 를 따라해 주세요.

### Step 3. 앱키 입력

설치 스크립트가 실행되면 앱키를 입력하라고 묻습니다.
준비해둔 앱키, 앱시크릿, AGENT_KEY를 차례로 입력합니다.

### Step 4. 완료

설치가 끝나면 PC를 켤 때마다 자동으로 에이전트가 실행됩니다.

---

## 방법 2. 수동 설치

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

### Step 3. 필요한 라이브러리(패키지) 설치

에이전트는 아래 3가지 Python 패키지가 필요합니다.

| 패키지 이름 | 용도 |
|---|---|
| `requests` | Replit 서버와 HTTP 통신 (작업 폴링, 결과 전송) |
| `python-dotenv` | `.env` 설정 파일 읽기 |
| `websocket-client` | 키움 WebSocket 연결 (조건검색, 실시간 시세) |

명령 프롬프트에서 아래 명령어를 입력하고 Enter:

```
pip install requests python-dotenv websocket-client
```

설치가 완료될 때까지 기다립니다 (1~3분 소요).

완료되면 아래와 같이 나옵니다:
```
Successfully installed requests-2.x.x python-dotenv-1.x.x websocket-client-1.x.x
```

#### pip가 없다고 나올 때

```
python -m pip install requests python-dotenv websocket-client
```

#### 패키지가 이미 설치된 경우 최신 버전으로 업그레이드

```
pip install --upgrade requests python-dotenv websocket-client
```

---

### Step 4. 에이전트 파일 복사

`kiwoom-agent.py` 파일을 `C:\kiwoom-agent\` 폴더에 복사합니다.

**파일을 가져오는 방법 (택 1):**

- **방법 A**: Replit 서비스에서 직접 다운로드
  ```
  curl -o C:\kiwoom-agent\kiwoom-agent.py https://kiwoom-stock-ai-mainstop3.replit.app/api/kiwoom-agent/script
  ```

- **방법 B**: 개발자(관리자)에게 `kiwoom-agent.py` 파일을 직접 받아서 `C:\kiwoom-agent\` 에 넣기

- **방법 C**: 기존 PC에서 `C:\kiwoom-agent\kiwoom-agent.py` 를 USB로 복사해서 가져오기

---

### Step 5. .env 파일 만들기

> `.env` 파일은 에이전트에게 비밀 설정값을 알려주는 설정 파일입니다.
> 메모장으로 만들 수 있습니다.

1. **메모장** 실행 (Windows 버튼 → "메모장" 검색)
2. 아래 내용을 메모장에 붙여넣기:

```
# 서버 주소 (배포 서버)
REPLIT_URL=https://kiwoom-stock-ai-mainstop3.replit.app

# 서버 주소 (개발 서버도 함께 폴링하려면 REPLIT_URLS 사용, 쉼표로 구분)
# REPLIT_URLS=https://kiwoom-stock-ai-mainstop3.replit.app,https://xxxx.spock.replit.dev

# 에이전트 인증 키 (관리자에게 받기)
AGENT_KEY=여기에_AGENT_KEY_값_입력

# 실계좌 앱키 (키움 포털에서 확인)
KIWOOM_APP_KEY_REAL=실계좌_앱키
KIWOOM_APP_SECRET_REAL=실계좌_앱시크릿

# 모의계좌 앱키 (없으면 실계좌와 동일하게 입력)
KIWOOM_APP_KEY_MOCK=모의계좌_앱키
KIWOOM_APP_SECRET_MOCK=모의계좌_앱시크릿

# 모의계좌 사용 여부: 실계좌=false, 모의계좌=true
KIWOOM_IS_MOCK=false

# 폴링 간격 (초, 기본 2)
POLL_INTERVAL=2
```

3. 각 항목을 실제 값으로 채웁니다:
   - `AGENT_KEY`: 관리자(개발자)에게 받은 비밀 키
   - `KIWOOM_APP_KEY_REAL`: 키움 포털에서 확인한 실계좌 앱키
   - `KIWOOM_APP_SECRET_REAL`: 키움 포털에서 확인한 실계좌 앱시크릿
   - `KIWOOM_APP_KEY_MOCK`: 모의계좌 앱키 (없으면 실계좌 값과 동일하게)
   - `KIWOOM_APP_SECRET_MOCK`: 모의계좌 앱시크릿 (없으면 실계좌 값과 동일하게)

4. **파일 저장**:
   - 메모장에서 **파일** → **다른 이름으로 저장**
   - 저장 위치: `C:\kiwoom-agent`
   - 파일 이름: `.env` (점이 앞에 있습니다)
   - 파일 형식: **모든 파일 (\*.\*)** 선택 (중요! 이걸 선택 안 하면 `.env.txt` 로 저장됩니다)
   - **저장** 클릭

> 저장 후 `C:\kiwoom-agent\.env` 파일이 생성되었으면 성공입니다.

---

### Step 6. 키움증권 IP 등록

새 PC의 IP 주소를 키움증권에 등록해야 합니다.

#### 내 IP 확인 방법

명령 프롬프트에서 입력:
```
curl ifconfig.me
```
나타나는 숫자가 내 외부 IP 주소입니다 (예: `121.xxx.xxx.xxx`)

#### 키움 포털에서 IP 등록

1. https://openapi.kiwoom.com 접속 → 로그인
2. **"앱 관리"** → 사용 중인 앱 클릭
3. **"허용 IP 관리"** 또는 **"IP 등록"** 메뉴
4. 확인한 IP 주소 입력 후 저장
5. 적용까지 수 분이 걸릴 수 있습니다

---

### Step 7. 에이전트 실행

명령 프롬프트에서 아래를 입력하고 Enter:

```
cd C:\kiwoom-agent
python kiwoom-agent.py
```

아래와 같은 로그가 나오면 정상입니다:

```
2026-03-27 10:00:00 [INFO] 키움 에이전트 시작
2026-03-27 10:00:00 [INFO] 지원 jobType: watchlist.get, price.get, balance.get, condition.list, condition.run, ...
2026-03-27 10:00:02 [INFO] 폴링 중... (작업 없음)
2026-03-27 10:00:04 [INFO] 폴링 중... (작업 없음)
```

---

### Step 8. PC 시작 시 자동 실행 설정 (선택)

매번 수동으로 실행하기 번거로우면 Windows 시작 프로그램에 등록합니다.

#### 8-1. start.bat 파일 만들기

메모장으로 아래 내용을 작성합니다:

```bat
@echo off
title 키움 에이전트
cd /d C:\kiwoom-agent
python kiwoom-agent.py
pause
```

파일 저장 시:
- 저장 위치: `C:\kiwoom-agent`
- 파일 이름: `start.bat`
- 파일 형식: **모든 파일 (\*.\*)**

#### 8-2. 시작 프로그램에 등록

1. 키보드에서 **Win+R** 누르기 → `shell:startup` 입력 → Enter
2. 열린 폴더에 `start.bat` 의 **바로 가기** 를 만들어 넣기:
   - `C:\kiwoom-agent\start.bat` 오른쪽 클릭 → **"바로 가기 만들기"**
   - 만들어진 바로 가기를 `shell:startup` 폴더 안으로 이동

이제 PC를 켤 때마다 자동으로 에이전트 창이 열립니다.

---

## 에이전트 재시작 방법

에이전트 코드가 업데이트된 경우, 오류가 발생한 경우, 또는 설정을 바꾼 경우 재시작이 필요합니다.

### 1단계: 실행 중인 에이전트 종료

에이전트가 실행 중인 명령 프롬프트 창에서:

```
Ctrl + C
```

아래 메시지가 나오면 종료된 것입니다:
```
KeyboardInterrupt
에이전트 종료
```

> **창을 그냥 닫아도 됩니다.** 강제 종료해도 다음 실행에 문제 없습니다.

### 2단계: 에이전트 다시 실행

```
cd C:\kiwoom-agent
python kiwoom-agent.py
```

또는 `start.bat` 파일을 더블클릭합니다.

### 백그라운드에서 실행하기 (창 없이)

명령 프롬프트 창을 닫고 싶을 때:

```
cd C:\kiwoom-agent
start /b pythonw kiwoom-agent.py
```

> `pythonw`를 사용하면 콘솔 창 없이 백그라운드에서 실행됩니다.
> 종료하려면 **작업 관리자(Ctrl+Shift+Esc)** → **프로세스 탭** → `pythonw.exe` 선택 → **작업 끝내기**

---

## 에이전트 업데이트 방법

에이전트 코드가 변경되면 파일을 새로 받아서 재시작해야 합니다.

### 방법 A: 명령 프롬프트로 자동 다운로드 (권장)

```
cd C:\kiwoom-agent
curl -o kiwoom-agent.py https://kiwoom-stock-ai-mainstop3.replit.app/api/kiwoom-agent/script
```

다운로드 후 에이전트를 재시작합니다.

### 방법 B: 관리자에게 파일 직접 받기

개발자(관리자)에게 최신 `kiwoom-agent.py` 파일을 받아서 `C:\kiwoom-agent\` 안의 기존 파일에 덮어씁니다.

덮어쓴 후 아래 순서로 진행합니다:

```
# 1. 기존 에이전트 종료 (실행 중인 창에서)
Ctrl + C

# 2. 새 파일로 재시작
cd C:\kiwoom-agent
python kiwoom-agent.py
```

### 업데이트 후 패키지 재설치 (필요한 경우)

새 버전에서 새 패키지가 추가된 경우:

```
pip install --upgrade requests python-dotenv websocket-client
```

현재 필요한 패키지는 3가지입니다:
- `requests` — HTTP 통신
- `python-dotenv` — .env 파일 읽기
- `websocket-client` — 키움 WebSocket (조건검색 등)

---

## 설치 확인

에이전트가 정상 동작하는지 확인하는 방법:

### 로그 확인

에이전트 창에서 아래와 같은 로그가 반복되면 정상입니다:

```
[INFO] 폴링 중... (작업 없음)
[INFO] 폴링 중... (작업 없음)
```

조건검색을 실행하면:

```
[INFO] 작업 수신: condition.run (seq=30)
[INFO] [condition.run] CNSRREQ 응답 수신, 현재 수집: 0개, msg keys=[...]
[INFO] [condition.run] REAL 수집 완료: 4개 종목
[INFO] condition.run 완료 (seq=30): 4개 종목
```

### 웹 화면에서 확인

브라우저에서 서비스 접속 후:
- 대시보드에서 **"에이전트 연결됨"** 표시 확인
- **"HTS 조건식 불러오기"** 버튼 클릭 후 조건식 목록이 나오면 성공
- 조건식 옆 ▶ 버튼 클릭 후 종목 목록이 나오면 조건검색도 정상

---

## 문제 발생 시

### "토큰 발급 실패" 오류

```
[ERROR] 키움 토큰 발급 실패
```

- 앱키/앱시크릿이 잘못 입력되었습니다
- `.env` 파일의 `KIWOOM_APP_KEY_REAL`, `KIWOOM_APP_SECRET_REAL` 값을 다시 확인하세요
- 키움 포털에서 앱키가 활성화 상태인지 확인하세요

---

### "Connection refused" 또는 IP 오류

```
[ERROR] 키움 API 오류: 허용되지 않은 IP
```

- 키움증권 포털에서 이 PC의 IP가 등록되어 있는지 확인하세요
- IP가 바뀌었을 수 있습니다 (`curl ifconfig.me` 로 재확인 후 포털에서 IP 재등록)

---

### 에이전트는 실행되는데 화면에 데이터가 안 나옴

```
[INFO] 폴링 중... (작업 없음)
```

이 메시지가 계속 나오는데 화면에 반응이 없다면:

- `AGENT_KEY` 값이 서버와 일치하는지 확인하세요
- `REPLIT_URL` 주소가 정확한지 확인하세요
- 관리자에게 현재 AGENT_KEY 값을 다시 확인하세요

---

### 로그가 전혀 안 나오거나 즉시 꺼짐

- `.env` 파일이 `C:\kiwoom-agent\.env` 에 있는지 확인 (`.env.txt` 가 아닌지!)
- `REPLIT_URL` 주소가 정확한지 확인하세요
- 인터넷 연결 확인

파일 확장자를 보려면 파일 탐색기 → **"보기"** → **"파일 확장명"** 체크

---

### 조건검색 결과가 안 나옴 (0개)

```
[INFO] condition.run 완료 (seq=30): 0개 종목
```

가능한 원인:
1. **해당 조건식에 현재 매칭되는 종목이 없음** (정상) — 조건이 엄격하면 종목이 0개일 수 있습니다
2. **장마감 이후** — 일부 조건은 장중(09:00~15:30)에만 결과가 나옵니다
3. **에이전트 버전이 낮음** — 최신 `kiwoom-agent.py`로 업데이트 후 재시작하세요

---

### WebSocket 오류 (code 100013, 8005)

```
[WARN] 키움 WS 오류: code=100013, 재시도 1/3...
```

- 키움 WebSocket 서버의 일시적인 문제입니다
- 에이전트가 자동으로 최대 3회 재시도합니다 (4초 간격)
- 계속 실패하면 1~2분 후 다시 시도하세요

---

### pip 설치 오류

```
ERROR: Could not install packages due to an OSError
```

관리자 권한으로 명령 프롬프트를 실행 후 다시 시도:
1. Windows 버튼 → "cmd" 검색
2. 마우스 오른쪽 클릭 → **"관리자 권한으로 실행"**
3. `pip install requests python-dotenv websocket-client` 재실행

---

## 파일 구조 요약

설치가 완료되면 `C:\kiwoom-agent\` 폴더 안에 이것들이 있어야 합니다:

```
C:\kiwoom-agent\
├── kiwoom-agent.py   ← 에이전트 실행 파일 (업데이트 시 이 파일만 교체)
├── .env              ← 비밀 설정값 (앱키, 서버 주소 등) — 한 번만 작성
└── start.bat         ← 더블클릭으로 실행하는 배치 파일 (선택)
```

---

## 빠른 참고 명령어 모음

```bash
# Python 버전 확인
python --version

# 패키지 설치
pip install requests python-dotenv websocket-client

# 패키지 최신 버전으로 업그레이드
pip install --upgrade requests python-dotenv websocket-client

# 에이전트 실행
cd C:\kiwoom-agent
python kiwoom-agent.py

# 에이전트 파일 업데이트 (최신 버전 받기)
curl -o C:\kiwoom-agent\kiwoom-agent.py https://kiwoom-stock-ai-mainstop3.replit.app/api/kiwoom-agent/script

# 내 외부 IP 확인 (키움 IP 등록용)
curl ifconfig.me
```
