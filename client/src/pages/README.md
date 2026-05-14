# client/src/pages/

## 역할
라우팅 단위 페이지 컴포넌트. App.tsx에서 각 경로와 매핑됩니다.

## 페이지 목록
| 파일 | 경로 | 역할 |
|------|------|------|
| `login.tsx` | /login | 로그인 (이메일 + Google OAuth) |
| `register.tsx` | /register | 회원가입 |
| `dashboard.tsx` | / | 포트폴리오 대시보드 |
| `trading.tsx` | /trading | 실시간 거래 인터페이스 |
| `accounts.tsx` | /accounts | 키움 계좌 연동 관리 |
| `ai-analysis.tsx` | /ai-analysis | GPT-4 AI 투자 분석 |
| `auto-trading.tsx` | /auto-trading | AI 자동매매 모델 관리 |
| `trade-history.tsx` | /trade-history | 거래 내역 및 통계 |
| `watchlist.tsx` | /watchlist | 관심종목 관리 |
| `condition-screening.tsx` | /condition-screening | 조건 스크리닝 |
| `backattack-scan.tsx` | /backattack-scan | 백어택2 전략 스캔 |

## 규칙
- 페이지 컴포넌트는 500줄 이하 유지
- 복잡한 로직은 components/ 또는 hooks/로 분리
- 데이터 fetching은 TanStack Query 사용
