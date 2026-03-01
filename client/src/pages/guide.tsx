import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  UserPlus, 
  Wallet, 
  TrendingUp, 
  Bot, 
  AlertCircle, 
  Settings, 
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Zap
} from "lucide-react";

export default function Guide() {
  return (
    <div className="relative min-h-screen">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--neon-cyan))]/5 to-[hsl(var(--neon-purple))]/5 animate-gradient-flow -z-10" />
      
      <div className="p-6 space-y-6 relative z-0 max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gradient-cyber mb-4" data-testid="text-guide-title">
            시작 가이드
          </h1>
          <p className="text-lg text-muted-foreground">
            키움 AI 자동매매 플랫폼 사용 방법을 단계별로 안내합니다
          </p>
        </div>

        {/* Step 1: 회원가입 */}
        <Card className="hover-elevate border-[hsl(var(--neon-cyan))]/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--neon-cyan))]/20 flex items-center justify-center">
                <span className="text-xl font-bold text-[hsl(var(--neon-cyan))]">1</span>
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[hsl(var(--neon-cyan))]" />
                  회원가입 및 로그인
                </CardTitle>
                <CardDescription>플랫폼 사용을 위한 계정 생성</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[hsl(var(--neon-green))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">이메일로 회원가입</p>
                <p className="text-sm text-muted-foreground">
                  이메일과 비밀번호를 입력하여 계정을 생성하세요 (비밀번호 최소 8자)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[hsl(var(--neon-green))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Google 간편 로그인</p>
                <p className="text-sm text-muted-foreground">
                  Google 계정으로 빠르게 로그인할 수 있습니다
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: 계좌 연동 */}
        <Card className="hover-elevate border-[hsl(var(--neon-purple))]/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--neon-purple))]/20 flex items-center justify-center">
                <span className="text-xl font-bold text-[hsl(var(--neon-purple))]">2</span>
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-[hsl(var(--neon-purple))]" />
                  키움증권 계좌 연동
                </CardTitle>
                <CardDescription>거래를 위한 증권 계좌 등록</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-[hsl(var(--neon-purple))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">대시보드에서 '계좌 추가' 클릭</p>
                <p className="text-sm text-muted-foreground">
                  로그인 후 대시보드 우측 상단의 '계좌 추가' 버튼을 누르세요
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-[hsl(var(--neon-purple))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">계좌번호 입력</p>
                <p className="text-sm text-muted-foreground">
                  키움증권 계좌번호를 입력하세요 (하이픈 없이 숫자만 입력 권장)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-[hsl(var(--neon-purple))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">계좌 유형 선택</p>
                <p className="text-sm text-muted-foreground">
                  실계좌 또는 모의투자 계좌를 선택하세요 (처음에는 모의투자 권장)
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-500">안전 팁</p>
                  <p className="text-sm text-muted-foreground">
                    처음에는 모의투자로 시작하여 시스템에 익숙해진 후 실계좌를 사용하세요
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: 대시보드 확인 */}
        <Card className="hover-elevate border-[hsl(var(--neon-green))]/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--neon-green))]/20 flex items-center justify-center">
                <span className="text-xl font-bold text-[hsl(var(--neon-green))]">3</span>
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[hsl(var(--neon-green))]" />
                  대시보드 활용
                </CardTitle>
                <CardDescription>실시간 자산 현황 모니터링</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="p-3 bg-card/50 rounded-md border">
                <p className="font-medium text-sm mb-1">총 자산</p>
                <p className="text-xs text-muted-foreground">
                  현재 보유 중인 총 자산 금액을 실시간으로 확인
                </p>
              </div>
              <div className="p-3 bg-card/50 rounded-md border">
                <p className="font-medium text-sm mb-1">오늘 수익</p>
                <p className="text-xs text-muted-foreground">
                  당일 수익률과 수익금을 실시간 업데이트
                </p>
              </div>
              <div className="p-3 bg-card/50 rounded-md border">
                <p className="font-medium text-sm mb-1">포트폴리오 구성</p>
                <p className="text-xs text-muted-foreground">
                  종목별 보유 비중을 차트로 시각화
                </p>
              </div>
              <div className="p-3 bg-card/50 rounded-md border">
                <p className="font-medium text-sm mb-1">자산 추이</p>
                <p className="text-xs text-muted-foreground">
                  최근 30일간 자산 변화를 그래프로 확인
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 4: 수동 거래 */}
        <Card className="hover-elevate border-[hsl(var(--neon-cyan))]/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--neon-cyan))]/20 flex items-center justify-center">
                <span className="text-xl font-bold text-[hsl(var(--neon-cyan))]">4</span>
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[hsl(var(--neon-cyan))]" />
                  주식 거래하기
                </CardTitle>
                <CardDescription>실시간 호가와 차트를 보며 직접 매매</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-[hsl(var(--neon-cyan))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">거래 메뉴 이동</p>
                <p className="text-sm text-muted-foreground">
                  좌측 메뉴에서 '거래' 탭을 클릭하세요
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-[hsl(var(--neon-cyan))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">종목 검색</p>
                <p className="text-sm text-muted-foreground">
                  종목코드 또는 종목명으로 원하는 주식을 검색하세요 (예: 삼성전자, 005930)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-[hsl(var(--neon-cyan))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">실시간 정보 확인</p>
                <p className="text-sm text-muted-foreground">
                  현재가, 일봉 차트, 호가 10단을 확인하며 매매 타이밍 결정
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-[hsl(var(--neon-cyan))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">주문 실행</p>
                <p className="text-sm text-muted-foreground">
                  매수/매도, 가격, 수량을 입력하고 주문 버튼을 클릭하세요
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 5: AI 분석 활용 */}
        <Card className="hover-elevate border-[hsl(var(--neon-purple))]/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--neon-purple))]/20 flex items-center justify-center">
                <span className="text-xl font-bold text-[hsl(var(--neon-purple))]">5</span>
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-[hsl(var(--neon-purple))]" />
                  AI 분석 활용
                </CardTitle>
                <CardDescription>GPT-4 기반 종목 분석 및 추천</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[hsl(var(--neon-green))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">종목 분석 요청</p>
                <p className="text-sm text-muted-foreground">
                  'AI 분석' 메뉴에서 종목코드를 입력하면 GPT-4가 실시간 분석 제공
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[hsl(var(--neon-green))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">포트폴리오 최적화</p>
                <p className="text-sm text-muted-foreground">
                  현재 보유 종목을 분석하여 최적의 포트폴리오 구성 추천
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[hsl(var(--neon-green))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">신뢰도 점수 확인</p>
                <p className="text-sm text-muted-foreground">
                  AI가 제시하는 신뢰도 점수를 참고하여 투자 결정
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 6: 자동매매 설정 */}
        <Card className="hover-elevate border-[hsl(var(--neon-green))]/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--neon-green))]/20 flex items-center justify-center">
                <span className="text-xl font-bold text-[hsl(var(--neon-green))]">6</span>
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[hsl(var(--neon-green))]" />
                  AI 자동매매 시작
                </CardTitle>
                <CardDescription>AI가 자동으로 매매하도록 설정</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-[hsl(var(--neon-green))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">자동매매 모델 생성</p>
                <p className="text-sm text-muted-foreground">
                  '자동매매' 메뉴에서 새 모델을 생성하고 투자 전략, 위험도, 예산을 설정
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-[hsl(var(--neon-green))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">모델 활성화</p>
                <p className="text-sm text-muted-foreground">
                  생성한 모델을 활성화하면 AI가 자동으로 시장을 분석하고 매매 실행
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-[hsl(var(--neon-green))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">실시간 모니터링</p>
                <p className="text-sm text-muted-foreground">
                  AI 추천 내역과 자동 실행된 거래를 실시간으로 확인
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-500">중요 주의사항</p>
                  <p className="text-sm text-muted-foreground">
                    자동매매는 반드시 모의투자로 충분히 테스트한 후 실계좌에 적용하세요
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 7: 거래 내역 및 설정 */}
        <Card className="hover-elevate border-[hsl(var(--neon-cyan))]/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--neon-cyan))]/20 flex items-center justify-center">
                <span className="text-xl font-bold text-[hsl(var(--neon-cyan))]">7</span>
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[hsl(var(--neon-cyan))]" />
                  거래 내역 및 설정
                </CardTitle>
                <CardDescription>거래 이력 확인 및 시스템 설정</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[hsl(var(--neon-green))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">거래 내역 조회</p>
                <p className="text-sm text-muted-foreground">
                  '거래 내역' 메뉴에서 주문/체결 내역과 상세 거래 로그 확인
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[hsl(var(--neon-green))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">관심종목 관리</p>
                <p className="text-sm text-muted-foreground">
                  관심 있는 종목을 등록하고 가격 알림을 설정하세요
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[hsl(var(--neon-green))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">시스템 설정</p>
                <p className="text-sm text-muted-foreground">
                  '설정' 메뉴에서 거래 모드(실전/모의), 알림 설정 등을 변경
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <Card className="glass-card border-[hsl(var(--neon-purple))]/30">
            <CardContent className="py-8">
              <Bot className="w-16 h-16 mx-auto mb-4 text-[hsl(var(--neon-purple))] animate-pulse-glow" />
              <h3 className="text-2xl font-bold mb-2 text-gradient-cyber">
                준비 완료!
              </h3>
              <p className="text-muted-foreground mb-6">
                이제 키움 AI 자동매매 플랫폼을 완벽하게 활용할 수 있습니다
              </p>
              <div className="flex justify-center gap-4">
                <a 
                  href="/"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-[hsl(var(--neon-cyan))] to-[hsl(var(--neon-purple))] text-white hover:opacity-90 h-10 px-6"
                >
                  대시보드로 이동
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
