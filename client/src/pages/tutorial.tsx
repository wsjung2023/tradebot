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
  Search,
  ServerCog,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";

type StepColor = "neon-cyan" | "neon-purple" | "neon-green" | "neon-red";

// Static Tailwind classes — must be string literals for the scanner to pick them up
const COLOR: Record<StepColor, {
  text: string; border: string; bg: string; iconBg: string;
  badgeBg: string; badgeText: string; badgeBorder: string;
  dot: string; navActive: string; navDone: string;
  accentBg: string; accentBorder: string;
}> = {
  "neon-cyan": {
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/5",
    iconBg: "bg-cyan-500/15",
    badgeBg: "bg-cyan-500/20",
    badgeText: "text-cyan-700 dark:text-cyan-300",
    badgeBorder: "border-cyan-500/30",
    dot: "bg-cyan-500",
    navActive: "bg-cyan-500/20 border-cyan-500/50 text-cyan-600 dark:text-cyan-400",
    navDone: "bg-emerald-500/5 border-emerald-500/20 text-emerald-600/60 dark:text-emerald-400/60",
    accentBg: "bg-cyan-500/5",
    accentBorder: "border-cyan-500/15",
  },
  "neon-purple": {
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/30",
    bg: "bg-purple-500/5",
    iconBg: "bg-purple-500/15",
    badgeBg: "bg-purple-500/20",
    badgeText: "text-purple-700 dark:text-purple-300",
    badgeBorder: "border-purple-500/30",
    dot: "bg-purple-500",
    navActive: "bg-purple-500/20 border-purple-500/50 text-purple-600 dark:text-purple-400",
    navDone: "bg-emerald-500/5 border-emerald-500/20 text-emerald-600/60 dark:text-emerald-400/60",
    accentBg: "bg-purple-500/5",
    accentBorder: "border-purple-500/15",
  },
  "neon-green": {
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    iconBg: "bg-emerald-500/15",
    badgeBg: "bg-emerald-500/20",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    badgeBorder: "border-emerald-500/30",
    dot: "bg-emerald-500",
    navActive: "bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
    navDone: "bg-emerald-500/5 border-emerald-500/20 text-emerald-600/60 dark:text-emerald-400/60",
    accentBg: "bg-emerald-500/5",
    accentBorder: "border-emerald-500/15",
  },
  "neon-red": {
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    iconBg: "bg-red-500/15",
    badgeBg: "bg-red-500/20",
    badgeText: "text-red-700 dark:text-red-300",
    badgeBorder: "border-red-500/30",
    dot: "bg-red-500",
    navActive: "bg-red-500/20 border-red-500/50 text-red-600 dark:text-red-400",
    navDone: "bg-emerald-500/5 border-emerald-500/20 text-emerald-600/60 dark:text-emerald-400/60",
    accentBg: "bg-red-500/5",
    accentBorder: "border-red-500/15",
  },
};

interface TutorialStep {
  id: number;
  phase: string;
  title: string;
  icon: any;
  color: StepColor;
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
    title: "설정 및 API 연결",
    icon: Settings2,
    color: "neon-cyan",
    trigger: "최초 실행 또는 시스템 재시작 시",
    goal: "실제 주문 및 조회가 가능한 물리적 연결 상태를 확보한다.",
    operatorAction: [
      "계좌관리에서 계좌번호 8자리와 상품구분(위탁 11 / 위탁종합 10)을 선택하여 계좌 등록",
      "계좌관리 > 열쇠 아이콘에서 해당 계좌의 APP KEY/SECRET 저장",
      "설정 > 거래 모드(모의/실전)가 자신의 계좌 타입과 맞는지 확인",
      "운영 상황실에서 엔진 상태가 'running'이고 에러가 없는지 확인",
    ],
    systemAction: [
      "8자리 계좌번호에는 선택한 상품구분 코드(11/10)를 붙여 저장하고, 10자리 입력은 그대로 저장한다.",
      "DB에 암호화된 API 키를 저장하고 키움 REST API 접근 경로를 초기화한다.",
      "잔고갱신 잡(5분 주기)이 키움 서버에서 계좌 잔고를 동기화한다.",
    ],
    checkpoints: [
      "계좌번호가 81277026-11처럼 상품구분과 함께 저장되었는가?",
      "운영 상황실에서 엔진 상태가 'running'인가?",
      "대시보드 상단에 계좌 잔고 데이터가 로드되는가?",
    ],
    failCase: {
      condition: "API 429 에러 발생 또는 계좌 정보가 보이지 않음",
      action: "설정 > 거래 모드와 계좌 유형이 일치하는지 확인. 스캔/매매 잡 주기를 1분 이상으로 늘린다.",
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
      "자동매매 > 'AI 모델 생성' 버튼 클릭",
      "전략 유형(모멘텀/가치투자 등) 선택 및 모델명 설정",
      "모델 상세 설정의 '현재 연결 계좌' 카드에서 실행 계좌와 API 키 등록 여부 확인",
      "모델 카드의 스위치를 '작동중'으로 변경하여 엔진 가동 준비",
    ],
    systemAction: [
      "모델 고유 ID를 생성하고 기본 손절정책/가중치 프리셋을 DB에 할당한다.",
      "모델 config.accountId에 선택 계좌를 저장하여 주문 실행 계좌를 고정한다.",
      "해당 모델이 매매 엔진 루프에 포함되도록 대기 상태로 전환한다.",
    ],
    checkpoints: [
      "모델 목록에 카드가 정상적으로 나타나는가?",
      "현재 연결 계좌가 활성 계좌로 표시되는가?",
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
      action: "상세 설정 '조건검색식' 섹션에서 키움 HTS에서 만든 검색식 이름을 반드시 추가한다. 사용 가이드 > '키움 조건검색식 & 차트 수식 설정' 섹션 참조.",
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
    goal: "스캔 → 평가 → 주문으로 이어지는 자동화 사이클을 시작한다.",
    operatorAction: [
      "배치잡 관리 > '스캔 잡'과 '매매 잡'의 상태를 '실행 중'으로 변경",
      "권장 주기: 스캔 30분, 매매 1분 (과도하게 줄이면 429 에러 발생)",
      "학습 잡(16:00 KST 자동)과 매도계획 잡(08:50 KST 자동)도 활성화 권장",
    ],
    systemAction: [
      "설정된 주기에 따라 백그라운드 프로세스를 스케줄링한다.",
      "서버 재시작 후에도 이전 잡 상태를 유지하도록 DB를 업데이트한다.",
      "잡 상태, 마지막 실행 시각, 다음 실행 예정 시각을 실시간 갱신한다.",
    ],
    checkpoints: [
      "잡 상태가 초록색 '실행 중' 배지로 변경되는가?",
      "마지막 실행 시간과 다음 실행 시간이 실시간으로 갱신되는가?",
    ],
    output: "자동 매매 엔진 풀 가동",
  },
  {
    id: 5,
    phase: "스캔",
    title: "후보 종목 자동 수집 및 DART 필터링",
    icon: Search,
    color: "neon-green",
    trigger: "스캔 잡 주기 도달 시 (30분)",
    goal: "조건검색식에 걸린 종목 중 리스크가 없는 후보군을 선별한다.",
    operatorAction: [
      "뒷차기2 스캔 메뉴에서 현재 수집된 후보 종목 리스트 확인",
      "선정/탈락 이력에서 특정 종목이 왜 빠졌는지 DART 필터 기록 확인",
    ],
    systemAction: [
      "키움 API로 조건검색 결과를 수집",
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
    trigger: "매매 잡 실행 시 (1분마다)",
    goal: "후보 종목의 차트 위치와 AI 점수를 대조하여 최종 진입을 결정한다.",
    operatorAction: [
      "선정/탈락 이력에서 AI의 매수/SKIP 사유 실시간 확인",
      "Confidence 점수와 레인보우 CL 위치(40~55%) 확인",
    ],
    systemAction: [
      "레인보우 차트 계산: 현재가의 240일 범위 위치 % 산출, CL(Center Line=50%) 근처인지 판별",
      "Claude AI에 뉴스·재무·차트 데이터를 전송하여 종합 신뢰도 점수 수신",
      "신뢰도 >= 허들 AND CL 위치 40%~55% 구간일 때 주문 명령 생성",
    ],
    checkpoints: [
      "선정/탈락 이력에 'BUY', 'SKIP' 사유가 상세히 기록되는가?",
      "레인보우 차트 위치가 CL 근처(50%)일 때 진입이 발생하는가?",
    ],
    failCase: {
      condition: "신뢰도는 높으나 레인보우 위치가 노랑/빨강 구간(60% 초과)",
      action: "AI가 '고점 추격 매수' 위험으로 판단하여 진입을 거절(SKIP)한다. 정상 동작입니다.",
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
      "포트폴리오 페이지에서 매수된 종목의 수익률 모니터링",
      "거래내역/매매저널 필터에서 전체·활성·보관·모의·실전·계좌별 조회 범위 확인",
      "AI 재량 스위치(목표초과보유, 추가매수 허용 등) 작동 여부 관찰",
    ],
    systemAction: [
      "키움 REST API를 통해 실제 매수/매도 주문 전송",
      "진입 후 가격 하락 시 Entry Ladder 계획에 따라 스케일인(추가매수) 실행",
      "매도 우선순위: ExitStage → 종목별익절% → 모델익절% → 물타기익절 → CL분할 → 손절 → 동적청산 → AI거부권",
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
      "[수기 설정 탭] 익절%·손절% 단순 오버라이드 또는 단계별 트리거 직접 입력",
      "매도계획 배치잡(08:50 KST)을 켜두면 매일 아침 자동으로 계획 갱신됨",
    ],
    systemAction: [
      "holding_exit_plans 테이블에 종목별 ExitStage 배열 저장",
      "1분 사이클마다 ExitStage 조건 평가 → 발동 시 sellRatio만큼 분할 매도, fulfilled=true 처리",
      "ExitStage 이외의 모델 레벨 CL 분할매도(rainbowLineSettings.sellWeight)는 별도로 1분 평가",
    ],
    checkpoints: [
      "🎯 버튼 클릭 시 매도전략 다이얼로그가 열리는가?",
      "AI 계획 생성 후 ExitStage 목록이 표시되는가?",
      "선정/탈락 이력에 '단계매도[1차 익절]' 형태 로그가 발생하는가?",
    ],
    failCase: {
      condition: "만료된 모의계좌의 과거 거래내역이 보이지 않음",
      action: "거래내역/매매저널의 계좌 상태 필터를 '전체' 또는 '보관'으로 변경한다. 계좌 삭제가 아닌 보관 처리 시 데이터는 유지됩니다.",
    },
    output: "레인보우·수익률 기반 자동 분할매도 운용",
  },
  {
    id: 9,
    phase: "학습",
    title: "데이터 피드백 및 전략 최적화",
    icon: GraduationCap,
    color: "neon-purple",
    trigger: "매일 16:00 KST (장 종료 후 자동)",
    goal: "오늘의 매매 결과를 학습하여 내일의 가중치와 허들을 개선한다.",
    operatorAction: [
      "자동매매 페이지의 '학습 파라미터 제안' 카드는 항상 표시됨 — 제안이 없으면 '마지막 학습: 날짜 — 데이터 부족/최적 상태' 메시지 확인",
      "제안 카드 '검토 필요' 섹션에서 파라미터 변경 내용을 확인 후 '적용' 또는 '무시' 클릭",
      "설정 > '학습 파라미터 적용 방식' 토글을 ON으로 전환 시 현재 pending 제안이 즉시 전부 적용되고 '자동 적용됨' 섹션에 기록됨",
      "이후 학습잡 실행 시에도 autoApply=ON이면 변경 내용을 '자동 적용됨'으로 기록하여 무엇이 바뀌었는지 확인 가능",
    ],
    systemAction: [
      "모델 기준으로 과거 보관 계좌 + 현재 활성 계좌의 매매 로그를 함께 분석 (최소 20건)",
      "autoApply=OFF: 제안을 pending 상태로 DB 저장 → '검토 필요' 섹션에 표시. autoApply=ON: 즉시 설정에 반영 후 auto_applied 상태로 기록",
      "사용자가 '적용' 클릭 시 해당 파라미터를 자동으로 모델 설정에 반영 (applied 상태로 전환)",
    ],
    checkpoints: [
      "학습 파라미터 제안 카드가 제안 없어도 항상 표시되는가?",
      "제안 적용 후 설정값이 실제로 바뀌는가?",
      "autoApply=ON 토글 시 pending 제안이 즉시 '자동 적용됨' 섹션으로 이동하는가?",
    ],
    output: "진화하는 트레이딩 엔진",
  },
];

export default function Tutorial() {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const Icon = step.icon;
  const C = COLOR[step.color];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6" data-testid="text-tutorial-title">
      <div className="text-center space-y-2 mb-4">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-gradient-to-r from-cyan-500 to-emerald-500 bg-clip-text text-transparent">
          TradeBot 운영 튜토리얼
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto">
          연결부터 자동 수익 실현까지, 시스템 운영의 모든 단계를 시뮬레이션합니다.
          각 단계별 핵심 체크포인트를 확인하세요.
        </p>
      </div>

      {/* 단계 네비게이션 */}
      <Card className="border-border/40 bg-card overflow-hidden">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
            {steps.map((s, i) => {
              const SI = s.icon;
              const isActive = i === currentStep;
              const isDone = i < currentStep;
              const navClass = isActive
                ? COLOR[s.color].navActive
                : isDone
                  ? COLOR[s.color].navDone
                  : "border-border/30 text-muted-foreground hover:bg-muted/30";

              return (
                <div key={s.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentStep(i)}
                    data-testid={`button-quick-step-${i + 1}`}
                    className={`flex h-9 items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all duration-200 ${navClass} ${isActive ? "scale-105 shadow-sm" : ""}`}
                  >
                    <SI className="w-3 h-3 shrink-0" />
                    <span className="font-semibold text-[11px]">{s.phase}</span>
                  </button>
                  {i < steps.length - 1 && <div className="w-3 h-px bg-border/30" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 현재 단계 카드 */}
      <Card className={`${C.border} shadow-xl`}>
        <CardHeader className={`pb-4 border-b border-border/20 ${C.bg}`}>
          <div className="flex items-start gap-5 flex-wrap">
            <div className={`w-14 h-14 rounded-2xl ${C.iconBg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-7 h-7 ${C.text}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <Badge className={`${C.badgeBg} ${C.badgeText} ${C.badgeBorder} text-[10px] font-bold px-2 py-0.5`}>
                  STEP {step.id} / {steps.length}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-tighter opacity-60">
                  {step.phase}
                </Badge>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">{step.title}</CardTitle>
              <div className="flex items-center gap-1.5 mt-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest">
                  {step.trigger}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          {/* 목표 */}
          <div className={`p-4 rounded-xl border ${C.accentBorder} ${C.accentBg} relative overflow-hidden`}>
            <div className={`absolute top-0 left-0 w-1 h-full ${C.dot} rounded-l-xl`} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">운영 목표</p>
            <p className="text-base text-foreground leading-relaxed font-medium">{step.goal}</p>
          </div>

          {/* 액션 2열 */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* 운영자 */}
            <div className="p-4 rounded-xl border border-border/30 bg-muted/10">
              <div className="text-xs font-bold mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                운영자 액션 가이드
              </div>
              <div className="space-y-2.5">
                {step.operatorAction.map((item, idx) => (
                  <div key={idx} className="flex gap-2 text-[12.5px] leading-relaxed">
                    <span className="text-muted-foreground font-mono font-bold shrink-0">{idx + 1}.</span>
                    <p className="text-foreground/80">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 시스템 */}
            <div className={`p-4 rounded-xl border ${C.accentBorder} ${C.accentBg}`}>
              <div className={`text-xs font-bold mb-3 flex items-center gap-2 ${C.text}`}>
                <div className={`w-2 h-2 rounded-full ${C.dot}`} />
                시스템 자동 동작
              </div>
              <div className="space-y-2.5">
                {step.systemAction.map((item, idx) => (
                  <div key={idx} className="flex gap-2 text-[12.5px] leading-relaxed">
                    <span className="text-muted-foreground font-mono font-bold shrink-0">{idx + 1}.</span>
                    <p className="text-foreground/80">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 체크포인트 */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <p className="text-xs font-bold mb-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              성공 체크포인트
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {step.checkpoints.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2.5 rounded-md border border-emerald-500/15 bg-background/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <p className="text-xs text-foreground/75 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 실패 분기 */}
          {step.failCase && (
            <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-900/15 border border-red-300 dark:border-red-500/25 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-1">장애 분기 및 해결책</p>
                <p className="text-xs text-red-800 dark:text-red-300/80 mb-2">
                  <span className="font-bold">조건:</span> {step.failCase.condition}
                </p>
                <p className="text-xs text-foreground font-medium bg-red-100 dark:bg-red-900/30 p-2 rounded border border-red-300/50 dark:border-red-500/20">
                  <span className="text-red-600 dark:text-red-400 font-bold mr-1">조치:</span>
                  {step.failCase.action}
                </p>
              </div>
            </div>
          )}

          {/* 최종 결과 */}
          <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-300/50 dark:border-emerald-500/20 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">최종 결과</p>
                <p className="text-sm font-bold text-foreground">{step.output}</p>
              </div>
            </div>
            <Monitor className="w-6 h-6 text-emerald-300 dark:text-emerald-700" />
          </div>
        </CardContent>
      </Card>

      {/* 이전/다음 버튼 */}
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

        <div className="flex gap-1.5 items-center">
          {steps.map((s, i) => (
            <div
              key={i}
              onClick={() => setCurrentStep(i)}
              className={`cursor-pointer h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? `w-6 ${COLOR[s.color].dot}`
                  : "w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>

        <Button
          variant="outline"
          onClick={() => setCurrentStep(s => Math.min(steps.length - 1, s + 1))}
          disabled={currentStep === steps.length - 1}
          className="gap-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          data-testid="button-next-step"
        >
          다음 단계
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
