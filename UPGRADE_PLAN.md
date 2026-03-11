# 🚀 주식투자봇 업그레이드 계획서
> **지능형 성장형 AI 거래봇 v2.0 설계 문서**
> 작성일: 2026-03-11 | 기준: 현재 소스코드 분석 + 2026년 최신 AI 기술

---

## 🎯 목표 비전

```
현재 (v1): 단순 키움 API 연동 + GPT 단일 분석 봇
목표 (v2): 지능형 성장형 멀티AI 토론 기반 자동거래 시스템

핵심 특징:
  1. 데이터 누적 기반 WIN률 성장 학습
  2. 3인 AI 투자분석가 토론 → 합의 기반 매수/매도 결정
  3. 사용자 차트 수식 시그널 기반 정밀 타점 컴퓨팅
  4. 2026년 최신 AI 모델 멀티 활용
```

---

## 📊 현재 시스템 한계 (v1)

| 항목 | 현재 상태 | 목표 |
|------|-----------|------|
| AI 분석 | 단일 GPT 호출, 1회성 | 3 AI 에이전트 토론, 피드백 루프 |
| 학습 | 파라미터 최적화만 | 실제 WIN/LOSS 기반 딥러닝 |
| 종목 발굴 | 조건식 검색 (미작동) | 멀티 조건 + AI 스코어링 |
| 매수 타점 | 레인보우 차트 단순 비교 | 사용자 차트수식 시그널 정밀 컴퓨팅 |
| AI 모델 | GPT-5.1 단일 | 5종 이상 멀티모델 활용 |

---

## 🏗️ v2.0 아키텍처 설계

```
┌─────────────────────────────────────────────────────────┐
│                  지능형 거래봇 v2.0                        │
│                                                          │
│  [종목 발굴 레이어]                                        │
│    조건검색(자체엔진) → AI 1차 필터링 → 후보 종목 풀           │
│                  ↓                                        │
│  [3인 AI 투자분석회의]                                     │
│    ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│    │ 테크니컬  │ │ 펀더멘탈  │ │ 센티멘탈  │               │
│    │ 분석가    │ │ 분석가    │ │ 분석가    │               │
│    │(GPT-4.1) │ │(Gemini2.5)│ │(Claude3.7)│               │
│    └────┬─────┘ └────┬─────┘ └────┬─────┘               │
│         └────────────┼─────────────┘                     │
│                      ↓                                    │
│  [투자분석 의장 AI] → 최종 결정 (매수/매도/관망)             │
│                      ↓                                    │
│  [타점 컴퓨팅 엔진]                                        │
│    차트수식 시그널 + 레인보우 차트 + AI 의견 → 정밀 타점       │
│                      ↓                                    │
│  [주문 실행] → 키움 REST API                               │
│                      ↓                                    │
│  [결과 학습] → WIN/LOSS 기록 → 모델 파라미터 최적화           │
└─────────────────────────────────────────────────────────┘
```

---

## 🤖 2026년 3월 기준 AI 모델 스펙 DB

> 봇이 동적으로 모델을 선택할 수 있도록 DB 테이블로 관리

### 신규 테이블: `ai_model_specs`

```sql
CREATE TABLE ai_model_specs (
  id SERIAL PRIMARY KEY,
  model_id TEXT NOT NULL UNIQUE,        -- 'gpt-4.1', 'claude-3-7-sonnet', etc.
  provider TEXT NOT NULL,               -- 'openai', 'anthropic', 'google', 'xai'
  display_name TEXT NOT NULL,
  
  -- 성능 특장점
  strengths TEXT[],                     -- ['reasoning', 'code', 'multimodal']
  best_for TEXT[],                      -- ['technical_analysis', 'sentiment', 'fundamental']
  context_window INTEGER,               -- 토큰 컨텍스트 크기
  
  -- 비용 (USD per 1M tokens)
  input_cost_per_1m DECIMAL(10,6),
  output_cost_per_1m DECIMAL(10,6),
  
  -- 성능 지표
  speed_tier TEXT,                      -- 'fast', 'medium', 'slow'
  reasoning_score INTEGER,              -- 0-100 (벤치마크 기반)
  
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2026년 3월 모델 데이터

| model_id | provider | 특장점 | 비용(Input/Output per 1M) | 추천 용도 |
|----------|----------|--------|--------------------------|----------|
| `gpt-4.1` | OpenAI | 코드+멀티모달, 128k ctx | $2.00 / $8.00 | 기술적 분석, 차트 패턴 인식 |
| `gpt-4.1-mini` | OpenAI | 빠르고 저렴 | $0.40 / $1.60 | 1차 스크리닝, 대량 처리 |
| `gpt-4o` | OpenAI | 범용, 안정성 | $2.50 / $10.00 | 일반 분석 |
| `o4-mini` | OpenAI | 고급 추론 특화 | $1.10 / $4.40 | 복잡한 전략 판단 |
| `claude-3-7-sonnet` | Anthropic | 장문 분석, 뉴스 감성 | $3.00 / $15.00 | 뉴스/공시 감성 분석 |
| `claude-3-5-haiku` | Anthropic | 초고속, 저렴 | $0.80 / $4.00 | 실시간 스캔 |
| `gemini-2.5-pro` | Google | 멀티모달, 차트 이미지 분석 | $1.25 / $10.00 | 차트 이미지 분석, 재무제표 |
| `gemini-2.0-flash` | Google | 초고속 | $0.10 / $0.40 | 고빈도 알림 처리 |
| `grok-3` | xAI | 실시간 웹검색, 뉴스 | $3.00 / $15.00 | 시장 뉴스 실시간 분석 |
| `deepseek-v3` | DeepSeek | 수학/코드 강점, 초저가 | $0.27 / $1.10 | 재무수치 계산, 대량 처리 |

### 3인 AI 분석가 역할 배정

```typescript
// server/services/ai-council.service.ts (신규)
const AI_ANALYSTS = {
  technical: {
    modelId: 'gpt-4.1',
    persona: '테크니컬 분석가 "테크"',
    role: '차트 패턴, 이동평균, 레인보우 차트, 볼린저밴드, RSI, MACD 전문',
    systemPrompt: `당신은 20년 경력의 기술적 분석 전문가입니다. 
      차트 패턴과 기술적 지표만을 근거로 매매 의견을 제시합니다.
      감성적 판단은 배제하고 수치와 패턴에만 집중합니다.`
  },
  fundamental: {
    modelId: 'gemini-2.5-pro',
    persona: '펀더멘탈 분석가 "펀드"',
    role: '재무제표, PER/PBR/ROE, 산업 분석, 기업 가치 전문',
    systemPrompt: `당신은 CFA 자격증 보유 펀더멘탈 분석가입니다.
      재무건전성, 밸류에이션, 산업 경쟁력을 근거로 투자 의견을 제시합니다.
      단기 가격 움직임보다 기업 본질 가치에 집중합니다.`
  },
  sentiment: {
    modelId: 'claude-3-7-sonnet',
    persona: '감성 분석가 "센스"',
    role: '뉴스, 공시, 소셜미디어, 시장 심리, 외국인/기관 동향 전문',
    systemPrompt: `당신은 시장 심리와 뉴스 분석의 전문가입니다.
      최신 뉴스, 공시, 주요 이벤트가 주가에 미치는 영향을 분석합니다.
      단기 모멘텀과 투자심리 변화에 민감하게 반응합니다.`
  },
  chairman: {
    modelId: 'o4-mini',
    persona: '투자분석회의 의장 "의장"',
    role: '3인의 분석을 종합하여 최종 투자 결정',
    systemPrompt: `당신은 투자분석회의 의장입니다.
      테크니컬, 펀더멘탈, 감성 3명의 분석가 의견을 검토하고
      다수결 + 가중치 기반으로 최종 매수/매도/관망 결정을 내립니다.
      결정에는 반드시 근거와 신뢰도(%)를 포함합니다.`
  }
};
```

---

## 🔧 v2.0 신규 기능 상세 설계

### Feature 1: 3인 AI 투자분석회의 (AI Council)

**신규 파일**: `server/services/ai-council.service.ts`

```typescript
interface CouncilAnalysis {
  technical: AnalystOpinion;
  fundamental: AnalystOpinion;
  sentiment: AnalystOpinion;
  chairman: ChairmanDecision;
  discussionLog: DiscussionMessage[];
  finalAction: 'buy' | 'sell' | 'hold';
  confidence: number;
  consensusRatio: number; // 3명 중 동의 비율
  targetPrice: number | null;
}

interface AnalystOpinion {
  analyst: string;         // "테크", "펀드", "센스"
  model: string;           // 사용된 AI 모델
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  keyPoints: string[];     // 핵심 근거 3가지
  riskFactors: string[];
}

interface ChairmanDecision {
  finalAction: 'buy' | 'sell' | 'hold';
  confidence: number;
  votingResult: { buy: number; sell: number; hold: number };
  reasoning: string;
  targetPrice: number | null;
  stopLoss: number | null;
}

class AICouncilService {
  // 3인 동시 분석 (parallel)
  async conductCouncil(params: {
    stockCode: string;
    stockName: string;
    currentPrice: number;
    priceHistory: any[];
    financialData: any;
    newsData: any;
    chartSignals: any; // 차트수식 시그널
  }): Promise<CouncilAnalysis> {
    
    // 1단계: 3인 분석가 동시 분석 (Promise.all)
    const [technical, fundamental, sentiment] = await Promise.all([
      this.runTechnicalAnalyst(params),
      this.runFundamentalAnalyst(params),
      this.runSentimentAnalyst(params),
    ]);
    
    // 2단계: 의장이 3인 의견 종합 → 최종 결정
    const chairman = await this.runChairman({
      technical, fundamental, sentiment, ...params
    });
    
    return { technical, fundamental, sentiment, chairman, ... };
  }
}
```

**API 라우트 추가**: `server/routes/ai.routes.ts`
```typescript
app.post("/api/ai/council-analysis", isAuthenticated, async (req, res) => {
  // 3인 AI 분석회의 실행
  // 결과를 DB에 저장 (학습용)
  // 클라이언트에 실시간 스트리밍 (SSE 또는 WebSocket)
});
```

### Feature 2: 정밀 타점 컴퓨팅 엔진

**신규 파일**: `server/services/entry-point-calculator.ts`

```typescript
interface EntryPointResult {
  action: 'buy' | 'sell' | 'hold';
  entryPrice: number;          // 권장 매수/매도가
  stopLoss: number;            // 손절가
  takeProfit: number;          // 익절가
  positionSize: number;        // 권장 매수 수량
  riskRewardRatio: number;     // 리스크/리워드 비율
  signalStrength: number;      // 0-100
  signals: {
    rainbowSignal: string;     // 레인보우 차트 신호
    chartFormulaSignals: string[]; // 사용자 차트수식 신호
    aiCouncilSignal: string;   // AI 회의 신호
    confluenceCount: number;   // 일치하는 시그널 수
  };
}

class EntryPointCalculator {
  calculate(params: {
    currentPrice: number;
    rainbowChart: RainbowChartResult;
    chartSignals: ChartFormulaSignal[];
    aiDecision: ChairmanDecision;
    riskCapital: number;  // 투자 가능 금액
  }): EntryPointResult {
    // 레인보우 + 차트수식 + AI 의견 3개가 일치하면 strong signal
    const confluenceCount = this.countConfluence(...);
    
    if (confluenceCount >= 2) {
      // 2개 이상 시그널 일치 → 매수 신호
      return this.computeBuyPoint(...);
    }
    // ...
  }
}
```

### Feature 3: WIN/LOSS 기반 데이터 누적 학습

**기존 테이블 활용**: `trading_performances`

```typescript
// server/services/learning.service.ts 확장
class LearningService {
  // 기존: optimizeModel (파라미터만 조정)
  // ✅ 추가: 딥 러닝 기반 패턴 학습
  
  async learnFromTrades(modelId: number) {
    const performances = await storage.getTradingPerformances(modelId);
    
    // WIN 거래의 공통 패턴 분석
    const winTrades = performances.filter(p => p.isWin);
    const lossTrades = performances.filter(p => !p.isWin);
    
    // AI에게 WIN 패턴 학습 요청
    const learningPrompt = `
      WIN 거래 ${winTrades.length}건과 LOSS 거래 ${lossTrades.length}건을 분석하여
      어떤 조건에서 WIN률이 높은지 패턴을 추출하고
      향후 매수/매도 조건을 어떻게 개선해야 하는지 제안하세요.
      
      WIN 거래 공통점: ${JSON.stringify(winPatterns)}
      LOSS 거래 공통점: ${JSON.stringify(lossPatterns)}
    `;
    
    const optimization = await aiService.learnAndOptimize(learningPrompt);
    
    // 학습 결과를 AI 모델 설정에 반영
    await storage.updateAiModel(modelId, {
      config: { ...currentConfig, ...optimization.updatedParams }
    });
    
    return { winRate, optimization };
  }
  
  // WIN률 대시보드 통계
  async getWinRateStats(userId: string) {
    return {
      totalTrades: 0,
      winRate: 0,
      avgReturn: 0,
      bestTrade: null,
      worstTrade: null,
      streaks: { current: 0, longest: 0 },
      byModel: [],
      byCondition: [],
      weeklyTrend: [],
    };
  }
}
```

### Feature 4: 실시간 분석회의 스트리밍 UI

**신규 컴포넌트**: `client/src/components/ai-analysis/AICouncilAnalysis.tsx`

```typescript
// 3인 분석가가 순차적으로 의견 제시 → 타이핑 효과로 실시간 표시
// 의장 최종 결정 → 투표 시각화
// WIN/LOSS 히스토리 → 그래프

interface UILayout {
  // 좌측: 3인 분석가 의견 카드 (나란히)
  //   - 테크니컬 분석가 카드 (차트 패턴)
  //   - 펀더멘탈 분석가 카드 (재무 지표)  
  //   - 감성 분석가 카드 (뉴스 감성)
  
  // 우측: 의장 최종 결정
  //   - 투표 시각화 (BUY/SELL/HOLD 비율)
  //   - 최종 액션 + 신뢰도
  //   - 타점 정보 (매수가, 손절가, 익절가)
  
  // 하단: WIN/LOSS 학습 히스토리 그래프
}
```

---

## 📅 개발 로드맵

### Phase 1: 버그 수정 (1-2주)
> BUGFIX_PLAN.md의 모든 이슈 해결

### Phase 2: 데이터 파이프라인 강화 (2-3주)
```
- 관심종목 키움 HTS 연동 완료
- 차트수식 시그널 엔진 완성
- 종목 마스터 DB 구축 (전 종목 코드/이름)
- 조건식 자체 평가 엔진 안정화
```

### Phase 3: 3인 AI 분석회의 구현 (3-4주)
```
- AICouncilService 구현
- 3개 AI 프로바이더 API 연동 (OpenAI + Anthropic + Google)
- 분석회의 결과 DB 저장 구조
- 실시간 스트리밍 UI
- AI 모델 스펙 DB 구축 및 관리 UI
```

### Phase 4: 정밀 타점 컴퓨팅 (2-3주)
```
- EntryPointCalculator 구현
- 차트수식 시그널 → 매수/매도 타점 변환
- 레인보우 + AI + 수식 컨플루언스 알고리즘
- 포지션 사이징 엔진 (리스크 기반)
```

### Phase 5: 학습 엔진 고도화 (3-4주)
```
- WIN/LOSS 패턴 자동 분석
- 모델별 승률 트래킹 대시보드
- 자동 파라미터 최적화 강화
- A/B 테스트 (모델별 성과 비교)
```

### Phase 6: 고급 자동화 (지속 개발)
```
- 멀티 계좌 동시 운영
- 섹터 로테이션 전략
- 뉴스 기반 즉시 매매 (Grok 실시간 웹검색 활용)
- 포트폴리오 리밸런싱 자동화
```

---

## 💰 비용 최적화 전략

### AI 모델 사용 계층화

```
1단계 스크리닝 (대량, 저비용):
  gemini-2.0-flash ($0.10/1M) 또는 deepseek-v3 ($0.27/1M)
  → 조건식 매칭 종목 1차 필터링

2단계 분석 (선택 종목, 중비용):
  gpt-4.1-mini ($0.40/1M)
  → 후보 종목 기본 분석

3단계 회의 (최종 후보, 고비용):
  gpt-4.1 + claude-3-7-sonnet + gemini-2.5-pro
  → 3인 분석가 회의 (하루 10-20 종목 한정)

4단계 의장 결정 (최종, 중비용):
  o4-mini ($1.10/1M)
  → 최종 매수/매도 결정
```

### 비용 제어 장치

```typescript
// server/services/ai-cost-controller.ts
class AICostController {
  private dailyBudget: number = 10; // USD
  private dailyUsage: number = 0;
  
  async canExecute(estimatedCost: number): Promise<boolean> {
    if (this.dailyUsage + estimatedCost > this.dailyBudget) {
      console.warn(`⚠️ Daily AI budget exceeded: ${this.dailyUsage}/${this.dailyBudget} USD`);
      return false;
    }
    return true;
  }
  
  recordUsage(cost: number) {
    this.dailyUsage += cost;
  }
}
```

---

## 🗃️ 신규 DB 스키마 추가 사항

```sql
-- AI 모델 스펙 DB
CREATE TABLE ai_model_specs (...); -- 위 설계 참조

-- AI 분석회의 기록
CREATE TABLE ai_council_sessions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id),
  stock_code TEXT NOT NULL,
  stock_name TEXT NOT NULL,
  session_data JSONB NOT NULL,  -- 3인 분석 + 의장 결정 전체
  final_action TEXT,
  final_confidence DECIMAL,
  target_price DECIMAL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 타점 기록
CREATE TABLE entry_points (
  id SERIAL PRIMARY KEY,
  council_session_id INTEGER REFERENCES ai_council_sessions(id),
  stock_code TEXT NOT NULL,
  entry_price DECIMAL,
  stop_loss DECIMAL,
  take_profit DECIMAL,
  position_size INTEGER,
  signal_confluence INTEGER,  -- 일치 시그널 수
  executed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 학습 이력
CREATE TABLE learning_records (
  id SERIAL PRIMARY KEY,
  model_id INTEGER REFERENCES ai_models(id),
  period_start DATE,
  period_end DATE,
  total_trades INTEGER,
  win_rate DECIMAL,
  avg_return DECIMAL,
  pattern_insights JSONB,   -- AI가 추출한 WIN 패턴
  applied_changes JSONB,    -- 적용된 파라미터 변경
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔌 추가 API 연동 계획

### Anthropic (Claude)
```typescript
// package.json에 추가
// "@anthropic-ai/sdk": "^0.39.0"

// server/services/providers/anthropic.provider.ts
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
```

### Google Gemini
```typescript
// "@google/generative-ai": "^0.21.0"

// server/services/providers/google.provider.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
```

### xAI Grok (실시간 웹검색 + 뉴스)
```typescript
// OpenAI 호환 인터페이스 사용 가능
const xai = new OpenAI({ 
  baseURL: 'https://api.x.ai/v1',
  apiKey: process.env.XAI_API_KEY 
});
```

### DeepSeek (저비용 대량 처리)
```typescript
// OpenAI 호환
const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY
});
```

---

## ⚙️ 환경변수 추가 필요 (Replit Secrets)

```bash
# 기존
OPENAI_API_KEY=sk-...
KIWOOM_APP_KEY=...
KIWOOM_APP_SECRET=...

# 신규 추가
ANTHROPIC_API_KEY=sk-ant-...        # Claude 3.7 Sonnet
GOOGLE_API_KEY=AIza...              # Gemini 2.5 Pro
XAI_API_KEY=xai-...                 # Grok 3 (선택)
DEEPSEEK_API_KEY=sk-...             # DeepSeek V3 (저비용 옵션)

AI_DAILY_BUDGET_USD=10              # 일일 AI 비용 한도
COUNCIL_MAX_STOCKS_PER_DAY=20       # 분석회의 최대 종목 수/일
```

---

## 📊 기대 효과

| 지표 | v1 (현재) | v2 (목표) |
|------|-----------|-----------|
| 분석 정확도 | 단일 AI 단순 분석 | 3인 합의 → 오류 감소 |
| WIN 승률 | 미측정 | 60% → 70%+ 성장 목표 |
| 매수 타점 정밀도 | 레인보우 존 내 임의 | 차트수식+AI 컨플루언스 |
| 자동화 수준 | 조건식 미작동 | 완전 자동 파이프라인 |
| 학습 능력 | 파라미터 조정만 | 패턴 기반 실질 학습 |
| AI 비용 효율 | 단일 GPT만 | 계층별 최적 모델 선택 |

---

*이 문서는 현재 소스코드 분석과 2026년 3월 기준 AI 기술 동향을 바탕으로 작성되었습니다.*
*단계별 구현을 통해 Replit 크레딧을 효율적으로 사용하세요.*
