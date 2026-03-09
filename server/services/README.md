# server/services/

## 역할
비즈니스 로직 서비스 레이어. 라우터에서 직접 DB/API를 호출하지 않고 이 서비스들을 통해 처리합니다.

## 주요 파일
| 파일 | 역할 |
|------|------|
| `ai.service.ts` | OpenAI GPT-4 기반 주식 분석 및 AI 모델 추천 생성 |
| `learning.service.ts` | AI 자동매매 성과 분석 및 모델 파라미터 자동 최적화 |
| `data-cleanup.service.ts` | 오래된 데이터 주기적 정리 (cron) |
| `kiwoom/` | 키움증권 REST API 연동 모듈 (인증/시세/주문/계좌/재무) |

## 규칙
- 파일당 500줄 이하
- 각 서비스는 단일 책임 원칙 준수
- 키움 API 관련은 반드시 `kiwoom/` 하위에 위치
