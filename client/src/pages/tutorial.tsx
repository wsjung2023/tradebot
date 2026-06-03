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
    title: "설정 및 에이전트 연동",
    icon: Settings2,
    color: "neon-cyan",
    trigger: "최초 실행 또는 시스템 재시작 시",
    goal: "실제 주문 및 조회가 가능한 물리적 연결 상태를 확보한다.",
    operatorAction: [
      "계좌관리 또는 대시보드에서 계좌번호 8자리와 상품구분(위탁 11 / 위탁종합 10)을 선택해 계좌 등록",
      "계좌관리 > 열쇠 아이콘에서 해당 계좌의 APP KEY/SECRET을 저장",
      "설정 > 거래 모드(모의/실전)가 자신의 계좌와 맞는지 재확인",
      "집 PC에서 Kiwoom Agent를 실행하고 대시보드에서 '연결됨' 배지 확인",
    ],
    systemAction: [
      "8자리 계좌번호에는 선택한 상품구분 코드(11/10)를 붙여 저장하고, 10자리 입력은 그대로 저장한다.",
      "DB에 암호화된 API 키를 저장하고 에이전트와 보안 터널을 형성한다.",
      "에이전트로부터 마지막 폴링 시각과 상태 값을 수신하여 UI에 표시한다.",
    ],
    checkpoints: [
      "계좌번호가 81277026-11 또는 51342627-10처럼 상품구분과 함께 표시되는가?",
      "에이전트 상태 배지가 초록색 '연결됨'으로 표시되는가?",
      "대시보드 상단에 계좌 잔고 데이터가 로드되는가?",
    ],
    failCase: {
      condition: "에이전트 미연결 또는 API 429 에러 발생",
      action: "잡(Job) 주기를 1분 이상으로 늘리고 에이전트 프로그램을 재시작한다.",
    },
    output: "물리적 연동 성공",
  },
  {
    id: 2,
    phase: "모델",
    title: "AI 매매 전략 모델 수립",
    icon: Bot,
    color: "neon-purple",
    trigger: "운영 전략 결정 시",
    goal: "트레이딩 성향에 맞는 AI 모델을 생성하고 기본 골격을 잡는다.",
    operatorAction: [
      "자동매매 > 'AI 모델 생성' 버튼을 클릭",
      "전략 유형(모멘텀/가치투자 등) 선택 및 모델명 설정",
      "모델 상세 설정의 '현재 연결 계좌' 카드에서 실행 계좌와 API 키 등록 여부 확인",
      "모델 카드의 스위치를 '작동중'으로 변경하여 엔진 가동 준비",
    ],
    systemAction: [
      "모델 고유 ID를 생성하고 기본 손절정책/가중치 프리셋을 DB에 할당한다.",
      "모델 config.accountId에 선택 계좌를 저장하여 주문 실행 계좌를 고정한다.",
      "해당 모델이 매매 엔진의 루프에 포함되도록 대기 상태로 전환한다.",
    ],
    checkpoints: [
      "모델 목록에 카드가 정상적으로 나타나는가?",
      "현재 연결 계좌가 보관 계좌가 아니라 활성 계좌로 표시되는가?",
      "작동중 스위치가 활성화되었는가?",
    ],
    output: "전략 모델 베이스라인 확정",
  },
  {
    id: 3,
    phase: "상세설정",
    title: "AI 지능 및 리스크 세부 튜닝",
    icon: SlidersHorizontal,
    color: "neon-green",
    trigger: "모델 생성 직후",
    goal: "AI가 어떤 지표에 가중치를 둘지, 얼마나 공격적으로 진입할지 확정한다.",
    operatorAction: [
      "모델 카드를 클릭하여 상세 설정 패널 진입",
      "가중치 설정: 뉴스/재무/테마 등의 가중치 합을 100%로 맞춤",
      "최소 신뢰도: AI 진입 승인을 위한 허들(보통 60~70) 설정",
      "Entry Ladder: 하락 시 추가 매수할 비중(유닛) 배분 설정",
    ],
    systemAction: [
      "가중치 합계 검증 로직 실행 (100%가 아니면 저장 거부)",
      "라더 유닛 합계와 종목당 최대 유닛 일치 여부 확인",
    ],
    checkpoints: [
      "설정 저장 시 '성공적으로 저장되었습니다' 알림이 뜨는가?",
      "가중치 합이 정확히 100인가?",
    ],
    failCase: {
      condition: "조건검색식이 설정되지 않음",
      action: "하단의 '조건검색식' 섹션에서 키움에서 만든 검색식 명칭을 반드시 추가한다.",
    },
    output: "AI 매매 지능 설정 완료",
  },
  {
    id: 4,
    phase: "잡제어",
    title: "배치잡(Jobs) 루프 가동",
    icon: ServerCog,
    color: "neon-purple",
    trigger: "장 시작 전 또는 운영 개시 시",
    goal: "스캔 -> 평가 -> 주문으로 이어지는 자동화 사이클을 시작한다.",
    operatorAction: [
      "배치잡 관리 > '스캔 잡'과 '매매 잡'의 상태를 '실행 중'으로 변경",
      "주기 설정: 스캔(2~5분), 매매(1~2분) 권장 주기 확인",
    ],
    systemAction: [
      "설정된 주기에 따라 백그라운드 프로세스를 스케줄링한다.",
      "서버 재시작 후에도 이전 잡 상태를 유지하도록 DB를 업데이트한다.",
    ],
    checkpoints: [
      "잡 상태가 초록색 '실행 중' 배지로 변경되는가?",
      "마지막 실행 시간과 다음 실행 시간이 실시간으로 갱신되는가?",
    ],
    output: "자동 매매 엔진 엔진 풀 가동",
  },
  {
    id: 5,
    phase: "스캔",
    title: "후보 종목 자동 수집 및 DART 필터링",
    icon: Search,
    color: "neon-green",
    trigger: "스캔 잡 주기 도달 시",
    goal: "조건검색식에 걸린 종목 중 리스크가 없는 후보군을 선별한다.",
    operatorAction: [
      "실시간 모니터 > '후보 종목' 테이블에서 현재 수집된 리스트 확인",
      "특정 종목이 왜 빠졌는지 DART 필터 기록 확인",
    ],
    systemAction: [
      "에이전트를 통해 조건검색 결과 수집",
      "DART API 연동: 최근 공시 중 횡령/부도 등 치명적 키워드 종목 즉시 제외",
      "유효한 종목만 candidate_stocks 테이블에 업서트(Upsert)",
    ],
    checkpoints: [
      "후보 종목 리스트가 주기에 맞춰 갱신되는가?",
      "DART 위험 공시 종목이 걸러지는가?",
    ],
    output: "신뢰할 수 있는 매수 후보군 확보",
  },
  {
    id: 6,
    phase: "평가",
    title: "AI 통합 분석 및 레인보우 차트 검증",
    icon: Layers,
    color: "neon-cyan",
    trigger: "매매 잡 실행 시",
    goal: "후보 종목의 차트 위치와 AI 점수를 대조하여 최종 진입을 결정한다.",
    operatorAction: [
      "실시간 모니터 > '매매 결정 피드'에서 AI의 실시간 생각 읽기",
      "Confidence 점수와 레인보우 CL 위치(40-55%) 확인",
    ],
    systemAction: [
      "레인보우 차트 계산: 현재가가 CL(Center Line) 근처인지 판별",
      "AI 모델(GPT-4/Claude 등)에 뉴스, 재무, 차트 데이터를 보내 종합 점수 수신",
      "신뢰도 >= 허들 AND 위치 == 초록구간 일 때 주문 명령 생성",
    ],
    checkpoints: [
      "결정 피드에 'BUY', 'SKIP' 사유가 상세히 기록되는가?",
      "레인보우 차트 위치가 50% 근처일 때 진입이 발생하는가?",
    ],
    failCase: {
      condition: "신뢰도는 높으나 레인보우 위치가 노랑/빨강 구간(60% 초과)",
      action: "AI가 '고점 추격 매수' 위험으로 판단하여 진입을 거절(SKIP)한다.",
    },
    output: "데이터 기반 정밀 진입 결정",
  },
  {
    id: 7,
    phase: "매매",
    title: "주문 실행 및 포지션 관리",
    icon: CheckCircle2,
    color: "neon-green",
    trigger: "진입 승인(Accepted) 시",
    goal: "설정된 라더(Ladder)에 따라 주문을 내고 수익을 확정한다.",
    operatorAction: [
      "보유 종목 페이지에서 매수된 종목의 수익률 모니터링",
      "거래내역/매매저널 필터에서 전체·활성·보관·모의·실전·계좌별 조회 범위를 확인",
      "AI 재량 스위치(목표초과보유 등) 작동 여부 관찰",
    ],
    systemAction: [
      "에이전트를 통해 키움 서버에 실제 매수/매도 주문 전송",
      "진입 후 가격 하락 시 라더 계획에 따라 스케일인(추가매수) 실행",
      "매도 조건 우선순위: ExitStage(분할계획) → 종목별익절% → 모델익절% → 물타기익절 → CL분할 → 손절 → 동적청산 → AI거부권 순으로 평가",
    ],
    checkpoints: [
      "실제 계좌에 주문이 체결되는가?",
      "평가손익과 실시간 잔고가 대시보드에 반영되는가?",
    ],
    output: "자동 수익 창출 사이클 완성",
  },
  {
    id: 8,
    phase: "매도전략",
    title: "종목별 분할매도 계획 설정",
    icon: SlidersHorizontal,
    color: "neon-red",
    trigger: "매수 후 포지션 운용 시 또는 매일 08:50 자동",
    goal: "보유 종목별로 '언제, 몇 %를 팔지' 세밀하게 제어하여 최적 청산 타이밍을 잡는다.",
    operatorAction: [
      "포트폴리오 > 종목 행 우측 🎯 버튼 클릭 → 매도전략 다이얼로그 열기",
      "[AI 계획 탭] 'AI 계획 생성' 버튼 → AI가 레인보우·수익률·보유기간 분석 후 2~4단계 자동 생성",
      "[수기 설정 탭] 익절%·손절% 단순 오버라이드 또는 단계별 직접 입력(CL선/수익률/손절률 트리거)",
      "매도계획 배치잡(08:50 KST)을 켜두면 매일 아침 자동으로 계획 갱신됨",
    ],
    systemAction: [
      "holding_exit_plans 테이블에 종목별 ExitStage 배열 저장",
      "1분 사이클마다 ExitStage 조건 평가 → 발동 시 sellRatio만큼 분할 매도, fulfilled=true 처리",
      "모델 레벨 CL 분할매도(rainbowLineSettings.sellWeight)는 별도로 매 1분 평가",
    ],
    checkpoints: [
      "🎯 버튼 클릭 시 다이얼로그가 열리는가?",
      "AI 계획 생성 후 ExitStage 목록이 표시되는가?",
      "선정/탈락 이력에 '단계매도[1차 익절]' 형태 로그가 발생하는가?",
    ],
    failCase: {
      condition: "만료된 모의계좌의 과거 거래내역이 보이지 않음",
      action: "거래내역/매매저널의 계좌 상태 필터를 '전체' 또는 '보관'으로 변경한다. 데이터는 삭제되지 않고 보관 계좌에 남아 있습니다.",
    },
    output: "레인보우·수익률 기반 자동 분할매도 운용",
  },
  {
    id: 9,
    phase: "학습",
    title: "데이터 피드백 및 전략 최적화",
    icon: GraduationCap,
    color: "neon-purple",
    trigger: "매일 16:00 (장 종료 후)",
    goal: "오늘의 매매 결과를 학습하여 내일의 가중치와 허들을 개선한다.",
    operatorAction: [
      "자동매매 > '학습 기록' 탭에서 AI의 개선 추천안 확인",
      "승률/수익률 지표를 보고 수동으로 설정을 보정하거나 자동 반영 확인",
      "모의계좌가 갱신된 경우에도 같은 모델의 전체 거래 이력을 합산해서 해석",
    ],
    systemAction: [
      "모델 기준으로 과거 보관 계좌와 현재 활성 계좌의 매매 로그를 함께 분석",
      "성과가 좋은 지표의 가중치를 높이고, 나쁜 지표는 낮추는 최적화안 생성",
      "안전 조건 충족 시 모델 설정값 자동 업데이트",
    ],
    checkpoints: [
      "학습 기록 테이블에 새로운 분석 리포트가 생성되었는가?",
      "설정값이 성과에 맞춰 조금씩 조정되는가?",
    ],
    output: "진화하는 트레이딩 엔진",
  },
];

export default function Tutorial() {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const Icon = step.icon;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6" data-testid="text-tutorial-title">
      <div className="text-center space-y-2 mb-4">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-gradient-to-r from-[hsl(var(--neon-green))] to-[hsl(var(--neon-cyan))] bg-clip-text text-transparent">
          TradeBot 운영 튜토리얼
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto">
          연결부터 자동 수익 실현까지, 시스템 운영의 모든 단계를 시뮬레이션합니다. 
          각 단계별 핵심 체크포인트를 확인하세요.
        </p>
      </div>

      <Card className="border-border/40 bg-slate-900/20 backdrop-blur-sm overflow-hidden">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            {steps.map((s, i) => {
              const SI = s.icon;
              return (
                <div key={s.id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentStep(i)}
                    data-testid={`button-quick-step-${i + 1}`}
                    className={`flex h-10 items-center gap-2 px-3 py-1 rounded-full border transition-all duration-300 ${
                      i === currentStep
                        ? `bg-[hsl(var(--${s.color}))]/20 border-[hsl(var(--${s.color}))]/50 text-[hsl(var(--${s.color}))] scale-105 shadow-lg shadow-[hsl(var(--${s.color}))]/10`
                        : i < currentStep
                          ? "bg-[hsl(var(--neon-green))]/5 border-[hsl(var(--neon-green))]/20 text-[hsl(var(--neon-green))]/60"
                          : "border-border/30 text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    <SI className="w-3.5 h-3.5" />
                    <span className="font-semibold">{s.phase}</span>
                  </button>
                  {i < steps.length - 1 && <div className="w-4 h-[1px] bg-border/30" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className={`border-[hsl(var(--${step.color}))]/30 shadow-2xl shadow-[hsl(var(--${step.color}))]/5 bg-slate-900/40`}>
        <CardHeader className="pb-4 border-b border-white/5 bg-[hsl(var(--${step.color}))]/5">
          <div className="flex items-start gap-5 flex-wrap">
            <div className={`w-14 h-14 rounded-2xl bg-[hsl(var(--${step.color}))]/15 flex items-center justify-center shrink-0 shadow-inner`}>
              <Icon className={`w-7 h-7 text-[hsl(var(--${step.color}))]`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <Badge className={`bg-[hsl(var(--${step.color}))]/20 text-[hsl(var(--${step.color}))] border-[hsl(var(--${step.color}))]/30 text-[10px] font-bold px-2 py-0.5`}>
                  STEP {step.id} / {steps.length}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-tighter opacity-70">{step.phase}</Badge>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">{step.title}</CardTitle>
              <div className="flex items-center gap-1.5 mt-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest">{step.trigger}</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="p-4 rounded-xl border border-white/5 bg-slate-950/40 relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full bg-[hsl(var(--${step.color}))]`} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">운영 목표</p>
            <p className="text-base text-foreground leading-relaxed font-medium">{step.goal}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-white/5 bg-slate-950/20 hover:bg-slate-950/40 transition-colors">
              <div className="text-xs font-bold mb-3 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                운영자 액션 가이드
              </div>
              <div className="space-y-2.5">
                {step.operatorAction.map((item, idx) => (
                  <div key={idx} className="flex gap-2 text-[13px] leading-relaxed">
                    <span className="text-muted-foreground font-mono">{idx + 1}.</span>
                    <p className="text-muted-foreground/90">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-white/5 bg-slate-950/20 hover:bg-slate-950/40 transition-colors">
              <div className="text-xs font-bold mb-3 flex items-center gap-2 text-[hsl(var(--${step.color}))]">
                <div className={`w-1.5 h-1.5 rounded-full bg-[hsl(var(--${step.color}))]`} />
                시스템 자동 동작
              </div>
              <div className="space-y-2.5">
                {step.systemAction.map((item, idx) => (
                  <div key={idx} className="flex gap-2 text-[13px] leading-relaxed">
                    <span className="text-muted-foreground font-mono">{idx + 1}.</span>
                    <p className="text-muted-foreground/90">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-[hsl(var(--neon-green))]/10 bg-[hsl(var(--neon-green))]/5">
            <p className="text-xs font-bold mb-3 flex items-center gap-2 text-[hsl(var(--neon-green))]">
              <CheckCircle2 className="w-4 h-4" />
              성공 체크포인트
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {step.checkpoints.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded bg-slate-950/40 border border-white/5">
                  <div className="w-1 h-1 rounded-full bg-[hsl(var(--neon-green))]" />
                  <p className="text-[11px] text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {step.failCase && (
            <div className="flex items-start gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl relative">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-red-400 mb-1">장애 분기 및 해결책</p>
                <p className="text-xs text-red-200/70 mb-1.5"><span className="font-bold">조건:</span> {step.failCase.condition}</p>
                <p className="text-xs text-foreground bg-red-500/20 p-2 rounded border border-red-500/30 font-medium">
                  <span className="text-red-300 font-bold mr-1">조치:</span> {step.failCase.action}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-[hsl(var(--neon-green))]/10 border border-[hsl(var(--neon-green))]/20 rounded-xl border-dashed">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[hsl(var(--neon-green))]/20 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-[hsl(var(--neon-green))]" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--neon-green))]">최종 결과</p>
                <p className="text-sm font-bold">{step.output}</p>
              </div>
            </div>
            <Monitor className="w-6 h-6 text-[hsl(var(--neon-green))]/20" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center px-2">
        <Button
          variant="ghost"
          onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className="gap-2 text-muted-foreground hover:text-foreground"
          data-testid="button-prev-step"
        >
          <ChevronLeft className="w-4 h-4" />
          이전 단계
        </Button>

        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep ? "w-6 bg-[hsl(var(--neon-green))]" : "bg-muted-foreground/30"
              }`} 
            />
          ))}
        </div>

        <Button
          variant="outline"
          onClick={() => setCurrentStep(s => Math.min(steps.length - 1, s + 1))}
          disabled={currentStep === steps.length - 1}
          className="gap-2 border-[hsl(var(--neon-green))]/30 text-[hsl(var(--neon-green))] hover:bg-[hsl(var(--neon-green))]/10"
          data-testid="button-next-step"
        >
          다음 단계
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
