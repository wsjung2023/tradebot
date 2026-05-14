# client/src/hooks/

## 역할
재사용 가능한 커스텀 React Hook. 상태 관리 및 사이드 이펙트 캡슐화.

## 주요 파일
| 파일 | 역할 |
|------|------|
| `use-market-stream.ts` | WebSocket 실시간 시세 구독 훅 (지수 백오프 재연결) |
| `use-toast.ts` | 토스트 알림 훅 (Shadcn 기반) |

## 규칙
- 컴포넌트에서 직접 WebSocket/fetch 연결 금지 → 반드시 훅으로 분리
- 훅 이름은 `use-` 접두사 필수
