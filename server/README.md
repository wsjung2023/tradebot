# README.md — server/ 폴더 가이드

이 폴더는 Express 백엔드 서버 코드 전체를 담고 있다.

## 폴더/파일 구조

| 경로 | 역할 |
|------|------|
| index.ts | 서버 진입점 (미들웨어, 세션, 보안 설정) |
| auth.ts | Passport.js 인증 설정 (로컬/구글/카카오/네이버) |
| db.ts | PostgreSQL 연결 풀 |
| vite.ts | Vite 개발서버 연동 |
| routes/ | API 라우터 (도메인별 분리) |
| services/ | 비즈니스 로직 (키움 API, AI, 학습 등) |
| formula/ | 레인보우 차트 분석 엔진 |
| utils/ | 공통 유틸리티 (암호화 등) |
| storage.ts | DB CRUD 함수 모음 (추후 분리 예정) |
| market-data-hub.ts | WebSocket 실시간 시세 허브 |
| auto-trading-worker.ts | 자동매매 백그라운드 워커 |

## 개발 규칙

- 새 기능 → services/ 하위에 별도 파일
- 새 API → routes/ 하위 해당 파일에 추가
- DB 접근 → storage.ts 함수만 사용
- 에러 처리 → try-catch 필수
- 파일 상단 → 한 줄 설명 주석 필수
