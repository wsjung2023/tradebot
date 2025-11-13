# 키움 AI 자동매매 플랫폼

## 프로젝트 개요
키움증권 REST API와 OpenAI GPT-4를 활용한 프로페셔널 AI 기반 자동매매 플랫폼

## 프로젝트 목표
- 키움증권 REST API를 활용한 실시간 매매
- OpenAI GPT-4 AI 투자 분석 및 자동매매 추천
- Google/Kakao OAuth + 이메일/비밀번호 인증
- 실시간 WebSocket 시세
- PWA 지원 및 모바일 최적화
- 상업용 품질의 완성도

## 기술 스택

### 백엔드
- Node.js + Express + TypeScript
- PostgreSQL (Neon) - Session Store 및 데이터 저장
- Passport.js - 다중 인증 (Local, Google OAuth, Kakao OAuth)
- Drizzle ORM
- WebSocket - 실시간 시세

### 프론트엔드
- React + TypeScript
- Vite
- Wouter - 라우팅
- TanStack Query - 서버 상태 관리
- Shadcn UI - UI 컴포넌트
- Tailwind CSS

### 외부 API
- 키움증권 REST API - 주식 거래
- OpenAI API (GPT-4) - AI 분석
- Google OAuth
- Kakao OAuth

## 아키텍처

### 데이터베이스 스키마
1. `users` - 사용자 정보 및 OAuth 프로필
2. `kiwoom_accounts` - 키움증권 계좌 정보
3. `holdings` - 포트폴리오 보유 종목
4. `orders` - 주문 내역
5. `ai_models` - AI 투자 모델
6. `ai_recommendations` - AI 추천
7. `watchlist` - 관심종목
8. `alerts` - 가격 알림
9. `user_settings` - 사용자 설정
10. `trading_logs` - 거래 로그

### API 엔드포인트
- `/api/auth/*` - 인증 (회원가입, 로그인, 로그아웃, OAuth)
- `/api/accounts/*` - 키움 계좌 관리
- `/api/orders/*` - 주문 관리 (POST /api/orders)
- `/api/all-orders` - 전체 주문 내역 조회 (GET)
- `/api/trading-logs` - 거래 로그 조회 (GET)
- `/api/stocks/*` - 주식 정보 조회
- `/api/ai/*` - AI 분석 및 모델 관리 (GPT-4 분석, 포트폴리오 최적화, 모델 CRUD)
- `/api/watchlist/*` - 관심종목
- `/api/alerts/*` - 알림 설정
- `/api/settings/*` - 사용자 설정

## 현재 구현 상태

### ✅ 완료
1. 데이터베이스 스키마 설계
2. Storage 인터페이스 (MemStorage - 개발용)
3. Passport.js 인증 시스템 (Local + Google/Kakao/Naver OAuth)
4. 로그인/회원가입 페이지 (이메일/비밀번호 + OAuth)
5. Protected Routes 및 인증 가드
6. 키움증권 계좌 연동 (CRUD, 잔고/보유종목 조회)
7. 실시간 대시보드 (Recharts: 포트폴리오 파이차트, 30일 자산 추이)
8. WebSocket 실시간 시세 시스템 (MarketDataHub, useMarketStream hook)
9. 거래 화면 (실시간 가격, 일봉 차트, 호가 10단, 주문 패널)
10. 키움증권 API 서비스 (stub - 실제 API 키 필요)
11. OpenAI AI 서비스 (stub - GPT-4 분석 준비)

### ✅ 완료 (계속)
12. AI 분석 대시보드 (Task #5: GPT-4 종목 분석, 포트폴리오 최적화, 신뢰도 점수)
13. 자동매매 시스템 (Task #6: AI 모델 CRUD, 활성화/비활성화, 추천 생성)
14. 거래 내역 및 로그 (Task #7: 주문/체결 내역, 거래 로그, 통계 대시보드)

### 🚧 진행 중
1. 관심종목 및 알림 (Task #8)
2. PWA 설정 (Task #9: Service Worker, 오프라인 모드)
3. 보안 강화 (Task #10: API 키 암호화, rate limiting)
4. 전체 시스템 테스트 (Task #11)
5. 최종 배포 준비 (Task #12)

## 개발 가이드

### 환경 변수
- `DATABASE_URL` - PostgreSQL 연결 문자열
- `SESSION_SECRET` - Session 암호화 키
- `KIWOOM_APP_KEY` - 키움증권 API 키
- `KIWOOM_APP_SECRET` - 키움증권 API 시크릿
- `OPENAI_API_KEY` - OpenAI API 키
- `GOOGLE_CLIENT_ID` - Google OAuth 클라이언트 ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth 클라이언트 시크릿
- `KAKAO_CLIENT_ID` - Kakao OAuth 클라이언트 ID
- `NAVER_CLIENT_ID` - Naver OAuth 클라이언트 ID (선택)
- `NAVER_CLIENT_SECRET` - Naver OAuth 클라이언트 시크릿 (선택)

### 서버 실행
```bash
npm run dev
```

### 데이터베이스 마이그레이션
```bash
npm run db:push
```

## 보안
- Session-based 인증 (PostgreSQL session store)
- CSRF 보호 (sameSite='lax' cookie)
- API 키 환경 변수 관리
- Passport.js OAuth 인증

## 다음 단계
1. 실시간 차트 및 호가창 구현
2. 주문 기능 완성
3. AI 분석 대시보드 완성
4. WebSocket 실시간 시세 구현
5. PWA manifest 및 service worker
6. 모바일 반응형 최적화
7. 프로덕션 배포 준비

## 최근 변경사항 (2025-11-13)

### Task #1-4 완료
- 키움 계좌 연동: 계좌 등록/관리, 잔고/보유종목 조회, API 키 설정
- 실시간 대시보드: Recharts 차트 (포트폴리오 파이, 30일 자산 추이)
- WebSocket 실시간 시세: MarketDataHub, useMarketStream hook, 연결 상태 표시
- 거래 화면: 실시간 가격 카드, 일봉 차트, 호가 10단, 주문 패널

### 인증 시스템 (Task #4.5 완료)
- 로그인/회원가입 페이지 (이메일/비밀번호)
- OAuth 버튼 (Google, Kakao, Naver)
- Protected Routes (App.tsx의 ProtectedRoute)
- Session 기반 인증 (PostgreSQL session store)

### 기술적 개선
- MemStorage ID counter 충돌 수정 (nextAccountId, nextHoldingId 분리)
- React re-render 무한 루프 수정
- Order validation schema 정렬 (orderMethod, orderQuantity)
- WebSocket URL 수정 (window.location.host 사용, local/Replit 호환)

### 다음 단계
- Task #5: AI 분석 대시보드 구현
- Task #6-12: 자동매매, 거래내역, 관심종목, PWA, 보안, 테스트
