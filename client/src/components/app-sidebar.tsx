import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  TrendingUp,
  Brain,
  Bot,
  Briefcase,
  Settings,
  LogOut,
  Activity,
  ScrollText,
  BookOpen,
  Search,
  LineChart,
  Code2,
  Rainbow,
  GraduationCap,
  ServerCog,
  ClipboardList,
  Coins,
  Wallet,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import sidebarVisual from "@assets/stock_images/dynamic_stock_market_0d6bd401.jpg";

const menuItems = [
  { title: "대시보드", url: "/", icon: LayoutDashboard },
  { title: "사용 가이드", url: "/guide", icon: BookOpen },
  { title: "튜토리얼", url: "/tutorial", icon: GraduationCap },
  { title: "거래", url: "/trading", icon: TrendingUp },
  { title: "AI 분석", url: "/ai-analysis", icon: Brain },
  { title: "자동매매", url: "/auto-trading", icon: Bot },
  { title: "AI 사용량", url: "/ai-usage", icon: Coins },
  { title: "포트폴리오", url: "/portfolio", icon: Briefcase },
  { title: "거래 내역", url: "/trade-history", icon: ScrollText },
  { title: "매매 저널", url: "/trade-journal", icon: ClipboardList },
  { title: "계좌 관리", url: "/accounts", icon: Wallet },
  { title: "조건검색", url: "/condition-formulas", icon: Search },
  { title: "뒷차기2 스캔", url: "/backattack-scan", icon: Rainbow },
  { title: "실시간 모니터", url: "/monitoring", icon: Activity },
  { title: "선정/탈락 이력", url: "/candidate-decisions", icon: ClipboardList },
  { title: "설정", url: "/settings", icon: Settings },
  { title: "배치잡 관리", url: "/admin-jobs", icon: ServerCog },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.location.href = "/login";
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "로그아웃 실패",
        description: "다시 시도해주세요",
      });
    },
  });

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold flex items-center gap-2">
            키움 AI 트레이딩
            {import.meta.env.VITE_APP_ENV === 'dev' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-black leading-none">DEV</span>
            )}
          </SidebarGroupLabel>
          <div className="hidden md:block mx-2 mb-3 rounded-xl overflow-hidden border border-white/60 shadow-sm">
            <div className="relative h-24">
              <img src={sidebarVisual} alt="market-visual" className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/45 via-slate-900/15 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2 text-[11px] text-white font-semibold tracking-wide">
                MARKET FLOW / AI SIGNAL
              </div>
            </div>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              로그아웃
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
