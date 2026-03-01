# README.md — server/storage/ 폴더 가이드

이 폴더는 DB 접근 레이어(스토리지)를 담당한다.

## 파일 구조

| 파일 | 역할 |
|------|------|
| index.ts | 진입점 — `storage` 인스턴스 export (여기서만 new PostgreSQLStorage()) |
| interface.ts | IStorage 인터페이스 정의 — 모든 메서드 시그니처 |
| postgres.storage.ts | PostgreSQL 실제 구현체 (Drizzle ORM) |

## 사용법

```typescript
import { storage } from "../storage"; // 폴더 경로로 자동 index.ts 참조
```

## 규칙

- DB 직접 쿼리 금지 → 반드시 이 폴더의 storage 함수 사용
- 새 메서드 추가 시 → interface.ts에 먼저 정의 → postgres.storage.ts에 구현
- 읽기 전용 원칙 → SELECT는 자유, INSERT/UPDATE/DELETE는 반드시 이유 명확히
- 에러 처리 → try-catch 없이 throw 허용 (호출부에서 처리)
