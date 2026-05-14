# client/src/

## 역할
React + TypeScript 프론트엔드 애플리케이션 소스.

## 구조
| 폴더 | 역할 |
|------|------|
| `pages/` | 페이지 컴포넌트 (라우팅 단위) |
| `components/` | 재사용 가능한 UI 컴포넌트 |
| `hooks/` | 커스텀 React Hook |
| `lib/` | API 클라이언트, 유틸리티 |

## 진입점
- `main.tsx` — React 앱 마운트 + 서비스워커 등록
- `App.tsx` — 라우팅 + 인증 처리

## 규칙
- 파일당 500줄 이하
- 페이지 컴포넌트는 데이터 fetching만 담당, 로직은 hooks로 분리
- API 호출은 TanStack Query 사용 (직접 fetch 금지)
