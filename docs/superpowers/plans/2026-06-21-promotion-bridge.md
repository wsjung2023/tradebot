# 승격 브리지 구현 계획 (Track 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 섀도우 시뮬에서 설정 변종 여러 개를 동시에 겨루고, 1등 설정을 "검증된 설정"으로 보관하는 승격 브리지를 만든다.

**Architecture:** 순수 함수 2개(변종 생성·채점)는 `tsx` 단독 테스트로 TDD한다. DB/오케스트레이션은 기존 `SimulationService`를 확장해 변종별 섀도우 sim 모델을 만들고 누적 실행한다. 1등은 신규 `proven_settings` 테이블에 보관만 하며 어떤 운영 모델에도 자동 적용하지 않는다.

**Tech Stack:** TypeScript, Express, Drizzle ORM(PostgreSQL), tsx, Playwright(스모크).

## Global Constraints

- 섀도우 경로만 사용 — 실주문 0건, 실계좌·모의투자 운영 모델 무영향. (`ShadowKiwoomService`가 주문/잔고를 가로챔)
- 승격은 **보관까지만**. 운영 모델/진짜 계좌에 자동 write-back 금지.
- 시뮬 거래는 `simulated=true`로 실거래 학습과 분리(기존 보장 유지).
- 이 프로젝트엔 단위 테스트 프레임워크가 없다. 순수 함수는 `tsx scripts/test-*.ts` + `node:assert`로 검증한다(기존 `scripts/test-chart-normalization.ts` 패턴).
- DB 스키마 변경 시 migration SQL 파일 + `migrations/meta/_journal.json` 둘 다 업데이트(CLAUDE.md 규칙).
- 서버 코드 수정 후 재시작 필요(tsx 자동재시작 안 함). 재시작은 PowerShell Task Scheduler 경유.
- 변형 손잡이 4개(확정): `minAiConfidence`, `defaultPositionSize`, `stalePeriodDays`, `surgeThreshold`.
- 변종 개수 기본 5개(챔피언 1 + 도전자 4), 상수화해 조정 가능.

---

## File Structure

- Create: `server/services/variant-generator.ts` — 순수 함수. 베이스 설정 + 개수 → 변종 오버라이드 목록.
- Create: `server/services/race-scoring.ts` — 순수 함수. perf row → 변종 점수, 점수 목록 → 1등.
- Modify: `server/services/simulation.service.ts` — 변종별 sim 모델 생성, 사이클 코어 추출, `runRaceCycle`, `settleRace`.
- Modify: `shared/schema.ts` — `provenSettings` 테이블 + insert 스키마 + 타입.
- Create: `migrations/0017_proven_settings.sql` — 테이블 생성 DDL.
- Modify: `migrations/meta/_journal.json` — idx 17 항목 추가.
- Modify: `server/storage/interface.ts` — `createProvenSettings`, `getProvenSettings` 시그니처.
- Modify: `server/storage/postgres.storage.ts` — 위 두 메서드 구현.
- Modify: `server/routes/autotrading.routes.ts` — `POST /api/auto-trading/simulation/race/run`, `POST /api/auto-trading/simulation/race/settle`.
- Create: `scripts/test-variant-generator.ts` — Task 1 테스트.
- Create: `scripts/test-race-scoring.ts` — Task 3 테스트.
- Create: `scripts/race-smoke.mjs` — 엔드포인트·안전 스모크(staging).

---

### Task 1: 변종 생성기 (순수 함수)

**Files:**
- Create: `server/services/variant-generator.ts`
- Test: `scripts/test-variant-generator.ts`

**Interfaces:**
- Produces:
  - `type VariantOverride = { minAiConfidence?: string; defaultPositionSize?: string; stalePeriodDays?: number; surgeThreshold?: string }`
  - `type Variant = { variantId: number; label: string; overrides: VariantOverride }`
  - `function generateVariants(base: VariantOverride, count?: number): Variant[]`
  - 규칙: `variantId=0`은 챔피언(빈 overrides, label `'champion'`). 도전자는 손잡이 하나씩만 변형. `count` 기본 5, 범위 1~5(초과 요청 시 5로 클램프).

- [ ] **Step 1: 실패하는 테스트 작성** — `scripts/test-variant-generator.ts`

```ts
import assert from 'node:assert';
import { generateVariants } from '../server/services/variant-generator';

const base = { minAiConfidence: '70', defaultPositionSize: '1000000', stalePeriodDays: 5, surgeThreshold: '10' };

// 1) 기본 개수 5, 챔피언이 첫 변종
const v = generateVariants(base);
assert.strictEqual(v.length, 5, '기본 5개');
assert.strictEqual(v[0].variantId, 0);
assert.strictEqual(v[0].label, 'champion');
assert.deepStrictEqual(v[0].overrides, {}, '챔피언은 변형 없음');

// 2) 각 도전자는 손잡이 정확히 1개만 변형
for (let i = 1; i < v.length; i++) {
  const keys = Object.keys(v[i].overrides);
  assert.strictEqual(keys.length, 1, `도전자 ${i}는 손잡이 1개만`);
}

// 3) 4개 손잡이가 도전자들에 모두 1번씩 등장
const touched = new Set(v.slice(1).flatMap((x) => Object.keys(x.overrides)));
assert.deepStrictEqual([...touched].sort(), ['defaultPositionSize', 'minAiConfidence', 'stalePeriodDays', 'surgeThreshold']);

// 4) 결정적(deterministic): 같은 입력 → 같은 출력
assert.deepStrictEqual(generateVariants(base), generateVariants(base), '결정적');

// 5) count 클램프
assert.strictEqual(generateVariants(base, 99).length, 5, '5 초과는 5로 클램프');
assert.strictEqual(generateVariants(base, 1).length, 1, 'count=1이면 챔피언만');

console.log('OK: variant-generator');
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx scripts/test-variant-generator.ts`
Expected: FAIL — `Cannot find module '../server/services/variant-generator'`

- [ ] **Step 3: 최소 구현** — `server/services/variant-generator.ts`

```ts
// variant-generator.ts — 챔피언 설정에서 손잡이 하나씩만 바꾼 변종 목록 생성 (순수 함수, Track 1)
export type VariantOverride = {
  minAiConfidence?: string;
  defaultPositionSize?: string;
  stalePeriodDays?: number;
  surgeThreshold?: string;
};

export type Variant = { variantId: number; label: string; overrides: VariantOverride };

// 베이스 값에서 한 단계 변형한 도전자 정의(결정적). 순서 고정.
function challengers(base: VariantOverride): { label: string; overrides: VariantOverride }[] {
  const conf = Number(base.minAiConfidence ?? '70');
  const pos = Number(base.defaultPositionSize ?? '1000000');
  const stale = Number(base.stalePeriodDays ?? 5);
  const surge = Number(base.surgeThreshold ?? '10');
  return [
    { label: 'looser-confidence', overrides: { minAiConfidence: String(Math.max(0, conf - 5)) } },
    { label: 'smaller-size', overrides: { defaultPositionSize: String(Math.round(pos * 0.7)) } },
    { label: 'shorter-hold', overrides: { stalePeriodDays: Math.max(1, stale - 2) } },
    { label: 'lower-surge', overrides: { surgeThreshold: String(Math.max(0, surge - 3)) } },
  ];
}

export function generateVariants(base: VariantOverride, count = 5): Variant[] {
  const clamped = Math.max(1, Math.min(5, Math.floor(count)));
  const out: Variant[] = [{ variantId: 0, label: 'champion', overrides: {} }];
  for (const c of challengers(base)) {
    if (out.length >= clamped) break;
    out.push({ variantId: out.length, label: c.label, overrides: c.overrides });
  }
  return out;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx scripts/test-variant-generator.ts`
Expected: PASS — `OK: variant-generator`

- [ ] **Step 5: 커밋**

```bash
git add server/services/variant-generator.ts scripts/test-variant-generator.ts
git commit -m "feat(Track 1): 변종 생성기 + 테스트 (승격 브리지 1/6)"
```

---

### Task 2: 채점·1등 선정 (순수 함수)

**Files:**
- Create: `server/services/race-scoring.ts`
- Test: `scripts/test-race-scoring.ts`

**Interfaces:**
- Consumes: `TradingPerformance` 형태 row 중 `profitLossRate: string|null`, `isWin: boolean|null`.
- Produces:
  - `type VariantScore = { trades: number; winRate: number; sumPlRate: number; score: number }`
  - `function scorePerf(rows: { profitLossRate: string | null; isWin: boolean | null }[]): VariantScore`
    - `trades` = `isWin`이 null이 아닌(=청산 완료) row 수. `sumPlRate` = profitLossRate 합. `winRate` = isWin true 비율(0~1). `score = sumPlRate + winRate * 10`.
  - `function pickWinner<T extends { score: VariantScore }>(items: T[], minTrades: number): T | null`
    - `score.trades >= minTrades`인 항목 중 `score.score` 최대. 없으면 null.

- [ ] **Step 1: 실패하는 테스트 작성** — `scripts/test-race-scoring.ts`

```ts
import assert from 'node:assert';
import { scorePerf, pickWinner } from '../server/services/race-scoring';

// scorePerf: 미청산(isWin=null)은 trades에서 제외
const s = scorePerf([
  { profitLossRate: '5', isWin: true },
  { profitLossRate: '-2', isWin: false },
  { profitLossRate: null, isWin: null }, // 미청산 → 제외
]);
assert.strictEqual(s.trades, 2, '청산 완료 2건');
assert.strictEqual(s.sumPlRate, 3, '5 + (-2)');
assert.strictEqual(s.winRate, 0.5, '1/2');
assert.strictEqual(s.score, 3 + 0.5 * 10);

// pickWinner: 최소 거래 수 미달은 제외
const a = { id: 'a', score: scorePerf([{ profitLossRate: '20', isWin: true }]) };          // trades=1
const b = { id: 'b', score: scorePerf([{ profitLossRate: '3', isWin: true }, { profitLossRate: '4', isWin: true }]) }; // trades=2
assert.strictEqual(pickWinner([a, b], 2)?.id, 'b', '최소 2건 충족한 b');
assert.strictEqual(pickWinner([a], 2), null, '아무도 최소 미달 → null');

console.log('OK: race-scoring');
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx scripts/test-race-scoring.ts`
Expected: FAIL — module 없음.

- [ ] **Step 3: 최소 구현** — `server/services/race-scoring.ts`

```ts
// race-scoring.ts — 변종 시뮬 성과 채점 + 1등 선정 (순수 함수, Track 1)
export type VariantScore = { trades: number; winRate: number; sumPlRate: number; score: number };

export function scorePerf(rows: { profitLossRate: string | null; isWin: boolean | null }[]): VariantScore {
  const closed = rows.filter((r) => r.isWin !== null && r.isWin !== undefined);
  const trades = closed.length;
  const sumPlRate = closed.reduce((acc, r) => acc + Number(r.profitLossRate ?? '0'), 0);
  const wins = closed.filter((r) => r.isWin === true).length;
  const winRate = trades === 0 ? 0 : wins / trades;
  return { trades, winRate, sumPlRate, score: sumPlRate + winRate * 10 };
}

export function pickWinner<T extends { score: VariantScore }>(items: T[], minTrades: number): T | null {
  const eligible = items.filter((it) => it.score.trades >= minTrades);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, it) => (it.score.score > best.score.score ? it : best));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx scripts/test-race-scoring.ts`
Expected: PASS — `OK: race-scoring`

- [ ] **Step 5: 커밋**

```bash
git add server/services/race-scoring.ts scripts/test-race-scoring.ts
git commit -m "feat(Track 1): 채점·1등 선정 순수함수 + 테스트 (승격 브리지 2/6)"
```

---

### Task 3: proven_settings 테이블 + 스토리지

**Files:**
- Modify: `shared/schema.ts` (autoTradingSettings 블록 뒤, 적당한 위치)
- Create: `migrations/0017_proven_settings.sql`
- Modify: `migrations/meta/_journal.json`
- Modify: `server/storage/interface.ts`
- Modify: `server/storage/postgres.storage.ts`

**Interfaces:**
- Produces:
  - `provenSettings` 테이블, 타입 `ProvenSetting`, `InsertProvenSetting`.
  - `storage.createProvenSettings(row: InsertProvenSetting): Promise<ProvenSetting>`
  - `storage.getProvenSettings(userId: string): Promise<ProvenSetting[]>` (최신순)

- [ ] **Step 1: 스키마 테이블 추가** — `shared/schema.ts` (`autoTradingSettings` 정의 바로 뒤에 추가)

```ts
// 승격 브리지(Track 1): 시합에서 1등한 검증된 설정 보관소. 어떤 운영 모델에도 자동 적용하지 않음.
export const provenSettings = pgTable("proven_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  sourceModelId: integer("source_model_id").notNull(), // 시합의 챔피언(원본) 모델
  variantLabel: text("variant_label").notNull(),        // 1등 변종 라벨
  settings: jsonb("settings").notNull(),                // 1등 변종의 settings 오버라이드 + 베이스 병합 결과
  score: jsonb("score").notNull(),                      // VariantScore 스냅샷
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProvenSettingsSchema = createInsertSchema(provenSettings).omit({ id: true, createdAt: true });
export type ProvenSetting = typeof provenSettings.$inferSelect;
export type InsertProvenSetting = z.infer<typeof insertProvenSettingsSchema>;
```

- [ ] **Step 2: 마이그레이션 SQL 작성** — `migrations/0017_proven_settings.sql`

```sql
-- 승격 브리지(Track 1): 시합 1등 설정 보관소
CREATE TABLE IF NOT EXISTS "proven_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "source_model_id" integer NOT NULL,
  "variant_label" text NOT NULL,
  "settings" jsonb NOT NULL,
  "score" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
```

- [ ] **Step 3: 저널 항목 추가** — `migrations/meta/_journal.json`의 `entries` 배열 끝(idx 16 항목 뒤)에 추가

```json
,
    {
      "idx": 17,
      "version": "7",
      "when": 1750550400000,
      "tag": "0017_proven_settings",
      "breakpoints": true
    }
```

- [ ] **Step 4: 인터페이스 시그니처 추가** — `server/storage/interface.ts`

`getAutoTradingSettings`/`createAutoTradingSettings` 시그니처(165~166줄) 부근에 추가:
```ts
  createProvenSettings(row: InsertProvenSetting): Promise<ProvenSetting>;
  getProvenSettings(userId: string): Promise<ProvenSetting[]>;
```
그리고 파일 상단 타입 import 블록(`type TradingPerformance, ...` 인근)에 추가:
```ts
  type ProvenSetting, type InsertProvenSetting,
```

- [ ] **Step 5: 스토리지 구현** — `server/storage/postgres.storage.ts` (Trading Performance 메서드 블록 뒤에 추가)

```ts
  // ==================== Proven Settings (승격 브리지) ====================

  async createProvenSettings(row: InsertProvenSetting): Promise<ProvenSetting> {
    const result = await db.insert(schema.provenSettings).values([row]).returning();
    return result[0];
  }

  async getProvenSettings(userId: string): Promise<ProvenSetting[]> {
    return db.select().from(schema.provenSettings)
      .where(eq(schema.provenSettings.userId, userId))
      .orderBy(desc(schema.provenSettings.createdAt));
  }
```
파일 상단 타입 import에 `ProvenSetting, InsertProvenSetting`이 포함되도록 확인(`@shared/schema`에서 import).

- [ ] **Step 6: 타입 체크**

Run: `npx tsc --noEmit`
Expected: PASS — proven_settings 관련 타입 오류 없음. (기존 무관한 오류가 있으면 이 변경으로 새로 생긴 것만 해결)

- [ ] **Step 7: 마이그레이션 적용 + 커밋**

Run: `npx tsx scripts/migrate.ts` (로컬 dev DB)
Expected: `0017_proven_settings` 적용 로그, 에러 없음.

```bash
git add shared/schema.ts migrations/0017_proven_settings.sql migrations/meta/_journal.json server/storage/interface.ts server/storage/postgres.storage.ts
git commit -m "feat(Track 1): proven_settings 테이블 + 스토리지 (승격 브리지 3/6)"
```

---

### Task 4: SimulationService — 변종별 sim 모델 + 사이클 코어 추출

**Files:**
- Modify: `server/services/simulation.service.ts`

**Interfaces:**
- Consumes: Task 1 `generateVariants`, `Variant`, `VariantOverride`.
- Produces:
  - `ensureSimModelForVariant(sourceModel: AiModel, simAccountId: number, variant: Variant): Promise<AiModel>`
    - sim 모델을 `(sourceModelId, variantId)`로 구분 재사용. config에 `variantId`, `variantLabel` 기록. settings 생성 시 `variant.overrides`를 베이스(source settings 복제)에 병합.
  - `private runCycleForSimModel(simModel: AiModel, sourceModel: AiModel, shadowCtx): Promise<number>` — 한 sim 모델에 대해 scaleIn/exits/후보평가 실행, 평가 건수 반환. (기존 `runSimCycle` 본문에서 추출, 단일 실행과 변종 시합이 공유)

**참고:** 기존 `runSimCycle`은 동작 유지(회귀). 내부만 `runCycleForSimModel` 호출하도록 리팩터.

- [ ] **Step 1: `ensureSimModelForVariant` 추가** — `ensureSimModel` 메서드 바로 아래에 추가

```ts
  // 변종별 시뮬 모델 확보 — (sourceModelId, variantId)로 재사용. overrides를 settings에 병합.
  async ensureSimModelForVariant(
    sourceModel: AiModel,
    simAccountId: number,
    variant: { variantId: number; label: string; overrides: Record<string, unknown> },
  ): Promise<AiModel> {
    const models = await storage.getAiModels(sourceModel.userId);
    const existing = models.find(
      (m) =>
        (m.config as any)?.isSimulation === true &&
        (m.config as any)?.sourceModelId === sourceModel.id &&
        (m.config as any)?.variantId === variant.variantId,
    );
    if (existing) return existing;

    const sourceConfig = (sourceModel.config as any) || {};
    const simModel = await storage.createAiModel({
      userId: sourceModel.userId,
      modelName: `[SIM v${variant.variantId}] ${sourceModel.modelName}`,
      modelType: sourceModel.modelType as 'momentum' | 'value' | 'technical' | 'custom',
      description: `전방 섀도우 변종 #${variant.variantId}(${variant.label}) — 원본 #${sourceModel.id}`,
      config: {
        ...sourceConfig,
        accountId: simAccountId,
        isSimulation: true,
        sourceModelId: sourceModel.id,
        simSource: 'forward_shadow',
        variantId: variant.variantId,
        variantLabel: variant.label,
      },
      isActive: false,
    });

    // 원본 settings 복제 후 변종 오버라이드 병합.
    // 운영 모델엔 항상 settings가 존재하므로 도전자는 이 경로를 탄다.
    // settings가 없는 예외 케이스는 챔피언(overrides 비어 있음)에서만 가능하므로 기본 생성으로 충분.
    const srcSettings = await storage.getAutoTradingSettings(sourceModel.id);
    if (srcSettings) {
      const { id, modelId, createdAt, updatedAt, ...rest } = srcSettings as any;
      await storage.createAutoTradingSettings({ ...rest, ...variant.overrides, modelId: simModel.id });
    } else {
      await this.executor.createDefaultSettings(simModel.id, sourceModel.modelType);
    }
    return simModel;
  }
```

- [ ] **Step 2: 사이클 코어 추출 + 기존 `runSimCycle` 리팩터**

기존 `runSimCycle`의 "1) scaleIn / 2) exits / 3) 후보평가" 블록(파일 113~141줄 상당)을 아래 private 메서드로 추출하고, `runSimCycle`은 이를 호출하게 바꾼다. **외부 동작·반환 형태는 그대로 유지**.

```ts
  // 한 sim 모델에 대해 한 사이클 실행(스케일인/청산/후보평가). 평가 건수 반환.
  private async runCycleForSimModel(
    simModel: AiModel,
    sourceModel: AiModel,
    shadow: ShadowKiwoomService,
    simSettings: AutoTradingSettings,
  ): Promise<number> {
    const aiModelName = 'gpt-5-mini';
    try {
      await this.executor.checkHoldingsForScaleIn(simModel, simSettings, shadow, this.aiService, aiModelName);
    } catch (e) { console.warn('[Sim] scaleIn 오류(무시):', e); }
    try {
      await this.executor.checkPositionsForExits(simModel, simSettings, shadow, this.aiService, aiModelName);
    } catch (e) { console.warn('[Sim] exits 오류(무시):', e); }

    const rawCandidates = await storage.getCandidateStocks(sourceModel.userId, sourceModel.id);
    const freshMs = 60 * 60 * 1000;
    const now = Date.now();
    const candidates = rawCandidates.filter((c: any) => {
      const t = c.scannedAt ? new Date(c.scannedAt).getTime() : 0;
      return Number.isFinite(t) && now - t <= freshMs;
    });
    let evaluated = 0;
    for (const candidate of candidates) {
      try {
        await this.executor.evaluateCandidateStock(simModel, simSettings, candidate, shadow, this.aiService, aiModelName);
        evaluated++;
      } catch (e) { console.warn('[Sim] evaluate 오류(무시):', e); }
    }
    return evaluated;
  }
```

`runSimCycle` 본문의 해당 블록을 다음으로 교체(앞부분 검증/sim 모델 확보/simRunId 기록/shadow 생성은 그대로 둠):
```ts
    const evaluated = await this.runCycleForSimModel(simModelForRun, sourceModel, shadow, simSettings);
    return { ok: true, simModelId: simModel.id, evaluated };
```
(`AutoTradingSettings` 타입 import가 없으면 상단 `import type { AiModel, KiwoomAccount } from '@shared/schema';`에 `AutoTradingSettings` 추가)

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: PASS (이 변경으로 새 오류 없음).

- [ ] **Step 4: 기존 단일 sim 회귀 스모크**

서버 재시작(PowerShell): `schtasks /End /TN "TradeBot-Server"` → 3초 → `schtasks /Run /TN "TradeBot-Server"`
Run: `node scripts/sim-smoke.mjs`
Expected: 기존과 동일 — 엔드포인트 200 또는 안전 reason, 실주문 0건. 회귀 없음.

- [ ] **Step 5: 커밋**

```bash
git add server/services/simulation.service.ts
git commit -m "feat(Track 1): 변종별 sim 모델 + 사이클 코어 추출 (승격 브리지 4/6)"
```

---

### Task 5: 시합 실행·정산 오케스트레이션

**Files:**
- Modify: `server/services/simulation.service.ts`

**Interfaces:**
- Consumes: Task 1 `generateVariants`, Task 2 `scorePerf`/`pickWinner`, Task 3 `storage.createProvenSettings`, Task 4 `ensureSimModelForVariant`/`runCycleForSimModel`.
- Produces:
  - `runRaceCycle(sourceModelId: number, count?: number): Promise<{ ok: boolean; reason?: string; variants?: { variantId: number; simModelId: number; label: string; evaluated: number }[] }>`
    - 변종 생성 → 각 변종 sim 모델 확보 → 각자 한 사이클 실행. 반복 호출로 성과 누적.
  - `settleRace(sourceModelId: number, minTrades?: number): Promise<{ ok: boolean; reason?: string; winner?: { variantId: number; label: string; score: unknown }; provenId?: number }>`
    - 변종 sim 모델들의 perf를 채점 → 1등 선정 → `proven_settings`에 보관. 1등 없으면 `{ ok:false, reason:'no eligible variant' }`.

- [ ] **Step 1: `runRaceCycle` 구현** — SimulationService에 추가

```ts
  // 시합 한 사이클 — 변종들을 각각 섀도우로 한 번씩 돌린다(반복 호출로 누적).
  async runRaceCycle(sourceModelId: number, count = 5): Promise<{
    ok: boolean; reason?: string;
    variants?: { variantId: number; simModelId: number; label: string; evaluated: number }[];
  }> {
    const sourceModel = await storage.getAiModel(sourceModelId);
    if (!sourceModel) return { ok: false, reason: 'source model not found' };
    const sourceConfig = (sourceModel.config as any) || {};
    if (sourceConfig.isSimulation) return { ok: false, reason: 'source is already a sim model' };
    const sourceAccountId = sourceConfig.accountId;
    if (!sourceAccountId) return { ok: false, reason: 'source model has no accountId' };
    const accounts = await storage.getKiwoomAccounts(sourceModel.userId);
    const sourceAccount = accounts.find((a) => a.id === sourceAccountId);
    if (!sourceAccount) return { ok: false, reason: 'source account not found' };
    const appKey = this.decryptKey(sourceAccount.kiwoomAppKey);
    const appSecret = this.decryptKey(sourceAccount.kiwoomAppSecret);
    if (!appKey || !appSecret) return { ok: false, reason: 'source account missing kiwoom keys' };

    const simAccount = await this.ensureSimAccount(sourceModel.userId, sourceAccount);
    const baseSettings = await storage.getAutoTradingSettings(sourceModelId);
    const base = {
      minAiConfidence: baseSettings?.minAiConfidence ?? undefined,
      defaultPositionSize: baseSettings?.defaultPositionSize ?? undefined,
      stalePeriodDays: baseSettings?.stalePeriodDays ?? undefined,
      surgeThreshold: baseSettings?.surgeThreshold ?? undefined,
    } as any;
    const variants = generateVariants(base, count);

    const shadow = new ShadowKiwoomService(
      { appKey, appSecret, accountType: simAccount.accountType === 'real' ? 'real' : 'mock' },
      { simAccountId: simAccount.id },
    );

    const out: { variantId: number; simModelId: number; label: string; evaluated: number }[] = [];
    for (const variant of variants) {
      const simModel = await this.ensureSimModelForVariant(sourceModel, simAccount.id, variant);
      const simSettings = await storage.getAutoTradingSettings(simModel.id);
      if (!simSettings) continue;
      const evaluated = await this.runCycleForSimModel(simModel, sourceModel, shadow, simSettings);
      out.push({ variantId: variant.variantId, simModelId: simModel.id, label: variant.label, evaluated });
    }
    return { ok: true, variants: out };
  }
```

- [ ] **Step 2: `settleRace` 구현** — SimulationService에 추가

```ts
  // 시합 정산 — 변종 sim 모델들을 채점해 1등을 proven_settings에 보관(자동 적용 없음).
  async settleRace(sourceModelId: number, minTrades = 3): Promise<{
    ok: boolean; reason?: string;
    winner?: { variantId: number; label: string; score: unknown }; provenId?: number;
  }> {
    const sourceModel = await storage.getAiModel(sourceModelId);
    if (!sourceModel) return { ok: false, reason: 'source model not found' };
    const models = await storage.getAiModels(sourceModel.userId);
    const variantModels = models.filter(
      (m) => (m.config as any)?.isSimulation === true && (m.config as any)?.sourceModelId === sourceModelId &&
        (m.config as any)?.variantId !== undefined,
    );
    if (variantModels.length === 0) return { ok: false, reason: 'no variant sim models — run race first' };

    const scored = [] as { model: typeof variantModels[number]; score: ReturnType<typeof scorePerf>; settings: any }[];
    for (const m of variantModels) {
      const perf = await storage.getTradingPerformance(m.id, 1000);
      const simPerf = perf.filter((p) => p.simulated === true);
      const settings = await storage.getAutoTradingSettings(m.id);
      scored.push({ model: m, score: scorePerf(simPerf), settings });
    }
    const winner = pickWinner(scored, minTrades);
    if (!winner) return { ok: false, reason: 'no eligible variant (min trades not met)' };

    const wConfig = (winner.model.config as any) || {};
    const proven = await storage.createProvenSettings({
      userId: sourceModel.userId,
      sourceModelId,
      variantLabel: wConfig.variantLabel ?? `v${wConfig.variantId}`,
      settings: winner.settings ?? {},
      score: winner.score,
    });
    return {
      ok: true,
      winner: { variantId: wConfig.variantId, label: wConfig.variantLabel, score: winner.score },
      provenId: proven.id,
    };
  }
```

- [ ] **Step 3: import 추가** — `simulation.service.ts` 상단

```ts
import { generateVariants } from './variant-generator';
import { scorePerf, pickWinner } from './race-scoring';
```

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add server/services/simulation.service.ts
git commit -m "feat(Track 1): 시합 실행·정산 오케스트레이션 (승격 브리지 5/6)"
```

---

### Task 6: 엔드포인트 + 스모크 검증

**Files:**
- Modify: `server/routes/autotrading.routes.ts`
- Create: `scripts/race-smoke.mjs`

**Interfaces:**
- Consumes: Task 5 `runRaceCycle`, `settleRace`. 기존 `verifyModelOwnership`, `getSimulationService`.
- Produces:
  - `POST /api/auto-trading/simulation/race/run` body `{ modelId, count? }` → `runRaceCycle`
  - `POST /api/auto-trading/simulation/race/settle` body `{ modelId, minTrades? }` → `settleRace`

- [ ] **Step 1: 엔드포인트 추가** — `simulation/run` 핸들러(745~757줄) 바로 뒤에 추가

```ts
  // POST /api/auto-trading/simulation/race/run — 변종 시합 1사이클(반복 호출로 누적). 실주문 미호출.
  app.post('/api/auto-trading/simulation/race/run', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const modelId = parseInt(String((req.body as any)?.modelId));
      if (!Number.isFinite(modelId)) return res.status(400).json({ error: 'modelId required' });
      const count = Number((req.body as any)?.count);
      if (!await verifyModelOwnership(user.id, modelId)) return res.status(403).json({ error: 'forbidden' });
      const result = await getSimulationService().runRaceCycle(modelId, Number.isFinite(count) ? count : undefined);
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/auto-trading/simulation/race/settle — 변종 채점→1등을 검증된 설정으로 보관(자동 적용 없음).
  app.post('/api/auto-trading/simulation/race/settle', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const modelId = parseInt(String((req.body as any)?.modelId));
      if (!Number.isFinite(modelId)) return res.status(400).json({ error: 'modelId required' });
      const minTrades = Number((req.body as any)?.minTrades);
      if (!await verifyModelOwnership(user.id, modelId)) return res.status(403).json({ error: 'forbidden' });
      const result = await getSimulationService().settleRace(modelId, Number.isFinite(minTrades) ? minTrades : undefined);
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
```

- [ ] **Step 2: 스모크 스크립트 작성** — `scripts/race-smoke.mjs` (기존 `scripts/sim-smoke.mjs` 패턴 재사용)

```js
// 변종 시합 스모크 (Track 1) — 세션 재사용으로 race/run + race/settle 검증. 실주문 0건 확인.
import { chromium } from 'playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://app.wsj-aitradebot.live';
const SESSION_FILE = '.playwright-session.json';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: SESSION_FILE, userAgent: UA });
try {
  const models = await (await ctx.request.get(`${BASE_URL}/api/ai/models`)).json();
  const src = models.find((m) => !m.config?.isSimulation && m.config?.accountId) || models.find((m) => !m.config?.isSimulation);
  if (!src) { console.log('⚠️ 비-시뮬 모델 없음 — 스킵'); }
  else {
    console.log(`▶ race/run: source #${src.id}`);
    const run = await ctx.request.post(`${BASE_URL}/api/auto-trading/simulation/race/run`, { data: { modelId: src.id, count: 5 } });
    console.log(`  run status=${run.status()} body=${(await run.text()).slice(0, 500)}`);

    const after = await (await ctx.request.get(`${BASE_URL}/api/ai/models`)).json();
    const sims = after.filter((m) => m.config?.isSimulation && m.config?.sourceModelId === src.id);
    console.log(`  변종 sim 모델: ${sims.length}개 ${sims.map((m) => `v${m.config?.variantId}`).join(',')}`);

    console.log(`▶ race/settle: source #${src.id}`);
    const settle = await ctx.request.post(`${BASE_URL}/api/auto-trading/simulation/race/settle`, { data: { modelId: src.id, minTrades: 1 } });
    console.log(`  settle status=${settle.status()} body=${(await settle.text()).slice(0, 500)}`);
  }
} finally {
  await browser.close();
}
```

- [ ] **Step 3: 서버 재시작 + 스모크 실행**

서버 재시작(PowerShell): `schtasks /End /TN "TradeBot-Server"` → 3초 → `schtasks /Run /TN "TradeBot-Server"`
Run: `node scripts/race-smoke.mjs`
Expected:
- `race/run` 200 + 변종 sim 모델 여러 개(최대 5) 생성됨.
- `race/settle` 200(1등 보관) 또는 400 `no eligible variant`(아직 청산 거래 부족 — 정상).
- 어떤 경로든 실주문 0건(섀도우).

- [ ] **Step 4: 커밋**

```bash
git add server/routes/autotrading.routes.ts scripts/race-smoke.mjs
git commit -m "feat(Track 1): 시합 엔드포인트 + 스모크 (승격 브리지 6/6)"
```

---

## Self-Review 결과

- **Spec 커버리지:** ① 변종 생성=Task 1, ② 시합 실행=Task 4·5, ③ 채점=Task 2·5, ④ 보관=Task 3·5. 안전 가드=Global Constraints + Task 4·6 스모크. 성공 기준 1~5 모두 태스크에 매핑됨.
- **비목표 확인:** 워커 자동 스케줄·AI 변종 생성·진짜 계좌 자동 적용은 계획에 없음(의도적 제외).
- **타입 일관성:** `generateVariants`/`Variant`/`VariantOverride`(Task1), `scorePerf`/`pickWinner`/`VariantScore`(Task2), `ProvenSetting`/`createProvenSettings`/`getProvenSettings`(Task3), `ensureSimModelForVariant`/`runCycleForSimModel`(Task4), `runRaceCycle`/`settleRace`(Task5), 엔드포인트(Task6) — 호출부/정의부 이름·시그니처 일치.
- **알려진 주의:** Task 4 Step 1의 settings 없음(`else`) 분기는 실경로상 챔피언(오버라이드 없음)에서만 가능하므로 기본 생성만 한다. 도전자는 항상 source settings 복제+오버라이드 경로를 탄다(운영 모델엔 settings가 존재).
