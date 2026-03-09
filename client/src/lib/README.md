# client/src/lib/

## 역할
API 클라이언트, 유틸리티, 서비스 초기화 모듈.

## 주요 파일
| 파일 | 역할 |
|------|------|
| `queryClient.ts` | TanStack Query 클라이언트 설정 + apiRequest 유틸 |
| `kiwoom-client.ts` | 프론트엔드 키움 API 요청 헬퍼 |
| `register-sw.ts` | 서비스 워커 등록 및 업데이트 감지 |
| `utils.ts` | 공통 유틸리티 (cn 함수 등) |

## 규칙
- 직접 fetch 호출 시 반드시 `apiRequest` 사용
- 인증이 필요한 요청은 자동으로 쿠키 세션 포함됨
