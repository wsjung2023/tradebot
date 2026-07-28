# 온톨로지(시장 지식그래프) 도입 설계

작성일: 2026-07-28
상태: 설계 확정, 첫 증분(집중리스크 게이트) 구현 대기
영감: `D:\Projects\si-toolkit`의 온톨로지 엔진 (속성그래프 + 결정적 파생 인사이트 + 검증가능 신뢰 아키텍처)

---

## 0. 한 줄 요약

트레이드봇의 **"종목 원자화"**(각 종목을 독립 평가) 한계를, si-toolkit식 **시장 지식그래프 + 결정적 파생 인사이트**로 보완한다. **기존 로직은 한 글자도 안 건드리는 비파괴 추가**로 시작하고, **상위 요금제 전용 프리미엄 기능**으로 제품화한다.

## 1. 배경 — 지금의 한계 (분석으로 확인된 사실)

- **종목 원자화**: 후보/매수/매도 판단이 모두 종목 1개씩 독립. GPT도 단일종목 맥락만 받음.
- **`themeScore`는 관계가 아니라 GPT의 종목명 추측** (`ai.service.ts` "AI·반도체·바이오면 +").
- **`market_issues` 테이블에 `issueType='theme'`·`relatedTheme` 컬럼이 있으나 판단에서 안 읽음** (수동 입력, boolean 게이트로만).
- **포트폴리오 상관·섹터 집중도·분산 판단이 0개** — 같은 테마 3종목 몰빵을 못 막음.
- 학습(`learning.service`)은 **가중치·임계치 튜닝만** — 관계 정보는 학습 대상 아님.

## 2. si-toolkit에서 차용하는 것

| si-toolkit | 트레이딩 적용 |
|---|---|
| 노드/엣지 속성그래프(Postgres) | 종목·섹터·테마·이벤트·레짐 노드 + 관계 엣지 |
| 상태 생명주기(DISCOVERED→APPROVED) + 근거(evidence) | 검증가능한 사실만 판단에 반영 |
| **결정적 파생 인사이트**(그래프 위상 계산, 할루시네이션 불가) | CONCENTRATION_RISK, THEME_MOMENTUM, LEADER_LAGGARD |
| **"온톨로지는 보강이지 전제가 아니다"**(실패해도 생성 안 막음) | **실패해도 매매 절대 안 막음** (핵심 안전원칙) |
| 주기 갱신(fingerprint 게이트 + advisory lock) | 그래프 갱신도 동일 패턴 |
| source_type 격리 + 자기 스윕 | 결정적/휴리스틱/AI 소스 분리 |

## 3. 불변 원칙 (사용자 요구 — 반드시 지킬 것)

### 3-1. 비파괴 안정성 (기존 로직 절대 훼손 금지)
- **추가만(additive)**: 새 테이블·새 서비스·새 게이트. 기존 `evaluateCandidateStock`/`checkPositionsForExits` 로직은 수정하지 않고 **앞/뒤에 훅으로 삽입**.
- **기능 토글**: 온톨로지 전체가 `settings.ontologyEnabled`(기본 **OFF**)로 on/off. OFF면 기존과 100% 동일 동작.
- **실패 안전(fail-open)**: 그래프 조회/계산이 실패·타임아웃·빈 결과면 **빈 컨텍스트로 폴백해 매매를 그대로 진행**. 온톨로지 때문에 매수/매도가 막히거나 지연되지 않는다.
- **forward-shadow 검증 필수**: 모든 증분은 켠 모델 vs 끈 모델을 전방-섀도우 시뮬로 A/B 해서, **기존 대비 개선(낙폭↓/기대값↑)이 증명될 때만** 실계좌 적용.
- 회귀 테스트: 온톨로지 OFF 상태에서 기존 스모크/회귀가 100% 그대로 통과.

### 3-2. 프리미엄 티어 (과금 차별화)
- 온톨로지는 **상위 요금제 전용 value-add**. `DEPLOYMENT_TIER`/구독 티어로 gate.
- 제안: **Public SaaS Pro/Enterprise + Private Cloud**에서 활성, Basic/Free는 미제공(또는 체험).
- 판매 포인트: "단일종목 AI를 넘어 **시장 관계·집중리스크·테마 모멘텀까지 읽는 지능**" — 더 높은 성능·더 큰 밸류 → 더 높은 요금.
- 코드 전략: [[project_saas_business_model]]의 단일레포·환경변수 티어 제어 그대로. 온톨로지 기능은 `tier-limits.service`에서 `ontology` capability로 enforce.

## 4. 첫 증분 (MVP) — 집중 리스크 게이트

**목표:** 새 매수 직전, 후보가 **기존 보유종목과 강하게 엮여있으면**(같이 움직임) 몰빵을 경고/축소/차단.

- **관계 신호 = 가격 수익률 상관** (결정적, GPT·외부데이터 불필요). 후보와 각 보유종목의 최근 일봉 수익률 상관계수 계산(봇이 이미 일봉 차트 가져옴).
  - → 온톨로지의 첫 결정적 엣지 `CORRELATED_WITH` + 파생 인사이트 `CONCENTRATION_RISK`(si-toolkit `SHARES_DEPENDENCY_WITH`의 트레이딩판).
- **게이트 동작**: `corr ≥ 임계치`인 보유가 있으면 집중 판정 → 정책(설정): **경고 / 비중축소 / 차단** (기본 경고, 상위로 갈수록 강함). + "고상관 포지션 최대 N개" 캡.
- **삽입 지점**: `evaluateCandidateStock`의 매수 결정 직전 — **훅으로 추가**(기존 게이트 미변경). `ontologyEnabled` OFF면 훅 자체를 스킵.
- **안전**: 상관 계산 실패/데이터 부족 시 게이트 스킵(fail-open). 결정적이라 할루시네이션 없음.
- **설정**: 상관 임계치·정책·최대 고상관 수를 `auto_trading_settings`에 additive 컬럼으로 추가.
- **검증(성공기준)**: forward-shadow에서 게이트 ON vs OFF → **최대낙폭·기대값 델타** 측정. 낙폭이 유의미하게 줄고 기대값이 나빠지지 않으면 채택.

## 5. 전체 로드맵 (첫 증분 이후)

- **Track A — 시장 지식그래프 기반**: `market_nodes`/`market_edges`/`evidence` 테이블. 결정적 엣지부터(조건검색 동시출현→테마, DART 공시→이벤트, 가격상관→CORRELATED, 시총/거래대금→LEADER_OF). 주기 갱신은 fingerprint+advisory lock.
- **Track B — 판단에 주입**: (1) `comprehensiveAiAnalysis` GPT 입력에 **APPROVED 관계 사실** 추가(소속테마·대장주 위치·고상관 흐름·진행이벤트). (2) `market_issues` 자동 채우기 → 껍데기 게이트 실질화.
- **Track C — 관계 피처 자가학습**: 진입 시 온톨로지 맥락을 `trading_performance.entryConditions`(이미 존재)에 스냅샷 → `learning.service`의 Information-Value 방식으로 **관계 피처의 승률 기여도** 학습 → 승격 브리지([[project_self_learning_roadmap]])와 결합.

## 6. 아키텍처 개요

- **저장**: Postgres 속성그래프(노드/엣지/근거), 상태 생명주기. JSON은 컬럼 안에.
- **파생 인사이트**: 그래프 위상만 계산(결정적). CONCENTRATION_RISK / THEME_MOMENTUM / LEADER_LAGGARD.
- **질의→판단 삽입**: APPROVED 사실만, 실패 시 빈 컨텍스트. 매수 게이트·GPT 프롬프트·청산 트리거에 훅.
- **갱신**: 백그라운드, fingerprint 변화 있을 때만, advisory lock으로 단일 인스턴스.
- **격리 원칙**: 결정적(자동 신뢰) / 휴리스틱·AI(사람 승인) 소스 분리.

## 7. 비목표 (이번 범위 아님)

- 실계좌 자동 적용(항상 forward-shadow 검증 후 사용자 결정).
- 외부 유료 데이터·뉴스 크롤러 신규 구축(기존 키움/DART/네이버뉴스 재사용).
- 기존 매매 로직 리팩터/변경(추가 훅만).

## 8. 성공 기준

1. **온톨로지 OFF일 때 기존 동작·회귀 100% 동일** (비파괴 증명).
2. 집중리스크 게이트 ON: forward-shadow에서 **최대낙폭 감소 + 기대값 비열화 없음**.
3. 그래프/계산 실패 시 매매가 막히거나 지연되지 않음(fail-open 확인).
4. 상위 티어에서만 활성화됨(tier gate 동작).
5. 실주문 0 영향 — 게이트는 판단만, 실행경로 무변경.
