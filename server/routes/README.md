# README.md — server/routes/ 폴더 가이드

이 폴더는 Express API 라우터를 도메인별로 분리한 것이다.

## 파일 구조

| 파일 | 담당 API |
|------|----------|
| index.ts | 전체 라우터 등록 진입점 (여기서만 app에 등록) |
| auth.routes.ts | /api/auth/* — 회원가입, 로그인, 소셜 로그인 |
| account.routes.ts | /api/accounts/* — 계좌 관리, 잔고, 보유종목 |
| trading.routes.ts | /api/stocks/*, /api/orders/*, /api/trading-logs |
| ai.routes.ts | /api/ai/* — AI 분석, 모델 관리, 학습 통계 |
| watchlist.routes.ts | /api/watchlist/*, /api/alerts/*, /api/settings |
| formula.routes.ts | /api/conditions/*, /api/chart-formulas/*, /api/stocks/fundamentals |
| autotrading.routes.ts | /api/auto-trading/* — 백어택2 자동 스캔 |
| rainbow.ts | /api/rainbow/* — 레인보우 차트 분석 (기존 파일) |

## 규칙

- 새 API 추가 시 → 해당 도메인 파일에 추가 (없으면 새 파일 생성)
- 각 파일 상단에 한 줄 설명 주석 필수
- 파일당 400줄 초과 금지 → 초과시 분리
- 에러 처리: try-catch 필수, res.status(XXX).json({ error }) 형식 통일
- DB 접근: storage.ts 함수만 사용 (직접 쿼리 금지)
