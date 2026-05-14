# UPGRADE_EXECUTION_PLAN (v2 실행 작업 계획서)

작성 기준:
- `UPGRADE_PLAN.md`의 비전/기능을 현재 코드베이스에 안전하게 이행
- 현재 Replit 운영 특성(단일 런타임 + 백그라운드 잡)과 장애 복구 관점 우선


## 0) 파일 기반 수정 매트릭스 (필수)

| 우선순위 | 파일 | 수정 내용 | 목적 |
|---|---|---|---|
| P0 | `server/config/feature-flags.ts` | 기능 플래그 파서/타입/기본값 정의 | 신규 기능 안전 온오프 |
| P0 | `server/auto-trading-worker.ts` | 사이클 실행ID 로그, 플래그 기반 가격알림/학습 제어, 실패 격리 강화 | Replit 백그라운드 안정성 |
| P0 | `server/job-manager.ts` | (후속) 잡 상태 응답에 플래그/실행 메타 연결 | 운영 가시성 |
| P1 | `shared/schema.ts` | `ai_model_specs`, `ai_council_sessions`, `entry_points`, `learning_records` 스키마 추가 | v2 데이터 계층 |
| P1 | `server/storage/interface.ts` | 신규 테이블 I/O 인터페이스 추가 | 스토리지 추상화 일관성 |
| P1 | `server/storage/postgres-core.storage.ts` | 신규 스키마 CRUD 구현 | 실제 DB 읽기/쓰기 |
| P1 | `server/routes/ai.routes.ts` | `POST /api/ai/council-analysis`(shadow mode) 추가 | AI Council 진입점 |
| P1 | `server/services/ai-council.service.ts` | 3인 분석 + 의장 종합 서비스 신설 | 핵심 v2 엔진 |
| P2 | `server/services/entry-point-calculator.ts` | 컨플루언스 기반 타점 계산 신설 | 타점 정밀화 |
| P2 | `client/src/pages/auto-trading.tsx` | feature flag/Shadow 결과 표시(읽기 전용) | 운영 안전 UI |

### 0-1) 바로 진행한 1차 착수 범위
- `server/config/feature-flags.ts` 신규 추가
- `server/auto-trading-worker.ts`에 실행ID 구조화 로그 및 feature flag 연동 반영
- `ENABLE_PRICE_ALERTS_IN_TRADING_CYCLE` / `ENABLE_ADVANCED_LEARNING` 플래그 경로 적용

---

## 1) 현재 기준선(Baseline) 점검

### 1-1. 이미 운영 중인 핵심 런타임
- 자동매매/학습은 `job-manager`에서 잡 단위로 관리되며, 현재 `auto-trading`(기본 1분), `learning`(기본 1일) 스케줄을 가짐.
- 자동매매 워커는 조건식 순회, 종목 평가, 주문 수행 흐름과 별도로 가격알림 체크(`checkPriceAlerts`)를 같은 사이클에 수행.
- 워커가 실행되려면 사용자별 키움 키, 계좌, 활성 조건식, 활성 AI 모델이 전부 유효해야 함.

### 1-2. 안정성 기준
- 신규 v2 기능은 기존 자동매매 경로를 절대 깨지 않도록 “기능 플래그”로 보호.
- API 실패/지연이 발생해도 워커 전체 중단이 아닌 “기능 스킵 + 로그 기록”으로 처리.
- Replit 재시작/배포 재기동 시에도 잡 중복 실행이 생기지 않도록 단일 실행 가드 유지.

---

## 2) v2 이행 전략 (안전 우선 순차 전개)

## Phase A — 사전 안전망 구축 (필수)
목표: v2 구현 전에 운영 리스크를 먼저 낮춤.

작업:
1. 기능 플래그 도입
   - `ENABLE_AI_COUNCIL`, `ENABLE_ENTRY_POINT_ENGINE`, `ENABLE_ADVANCED_LEARNING`.
2. 워커 실행 보호
   - 외부 AI 공급자 호출 타임아웃/재시도/서킷브레이커 적용.
   - 1사이클 최대 처리 종목 수/최대 토큰 사용량/최대 처리시간 상한 적용.
3. 관측성(Observability)
   - 잡 실행 ID 단위 구조화 로그 도입.
   - 실패 유형 분리 집계(키움 실패 / 모델 실패 / DB 실패 / 검증 실패).
4. 롤백 표준화
   - 플래그 OFF만으로 즉시 기존 v1 경로로 복귀 가능하게 구성.

완료 조건:
- 기능 플래그 OFF 상태에서 기존 동작과 동일(회귀 없음).
- 잡 실패율/재시도율 모니터링 지표 생성 완료.

## Phase B — 데이터/스키마 확장 (무중단)
목표: AI Council/타점 계산/학습 고도화에 필요한 저장소를 먼저 준비.

작업:
1. 신규 테이블 추가
   - `ai_model_specs`, `ai_council_sessions`, `entry_points`, `learning_records`.
2. 인덱스/보존정책
   - `user_id`, `stock_code`, `created_at` 복합 인덱스.
   - 로그성 JSONB 컬럼은 보존 기간/용량 상한 정책 설정.
3. 스키마 마이그레이션 안전 절차
   - Additive migration만 먼저 적용 (기존 컬럼 변경/삭제 금지).
   - 배포 후 읽기/쓰기 경로를 순차 전환.

완료 조건:
- 마이그레이션 후 기존 API/워커 정상.
- 신규 테이블 쓰기 실패 시에도 핵심 주문 경로 영향 없음.

## Phase C — AI Council 최소기능(MVP) 도입
목표: 3인 분석회의를 별도 경로로 붙이고, 기존 매매 흐름과 분리 검증.

작업:
1. `AICouncilService` 신규 추가 (기술/펀더/센티 + 의장 종합).
2. API 추가
   - `POST /api/ai/council-analysis` (비동기 처리 + 타임아웃).
3. 저장
   - 분석 결과를 `ai_council_sessions`에 저장.
4. 워커 연동 방식
   - 초기에는 주문 의사결정 직접 반영 금지.
   - “shadow mode”로만 돌려 기존 판단과 비교치 수집.

완료 조건:
- Shadow mode 1주 이상 운영 중 치명 오류 0건.
- 분석 지연/비용 상한 준수.

## Phase D — 정밀 타점 엔진 연동
목표: 기존 신호 + AI 의사결정의 컨플루언스 계산을 안전하게 도입.

작업:
1. `EntryPointCalculator` 추가.
2. 기존 조건식 신호/레인보우 결과와 합성 규칙 정의.
3. 리스크 규칙 강제
   - 최소 손절폭, 최소 R/R, 최대 포지션 비중.
4. 배포 순서
   - 읽기 전용 추천값 노출 → 검증 → 실제 주문 반영(플래그 ON).

완료 조건:
- 추천값과 실제 체결 성과 간 일관성 지표 확보.
- 주문 실패율 악화 없음.

## Phase E — WIN/LOSS 학습 고도화
목표: 기존 optimizeModel을 확장하되, 실계좌 안전을 침해하지 않음.

작업:
1. 학습 배치 분리
   - 학습 주기는 기존 `learning` 잡 유지, 거래 시간 외 처리 우선.
2. 모델 파라미터 업데이트 가드
   - 자동 반영 전 검증 룰(최소 표본수, 이상치 제거).
3. A/B 실험
   - 기존 파라미터군 vs 신규 파라미터군 병행 비교.

완료 조건:
- 특정 기간 기준 win rate 또는 손익 안정성 개선 확인.
- 악화 시 자동 롤백.

---

## 3) Replit 백그라운드 환경 고려사항

1. 단일 런타임 전제
- 동일 프로세스 내에서 워커/웹서버가 함께 동작하므로, 무거운 AI 호출은 동시성 제한 필수.

2. 재배포/재시작 내구성
- 시작 시점 잡 중복 시작 방지.
- 진행 중 사이클은 idempotent 키(모델ID+조건ID+시각 버킷)로 중복 실행 차단.

3. 네트워크 불안정
- 공급자 API 에러를 “전체 중단”이 아니라 “해당 모델 스킵”으로 처리.
- 키움 시세 조회 실패 시 알림 체크만 스킵하고 다음 사이클 유지(현재 패턴 유지).

4. 비용 제어
- 일일/사이클별 토큰 예산 초과 시 저비용 모델로 강등 또는 분석 단계 축소.

---

## 4) 구현 순서별 산출물

1. 설계/안전망 PR
- 기능 플래그, 타임아웃, 재시도, 구조화 로그.

2. 데이터 계층 PR
- 신규 스키마 + storage 인터페이스 + 기본 CRUD.

3. AI Council PR
- 서비스/라우트 + shadow mode + 결과 저장.

4. 타점 엔진 PR
- 계산 엔진 + UI 조회 API(읽기 전용부터).

5. 학습 고도화 PR
- 학습 기록/패턴 추출 + A/B 운영 기능.

각 PR 원칙:
- 1 PR = 1 기능군
- 회귀 테스트 + 롤백 방법 포함
- 배포 체크리스트(환경변수/DB/스케줄) 포함

---

## 5) 즉시 착수 To-Do (다음 작업 티켓)

- [ ] Feature flag 유틸 + 환경변수 스키마 추가
- [ ] 외부 AI provider 공통 timeout/retry 래퍼 추가
- [ ] `ai_model_specs`/`ai_council_sessions` 스키마 및 storage 메서드 추가
- [ ] AI Council Shadow API 초안 구현
- [ ] 잡 실행 구조화 로그(실행ID) 및 실패 코드 체계 도입

