import React from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Trading from "@/pages/trading";
import AIAnalysis from "@/pages/ai-analysis";
import AutoTrading from "@/pages/auto-trading";
import Portfolio from "@/pages/portfolio";
import TradeHistory from "@/pages/trade-history";
import TradeJournal from "@/pages/trade-journal";
import Watchlist from "@/pages/watchlist";
import Settings from "@/pages/settings";
import Guide from "@/pages/guide";
import Tutorial from "@/pages/tutorial";
import Accounts from "@/pages/accounts";
import ConditionFormulas from "@/pages/condition-formulas";
import ConditionScreening from "@/pages/condition-screening";
import WatchlistSignals from "@/pages/watchlist-signals";
import ChartFormulaEditor from "@/pages/chart-formula-editor";
import BackAttackScan from "@/pages/backattack-scan";
import AdminJobs from "@/pages/admin-jobs";
import AdminUsers from "@/pages/admin-users";
import AdminPrivateCloud from "@/pages/admin-private-cloud";
import Billing from "@/pages/billing";
import Onboarding from "@/pages/onboarding";
import Monitoring from "@/pages/monitoring";
import CandidateDecisions from "@/pages/candidate-decisions";
import AiUsage from "@/pages/ai-usage";
import heroA from "@assets/stock_images/futuristic_ai_artifi_11460e5f.jpg";
import heroB from "@assets/stock_images/dynamic_stock_market_da45a7fb.jpg";
import heroC from "@assets/stock_images/futuristic_ai_artifi_f9d4da05.jpg";
import { Sparkles, Radar, GalleryHorizontal, MailWarning } from "lucide-react";

function DecorativeHeroStrip() {
  return (
    <section className="mx-3 mt-3 mb-2 md:mx-4">
      <div className="app-hero-panel overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 p-4 md:p-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700">
              <Sparkles className="h-3.5 w-3.5" />
              실시간 AI 트레이딩 워크스테이션
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              데이터 흐름은 선명하게, 매매 판단은 직관적으로
            </h2>
            <p className="text-sm md:text-[15px] text-slate-600">
              화면 구조는 유지하면서, 시각 밀도를 높여 한눈에 상태를 읽기 쉽게 구성했습니다.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="app-chip"><Radar className="h-3.5 w-3.5" /> 실시간 모니터링</span>
              <span className="app-chip"><GalleryHorizontal className="h-3.5 w-3.5" /> 정보 밀도 강화</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {[heroA, heroB, heroC].map((src, idx) => (
              <div key={idx} className="relative rounded-xl overflow-hidden border border-white/60 min-h-24 md:min-h-28">
                <img
                  src={src}
                  alt={`decorative-market-${idx + 1}`}
                  className="h-full w-full object-cover scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/25 to-transparent" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { data: user, isLoading, isError, error } = useQuery<{ user: any }>({
    queryKey: ['/api/auth/me'],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">로딩중...</div>
      </div>
    );
  }

  if (isError) {
    const statusCode = (error as any)?.response?.status;
    if (statusCode === 401 || !user?.user) {
      return <Redirect to="/login" />;
    }
    console.error("Protected route error:", error);
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-destructive">
          오류가 발생했습니다. 다시 시도해 주세요.
        </div>
      </div>
    );
  }

  // 온보딩 미완료 → /onboarding으로 리다이렉트 (/onboarding 자체는 통과)
  const currentPath = window.location.pathname;
  if (user?.user && !user.user.onboardedAt && currentPath !== '/onboarding') {
    return <Redirect to="/onboarding" />;
  }

  return <Component {...rest} />;
}

function EmailVerificationBanner() {
  const { data } = useQuery<{ user: any }>({ queryKey: ['/api/auth/me'], retry: false });
  const [sent, setSent] = React.useState(false);
  const resend = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest('POST', '/api/auth/resend-verification');
      return resp.json();
    },
    onSuccess: () => setSent(true),
  });
  if (!data?.user || data.user.isEmailVerified !== false) return null;
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-1.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs">
      <div className="flex items-center gap-1.5">
        <MailWarning className="h-3.5 w-3.5 shrink-0" />
        이메일 인증이 완료되지 않았습니다. 받은 편지함을 확인해주세요.
      </div>
      <button
        className="underline shrink-0 disabled:opacity-50"
        disabled={sent || resend.isPending}
        onClick={() => resend.mutate()}
      >
        {sent ? '발송됨' : '재발송'}
      </button>
    </div>
  );
}

function AuthenticatedRouter() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full app-shell-bg">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <EmailVerificationBanner />
          <header className="flex items-center justify-between p-2 border-b border-white/50 bg-white/70 backdrop-blur-sm">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto pb-4">
            <DecorativeHeroStrip />
            <div className="app-page-shell">
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/guide" component={Guide} />
                <Route path="/tutorial" component={Tutorial} />
                <Route path="/accounts" component={Accounts} />
                <Route path="/trading" component={Trading} />
                <Route path="/ai-analysis" component={AIAnalysis} />
                <Route path="/auto-trading" component={AutoTrading} />
                <Route path="/portfolio" component={Portfolio} />
                <Route path="/trade-history" component={TradeHistory} />
                <Route path="/trade-journal" component={TradeJournal} />
                <Route path="/watchlist" component={Watchlist} />
                <Route path="/condition-formulas" component={ConditionFormulas} />
                <Route path="/condition-screening" component={ConditionScreening} />
                <Route path="/watchlist-signals" component={WatchlistSignals} />
                <Route path="/chart-formula-editor" component={ChartFormulaEditor} />
                <Route path="/backattack-scan" component={BackAttackScan} />
                <Route path="/settings" component={Settings} />
                <Route path="/monitoring" component={Monitoring} />
                <Route path="/candidate-decisions" component={CandidateDecisions} />
                <Route path="/ai-usage" component={AiUsage} />
                <Route path="/admin-jobs" component={AdminJobs} />
                <Route path="/admin-users" component={AdminUsers} />
                <Route path="/admin-private-cloud" component={AdminPrivateCloud} />
                <Route path="/billing" component={Billing} />
                <Route component={NotFound} />
              </Switch>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/onboarding">
        {(params) => <ProtectedRoute component={Onboarding} {...params} />}
      </Route>
      <Route>
        {(params) => <ProtectedRoute component={AuthenticatedRouter} {...params} />}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
