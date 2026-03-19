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
-   **앱키 관리**: 실계좌(`KIWOOM_APP_KEY_REAL`)와 모의계좌(`KIWOOM_APP_KEY_MOCK`) 앱키는 완전히 분리되어 사용되며, 에이전트는 서버로부터 필요한 앱키를 동적으로 받아올 수 있습니다.
-   **잔고 파싱 로직**: 키움 API의 다양한 응답 필드명을 처리하기 위해 일관된 파싱 우선순위를 적용하여 정확한 잔고 및 보유종목 정보를 표시합니다.
-   **총 자산 계산**: 주식평가금액과 예수금을 합산하여 총 자산을 계산합니다.

### File Structure
-   `server/`: Express API, 서비스 로직, 키움 API 래퍼, 스토리지 계층.
-   `agent/`: 집 PC에서 실행되는 Python 에이전트.
-   `client/src/`: React 기반 프론트엔드 코드.

## External Dependencies
-   **키움증권 REST API**: 주식 시세, 주문, 계좌 정보 조회 등 핵심 거래 기능 연동.
-   **OpenAI GPT-4 API**: AI 기반 종목 분석 및 투자 자문 기능 제공.
-   **PostgreSQL (Neon)**: 모든 사용자 데이터, 거래 내역, 설정 등을 저장하는 주 데이터베이스.
-   **DART API**: 기업 공시 정보 및 재무 데이터 연동 (활성화 시).
-   **Passport.js**: 사용자 인증 (로컬, Google/Kakao OAuth).