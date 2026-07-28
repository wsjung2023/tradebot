# 온톨로지 1차: 집중 리스크 게이트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 새 매수 직전, 후보가 기존 보유종목과 가격상관이 높으면(몰빵) 경고/차단하는 결정적 집중리스크 게이트를 **기존 로직 무변경·토글 OFF 기본·실패시 매매 무영향**으로 추가한다.

**Architecture:** 순수함수 2개(상관계산·집중평가)를 tsx 단독테스트로 TDD한다. 게이트는 `evaluateCandidateStock`의 기존 게이트 뒤에 훅 1개로 삽입되며, `settings.ontologyEnabled`(기본 false) + 티어 허용일 때만 동작하고, 계산 실패/데이터 부족 시 fail-open(매수 그대로 진행)한다. 상관은 봇이 이미 가져오는 일봉 종가로 계산(외부데이터·GPT 불필요).

**Tech Stack:** TypeScript, Express, Drizzle ORM(PostgreSQL), tsx, 키움 REST(getStockChart).

## Global Constraints

- **비파괴**: 기존 매매 로직 수정 금지. 새 파일 + `evaluateCandidateStock`에 훅 1곳·private 메서드 1개만 추가.
- **토글 OFF 기본**: `auto_trading_settings.ontology_enabled` 기본 `false`. OFF면 게이트 훅 자체를 스킵 → 기존과 100% 동일.
- **fail-open**: 차트조회/상관계산 실패·타임아웃·데이터부족이면 게이트는 `allow` 반환. 온톨로지 때문에 매수가 막히거나 지연되지 않는다.
- **프리미엄 티어**: 게이트는 `saas_pro`/`saas_enterprise`(및 Private=enterprise)에서만 활성. free/basic은 미동작.
- **결정적**: 상관은 순수 계산(할루시네이션 없음).
- 테스트 프레임워크 없음 → 순수함수는 `tsx scripts/test-*.ts` + `node:assert`(기존 `scripts/test-exit-guards.ts` 패턴).
- DB 스키마 변경 시 migration SQL + `migrations/meta/_journal.json` 둘 다. 운영/개발 DB는 수동 additive 적용(CLAUDE.md).
- 정규화 차트: `normalizeChartDataAsc(chartData.output || chartData)` → `OHLCVData[]`(오름차순, `close:number`, `close>0`만).

---

## File Structure

- Create: `server/utils/correlation.ts` — 순수. 종가→수익률, 피어슨 상관.
- Create: `server/services/concentration-risk.ts` — 순수. 집중 평가 + 행동 결정.
- Create: `scripts/test-correlation.ts` — Task 1 테스트.
- Create: `scripts/test-concentration-risk.ts` — Task 2 테스트.
- Modify: `shared/schema.ts` — `autoTradingSettings`에 4개 컬럼 추가.
- Create: `migrations/0018_ontology_concentration.sql` + `migrations/meta/_journal.json` idx 18.
- Modify: `server/services/tier-limits.service.ts` — TIER_LIMITS에 `ontology` + `checkOntologyAllowed`.
- Modify: `server/services/trade-executor.service.ts` — `runConcentrationGate` private 메서드 + `evaluateCandidateStock` 매수 직전 훅 1곳.

---

### Task 1: 상관 계산 순수함수

**Files:**
- Create: `server/utils/correlation.ts`
- Test: `scripts/test-correlation.ts`

**Interfaces:**
- Produces:
  - `function toReturns(closes: number[]): number[]` — 일간 단순수익률 `(c[i]-c[i-1])/c[i-1]`. 길이 n-1. c[i-1]==0이면 그 값은 0.
  - `function pearsonCorrelation(a: number[], b: number[]): number | null` — 피어슨 상관계수. 길이가 다르거나 <2거나 분산 0이면 null.

- [ ] **Step 1: 실패 테스트 작성** — `scripts/test-correlation.ts`

```ts
import assert from 'node:assert';
import { toReturns, pearsonCorrelation } from '../server/utils/correlation';

// toReturns
assert.deepStrictEqual(toReturns([100, 110, 99]), [0.1, -0.1], '단순수익률');
assert.deepStrictEqual(toReturns([100]), [], '1개면 빈배열');
assert.deepStrictEqual(toReturns([0, 10]), [0], '이전값 0 → 0');

// pearsonCorrelation
const a = [1, 2, 3, 4, 5];
assert.ok(Math.abs((pearsonCorrelation(a, [2, 4, 6, 8, 10]) as number) - 1) < 1e-9, '완전 양의상관=1');
assert.ok(Math.abs((pearsonCorrelation(a, [10, 8, 6, 4, 2]) as number) + 1) < 1e-9, '완전 음의상관=-1');
assert.strictEqual(pearsonCorrelation([1, 2], [1]), null, '길이 불일치 null');
assert.strictEqual(pearsonCorrelation([1], [2]), null, '표본<2 null');
assert.strictEqual(pearsonCorrelation([5, 5, 5], [1, 2, 3]), null, '분산0 null');
console.log('OK: correlation');
```

- [ ] **Step 2: 실패 확인** — Run: `npx tsx scripts/test-correlation.ts` → FAIL (module 없음)

- [ ] **Step 3: 구현** — `server/utils/correlation.ts`

```ts
// correlation.ts — 종가→수익률, 피어슨 상관 (순수 함수)

export function toReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    out.push(prev === 0 ? 0 : (closes[i] - prev) / prev);
  }
  return out;
}

export function pearsonCorrelation(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n !== b.length || n < 2) return null;
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const ma = mean(a), mb = mean(b);
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  if (va === 0 || vb === 0) return null; // 분산 0 → 정의 불가
  return cov / Math.sqrt(va * vb);
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx tsx scripts/test-correlation.ts` → `OK: correlation`

- [ ] **Step 5: 커밋**

```bash
git add server/utils/correlation.ts scripts/test-correlation.ts
git commit -m "feat(ontology): 상관 계산 순수함수 + 테스트 (집중게이트 1/5)"
```

---

### Task 2: 집중 평가 + 행동 결정 순수함수

**Files:**
- Create: `server/services/concentration-risk.ts`
- Test: `scripts/test-concentration-risk.ts`

**Interfaces:**
- Consumes: Task 1 `toReturns`, `pearsonCorrelation`.
- Produces:
  - `type ConcentrationPolicy = 'warn' | 'block'`
  - `type HoldingReturns = { stockCode: string; returns: number[] }`
  - `type ConcentrationAssessment = { correlated: { stockCode: string; corr: number }[]; maxCorr: number | null }`
  - `function assessConcentration(candidateReturns: number[], holdings: HoldingReturns[], threshold: number): ConcentrationAssessment` — 각 보유에 대해 **꼬리 정렬**(둘 중 짧은 길이의 마지막 L개)로 상관 계산. `corr >= threshold`인 것만 `correlated`에 담고 corr 내림차순. `maxCorr`=상관 최댓값(없으면 null).
  - `function decideConcentrationAction(a: ConcentrationAssessment, policy: ConcentrationPolicy, maxCorrelated: number): { action: 'allow' | ConcentrationPolicy; reason: string }` — `a.correlated.length >= maxCorrelated`이면 `action=policy`, 아니면 `allow`.

- [ ] **Step 1: 실패 테스트 작성** — `scripts/test-concentration-risk.ts`

```ts
import assert from 'node:assert';
import { assessConcentration, decideConcentrationAction } from '../server/services/concentration-risk';

const up = [0.01, 0.02, -0.01, 0.03, 0.00];       // 후보
const same = [0.011, 0.019, -0.012, 0.031, 0.001]; // 거의 동일(고상관)
const opp = [-0.01, -0.02, 0.01, -0.03, 0.00];     // 반대(음상관)

// assess: 고상관 보유만 임계 넘어 담김
const a1 = assessConcentration(up, [
  { stockCode: 'AAA', returns: same },
  { stockCode: 'BBB', returns: opp },
], 0.7);
assert.strictEqual(a1.correlated.length, 1, 'AAA만 고상관');
assert.strictEqual(a1.correlated[0].stockCode, 'AAA');
assert.ok((a1.maxCorr as number) > 0.9, 'maxCorr 높음');

// 꼬리 정렬: 길이 다른 series도 짧은 쪽 기준 계산
const a2 = assessConcentration(up, [{ stockCode: 'AAA', returns: [0.5, ...same] }], 0.7);
assert.strictEqual(a2.correlated.length, 1, '길이 달라도 꼬리정렬로 계산');

// decide
assert.strictEqual(decideConcentrationAction(a1, 'block', 1).action, 'block', '1개 이상 → block');
assert.strictEqual(decideConcentrationAction(a1, 'warn', 1).action, 'warn', 'policy=warn');
assert.strictEqual(decideConcentrationAction(a1, 'block', 2).action, 'allow', '2개 필요한데 1개뿐 → allow');
assert.strictEqual(decideConcentrationAction({ correlated: [], maxCorr: null }, 'block', 1).action, 'allow', '상관없음 → allow');
console.log('OK: concentration-risk');
```

- [ ] **Step 2: 실패 확인** — Run: `npx tsx scripts/test-concentration-risk.ts` → FAIL

- [ ] **Step 3: 구현** — `server/services/concentration-risk.ts`

```ts
// concentration-risk.ts — 보유 포트폴리오 대비 후보 집중(상관) 평가 (순수 함수)
import { pearsonCorrelation } from '../utils/correlation';

export type ConcentrationPolicy = 'warn' | 'block';
export type HoldingReturns = { stockCode: string; returns: number[] };
export type ConcentrationAssessment = {
  correlated: { stockCode: string; corr: number }[];
  maxCorr: number | null;
};

// 두 수익률 series를 짧은 길이의 "마지막 L개"로 맞춘다(최신 구간 정렬).
function alignTail(a: number[], b: number[]): [number[], number[]] {
  const L = Math.min(a.length, b.length);
  return [a.slice(a.length - L), b.slice(b.length - L)];
}

export function assessConcentration(
  candidateReturns: number[],
  holdings: HoldingReturns[],
  threshold: number,
): ConcentrationAssessment {
  const correlated: { stockCode: string; corr: number }[] = [];
  let maxCorr: number | null = null;
  for (const h of holdings) {
    const [x, y] = alignTail(candidateReturns, h.returns);
    const corr = pearsonCorrelation(x, y);
    if (corr === null) continue;
    if (maxCorr === null || corr > maxCorr) maxCorr = corr;
    if (corr >= threshold) correlated.push({ stockCode: h.stockCode, corr });
  }
  correlated.sort((p, q) => q.corr - p.corr);
  return { correlated, maxCorr };
}

export function decideConcentrationAction(
  a: ConcentrationAssessment,
  policy: ConcentrationPolicy,
  maxCorrelated: number,
): { action: 'allow' | ConcentrationPolicy; reason: string } {
  if (a.correlated.length >= maxCorrelated) {
    const list = a.correlated.map((c) => `${c.stockCode}(${c.corr.toFixed(2)})`).join(', ');
    return { action: policy, reason: `보유종목과 고상관 ${a.correlated.length}건: ${list}` };
  }
  return { action: 'allow', reason: '집중 위험 낮음' };
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx tsx scripts/test-concentration-risk.ts` → `OK: concentration-risk`

- [ ] **Step 5: 커밋**

```bash
git add server/services/concentration-risk.ts scripts/test-concentration-risk.ts
git commit -m "feat(ontology): 집중 평가·행동결정 순수함수 + 테스트 (집중게이트 2/5)"
```

---

### Task 3: 설정 컬럼 (additive)

**Files:**
- Modify: `shared/schema.ts` (autoTradingSettings 테이블 내부, 다른 컬럼들 사이 적당한 곳)
- Create: `migrations/0018_ontology_concentration.sql`
- Modify: `migrations/meta/_journal.json`

**Interfaces:**
- Produces: `autoTradingSettings`에 `ontologyEnabled`(bool, 기본 false), `concentrationPolicy`(text, 기본 'warn'), `concentrationThreshold`(decimal, 기본 '0.7'), `maxCorrelatedPositions`(int, 기본 1).

- [ ] **Step 1: 스키마 컬럼 추가** — `shared/schema.ts` (autoTradingSettings의 `enableDynamicExit` 인근에 추가)

```ts
  // 온톨로지: 집중 리스크 게이트 (기본 OFF — 켜기 전 기존 동작과 100% 동일)
  ontologyEnabled: boolean("ontology_enabled").notNull().default(false),
  concentrationPolicy: text("concentration_policy").notNull().default('warn'), // 'warn' | 'block'
  concentrationThreshold: decimal("concentration_threshold", { precision: 4, scale: 2 }).notNull().default('0.70'),
  maxCorrelatedPositions: integer("max_correlated_positions").notNull().default(1),
```

- [ ] **Step 2: 마이그레이션 SQL** — `migrations/0018_ontology_concentration.sql`

```sql
-- 온톨로지 1차: 집중 리스크 게이트 설정 (additive, 기본 OFF)
ALTER TABLE "auto_trading_settings" ADD COLUMN IF NOT EXISTS "ontology_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "auto_trading_settings" ADD COLUMN IF NOT EXISTS "concentration_policy" text NOT NULL DEFAULT 'warn';
ALTER TABLE "auto_trading_settings" ADD COLUMN IF NOT EXISTS "concentration_threshold" numeric(4,2) NOT NULL DEFAULT 0.70;
ALTER TABLE "auto_trading_settings" ADD COLUMN IF NOT EXISTS "max_correlated_positions" integer NOT NULL DEFAULT 1;
```

- [ ] **Step 3: 저널 항목 추가** — `migrations/meta/_journal.json`의 `entries` 배열 끝(idx 17 뒤)에 추가

```json
,
    {
      "idx": 18,
      "version": "7",
      "when": 1753660800000,
      "tag": "0018_ontology_concentration",
      "breakpoints": true
    }
```

- [ ] **Step 4: 타입체크 + 마이그레이션 적용**

Run: `npx tsc --noEmit` → PASS
Run: `npx tsx scripts/migrate.ts` → `0018_ontology_concentration` 적용(에러 없음)

- [ ] **Step 5: 커밋**

```bash
git add shared/schema.ts migrations/0018_ontology_concentration.sql migrations/meta/_journal.json
git commit -m "feat(ontology): 집중게이트 설정 컬럼 (기본 OFF, 집중게이트 3/5)"
```

---

### Task 4: 티어 게이트 (프리미엄 전용)

**Files:**
- Modify: `server/services/tier-limits.service.ts`

**Interfaces:**
- Produces: `checkOntologyAllowed(userId: string): Promise<boolean>` — pro/enterprise(및 Private=enterprise)만 true.

- [ ] **Step 1: TIER_LIMITS에 ontology 플래그 추가** — `tier-limits.service.ts:5-10` 각 티어에 `ontology` 추가

```ts
export const TIER_LIMITS = {
  free:             { maxRealAccounts: 0, maxAiAnalysisPerDay: 0,   canAutoApply: false, ontology: false },
  saas_basic:       { maxRealAccounts: 1, maxAiAnalysisPerDay: 10,  canAutoApply: false, ontology: false },
  saas_pro:         { maxRealAccounts: 2, maxAiAnalysisPerDay: 50,  canAutoApply: true,  ontology: true  },
  saas_enterprise:  { maxRealAccounts: 5, maxAiAnalysisPerDay: 300, canAutoApply: true,  ontology: true  },
} as const;
```

- [ ] **Step 2: checkOntologyAllowed 추가** — `checkAutoApplyAllowed` 바로 아래

```ts
// 온톨로지(집중게이트 등) 사용 허용 여부 — 프리미엄 티어 전용
export async function checkOntologyAllowed(userId: string): Promise<boolean> {
  const tier = await getUserTier(userId);
  return getLimits(tier).ontology;
}
```

- [ ] **Step 3: 타입체크** — Run: `npx tsc --noEmit` → PASS

- [ ] **Step 4: 커밋**

```bash
git add server/services/tier-limits.service.ts
git commit -m "feat(ontology): 프리미엄 티어 게이트 checkOntologyAllowed (집중게이트 4/5)"
```

---

### Task 5: 매수 게이트 훅 (비파괴 삽입)

**Files:**
- Modify: `server/services/trade-executor.service.ts` (import 추가 + `runConcentrationGate` private 메서드 추가 + `evaluateCandidateStock` 매수 실행 직전 훅 1곳)

**Interfaces:**
- Consumes: Task 1/2 순수함수, Task 4 `checkOntologyAllowed`, `settings`(Task 3 컬럼), `normalizeChartDataAsc`, `kiwoomService.getStockChart`.
- Produces:
  - `private async runConcentrationGate(candidateCode: string, holdings: { stockCode: string }[], settings: AutoTradingSettings, kiwoomService: KiwoomService): Promise<{ action: 'allow' | 'warn' | 'block'; reason: string }>` — 후보·보유 일봉 종가로 수익률 상관 계산 → 행동 결정. **어떤 예외/부족이든 `{action:'allow'}`(fail-open)**.

- [ ] **Step 1: import 추가** — `trade-executor.service.ts` 상단(`normalizeChartDataAsc` import 인근)

```ts
import { toReturns } from '../utils/correlation';
import { assessConcentration, decideConcentrationAction, type ConcentrationPolicy } from './concentration-risk';
import { checkOntologyAllowed } from './tier-limits.service';
```

- [ ] **Step 2: private 메서드 추가** — `evaluateCandidateStock` 메서드 근처(클래스 내부)

```ts
  // 온톨로지 집중리스크 게이트 — 후보가 보유종목과 고상관이면 정책(warn/block) 반환.
  // 결정적(가격상관)·fail-open(어떤 실패든 allow)·비파괴(판단만, 실행경로 무변경).
  private async runConcentrationGate(
    candidateCode: string,
    holdings: { stockCode: string }[],
    settings: AutoTradingSettings,
    kiwoomService: KiwoomService,
  ): Promise<{ action: 'allow' | 'warn' | 'block'; reason: string }> {
    try {
      if (!holdings.length) return { action: 'allow', reason: '보유 없음' };
      const threshold = parseFloat(String(settings.concentrationThreshold ?? '0.7'));
      const maxCorrelated = parseInt(String(settings.maxCorrelatedPositions ?? '1'), 10);
      const policy = (settings.concentrationPolicy === 'block' ? 'block' : 'warn') as ConcentrationPolicy;

      const closesOf = async (code: string): Promise<number[]> => {
        const chart = await kiwoomService.getStockChart(code, 'D', 30);
        return normalizeChartDataAsc(chart.output || chart).map((r) => r.close);
      };
      const candReturns = toReturns(await closesOf(candidateCode));
      if (candReturns.length < 5) return { action: 'allow', reason: '후보 데이터 부족' };

      const holdingReturns: { stockCode: string; returns: number[] }[] = [];
      for (const h of holdings) {
        if (h.stockCode === candidateCode) continue;
        try {
          const r = toReturns(await closesOf(h.stockCode));
          if (r.length >= 5) holdingReturns.push({ stockCode: h.stockCode, returns: r });
        } catch { /* 개별 보유 실패는 무시 */ }
      }
      if (!holdingReturns.length) return { action: 'allow', reason: '비교 가능한 보유 없음' };

      const assessment = assessConcentration(candReturns, holdingReturns, threshold);
      return decideConcentrationAction(assessment, policy, maxCorrelated);
    } catch (e) {
      console.warn('[ConcentrationGate] 실패 — fail-open(allow):', e);
      return { action: 'allow', reason: 'gate 예외 → fail-open' };
    }
  }
```

- [ ] **Step 3: 매수 직전 훅 삽입** — `evaluateCandidateStock`에서 **기존 모든 게이트를 통과해 `executeBuy`/`executeAdditionalBuy`를 호출하기 직전**에 아래를 추가한다. (기존 코드 라인은 삭제/수정하지 않고 그 앞에 삽입.)

```ts
      // ── 온톨로지 집중리스크 게이트 (토글 OFF 기본 + 프리미엄 티어 전용 + fail-open) ──
      if (settings.ontologyEnabled && await checkOntologyAllowed(model.userId)) {
        const holdingsForGate = await storage.getHoldings(activeAccount.id);
        const gate = await this.runConcentrationGate(candidate.stockCode, holdingsForGate, settings, kiwoomService);
        if (gate.action === 'block') {
          await logDecision({
            accepted: false,
            decisionType: 'concentration_blocked',
            skipReason: 'concentration_blocked',
            qualitativeReason: `집중 리스크 차단 — ${gate.reason}`,
          });
          return; // 매수 스킵
        }
        if (gate.action === 'warn') {
          console.log(`  ⚠️ [집중게이트] ${candidate.stockCode} 경고(매수 진행): ${gate.reason}`);
        }
      }
```
주의: `logDecision`의 인자 형태는 이 메서드 내 기존 `logDecision({...})` 호출들과 동일 필드를 사용한다(파일에서 실제 시그니처 확인 후 필드명 맞출 것 — 위 `accepted/decisionType/skipReason/qualitativeReason`은 기존 호출 패턴 기준). `candidate`·`activeAccount`·`kiwoomService`·`model`·`settings`는 이 메서드 스코프에 이미 존재하는 변수다.

- [ ] **Step 4: 타입체크 + 회귀**

Run: `npx tsc --noEmit` → PASS (새 오류 없음)
Run: `npx tsx scripts/test-correlation.ts && npx tsx scripts/test-concentration-risk.ts` → 둘 다 OK
서버 재시작(PowerShell): `schtasks /End /TN "TradeBot-Server"` → 3초 → `schtasks /Run /TN "TradeBot-Server"`
확인: `ontology_enabled=false`(기본)이므로 훅은 **동작하지 않아야 함** → 기존 매매 사이클 로그가 이전과 동일(집중게이트 로그 없음).

- [ ] **Step 5: 커밋**

```bash
git add server/services/trade-executor.service.ts
git commit -m "feat(ontology): 매수 집중리스크 게이트 훅 (비파괴·토글OFF·fail-open, 집중게이트 5/5)"
```

---

## Self-Review 결과

- **Spec 커버리지:** 비파괴(토글 OFF·훅만·fail-open)=Task 5 + Global Constraints. 프리미엄 티어=Task 4. 집중게이트(가격상관 결정적)=Task 1·2·5. 설정=Task 3. forward-shadow A/B=별도 코드 불필요(시뮬 모델의 `ontologyEnabled`를 켜고 끄면 동일 `evaluateCandidateStock` 경로로 자동 반영 — 스펙 §4 검증은 sim 모델 설정 토글로 수행).
- **비목표 준수:** 실계좌 자동적용·외부데이터·기존로직 변경 없음. 'reduce' 정책은 이번 제외(warn/block만).
- **타입 일관성:** `toReturns`/`pearsonCorrelation`(T1), `assessConcentration`/`decideConcentrationAction`/`ConcentrationPolicy`/`HoldingReturns`(T2), 설정 4컬럼(T3), `checkOntologyAllowed`(T4), `runConcentrationGate`(T5) — 정의부/사용부 이름·타입 일치.
- **알려진 주의:** Task 5 Step 3의 `logDecision` 필드는 파일 내 기존 호출과 정확히 맞춰야 함(구현자가 실제 시그니처 확인). 게이트가 매수 사이클당 보유종목 수만큼 차트를 추가 조회하므로(키움 읽기, AI 아님) 지연은 작지만, 토글 OFF 기본이라 평소엔 0.
