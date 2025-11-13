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
import Portfolio from "@/pages/portfolio";
import Watchlist from "@/pages/watchlist";
import Settings from "@/pages/settings";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { data: user, isLoading, isError } = useQuery({
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

  if (isError || !user?.user) {
    return <Redirect to="/login" />;
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
              <Route path="/trading" component={Trading} />
              <Route path="/ai-analysis" component={AIAnalysis} />
              <Route path="/portfolio" component={Portfolio} />
              <Route path="/watchlist" component={Watchlist} />
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
