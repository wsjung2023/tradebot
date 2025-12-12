import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  ChevronLeft,
  ChevronRight,
  UserPlus, 
  Wallet, 
  TrendingUp, 
  Bot, 
  BarChart3,
  Settings,
  Star,
  History,
  CheckCircle2,
  ArrowRight,
  Home,
  Zap,
  AlertTriangle
} from "lucide-react";

interface TutorialStep {
  id: number;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  description: string;
  steps: string[];
  tips?: string;
  warning?: string;
  linkTo?: string;
  linkText?: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 1,
    title: "회원가입 & 로그인",
    subtitle: "플랫폼 시작하기",
    icon: UserPlus,
    color: "neon-cyan",
    description: "키움 AI 자동매매 플랫폼을 사용하려면 먼저 계정을 만들어야 해요.",
    steps: [
      "앱을 열면 로그인 화면이 나와요",
      "'회원가입' 버튼을 눌러요",
      "이름, 이메일, 비밀번호를 입력해요 (비밀번호는 8자 이상)",
      "'회원가입' 버튼을 눌러요",
      "완료! 자동으로 로그인돼요"
    ],
    tips: "Google 계정이 있다면 'Google 로그인' 버튼으로 더 빠르게 가입할 수 있어요!",
    linkTo: "/login",
    linkText: "로그인 페이지로 가기"
  },
  {
    id: 2,
    title: "계좌 연결하기",
    subtitle: "증권 계좌 등록",
    icon: Wallet,
    color: "neon-purple",
    description: "주식을 사고 팔려면 키움증권 계좌를 연결해야 해요.",
    steps: [
      "왼쪽 메뉴에서 '설정'을 눌러요",
      "'계좌 관리' 부분을 찾아요",
      "'계좌 추가' 버튼을 눌러요",
      "계좌 이름, 번호를 입력해요",
      "계좌 유형을 선택해요 (모의투자 추천!)",
      "'저장' 버튼을 눌러요"
    ],
    tips: "처음에는 '모의투자' 계좌로 연습하세요. 진짜 돈이 들지 않아요!",
    warning: "실전 계좌는 진짜 돈이 들어가요. 모의투자로 충분히 연습한 후 사용하세요.",
    linkTo: "/settings",
    linkText: "설정 페이지로 가기"
  },
  {
    id: 3,
    title: "대시보드 살펴보기",
    subtitle: "내 자산 확인",
    icon: BarChart3,
    color: "neon-green",
    description: "대시보드에서 내 자산 현황을 한눈에 볼 수 있어요.",
    steps: [
      "로그인하면 대시보드가 자동으로 나와요",
      "'총 자산'에서 내가 가진 돈을 확인해요",
      "'오늘 수익'에서 당일 수익률을 봐요",
      "'보유 종목'에서 내가 가진 주식을 확인해요",
      "차트에서 30일 자산 변화를 봐요"
    ],
    tips: "대시보드는 실시간으로 업데이트돼요!",
    linkTo: "/",
    linkText: "대시보드로 가기"
  },
  {
    id: 4,
    title: "주식 거래하기",
    subtitle: "직접 사고 팔기",
    icon: TrendingUp,
    color: "neon-cyan",
    description: "원하는 주식을 직접 사고 팔 수 있어요.",
    steps: [
      "왼쪽 메뉴에서 '거래'를 눌러요",
      "검색창에 주식 이름을 입력해요 (예: 삼성전자)",
      "차트와 현재가를 확인해요",
      "'매수' 또는 '매도' 탭을 선택해요",
      "주문 유형을 선택해요 (지정가 또는 시장가)",
      "가격과 수량을 입력해요",
      "'매수' 또는 '매도' 버튼을 눌러요"
    ],
    tips: "'시장가'로 주문하면 바로 거래돼요. '지정가'는 내가 원하는 가격에 거래돼요.",
    linkTo: "/trading",
    linkText: "거래 페이지로 가기"
  },
  {
    id: 5,
    title: "AI 분석 활용하기",
    subtitle: "GPT가 분석해줘요",
    icon: Bot,
    color: "neon-purple",
    description: "AI가 주식을 분석해서 추천해줘요.",
    steps: [
      "왼쪽 메뉴에서 'AI 분석'을 눌러요",
      "분석하고 싶은 주식 코드를 입력해요 (예: 005930)",
      "'분석 시작' 버튼을 눌러요",
      "AI가 열심히 분석해요 (조금 기다려요)",
      "결과를 확인해요 (강력매수, 매수, 중립, 매도, 강력매도)"
    ],
    tips: "AI의 '신뢰도' 점수도 함께 확인하세요. 높을수록 AI가 확신하는 거예요!",
    linkTo: "/ai-analysis",
    linkText: "AI 분석 페이지로 가기"
  },
  {
    id: 6,
    title: "자동매매 설정하기",
    subtitle: "AI가 알아서 투자",
    icon: Zap,
    color: "neon-green",
    description: "설정해두면 AI가 알아서 주식을 사고 팔아요!",
    steps: [
      "왼쪽 메뉴에서 '자동매매'를 눌러요",
      "'자동매매 활성화' 스위치를 켜요 (초록색이 되면 켜진 거예요)",
      "AI 모델을 선택해요 (gpt-5.1 추천)",
      "1회 최대 투자금을 설정해요",
      "총 투자 한도를 설정해요",
      "끝! 이제 AI가 알아서 투자해요"
    ],
    tips: "자동매매는 서버에서 돌아가요. 컴퓨터를 꺼도 계속 작동해요!",
    warning: "자동매매는 평일 오전 9시 ~ 오후 3시 30분에만 작동해요.",
    linkTo: "/auto-trading",
    linkText: "자동매매 페이지로 가기"
  },
  {
    id: 7,
    title: "관심종목 등록하기",
    subtitle: "자주 보는 종목 저장",
    icon: Star,
    color: "neon-cyan",
    description: "자주 보고 싶은 주식을 저장해둘 수 있어요.",
    steps: [
      "왼쪽 메뉴에서 '관심종목'을 눌러요",
      "'종목 추가' 버튼을 눌러요",
      "주식 코드를 입력해요 (예: 005930)",
      "'추가' 버튼을 눌러요",
      "이제 목록에서 빠르게 볼 수 있어요!"
    ],
    tips: "가격 알림도 설정할 수 있어요. 원하는 가격이 되면 알려줘요!",
    linkTo: "/watchlist",
    linkText: "관심종목 페이지로 가기"
  },
  {
    id: 8,
    title: "거래 내역 확인하기",
    subtitle: "기록 보기",
    icon: History,
    color: "neon-purple",
    description: "내가 사고판 기록을 볼 수 있어요.",
    steps: [
      "왼쪽 메뉴에서 '거래 내역'을 눌러요",
      "모든 거래 기록이 나와요",
      "날짜, 종목, 유형, 가격, 수량을 확인해요",
      "상태를 확인해요 (체결, 대기, 취소)"
    ],
    tips: "'체결'은 거래가 완료됐다는 뜻이에요. '대기'는 아직 거래 중이에요.",
    linkTo: "/trade-history",
    linkText: "거래 내역 페이지로 가기"
  },
  {
    id: 9,
    title: "설정 변경하기",
    subtitle: "나에게 맞게 조정",
    icon: Settings,
    color: "neon-green",
    description: "여러 가지를 바꿀 수 있어요.",
    steps: [
      "왼쪽 메뉴에서 '설정'을 눌러요",
      "계좌 관리: 계좌 추가/삭제/수정",
      "AI 설정: 사용할 AI 모델 선택",
      "알림 설정: 알림 켜기/끄기",
      "자동매매 설정: 투자금, 손절/익절 기준 설정"
    ],
    tips: "처음에는 기본 설정 그대로 사용해도 좋아요!",
    linkTo: "/settings",
    linkText: "설정 페이지로 가기"
  }
];

export default function Tutorial() {
  const [currentStep, setCurrentStep] = useState(0);
  const step = tutorialSteps[currentStep];
  const IconComponent = step.icon;

  const goToNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--neon-cyan))]/5 to-[hsl(var(--neon-purple))]/5 animate-gradient-flow -z-10" />
      
      <div className="p-4 md:p-6 space-y-6 relative z-0 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gradient-cyber mb-2" data-testid="text-tutorial-title">
            사용법 튜토리얼
          </h1>
          <p className="text-muted-foreground">
            처음부터 끝까지 쉽게 따라해보세요
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center gap-2 mb-6">
          {tutorialSteps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentStep 
                  ? `bg-[hsl(var(--${step.color}))] scale-125` 
                  : index < currentStep 
                    ? 'bg-[hsl(var(--neon-green))]' 
                    : 'bg-muted'
              }`}
              data-testid={`button-step-${index + 1}`}
            />
          ))}
        </div>

        {/* Step counter */}
        <div className="text-center">
          <Badge variant="outline" className="text-lg px-4 py-1">
            {currentStep + 1} / {tutorialSteps.length}
          </Badge>
        </div>

        {/* Main content card */}
        <Card className={`border-[hsl(var(--${step.color}))]/30 shadow-lg`}>
          <CardHeader className="text-center pb-4">
            <div className={`w-20 h-20 mx-auto rounded-full bg-[hsl(var(--${step.color}))]/20 flex items-center justify-center mb-4`}>
              <IconComponent className={`w-10 h-10 text-[hsl(var(--${step.color}))]`} />
            </div>
            <CardTitle className="text-2xl md:text-3xl flex items-center justify-center gap-3">
              <span className={`text-[hsl(var(--${step.color}))]`}>Step {step.id}.</span>
              {step.title}
            </CardTitle>
            <CardDescription className="text-base">
              {step.subtitle}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Description */}
            <p className="text-center text-lg">
              {step.description}
            </p>

            {/* Steps list */}
            <div className="space-y-3 bg-muted/30 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3">따라하기:</h3>
              {step.steps.map((text, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full bg-[hsl(var(--${step.color}))]/20 flex items-center justify-center flex-shrink-0`}>
                    <span className={`text-sm font-bold text-[hsl(var(--${step.color}))]`}>{index + 1}</span>
                  </div>
                  <p className="text-base pt-0.5">{text}</p>
                </div>
              ))}
            </div>

            {/* Tips */}
            {step.tips && (
              <div className="bg-[hsl(var(--neon-cyan))]/10 border border-[hsl(var(--neon-cyan))]/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[hsl(var(--neon-cyan))] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-[hsl(var(--neon-cyan))]">팁!</p>
                    <p className="text-sm">{step.tips}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Warning */}
            {step.warning && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-yellow-500">주의!</p>
                    <p className="text-sm">{step.warning}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Link to page */}
            {step.linkTo && (
              <div className="text-center pt-2">
                <Link href={step.linkTo}>
                  <Button 
                    variant="outline" 
                    className={`border-[hsl(var(--${step.color}))]/50 hover:bg-[hsl(var(--${step.color}))]/10`}
                    data-testid={`button-goto-${step.linkTo.replace('/', '') || 'home'}`}
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    {step.linkText}
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation buttons */}
        <div className="flex justify-between items-center pt-4">
          <Button
            variant="outline"
            onClick={goToPrev}
            disabled={currentStep === 0}
            className="gap-2"
            data-testid="button-prev-step"
          >
            <ChevronLeft className="w-4 h-4" />
            이전
          </Button>

          <Link href="/">
            <Button variant="ghost" className="gap-2" data-testid="button-goto-dashboard">
              <Home className="w-4 h-4" />
              대시보드
            </Button>
          </Link>

          <Button
            onClick={goToNext}
            disabled={currentStep === tutorialSteps.length - 1}
            className={`gap-2 bg-[hsl(var(--${step.color}))] hover:bg-[hsl(var(--${step.color}))]/80`}
            data-testid="button-next-step"
          >
            다음
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Completion message */}
        {currentStep === tutorialSteps.length - 1 && (
          <Card className="mt-8 border-[hsl(var(--neon-green))]/30 bg-[hsl(var(--neon-green))]/5">
            <CardContent className="py-8 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-[hsl(var(--neon-green))]" />
              <h3 className="text-2xl font-bold mb-2 text-[hsl(var(--neon-green))]">
                축하합니다! 튜토리얼 완료!
              </h3>
              <p className="text-muted-foreground mb-6">
                이제 키움 AI 자동매매 플랫폼을 자유롭게 사용할 수 있어요!
              </p>
              <Link href="/">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-[hsl(var(--neon-cyan))] to-[hsl(var(--neon-purple))]"
                  data-testid="button-start-trading"
                >
                  지금 시작하기
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Quick step navigation */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">빠른 이동</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {tutorialSteps.map((s, index) => {
                const StepIcon = s.icon;
                return (
                  <Button
                    key={index}
                    variant={index === currentStep ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentStep(index)}
                    className={`flex-col h-auto py-3 ${index === currentStep ? `bg-[hsl(var(--${s.color}))]` : ''}`}
                    data-testid={`button-quick-step-${index + 1}`}
                  >
                    <StepIcon className="w-5 h-5 mb-1" />
                    <span className="text-xs">{index + 1}단계</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
