import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Layers,
  Monitor,
  Newspaper,
  Search,
  ServerCog,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";

interface TutorialStep {
  id: number;
  phase: string;
  title: string;
  icon: any;
  color: string;
  trigger: string;
  goal: string;
  operatorAction: string[];
  systemAction: string[];
  checkpoints: string[];
  failCase?: { condition: string; action: string };
  output: string;
}

const steps: TutorialStep[] = [
  {
    id: 1,
    phase: "연결",
    title: "설정 페이지에서 연동 준비",
    icon: Settings2,
    color: "neon-cyan",
    trigger: "최초 1회 / 재시작 후",
    goal: "실제 주문 가능한 연결 상태를 만든다",
    operatorAction: [
      "설정 > 키움증권 API 키(APP KEY/APP SECRET)를 저장한다.",
      "설정 > 집 PC 에이전트 연결 배지(연결됨/미연결)를 확인한다.",
      "설정 > 거래 모드(모의투자/실전투자)를 의도대로 맞춘다.",
    ],
    systemAction: [
      "서버 URL, 마지막 폴링, 폴링 횟수를 표시한다.",
      "에이전트 미연결 시 미연결 상태와 점검 안내를 보여준다.",
    ],
    checkpoints: [
      "에이전트 상태가 '연결됨'",
      "키움 키 저장 완료 토스트 확인",
    ],
    failCase: {
      condition: "에이전트가 미연결 또는 폴링 지연",
      action: "집 PC 에이전트(.env REPLIT_URLS 포함)부터 복구한 후 진행한다.",
    },
    output: "연결 준비 완료",
  },
  {
    id: 2,
    phase: "모델",
    title: "자동매매 모델 생성 및 작동 전환",
    icon: Bot,
    color: "neon-purple",
    trigger: "새 전략 추가 시",
    goal: "운영할 전략 모델을 만들고 활성화한다",
    operatorAction: [
      "자동매매 > AI 모델 생성 버튼을 누른다.",
      "전략 유형(모멘텀/가치투자/기술적분석/커스텀)을 선택한다.",
      "모델 카드의 스위치를 켜서 '작동중'으로 전환한다.",
    ],
    systemAction: [
      "모델별 기본 프리셋(손절 정책/라더/가중치)을 생성한다.",
      "모델 목록 카드에 수익률/승률/총거래 지표를 표시한다.",
    ],
    checkpoints: [
      "모델 카드가 목록에 생성됨",
      "스위치 ON 후 상태가 작동중으로 변경됨",
    ],
    output: "활성 모델 준비",
  },
  {
    id: 3,
    phase: "세부설정",
    title: "모델 상세 설정 저장",
    icon: SlidersHorizontal,
    color: "neon-green",
    trigger: "모델 선택 후",
    goal: "진입/청산/리스크 기준을 모델별로 확정한다",
    operatorAction: [
      "모델 카드를 클릭해 자동매매 설정 카드를 연다.",
      "계좌(account), maxDailyTrades, AI 최소 신뢰도, 가중치를 조정한다.",
      "entryLadder, stopLossPolicy, AI 재량 스위치를 설정하고 저장한다.",
    ],
    systemAction: [
      "가중치 합계가 100%가 아니면 저장을 거부한다.",
      "라더 총 유닛이 종목당 최대 유닛을 초과하면 저장을 거부한다.",
      "구형 설정 감지 시 전환 안내를 표시한다.",
    ],
    checkpoints: [
      "설정 저장 완료 토스트",
      "저장 후 값 재조회 시 동일하게 반영됨",
    ],
    failCase: {
      condition: "조건검색식(conditionSearchSequences)이 비어 있음",
      action: "조건검색식 섹션에서 최소 1개를 추가하지 않으면 스캔이 실행되지 않는다.",
    },
    output: "모델별 운용 기준 확정",
  },
  {
    id: 4,
    phase: "이슈",
    title: "시장 이슈 종목 등록(선택)",
    icon: Newspaper,
    color: "neon-cyan",
    trigger: "requireMarketIssue 사용 시",
    goal: "당일 이슈 종목만 진입하도록 제어한다",
    operatorAction: [
      "자동매매 > 시장 이슈 종목 관리에서 날짜를 선택한다.",
      "종목/유형/영향도를 입력해 등록한다.",
      "모델 설정에서 requireMarketIssue ON 여부를 결정한다.",
    ],
    systemAction: [
      "이슈 데이터는 날짜(YYYYMMDD) 기준으로 저장/조회한다.",
      "requireMarketIssue ON이면 당일 미등록 종목을 SKIP 처리한다.",
    ],
    checkpoints: [
      "테이블에 등록 종목이 보임",
      "모니터 피드에 시장이슈 미등록 SKIP 사유가 기록됨",
    ],
    output: "이슈 기반 진입 필터 구성",
  },
  {
    id: 5,
    phase: "잡제어",
    title: "배치잡 시작 및 주기 조정",
    icon: ServerCog,
    color: "neon-purple",
    trigger: "운영 시작 전",
    goal: "스캔/매매/학습 등 백그라운드 작업을 실행한다",
    operatorAction: [
      "배치잡 관리에서 필요한 잡을 시작한다.",
      "필요 시 분/초/시각 주기를 수정한다.",
      "테스트 시 즉시 실행 버튼으로 단발 검증한다.",
    ],
    systemAction: [
      "잡 상태, 마지막/다음 실행, 오류 횟수를 표시한다.",
      "시작/중지 상태와 주기 설정을 DB에 저장해 재시작 후 유지한다.",
    ],
    checkpoints: [
      "대상 잡 상태가 '실행 중'",
      "다음 실행 시간(nextRun)이 갱신됨",
    ],
    output: "자동 실행 루프 가동",
  },
  {
    id: 6,
    phase: "스캔",
    title: "후보 종목 수집 사이클",
    icon: Search,
    color: "neon-green",
    trigger: "스캔 잡 주기 도달",
    goal: "매수 평가 대상 후보를 최신화한다",
    operatorAction: [
      "실시간 모니터에서 후보 종목 수와 스캔 시각을 확인한다.",
      "후보가 0건이면 조건검색식/에이전트/장시간 여부를 점검한다.",
    ],
    systemAction: [
      "장중 + 에이전트 연결 상태에서만 스캔 사이클을 진행한다.",
      "조건검색식 결과를 수집하고 DART 위험공시 종목을 제외한다.",
      "최종 후보를 candidate_stocks로 저장한다.",
    ],
    checkpoints: [
      "후보 종목 테이블 갱신",
      "DART 차단/스킵 사유 로그 확인",
    ],
    output: "평가 가능한 후보군 확보",
  },
  {
    id: 7,
    phase: "매매",
    title: "평가·진입·포지션 관리",
    icon: Layers,
    color: "neon-cyan",
    trigger: "매매 잡 주기 도달",
    goal: "보유 포지션 관리와 신규 진입을 수행한다",
    operatorAction: [
      "모니터 피드에서 BUY/SELL/SKIP 사유를 추적한다.",
      "동일 종목 반복 평가를 줄이려면 후보 재평가 쿨다운(120분/하루3회/하루1회)을 설정한다.",
      "SKIP이 많으면 minAiConfidence/필터/투기성 허용값을 재조정한다.",
    ],
    systemAction: [
      "보유 포지션은 익절/손절정책/동적청산/AI결정으로 관리한다.",
      "후보는 시장이슈/신뢰도/재무/유동성/DART/투기성 필터를 통과해야 한다.",
      "AI 진입정책 승인 시 라더 기반 신규 매수, 이후 스케일인/부분익절을 수행한다.",
    ],
    checkpoints: [
      "매매 결정 피드에 사유와 점수가 함께 기록됨",
      "점수 계산식(confidence=가중합/가중치합)과 최소 신뢰도 비교값이 표시됨",
      "포지션/주문 데이터가 누락 없이 반영됨",
    ],
    failCase: {
      condition: "모의 모드인데 실계좌가 선택됨",
      action: "안전장치로 거래가 차단된다. 거래 모드 또는 계좌 타입을 맞춰야 한다.",
    },
    output: "전략 기준 자동 매매 실행",
  },
  {
    id: 8,
    phase: "학습",
    title: "학습 잡 실행과 자동 최적화",
    icon: GraduationCap,
    color: "neon-green",
    trigger: "매일 16:00 / 즉시 실행",
    goal: "성과 데이터로 다음 사이클 파라미터를 개선한다",
    operatorAction: [
      "배치잡 관리에서 학습 잡 시각(기본 16:00)을 확인한다.",
      "테스트 시 학습 잡 '즉시 실행'으로 결과를 점검한다.",
      "자동매매 페이지에서 학습 기록/추천 내용을 확인한다.",
    ],
    systemAction: [
      "ENABLE_ADVANCED_LEARNING=true 일 때만 학습 사이클을 수행한다.",
      "20건 미만은 추천/기록만 만들고 적용은 하지 않는다.",
      "50건 이상 + 안전조건 충족 시에만 자동 반영한다.",
      "가중치/신뢰도/라더/손절정책을 업데이트하고 learning_records에 저장한다.",
    ],
    checkpoints: [
      "학습 실행 후 learning_records가 증가",
      "적용 조건 충족 시 설정값 변경 로그 확인",
    ],
    failCase: {
      condition: "ENABLE_ADVANCED_LEARNING=false 또는 거래 건수 부족",
      action: "학습은 skip되거나 추천만 생성된다. 환경변수와 거래 데이터 수를 먼저 확인한다.",
    },
    output: "학습 결과 기록 및 조건부 자동 최적화",
  },
  {
    id: 9,
    phase: "모니터",
    title: "실시간 운영 점검",
    icon: Monitor,
    color: "neon-purple",
    trigger: "운영 중 상시",
    goal: "문제를 조기에 감지하고 안전하게 재개한다",
    operatorAction: [
      "실시간 모니터에서 엔진 상태 배지와 최근 사이클 시각을 확인한다.",
      "알림 요약(미확인/경고/긴급)을 우선 처리한다.",
      "반복 타임아웃 시 잡 중지 후 에이전트 복구 뒤 재개한다.",
    ],
    systemAction: [
      "30초 주기로 잡 상태/후보/결정 피드를 자동 갱신한다.",
      "에이전트 타임아웃 누적 시 자동 일시중지/쿨다운을 적용할 수 있다.",
    ],
    checkpoints: [
      "엔진 상태가 running으로 유지",
      "critical/warn 알림이 누적되지 않음",
    ],
    output: "안정적인 장중 운영",
  },
];

export default function Tutorial() {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const Icon = step.icon;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4" data-testid="text-tutorial-title">
      <div>
        <h1 className="text-3xl font-bold mb-1">튜토리얼</h1>
        <p className="text-muted-foreground text-sm">
          최신 UI 기준 운영 흐름입니다. 각 단계에서 화면에서 무엇을 눌러야 하는지 중심으로 구성했습니다.
        </p>
      </div>

      <Card className="border-border/40">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {steps.map((s, i) => {
              const SI = s.icon;
              return (
                <div key={s.id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentStep(i)}
                    data-testid={`button-quick-step-${i + 1}`}
                    className={`flex min-h-11 items-center gap-1 px-2 py-1 rounded-md border transition-colors md:min-h-7 ${
                      i === currentStep
                        ? `bg-[hsl(var(--${s.color}))]/20 border-[hsl(var(--${s.color}))]/50 text-[hsl(var(--${s.color}))]`
                        : i < currentStep
                          ? "bg-muted/50 border-border/30 text-muted-foreground"
                          : "border-border/30 text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    <SI className="w-3 h-3" />
                    <span>{s.phase}</span>
                  </button>
                  {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className={`border-[hsl(var(--${step.color}))]/30`}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-4 flex-wrap">
            <div className={`w-12 h-12 rounded-full bg-[hsl(var(--${step.color}))]/15 flex items-center justify-center shrink-0`}>
              <Icon className={`w-6 h-6 text-[hsl(var(--${step.color}))]`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge className={`bg-[hsl(var(--${step.color}))]/20 text-[hsl(var(--${step.color}))] border-[hsl(var(--${step.color}))]/30 text-xs`}>
                  Step {step.id} / {steps.length}
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

        <CardContent className="space-y-4">
          <div className="p-3 rounded-md border border-border/30 bg-muted/20">
            <p className="text-xs text-muted-foreground mb-1">목표</p>
            <p className="text-sm">{step.goal}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="p-3 rounded-md border border-border/30 bg-muted/20">
              <p className="text-sm font-semibold mb-2">운영자 할 일</p>
              <div className="space-y-1.5">
                {step.operatorAction.map((item, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground">{idx + 1}. {item}</p>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-md border border-border/30 bg-muted/20">
              <p className="text-sm font-semibold mb-2">시스템 동작</p>
              <div className="space-y-1.5">
                {step.systemAction.map((item, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground">{idx + 1}. {item}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-md border border-border/30 bg-muted/20">
            <p className="text-sm font-semibold mb-2">확인 포인트</p>
            <div className="space-y-1.5">
              {step.checkpoints.map((item, idx) => (
                <p key={idx} className="text-xs text-muted-foreground">{idx + 1}. {item}</p>
              ))}
            </div>
          </div>

          {step.failCase && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold mb-0.5">실패 분기</p>
                <p className="text-xs text-muted-foreground">조건: {step.failCase.condition}</p>
                <p className="text-xs text-muted-foreground">조치: {step.failCase.action}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-[hsl(var(--neon-green))]/10 border border-[hsl(var(--neon-green))]/20 rounded-md">
            <CheckCircle2 className="w-4 h-4 text-[hsl(var(--neon-green))] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-[hsl(var(--neon-green))] mb-0.5">단계 결과</p>
              <p className="text-xs">{step.output}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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

        <span className="text-xs text-muted-foreground">{currentStep + 1} / {steps.length}</span>

        <Button
          onClick={() => setCurrentStep(s => Math.min(steps.length - 1, s + 1))}
          disabled={currentStep === steps.length - 1}
          className="gap-2"
          data-testid="button-next-step"
        >
          다음
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
