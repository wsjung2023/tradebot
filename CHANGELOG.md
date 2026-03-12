# CHANGELOG

## [PR #11] 2026-03-12 — DART 공시·학습 서비스·분석 재료 수집·Replit 준비상태 스크립트

### 신규 파일
| 파일 | 설명 |
|------|------|
| `server/services/dart.service.ts` | 금감원 전자공시(DART) API 연동. `DART_API_KEY` 필요, 없으면 빈 배열 반환 |
| `server/services/learning.service.ts` | AI 모델 성과 분석·패턴 인사이트·파라미터 최적화 |
| `client/src/components/auto-trading/AutoTradingLearningRecords.tsx` | 학습 기록 UI (승률·수익률·샤프비율·최대낙폭·진입/청산 최적라인) |
| `scripts/replit-readiness.mjs` | Replit 환경 준비상태 자동 점검 (DB·환경변수·빌드·서버 응답 확인) |

### 신규 DB 테이블 (schema.ts + drizzle-kit push 적용)
| 테이블 | 설명 |
|--------|------|
| `company_filings` | DART 공시 내용 저장 |
| `news_articles` | 뉴스 기사 캐시 |
| `analysis_material_snapshots` | 분석 재료 스냅샷 (뉴스+공시+재무 통합) |

### 신규 API 엔드포인트
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/stocks/:code/sync-materials` | 분석 재료 수집 (DART, 뉴스, 재무) |
| GET | `/api/stocks/:code/materials` | 수집된 분석 재료 목록 조회 |
| GET | `/api/ai/models/:id/learning-stats` | AI 모델 학습 통계 |
| GET | `/api/ai/models/:id/learning-records` | AI 모델 학습 기록 목록 |

### 주요 업데이트
- `client/src/components/ai-analysis/IntegratedAnalysis.tsx` — 분석 재료 스냅샷 통합
- `client/src/pages/auto-trading.tsx` — 학습 기록 탭 추가
- `server/routes/ai.routes.ts` — 294줄 추가 (분석재료·학습·DART 엔드포인트)
- `server/storage/interface.ts` — 40줄 추가 (`getCompanyFilings`, `getNewsArticles`, `getAnalysisMaterialSnapshots` 등)
- `server/storage/postgres-core.storage.ts` — 187줄 추가

---

## [PR #10] 2026-03-12 — HTS 동기화 에러 핸들링 보완
### 변경
- `server/routes/watchlist.routes.ts`: `watchlist_sync_snapshots` 테이블 미생성 시 503 + 안내 메시지 반환 (`WATCHLIST_SYNC_TABLE_MISSING` 코드)

---

## [PR #9] 2026-03-12 — 키움 HTS 동기화·차트 시그널·AI Council·피처 플래그
### 신규 파일
| 파일 | 설명 |
|------|------|
| `server/config/feature-flags.ts` | 환경변수 기반 피처 플래그 (`ENABLE_AI_COUNCIL` 등) |
| `server/services/ai-council.service.ts` | AI 투자자문 위원회 — 기술/기본/감성 3인 다수결 |
| `scripts/playwright-smoke.mjs` | Playwright 스모크 테스트 |
| `IMPLEMENTATION_WORK_INSTRUCTION.md` | 구현 지시서 |
| `UPGRADE_EXECUTION_PLAN.md` | 업그레이드 실행 계획 |

### 신규 API 엔드포인트
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/stocks/:code/chart-signals` | 조건검색 결과 기반 차트 시그널 오버레이 |
| POST | `/api/watchlist/sync/kiwoom` | 키움 HTS 관심종목 동기화 |
| GET | `/api/watchlist/sync-snapshots` | 동기화 스냅샷 목록 |
| POST | `/api/ai/council-analysis` | AI 3인 위원회 분석 |
| GET | `/api/ai/council-sessions` | 위원회 세션 이력 |

### DB 스키마 추가
- `watchlist_sync_snapshots` — 키움 HTS 동기화 스냅샷 테이블

### 주요 변경
- `client/src/pages/trading.tsx`: 차트 시그널 오버레이 UI 추가
- `client/src/pages/watchlist.tsx`: HTS 동기화 버튼 추가
- `client/src/pages/condition-screening.tsx`: 키움 조건식 탭 UI 개선
- `server/auto-trading-worker.ts`: 피처 플래그 적용, 가격 알림 자동 체크
- `server/services/kiwoom/kiwoom.market.ts`: `getWatchlistInfo`, `getStockInfo`, `getStockList` 메서드 추가
- `server/services/kiwoom/kiwoom.condition.ts`: WebSocket 재시도·모니터링 확장
- `server/storage/interface.ts`: `getWatchlistSyncSnapshots`, `upsertWatchlistSyncSnapshot` 추가

---

## [PR #8] 2026-03-12 — AI Council 기반 및 조건검색 kiwoom 연동
### 신규
- `server/routes/ai.routes.ts`: AI 분석 + Council 엔드포인트 추가
- `server/storage/postgres-core.storage.ts`: `getAllActiveAlerts`, sync 스냅샷 구현

### 변경
- `server/auto-trading-worker.ts`: 가격 알림 자동 체크 통합
- `server/routes/formula.routes.ts`: `/api/kiwoom/conditions` 추가, seq 자동 해결

---

## [PR #7] 2026-03-11 — TypeScript 타입 강화 및 키움 API 확장
### 변경
- `server/services/kiwoom/kiwoom.financial.ts`: `getFinancialRatios()` 응답 배열→객체 변경
- `server/services/kiwoom/kiwoom.base.ts`: `FinancialRatiosResponse` 타입 수정
- `client/src/pages/dashboard.tsx`: useQuery 명시적 타입 추가
- `server/routes/ai.routes.ts`: `ratiosData` 배열/객체 양방향 처리
- `server/routes/watchlist.routes.ts`: 관심종목 조회에 키움 실시간 시세 병합

---

## [이전] 자체 구현 (PR 이전)
- 뉴스 서비스 (`news.service.ts`) — 네이버 API, 감성 분류, 5분 캐시
- 통합 분석 (`/api/ai/integrated-analysis`) — 뉴스+재무+기술 통합
- DB 읽기/쓰기 풀 분리 (`server/db.ts`)
- 서비스 워커 v4-passthrough (캐싱 없음, 빈화면 버그 해결)
