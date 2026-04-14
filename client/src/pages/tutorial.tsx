import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, Database, Brain, Filter, ShoppingCart,
  TrendingDown, GraduationCap, Clock, AlertTriangle, CheckCircle2,
  ArrowDown, Layers
} from "lucide-react";

interface FlowStep {
  id: number;
  phase: string;
  title: string;
  icon: any;
  color: string;
  trigger: string;
  description: string;
  process: { step: string; detail: string }[];
  decision?: { condition: string; yes: string; no: string };
  output: string;
  code?: string;
  notes?: string[];
}

const flowSteps: FlowStep[] = [
  {
    id: 1,
    phase: "스캔",
    title: "조건검색 & 후보 수집",
    icon: Database,
    color: "neon-cyan",
    trigger: "매 30분 (cron: */30 * * * *)",
    description: "키움증권 API를 통해 '뒷차기2' 조건을 만족하는 종목을 수집하고, DART 위험공시를 필터링한 후 DB에 저장합니다.",
    process: [
      { step: "활성 모델 조회", detail: "DB에서 status='active'인 AI 모델 전체를 가져옵니다" },
      { step: "키움 에이전트 확인", detail: "각 모델의 계좌로 키움 에이전트 연결 상태를 확인합니다" },
      { step: "뒷차기2 조건검색 실행", detail: "키움 Open API 조건검색 실행 → 조건 만족 종목 목록 수신" },
      { step: "DART 위험공시 조회", detail: "각 종목의 최근 공시를 DART API로 조회합니다" },
      { step: "위험 키워드 필터링", detail: "유상증자·전환사채·횡령·배임·관리종목 등 13종 키워드 포함 시 제외" },
      { step: "candidate_stocks 저장", detail: "통과한 종목을 DB에 upsert (source='뒷차기2')" },
    ],
    decision: {
      condition: "조건검색 결과가 0건인가?",
      yes: "기존 candidate_stocks 전체 삭제 (초기화)",
      no: "정상 저장 완료"
    },
    output: "candidate_stocks 테이블에 유효 후보 종목 목록 갱신",
    notes: [
      "스캔잡은 키움 에이전트가 실행 중이어야 작동합니다",
      "DART 필터는 스캔 단계와 매수 단계 두 번 적용됩니다",
    ]
  },
  {
    id: 2,
    phase: "매매",
    title: "매매 사이클 시작 & 사전 검증",
    icon: Clock,
    color: "neon-purple",
    trigger: "매 1분 (cron: * * * * *)",
    description: "1분마다 실행되지만, 한국 주식 시장이 열려 있는 평일 09:00~15:30에만 실제 매매 판단을 수행합니다.",
    process: [
      { step: "한국장 개장 확인", detail: "isKoreanMarketOpen() → 평일 09:00~15:30 외에는 사이클 종료" },
      { step: "활성 모델 순회 시작", detail: "status='active' 모델 전체를 차례로 처리" },
      { step: "autoTradingEnabled 확인", detail: "모델별 사용자 설정 조회 → false이면 해당 모델 건너뜀" },
      { step: "키움 서비스 초기화", detail: "해당 모델의 계좌 정보로 KiwoomService 인스턴스 획득" },
      { step: "에이전트 타임아웃 체크", detail: "10분 이내 연속 3회 타임아웃 시 모델 자동 비활성화" },
    ],
    output: "각 모델별로 청산 판단 → 신규 매수 판단 → 추가매수 판단 순서로 진행",
    notes: [
      "모든 모델이 같은 1분 사이클에서 처리됩니다",
      "에이전트 응답 없음이 10분 내 3회 누적되면 자동 비활성화됩니다",
    ]
  },
  {
    id: 3,
    phase: "청산",
    title: "보유 포지션 청산 판단",
    icon: TrendingDown,
    color: "neon-green",
    trigger: "매매 사이클 내 — 신규 매수보다 먼저 실행",
    description: "보유 중인 모든 포지션을 점검하고, 익절·손절·급등청산·장기보유청산 조건을 순서대로 확인합니다.",
    process: [
      { step: "보유 포지션 전체 조회", detail: "해당 모델의 auto_trading_positions에서 보유 종목 가져오기" },
      { step: "현재가 조회", detail: "키움 에이전트를 통해 각 종목의 실시간 현재가 수신" },
      { step: "수익률 계산", detail: "profitRate = (현재가 - 평균매수가) / 평균매수가 × 100" },
      { step: "익절 조건 확인", detail: "profitRate ≥ takeProfitPercent% → 전량 시장가 매도" },
      { step: "손절 조건 확인", detail: "|profitRate| ≥ stopLoss.percent% (손실 중일 때) → 전량 매도" },
      { step: "급등 청산 확인", detail: "profitRate ≥ surgeThreshold% → 조기 익절 매도" },
      { step: "장기보유 청산 확인", detail: "보유일수 ≥ stalePeriodDays 이고 손실 중 → 청산" },
    ],
    code: `청산 우선순위:
1순위. 익절 (takeProfitPercent)
2순위. 손절 (stopLoss)
3순위. 급등 청산 (surgeThreshold)
4순위. 장기보유 청산 (stalePeriodDays + 손실)`,
    output: "매도 주문 실행 → auto_trading_positions 업데이트 → 거래 로그 기록",
  },
  {
    id: 4,
    phase: "분석",
    title: "GPT 종합 분석 (comprehensiveAiAnalysis)",
    icon: Brain,
    color: "neon-cyan",
    trigger: "신규 매수 후보 종목 1개당 실행",
    description: "GPT 호출 2개(analyzeStock, integratedAnalysis)가 병렬로 실행되고, 거래량 기반 점수 2개를 규칙으로 계산합니다.",
    process: [
      { step: "candidate_stocks 조회", detail: "현재 DB에 저장된 후보 종목 목록 가져오기 (이미 보유 중인 종목 제외)" },
      { step: "[병렬] analyzeStock() 호출", detail: "GPT에게 테마/모멘텀/기술적 신호 분석 요청 → themeScore (0~100) 반환" },
      { step: "[병렬] integratedAnalysis() 호출", detail: "GPT에게 뉴스·DART·PER/PBR/ROE 분석 요청 → newsScore, financialScore (0~100) 반환" },
      { step: "liquidityScore 계산", detail: "거래량 기준 규칙: ≥500K→80, ≥100K→65, ≥50K→45, 기타→25" },
      { step: "institutionalScore 계산", detail: "동일 acml_vol로 더 높은 임계값 적용: ≥1M→75, ≥500K→65, ≥100K→55, ≥50K→45, 기타→35 (별도 기관 데이터 없음)" },
      { step: "가중합산 → confidence", detail: "5개 점수 × 각 슬라이더 가중치(%) → 합산 = confidence (0~100)" },
      { step: "DART 위험공시 이중확인", detail: "dartDangerKeyword 있으면 이 단계에서도 차단" },
    ],
    code: `confidence = (
  themeScore         × themeWeight         (기본 20)
+ newsScore          × newsWeight          (기본 15)
+ financialScore     × financialsWeight    (기본 25)
+ liquidityScore     × liquidityWeight     (기본 20)
+ institutionalScore × institutionalWeight (기본 20)
) / totalWeight   ← 슬라이더 합계로 나눔 (자동 정규화)

hasGoodFinancials = financialScore ≥ 60
hasHighLiquidity  = liquidityScore ≥ 40`,
    output: "confidence, themeScore, newsScore, financialsScore, liquidityScore, institutionalScore, dartDangerKeyword",
    notes: [
      "GPT 모델은 설정 메뉴 → AI 설정에서 선택한 모델을 사용합니다",
      "병렬 실행이므로 두 GPT 호출이 동시에 진행됩니다",
    ]
  },
  {
    id: 5,
    phase: "필터",
    title: "매수 필터 순차 적용",
    icon: Filter,
    color: "neon-purple",
    trigger: "종목 평가 시작 직후",
    description: "평가 시작 시 6가지 필터를 순서대로 적용합니다. ①은 GPT 호출 전, ②~⑥은 GPT 분석 후 적용됩니다. 하나라도 탈락하면 해당 종목은 이번 사이클에서 스킵됩니다.",
    process: [
      { step: "① 시장이슈 필터", detail: "requireMarketIssue=ON이면 오늘 날짜 market_issues DB에 없는 종목 스킵 — GPT 호출 전 최우선 체크" },
      { step: "② confidence 최소값 체크", detail: "confidence < minAiConfidence → 스킵 ('⚠️ AI confidence X% < threshold Y%')" },
      { step: "③ 재무건전성 필터", detail: "requireGoodFinancials=ON 이고 financialScore < 60 → 스킵" },
      { step: "④ 유동성 필터", detail: "requireHighLiquidity=ON 이고 liquidityScore < 40 → 스킵" },
      { step: "⑤ DART 위험공시 차단", detail: "dartDangerKeyword 존재 → 설정 무관 무조건 스킵 ('🚫 DART 위험공시 감지')" },
      { step: "⑥ 레인보우 라인 체크", detail: "currentLine > 50 또는 unitCount = 0 → 매수 조건 미충족" },
      { step: "[executeBuy 내부] 보유 종목 수", detail: "현재 보유수 ≥ maxPositions → 주문 취소 (레인보우 판단 이후 최종 확인)" },
      { step: "[executeBuy 내부] 일일 한도", detail: "오늘 자동매매 건수 ≥ maxDailyTrades → 주문 취소" },
    ],
    decision: {
      condition: "모든 필터 통과?",
      yes: "매수 주문 실행 단계로 진행",
      no: "해당 종목 스킵, 다음 후보 종목으로"
    },
    output: "통과 시: 매수 실행. 탈락 시: 로그에 사유 기록 후 스킵",
  },
  {
    id: 6,
    phase: "매수",
    title: "신규 매수 주문 실행",
    icon: ShoppingCart,
    color: "neon-green",
    trigger: "모든 필터 통과 + 레인보우 currentLine ≤ 50",
    description: "유닛 기반으로 주문 수량을 계산하고 시장가 매수 주문을 실행합니다.",
    process: [
      { step: "레인보우 라인 확정", detail: "현재가로 currentLine 계산 (10~50% 중 하나)" },
      { step: "유닛 수 조회", detail: "lineUnits[currentLine] → 해당 라인 유닛 수 (설정에서 지정)" },
      { step: "주문 수량 계산", detail: "qty = floor(unitSize × unitCount ÷ 현재가)" },
      { step: "매수 주문 발행", detail: "키움 에이전트를 통해 시장가 매수 주문 전송" },
      { step: "포지션 DB 기록", detail: "auto_trading_positions에 entryPrice, entryRainbowLine, entryAiConfidence 저장" },
      { step: "거래 로그 기록", detail: "themeScore·newsScore·financialsScore·liquidityScore·confidence 전체 기록" },
    ],
    code: `주문 수량 계산 예시:
  unitSize = 500,000원
  lineUnits[30] = 2   (30% 라인 → 2유닛 설정)
  현재가 = 25,000원

  qty = floor(500,000 × 2 ÷ 25,000) = 40주`,
    output: "매수 주문 체결 → auto_trading_positions 생성 → auto_trading_logs 기록",
    notes: [
      "unitCount가 0이면 해당 라인에서 매수하지 않습니다",
      "주문 수량이 0이 되는 경우(unitSize < 주가)에도 매수하지 않습니다",
    ]
  },
  {
    id: 7,
    phase: "추가매수",
    title: "추가매수 판단 & 실행",
    icon: ArrowDown,
    color: "neon-cyan",
    trigger: "기존 보유 종목 대상 — 매매 사이클 내 마지막 단계",
    description: "이미 보유 중인 종목이 진입 가격보다 더 하락했을 때 추가 매수합니다.",
    process: [
      { step: "보유 포지션 조회", detail: "auto_trading_positions에서 현재 보유 종목 목록 가져오기" },
      { step: "현재 레인보우 라인 계산", detail: "실시간 현재가로 currentLine 재계산" },
      { step: "추가매수 조건 확인", detail: "entryLine > 10 이고 currentLine ≤ entryLine - 10 이고 currentLine ≥ 10 이면 조건 충족" },
      { step: "일일 한도 재확인", detail: "maxDailyTrades 초과 여부 재검사" },
      { step: "유닛 수 조회", detail: "해당 currentLine에 대한 lineUnits 조회" },
      { step: "주문 수량 계산 & 실행", detail: "동일 유닛 공식으로 수량 계산 후 시장가 매수 주문" },
    ],
    code: `추가매수 조건:
  조건1: entryLine > 10  (10% 라인 진입 시 추가매수 불가)
  조건2: currentLine ≤ entryLine - 10
  조건3: currentLine ≥ 10

  예) 30% 라인에서 최초 매수 (entryLine = 30)
      → currentLine ≤ 20 이고 ≥ 10 이면 추가매수
      → 해당 라인(20%)의 lineUnits 수량으로 추가 주문`,
    output: "추가매수 체결 → auto_trading_positions 업데이트 → 로그 기록",
    notes: [
      "같은 라인에 이미 추가매수가 체결된 경우 중복 매수를 방지합니다",
    ]
  },
  {
    id: 8,
    phase: "학습",
    title: "야간 학습 최적화",
    icon: GraduationCap,
    color: "neon-purple",
    trigger: "매일 16:00 (cron: 0 16 * * *)",
    description: "하루 거래 결과를 분석하고, 성과가 낮은 모델은 파라미터를 자동 조정합니다.",
    process: [
      { step: "활성 모델 전체 조회", detail: "status='active'인 모든 AI 모델 순회" },
      { step: "성과 데이터 집계", detail: "totalTrades, winRate(%), totalReturn(%) 계산" },
      { step: "파라미터 최적화 분석", detail: "LearningService.optimizeModel() 실행 → 권장 파라미터 산출" },
      { step: "자동 적용", detail: "appliedChanges=true이면 DB에 최적화된 파라미터 자동 업데이트" },
      { step: "권장사항 출력", detail: "콘솔에 recommendations 배열 출력" },
    ],
    output: "AI 모델 파라미터 자동 조정 완료 (또는 현재 설정 유지 권장)",
    notes: [
      "학습 결과는 다음 매매 사이클부터 자동 반영됩니다",
      "appliedChanges=false이면 변경 없이 권장사항만 출력됩니다",
    ]
  },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-muted/40 rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-border/30 mt-2">
      {children}
    </pre>
  );
}

export default function Tutorial() {
  const [currentStep, setCurrentStep] = useState(0);
  const step = flowSteps[currentStep];
  const Icon = step.icon;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4" data-testid="text-tutorial-title">

      <div className="mb-4">
        <h1 className="text-3xl font-bold mb-1">거래 흐름 튜토리얼</h1>
        <p className="text-muted-foreground text-sm">한 번의 자동매매가 이루어지는 전체 과정 — 스캔부터 청산까지</p>
      </div>

      {/* 전체 플로우 요약 */}
      <Card className="border-border/40">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {flowSteps.map((s, i) => {
              const SI = s.icon;
              return (
                <div key={s.id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentStep(i)}
                    data-testid={`button-quick-step-${i + 1}`}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-colors ${
                      i === currentStep
                        ? `bg-[hsl(var(--${s.color}))]/20 border-[hsl(var(--${s.color}))]/50 text-[hsl(var(--${s.color}))]`
                        : i < currentStep
                          ? 'bg-muted/50 border-border/30 text-muted-foreground'
                          : 'border-border/30 text-muted-foreground hover:bg-muted/30'
                    }`}
                  >
                    <SI className="w-3 h-3" />
                    <span>{s.phase}</span>
                  </button>
                  {i < flowSteps.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Progress dots */}
      <div className="flex justify-center gap-2">
        {flowSteps.map((s, i) => (
          <button
            key={i}
            onClick={() => setCurrentStep(i)}
            data-testid={`button-step-${i + 1}`}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === currentStep
                ? `bg-[hsl(var(--${s.color}))] scale-125`
                : i < currentStep
                  ? 'bg-muted-foreground/50'
                  : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Main card */}
      <Card className={`border-[hsl(var(--${step.color}))]/30`}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-4 flex-wrap">
            <div className={`w-12 h-12 rounded-full bg-[hsl(var(--${step.color}))]/15 flex items-center justify-center shrink-0`}>
              <Icon className={`w-6 h-6 text-[hsl(var(--${step.color}))]`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge className={`bg-[hsl(var(--${step.color}))]/20 text-[hsl(var(--${step.color}))] border-[hsl(var(--${step.color}))]/30 text-xs`}>
                  Step {step.id} / {flowSteps.length}
                </Badge>
                <Badge variant="outline" className="text-xs">{step.phase}</Badge>
              </div>
              <CardTitle className="text-xl">{step.title}</CardTitle>
              <div className="flex items-center gap-1.5 mt-1">
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground font-mono">{step.trigger}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">{step.description}</p>

          {/* Process steps */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">실행 순서</p>
            <div className="space-y-2">
              {step.process.map((p, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full bg-[hsl(var(--${step.color}))]/15 flex items-center justify-center shrink-0 mt-0.5`}>
                    <span className={`text-xs font-bold text-[hsl(var(--${step.color}))]`}>{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{p.step}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Decision point */}
          {step.decision && (
            <div className="p-3 border border-border/40 rounded-md bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground mb-2">판단 분기</p>
              <p className="text-sm font-medium mb-2">{step.decision.condition}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-md">
                  <p className="text-xs text-green-400 font-semibold mb-0.5">YES</p>
                  <p className="text-xs">{step.decision.yes}</p>
                </div>
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-md">
                  <p className="text-xs text-red-400 font-semibold mb-0.5">NO</p>
                  <p className="text-xs">{step.decision.no}</p>
                </div>
              </div>
            </div>
          )}

          {/* Code block */}
          {step.code && <CodeBlock>{step.code}</CodeBlock>}

          {/* Output */}
          <div className="flex items-start gap-2 p-3 bg-[hsl(var(--neon-green))]/10 border border-[hsl(var(--neon-green))]/20 rounded-md">
            <CheckCircle2 className="w-4 h-4 text-[hsl(var(--neon-green))] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-[hsl(var(--neon-green))] mb-0.5">출력 결과</p>
              <p className="text-xs">{step.output}</p>
            </div>
          </div>

          {/* Notes */}
          {step.notes && step.notes.length > 0 && (
            <div className="space-y-1.5">
              {step.notes.map((n, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
                  <p className="text-xs">{n}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className="gap-2"
          data-testid="button-prev-step"
        >
          <ChevronLeft className="w-4 h-4" />
          이전
        </Button>

        <span className="text-xs text-muted-foreground">{currentStep + 1} / {flowSteps.length}</span>

        <Button
          onClick={() => setCurrentStep(s => Math.min(flowSteps.length - 1, s + 1))}
          disabled={currentStep === flowSteps.length - 1}
          className={`gap-2`}
          data-testid="button-next-step"
        >
          다음
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Completion */}
      {currentStep === flowSteps.length - 1 && (
        <Card className="border-[hsl(var(--neon-green))]/30 bg-[hsl(var(--neon-green))]/5">
          <CardContent className="py-6 text-center">
            <Layers className="w-10 h-10 mx-auto mb-3 text-[hsl(var(--neon-green))]" />
            <h3 className="text-lg font-bold mb-1">전체 사이클 파악 완료</h3>
            <p className="text-sm text-muted-foreground">
              스캔(30분) → GPT분석(1분) → 필터 → 매수 → 청산 → 학습(16시)<br />
              이 루프가 반복되며 자동매매가 운영됩니다
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
