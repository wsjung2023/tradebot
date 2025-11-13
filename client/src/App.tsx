import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
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
import Watchlist from "@/pages/watchlist";
import Settings from "@/pages/settings";
import Guide from "@/pages/guide";
import Accounts from "@/pages/accounts";
import ConditionFormulas from "@/pages/condition-formulas";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { data: user, isLoading, isError, error } = useQuery({
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

  // Handle 401 (unauthorized) - redirect to login
  if (isError) {
    const statusCode = (error as any)?.response?.status;
    if (statusCode === 401 || !user?.user) {
      return <Redirect to="/login" />;
    }
    
    // Other errors - show error message
    console.error("Protected route error:", error);
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-destructive">
          오류가 발생했습니다. 다시 시도해 주세요.
        </div>
      </div>
    );
  }

  return <Component {...rest} />;
}

function AuthenticatedRouter() {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-2 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/guide" component={Guide} />
              <Route path="/accounts" component={Accounts} />
              <Route path="/trading" component={Trading} />
              <Route path="/ai-analysis" component={AIAnalysis} />
              <Route path="/auto-trading" component={AutoTrading} />
              <Route path="/portfolio" component={Portfolio} />
              <Route path="/trade-history" component={TradeHistory} />
              <Route path="/watchlist" component={Watchlist} />
              <Route path="/condition-formulas" component={ConditionFormulas} />
              <Route path="/settings" component={Settings} />
              <Route component={NotFound} />
            </Switch>
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
