import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Wallet, Target, Plus, Trash2, RefreshCw, WifiOff, ArrowLeftRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useKiwoomBalance } from "@/hooks/use-kiwoom-balance";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface DashboardAccount {
  id: number;
  accountNumber: string;
  accountType: "mock" | "real";
  accountName?: string;
}

interface DashboardSettings {
  tradingMode?: "mock" | "real";
}

interface CachedBalanceSummary {
  totalAssets: number;
  depositAmount: number;
  todayProfit: number;
  todayProfitRate: number;
  fetchedAt?: string;
}

interface DashboardCachedBalance {
  assetHistory?: Array<{ date: string; value: number }>;
  cachedBalance?: CachedBalanceSummary | null;
}

interface DashboardHolding {
  id: number;
  stockCode: string;
  stockName: string;
  quantity: string;
  avgPrice: string;
  currentPrice: string;
  profitLoss: string;
  profitLossRate: string;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<"mock" | "real">("mock");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<DashboardAccount[]>({ queryKey: ['/api/accounts'] });
  const { data: settings } = useQuery<DashboardSettings>({ queryKey: ['/api/settings'] });
  const { data: cachedBalance } = useQuery<DashboardCachedBalance>({
    queryKey: ['/api/accounts', selectedAccountId, 'balance'],
    enabled: !!selectedAccountId,
  });
  const { data: holdings = [], isLoading: holdingsLoading } = useQuery<DashboardHolding[]>({
    queryKey: ['/api/accounts', selectedAccountId, 'holdings'],
    enabled: !!selectedAccountId,
  });

  const { data: recentTrades = [] } = useQuery<any[]>({
    queryKey: ['/api/accounts', selectedAccountId, 'trades'],
    enabled: !!selectedAccountId,
  });

  const { data: sysStatus, refetch: recheckSysStatus, isFetching: sysStatusChecking } = useQuery<{
    status: "ok" | "maintenance" | "unknown";
    message: string;
    httpStatus?: number;
    location?: string;
    checkedAt?: number;
    cached?: boolean;
  }>({
    queryKey: ['/api/kiwoom-agent/system-status'],
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { data: assetSnapshots = [] } = useQuery<any[]>({
    queryKey: ['/api/accounts', selectedAccountId, 'asset-snapshots'],
    enabled: !!selectedAccountId,
  });

  const kiwoom = useKiwoomBalance();

  const selectedAccount = accounts?.find((a: any) => a.id === selectedAccountId);

  useEffect(() => {
    if (!selectedAccountId && accounts?.length > 0 && !accountsLoading) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, accountsLoading, selectedAccountId]);

  // ACCOUNT_TYPE_MISMATCH / IP_NOT_REGISTERED 에러 토스트 표시
  // fetchedAccountId === selectedAccountId 일 때만 표시 (계좌 전환 시 스테일 오류 방지)
  useEffect(() => {
    if (selectedAccount?.accountType !== "real") return;
    if (kiwoom.fetchedAccountId !== selectedAccount?.id) return;
    
    if (kiwoom.errorCode === "ACCOUNT_TYPE_MISMATCH") {
      toast({
        variant: "destructive",
        title: "실계좌 API 키가 등록되지 않았습니다",
        description: `${selectedAccount.accountNumber || "선택한 계좌"}의 전용 API 키를 설정해주세요.`,
      });
    } else if (kiwoom.errorCode === "IP_NOT_REGISTERED") {
      toast({
        variant: "destructive",
        title: "서버 IP가 키움 포털에 등록되지 않았습니다",
        description: "설정 페이지에서 현재 IP를 확인하고 키움 OpenAPI 포털의 지정단말기 IP로 등록하세요.",
      });
    }
  }, [kiwoom.errorCode, selectedAccount?.id]);

  const handleRefresh = () => {
    if (!selectedAccount) return;
    kiwoom.fetch(
      selectedAccount.id,
      selectedAccount.accountNumber,
      selectedAccount.accountType as "mock" | "real"
    );
  };

  const addAccountMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/accounts', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      setDialogOpen(false);
      setAccountNumber(""); setAccountName(""); setAccountType("mock");
      toast({ title: "계좌 추가 완료" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "계좌 추가 실패", description: error.message });
    },
  });

  const toggleAccountTypeMutation = useMutation({
    mutationFn: async ({ id, currentType }: { id: number; currentType: "mock" | "real" }) => {
      const newType = currentType === "mock" ? "real" : "mock";
      const res = await apiRequest('PATCH', `/api/accounts/${id}`, { accountType: newType });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      const newType = variables.currentType === "mock" ? "실전투자" : "모의투자";
      toast({ title: `계좌 유형 변경됨`, description: `${newType}으로 변경되었습니다` });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "계좌 유형 변경 실패", description: error.message });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/accounts/${id}`, undefined);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      setSelectedAccountId(null);
      toast({ title: "계좌 삭제 완료" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "계좌 삭제 실패", description: error.message });
    },
  });

  const syncTradingModeMutation = useMutation({
    mutationFn: async (tradingMode: "mock" | "real") => {
      const res = await apiRequest('PATCH', '/api/settings', { tradingMode });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "거래 모드 동기화 실패", description: error.message });
    },
  });

  const fmt = (value: number | string | undefined) => {
    if (value === undefined || value === null) return "-";
    const n = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(n)) return "-";
    return `₩${n.toLocaleString("ko-KR")}`;
  };

  const fmtPct = (value: number | string | undefined) => {
    if (value === undefined || value === null) return "-";
    const n = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(n)) return "-";
    return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  };

  // kiwoom 결과가 현재 선택된 계좌의 것인지 확인 (계좌 전환 시 스테일 방지)
  const kiwoomIsForCurrentAccount = kiwoom.fetchedAccountId === selectedAccountId;
  const isIdle = kiwoom.status === "idle" || !kiwoomIsForCurrentAccount;
  const isLoading = kiwoom.status === "loading" && kiwoomIsForCurrentAccount;
  const isSuccess = kiwoom.status === "success" && kiwoomIsForCurrentAccount;
  const hasError = (kiwoom.status === "error" || kiwoom.status === "agent_timeout") && kiwoomIsForCurrentAccount;
  const balance = isSuccess ? kiwoom.data : null;

  // 마지막 성공한 잔고 조회 캐시 (새로고침 전 기존 데이터 표시용)
  const cached = cachedBalance?.cachedBalance ?? null;

  const assetHistory = assetSnapshots?.map((s: any) => ({
    date: s.date,
    totalAssets: s.totalAssets,
    profit: s.profit,
  })) ?? [];

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--neon-cyan))]/5 to-[hsl(var(--neon-purple))]/5 animate-gradient-flow -z-10" />

      <div className="p-3 md:p-6 space-y-4 md:space-y-6 relative z-0">
        {/* 키움 시스템 점검 배너 */}
        {sysStatus && sysStatus.status !== "ok" && (
          <div
            data-testid="banner-kiwoom-system-status"
            className={`flex flex-wrap items-center gap-3 rounded-md px-4 py-3 text-sm font-medium ${
              sysStatus.status === "maintenance"
                ? "bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-400"
                : "bg-muted border border-border text-muted-foreground"
            }`}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              {sysStatus.status === "maintenance"
                ? `키움증권 시스템 점검 중 — 잔고·토큰 조회가 일시적으로 불가합니다. (${sysStatus.message})`
                : `키움 서버 상태 확인 불가 — ${sysStatus.message}`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={sysStatusChecking}
              onClick={() => recheckSysStatus()}
              data-testid="button-recheck-system-status"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${sysStatusChecking ? "animate-spin" : ""}`} />
              재확인
            </Button>
          </div>
        )}
        {sysStatus?.status === "ok" && (
          <div
            data-testid="banner-kiwoom-system-ok"
            className="flex items-center gap-2 rounded-md px-4 py-2 text-xs bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400"
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>키움 API 서버 정상</span>
            {sysStatus.cached && <span className="text-muted-foreground">(캐시)</span>}
          </div>
        )}

        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gradient-cyber" data-testid="text-dashboard-title">대시보드</h1>
            <p className="text-sm md:text-base text-muted-foreground">AI 기반 자동매매 플랫폼</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-account"><Plus className="h-4 w-4 mr-2" />계좌 추가</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>키움증권 계좌 추가</DialogTitle>
                <DialogDescription>키움증권 계좌 정보를 입력하세요</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>계좌번호</Label>
                  <Input placeholder="81208166 (8자리)" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} data-testid="input-account-number" />
                  <p className="text-xs text-muted-foreground">8자리 계좌번호를 입력하세요. 주식계좌는 상품코드(11)가 자동으로 추가됩니다.</p>
                </div>
                <div className="space-y-2">
                  <Label>계좌명 (선택)</Label>
                  <Input placeholder="주식 계좌" value={accountName} onChange={(e) => setAccountName(e.target.value)} data-testid="input-account-name" />
                </div>
                <div className="space-y-2">
                  <Label>계좌 유형</Label>
                  <Select value={accountType} onValueChange={(v: any) => setAccountType(v)}>
                    <SelectTrigger data-testid="select-account-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mock">모의투자</SelectItem>
                      <SelectItem value="real">실계좌</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => addAccountMutation.mutate({ accountNumber, accountName, accountType })}
                  disabled={!accountNumber || addAccountMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-account"
                >
                  {addAccountMutation.isPending ? "추가 중..." : "계좌 추가"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* 계좌 선택 */}
        {accounts && accounts.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Label className="text-sm">계좌 선택:</Label>
            <div className="flex items-center gap-2 flex-1">
              <Select value={selectedAccountId?.toString()} onValueChange={(v) => { setSelectedAccountId(parseInt(v)); }}>
                <SelectTrigger className="w-full sm:w-64" data-testid="select-account"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map((acc: any) => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      {acc.accountName || acc.accountNumber} ({acc.accountType === "real" ? "실계좌" : "모의투자"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccountId && selectedAccount && (
                <>
                  {selectedAccount.accountType === "real" && hasError && (kiwoom.errorCode === "ACCOUNT_TYPE_MISMATCH" || kiwoom.errorCode === "IP_NOT_REGISTERED") ? (
                    <Badge variant="destructive" data-testid="badge-account-type-error">
                      {kiwoom.errorCode === "ACCOUNT_TYPE_MISMATCH" ? "API 키 오류" : "IP 미등록"}
                    </Badge>
                  ) : (
                    <Badge
                      variant={selectedAccount.accountType === "real" ? "default" : "secondary"}
                      data-testid="badge-account-type"
                    >
                      {selectedAccount.accountType === "real" ? "실전" : "모의"}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleAccountTypeMutation.mutate({ id: selectedAccount.id, currentType: selectedAccount.accountType as "mock" | "real" })}
                    disabled={toggleAccountTypeMutation.isPending}
                    title={`${selectedAccount.accountType === "real" ? "모의투자" : "실전투자"}로 전환`}
                    data-testid="button-toggle-account-type"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading} data-testid="button-refresh-balance">
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmOpen(true)} data-testid="button-delete-account">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* 에러 상태 */}
        {hasError && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-4 pb-4 flex items-start gap-3">
              <WifiOff className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Kiwoom API 연결 실패</p>
                <p className="text-xs text-muted-foreground mt-1">{kiwoom.error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 요약 카드 */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card className="hover-elevate transition-all duration-300 border-[hsl(var(--neon-cyan))]/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-xs md:text-sm font-medium">총 자산</CardTitle>
              <Wallet className="h-4 w-4 text-[hsl(var(--neon-cyan))]" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg md:text-2xl font-bold font-mono text-glow-cyan truncate" data-testid="text-total-assets">
                {isLoading ? <span className="text-muted-foreground text-base">조회 중...</span>
                  : isSuccess ? fmt(balance?.totalAssets)
                  : cached ? fmt(cached.totalAssets)
                  : <span className="text-muted-foreground text-sm">-</span>}
              </div>
              {!selectedAccountId && <p className="text-xs text-muted-foreground">계좌를 연결해주세요</p>}
              {selectedAccountId && isIdle && !cached && <p className="text-xs text-muted-foreground">새로고침 버튼으로 조회</p>}
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-all duration-300 border-[hsl(var(--neon-green))]/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-xs md:text-sm font-medium">평가손익</CardTitle>
              <TrendingUp className="h-4 w-4 text-[hsl(var(--neon-green))]" />
            </CardHeader>
            <CardContent className="pt-0">
              <div
                className={`text-lg md:text-2xl font-bold font-mono truncate ${
                  (isSuccess ? (balance?.todayProfit ?? 0) : (cached?.todayProfit ?? 0)) > 0 ? "text-[hsl(var(--neon-green))]"
                  : (isSuccess ? (balance?.todayProfit ?? 0) : (cached?.todayProfit ?? 0)) < 0 ? "text-[hsl(var(--neon-red))]" : ""
                }`}
                data-testid="text-today-profit"
              >
                {isLoading ? <span className="text-muted-foreground text-base">조회 중...</span>
                  : isSuccess ? fmt(balance?.todayProfit)
                  : cached ? fmt(cached.todayProfit)
                  : <span className="text-muted-foreground text-sm">-</span>}
              </div>
              <p className={`text-xs ${
                (isSuccess ? (balance?.todayProfitRate ?? 0) : (cached?.todayProfitRate ?? 0)) > 0 ? "text-[hsl(var(--neon-green))]"
                : (isSuccess ? (balance?.todayProfitRate ?? 0) : (cached?.todayProfitRate ?? 0)) < 0 ? "text-[hsl(var(--neon-red))]"
                : "text-muted-foreground"
              }`}>
                {isSuccess ? fmtPct(balance?.todayProfitRate) : cached ? fmtPct(cached.todayProfitRate) : ""}
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-all duration-300 border-[hsl(var(--neon-purple))]/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-xs md:text-sm font-medium">예수금</CardTitle>
              <Target className="h-4 w-4 text-[hsl(var(--neon-purple))]" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg md:text-2xl font-bold font-mono" data-testid="text-total-return">
                {isLoading ? <span className="text-muted-foreground text-base">조회 중...</span>
                  : isSuccess ? fmt(balance?.depositAmount)
                  : cached ? fmt(cached.depositAmount)
                  : <span className="text-muted-foreground text-sm">-</span>}
              </div>
              <p className="text-xs text-muted-foreground">출금가능금액</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-all duration-300 border-primary/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-xs md:text-sm font-medium">거래 모드</CardTitle>
              <TrendingDown className={`h-4 w-4 ${selectedAccount?.accountType === "real" ? "text-[hsl(var(--neon-cyan))] animate-pulse-glow" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg md:text-2xl font-bold" data-testid="text-trading-mode">
                {selectedAccount ? (selectedAccount.accountType === "real" ? "실전" : "모의") : (settings?.tradingMode === "real" ? "실전" : "모의")}
              </div>
              <p className="text-xs text-muted-foreground">설정에서 변경 가능</p>
            </CardContent>
          </Card>
        </div>

        {/* 포트폴리오 & 보유종목 — DB 저장 데이터 표시 (새로고침 전에도 유지) */}
        {holdings && holdings.length > 0 && (
          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
            <Card className="hover-elevate">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  포트폴리오 구성
                  <div className="w-2 h-2 rounded-full bg-[hsl(var(--neon-cyan))] animate-pulse-glow" />
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">종목별 비중</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200} className="md:!h-[300px]">
                  <PieChart>
                    <Pie
                      data={holdings.map((h: any) => ({
                        name: h.stockName,
                        value: h.quantity * (parseFloat(h.currentPrice) || parseFloat(h.averagePrice) || 0),
                      }))}
                      cx="50%" cy="50%" labelLine={false} label={(e) => e.name}
                      outerRadius={80} dataKey="value"
                    >
                      {holdings.map((_: any, i: number) => (
                        <Cell key={i} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'][i % 5]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  보유 종목
                  <div className="w-2 h-2 rounded-full bg-[hsl(var(--neon-purple))] animate-pulse-glow" />
                </CardTitle>
                <CardDescription>종목별 수익률</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {holdings.map((h: any) => {
                    const storedRate = parseFloat(h.profitLossRate);
                    const cur = parseFloat(h.currentPrice);
                    const avg = parseFloat(h.averagePrice);
                    const rate = storedRate !== 0
                      ? storedRate
                      : (cur > 0 && avg > 0 ? ((cur - avg) / avg) * 100 : NaN);
                    return (
                      <div key={h.id} className="flex items-center justify-between p-3 border rounded-md" data-testid={`holding-${h.stockCode}`}>
                        <div>
                          <p className="font-medium">{h.stockName}</p>
                          <p className="text-sm text-muted-foreground">{h.stockCode}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm">{h.quantity}주</p>
                          <p className={`text-sm font-medium ${rate > 0 ? "text-green-600 dark:text-green-400" : rate < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                            {isNaN(rate) ? "-" : fmtPct(rate)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 자산 추이 — 실제 스냅샷 데이터가 있을 때만 표시 */}
        {assetHistory.length > 0 && (
          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                자산 추이
                <TrendingUp className="w-4 h-4 text-[hsl(var(--neon-green))]" />
              </CardTitle>
              <CardDescription>최근 30일 총자산 변화</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={assetHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="totalAssets" stroke="#8884d8" name="총자산" strokeWidth={2} />
                  <Line type="monotone" dataKey="profit" stroke="#82ca9d" name="수익" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* 최근 거래 */}
        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              최근 거래
              <div className="w-2 h-2 rounded-full bg-[hsl(var(--neon-cyan))] animate-pulse-glow" />
            </CardTitle>
            <CardDescription>최근 5건의 매매 내역</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTrades && recentTrades.length > 0 ? (
              <div className="space-y-3">
                {recentTrades.map((trade: any) => (
                  <div key={trade.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-semibold">{trade.stockName} ({trade.stockCode})</p>
                      <p className="text-xs text-muted-foreground">
                        {trade.side === 'buy' ? '매수' : '매도'} {trade.quantity}주 @ {parseInt(trade.price).toLocaleString()}원
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {trade.profit >= 0 ? (
                          <span className="text-green-600 dark:text-green-400">+{parseInt(trade.profit).toLocaleString()}</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">{parseInt(trade.profit).toLocaleString()}</span>
                        )}원
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {trade.profitRate >= 0 ? '+' : ''}{(trade.profitRate * 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">거래 내역이 없습니다</p>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>계좌 삭제</AlertDialogTitle>
            <AlertDialogDescription>이 계좌를 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (selectedAccountId) deleteAccountMutation.mutate(selectedAccountId); }}
              data-testid="button-confirm-delete"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
