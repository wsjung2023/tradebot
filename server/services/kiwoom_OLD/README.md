# README.md — server/services/kiwoom/ 폴더 가이드

키움증권 REST API 연동 모듈. 모든 키움 관련 API 호출은 이 폴더를 통해 처리한다.

## 파일 구조

| 파일 | 역할 |
|------|------|
| index.ts | KiwoomService 통합 클래스 + getKiwoomService() 싱글톤 |
| kiwoom.base.ts | 공통 기반 클래스 (axios 인스턴스, 토큰 인증, 공유 타입) |
| kiwoom.account.ts | 계좌 잔고, 보유종목 조회 |
| kiwoom.order.ts | 주문 실행, 취소, 내역 조회 |
| kiwoom.market.ts | 시세, 차트, 종목 검색, 거래량, 장이슈 |
| kiwoom.condition.ts | HTS 조건검색식 실행 및 모니터링 |
| kiwoom.financial.ts | 재무제표, 재무비율 조회 |

## 사용법

```typescript
import { getKiwoomService } from "../services/kiwoom";
const kiwoom = getKiwoomService();
const price = await kiwoom.getStockPrice("005930");
```

## 규칙

- 새 API 추가 → 해당 도메인 파일에 메서드 추가 후 index.ts에 위임 메서드 추가
- 공통 타입 → kiwoom.base.ts에 정의
- 인증 처리 → KiwoomBase가 자동으로 처리 (직접 호출 금지)
- STUB 모드 → 환경변수 없으면 자동 활성화 (실제 API 호출 안 함)
