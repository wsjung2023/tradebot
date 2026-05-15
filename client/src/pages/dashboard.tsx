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

interface DashboardOrder {
  id: number;
  stockCode: string;
  stockName: string;
  orderType: "buy" | "sell";
  orderStatus: "pending" | "partial" | "completed" | "cancelled";
  orderPrice: string | number | null;
  orderQuantity: number;
  executedPrice: string | number | null;
  executedQuantity: number;
  createdAt: string;
}

const DASHBOARD_ACCOUNT_STORAGE_KEY = "dashboard:lastSelectedAccountId";

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
  const { data: holdings = [], isLoading: holdingsLoading } = useQuery<DashboardHolding[]>({
    queryKey: ['/api/accounts', selectedAccountId, 'holdings'],
    enabled: !!selectedAccountId,
  });

  const { data: recentTrades = [] } = useQuery<DashboardOrder[]>({
    queryKey: ['/api/accounts', selectedAccountId, 'orders?limit=5'],
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
    enabled: false,
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
    if (accountsLoading) return;
    if (!accounts || accounts.length === 0) {
      setSelectedAccountId(null);
      return;
    }

    if (selectedAccountId != null && accounts.some((acc) => acc.id === selectedAccountId)) {
      return;
    }

    let nextAccountId: number | null = null;
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(DASHBOARD_ACCOUNT_STORAGE_KEY);
      const parsed = saved ? parseInt(saved, 10) : NaN;
      if (Number.isFinite(parsed) && accounts.some((acc) => acc.id === parsed)) {
        nextAccountId = parsed;
      }
    }

    if (nextAccountId == null && settings?.tradingMode) {
      const sameMode = accounts.find((acc) => acc.accountType === settings.tradingMode);
      if (sameMode) nextAccountId = sameMode.id;
    }

    if (nextAccountId == null) {
      nextAccountId = accounts[0].id;
    }

    setSelectedAccountId(nextAccountId);
  }, [accounts, accountsLoading, selectedAccountId, settings?.tradingMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedAccountId == null) {
      window.localStorage.removeItem(DASHBOARD_ACCOUNT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(DASHBOARD_ACCOUNT_STORAGE_KEY, String(selectedAccountId));
  }, [selectedAccountId]);

  // Í≥ÑÏ¢å ?†ÌÉù?òÎ©¥ ?êÎèô?ºÎ°ú ?îÍ≥† Ï°∞Ìöå (Í≥ÑÏ¢å ?ÑÌôò Î∞??†Ìòï Î≥ÄÍ≤??úÏóê???¨Ï°∞??
  useEffect(() => {
    if (!selectedAccount) return;
    kiwoom.fetch(
      selectedAccount.id,
      selectedAccount.accountNumber,
      selectedAccount.accountType as "mock" | "real"
    );
  }, [selectedAccount?.id, selectedAccount?.accountType]);

  // ACCOUNT_TYPE_MISMATCH / IP_NOT_REGISTERED ?êÎü¨ ?†Ïä§???úÏãú
  // fetchedAccountId === selectedAccountId ???åÎßå ?úÏãú (Í≥ÑÏ¢å ?ÑÌôò ???§ÌÖå???§Î•ò Î∞©Ï?)
  useEffect(() => {
    if (selectedAccount?.accountType !== "real") return;
    if (kiwoom.fetchedAccountId !== selectedAccount?.id) return;
    
    if (kiwoom.errorCode === "ACCOUNT_TYPE_MISMATCH") {
      toast({
        variant: "destructive",
        title: "?§Í≥ÑÏ¢?API ?§Í? ?±Î°ù?òÏ? ?äÏïò?µÎãà??,
        description: `${selectedAccount.accountNumber || "?†ÌÉù??Í≥ÑÏ¢å"}???ÑÏö© API ?§Î? ?§Ï†ï?¥Ï£º?∏Ïöî.`,
      });
    } else if (kiwoom.errorCode === "IP_NOT_REGISTERED") {
      toast({
        variant: "destructive",
        title: "?úÎ≤Ñ IPÍ∞Ä ?§Ï? ?¨ÌÑ∏???±Î°ù?òÏ? ?äÏïò?µÎãà??,
        description: "?§Ï†ï ?òÏù¥ÏßÄ?êÏÑú ?ÑÏû¨ IPÎ•??ïÏù∏?òÍ≥† ?§Ï? OpenAPI ?¨ÌÑ∏??ÏßÄ?ïÎã®ÎßêÍ∏∞ IPÎ°??±Î°ù?òÏÑ∏??",
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
      toast({ title: "Í≥ÑÏ¢å Ï∂îÍ? ?ÑÎ£å" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Í≥ÑÏ¢å Ï∂îÍ? ?§Ìå®", description: error.message });
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
      const newType = variables.currentType === "mock" ? "?§Ï†Ñ?¨Ïûê" : "Î™®Ïùò?¨Ïûê";
      toast({ title: `Í≥ÑÏ¢å ?†Ìòï Î≥ÄÍ≤ΩÎê®`, description: `${newType}?ºÎ°ú Î≥ÄÍ≤ΩÎêò?àÏäµ?àÎã§` });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Í≥ÑÏ¢å ?†Ìòï Î≥ÄÍ≤??§Ìå®", description: error.message });
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
      toast({ title: "Í≥ÑÏ¢å ??†ú ?ÑÎ£å" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Í≥ÑÏ¢å ??†ú ?§Ìå®", description: error.message });
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
      toast({ variant: "destructive", title: "Í±∞Îûò Î™®Îìú ?ôÍ∏∞???§Ìå®", description: error.message });
    },
  });

  const fmt = (value: number | string | undefined) => {
    if (value === undefined || value === null) return "-";
    const n = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(n)) return "-";
    return `??{n.toLocaleString("ko-KR")}`;
  };

  const fmtPct = (value: number | string | undefined) => {
    if (value === undefined || value === null) return "-";
    const n = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(n)) return "-";
    return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  };

  // kiwoom Í≤∞Í≥ºÍ∞Ä ?ÑÏû¨ ?†ÌÉù??Í≥ÑÏ¢å??Í≤ÉÏù∏ÏßÄ ?ïÏù∏ (Í≥ÑÏ¢å ?ÑÌôò ???§ÌÖå??Î∞©Ï?)
  const kiwoomIsForCurrentAccount = kiwoom.fetchedAccountId === selectedAccountId;
  const isIdle = kiwoom.status === "idle" || !kiwoomIsForCurrentAccount;
  const isLoading = kiwoom.status === "loading" && kiwoomIsForCurrentAccount;
  const isSuccess = kiwoom.status === "success" && kiwoomIsForCurrentAccount;
  const hasError = (kiwoom.status === "error" || kiwoom.status === "agent_timeout") && kiwoomIsForCurrentAccount;
  const balance = isSuccess ? kiwoom.data : (selectedAccount ? {
    totalAssets: parseFloat((selectedAccount as any).lastTotalAssets || "0"),
    todayProfit: parseFloat((selectedAccount as any).lastTodayProfit || "0"),
    todayProfitRate: parseFloat((selectedAccount as any).lastTodayProfitRate || "0"),
    depositAmount: parseFloat((selectedAccount as any).lastDepositAmount || "0"),
  } : null);


  const assetHistory = assetSnapshots?.map((s: any) => ({
    date: s.snapshotAt ? new Date(s.snapshotAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : s.date,
    totalAssets: parseFloat(s.totalAssets || "0"),
    profit: parseFloat(s.totalProfitLoss || s.profit || "0"),
  })) ?? [];

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--neon-cyan))]/5 to-[hsl(var(--neon-purple))]/5 animate-gradient-flow -z-10" />

      <div className="p-3 md:p-6 space-y-4 md:space-y-6 relative z-0">
        {/* ?§Ï? ?úÏä§???êÍ? Î∞∞ÎÑà */}
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
                ? `?§Ï?Ï¶ùÍ∂å ?úÏä§???êÍ? Ï§????îÍ≥†¬∑?†ÌÅ∞ Ï°∞ÌöåÍ∞Ä ?ºÏãú?ÅÏúºÎ°?Î∂àÍ??©Îãà?? (${sysStatus.message})`
                : `?§Ï? ?úÎ≤Ñ ?ÅÌÉú ?ïÏù∏ Î∂àÍ? ??${sysStatus.message}`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={sysStatusChecking}
              onClick={() => recheckSysStatus()}
              data-testid="button-recheck-system-status"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${sysStatusChecking ? "animate-spin" : ""}`} />
              ?¨Ìôï??
            </Button>
          </div>
        )}
        {sysStatus?.status === "ok" && (
          <div
            data-testid="banner-kiwoom-system-ok"
            className="flex items-center gap-2 rounded-md px-4 py-2 text-xs bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400"
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>?§Ï? API ?úÎ≤Ñ ?ïÏÉÅ</span>
            {sysStatus.cached && <span className="text-muted-foreground">(Ï∫êÏãú)</span>}
          </div>
        )}

        {/* ?§Îçî */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gradient-cyber" data-testid="text-dashboard-title">?Ä?úÎ≥¥??/h1>
            <p className="text-sm md:text-base text-muted-foreground">AI Í∏∞Î∞ò ?êÎèôÎß§Îß§ ?åÎû´??/p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-account"><Plus className="h-4 w-4 mr-2" />Í≥ÑÏ¢å Ï∂îÍ?</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>?§Ï?Ï¶ùÍ∂å Í≥ÑÏ¢å Ï∂îÍ?</DialogTitle>
                <DialogDescription>?§Ï?Ï¶ùÍ∂å Í≥ÑÏ¢å ?ïÎ≥¥Î•??ÖÎ†•?òÏÑ∏??/DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Í≥ÑÏ¢åÎ≤àÌò∏</Label>
                  <Input placeholder="81208166 (8?êÎ¶¨)" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} data-testid="input-account-number" />
                  <p className="text-xs text-muted-foreground">8?êÎ¶¨ Í≥ÑÏ¢åÎ≤àÌò∏Î•??ÖÎ†•?òÏÑ∏?? Ï£ºÏãùÍ≥ÑÏ¢å???ÅÌíàÏΩîÎìú(11)Í∞Ä ?êÎèô?ºÎ°ú Ï∂îÍ??©Îãà??</p>
                </div>
                <div className="space-y-2">
                  <Label>Í≥ÑÏ¢åÎ™?(?†ÌÉù)</Label>
                  <Input placeholder="Ï£ºÏãù Í≥ÑÏ¢å" value={accountName} onChange={(e) => setAccountName(e.target.value)} data-testid="input-account-name" />
                </div>
                <div className="space-y-2">
                  <Label>Í≥ÑÏ¢å ?†Ìòï</Label>
                  <Select value={accountType} onValueChange={(v: any) => setAccountType(v)}>
                    <SelectTrigger data-testid="select-account-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mock">Î™®Ïùò?¨Ïûê</SelectItem>
                      <SelectItem value="real">?§Í≥ÑÏ¢?/SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => addAccountMutation.mutate({ accountNumber, accountName, accountType })}
                  disabled={!accountNumber || addAccountMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-account"
                >
                  {addAccountMutation.isPending ? "Ï∂îÍ? Ï§?.." : "Í≥ÑÏ¢å Ï∂îÍ?"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Í≥ÑÏ¢å ?†ÌÉù */}
        {accounts && accounts.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Label className="text-sm">Í≥ÑÏ¢å ?†ÌÉù:</Label>
            <div className="flex items-center gap-2 flex-1">
              <Select value={selectedAccountId?.toString()} onValueChange={(v) => { setSelectedAccountId(parseInt(v)); }}>
                <SelectTrigger className="w-full sm:w-64" data-testid="select-account"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map((acc: any) => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      {acc.accountName || acc.accountNumber} ({acc.accountType === "real" ? "?§Í≥ÑÏ¢? : "Î™®Ïùò?¨Ïûê"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccountId && selectedAccount && (
                <>
                  {selectedAccount.accountType === "real" && hasError && (kiwoom.errorCode === "ACCOUNT_TYPE_MISMATCH" || kiwoom.errorCode === "IP_NOT_REGISTERED") ? (
                    <Badge variant="destructive" data-testid="badge-account-type-error">
                      {kiwoom.errorCode === "ACCOUNT_TYPE_MISMATCH" ? "API ???§Î•ò" : "IP ÎØ∏Îì±Î°?}
                    </Badge>
                  ) : (
                    <Badge
                      variant={selectedAccount.accountType === "real" ? "default" : "secondary"}
                      data-testid="badge-account-type"
                    >
                      {selectedAccount.accountType === "real" ? "?§Ï†Ñ" : "Î™®Ïùò"}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleAccountTypeMutation.mutate({ id: selectedAccount.id, currentType: selectedAccount.accountType as "mock" | "real" })}
                    disabled={toggleAccountTypeMutation.isPending}
                    title={`${selectedAccount.accountType === "real" ? "Î™®Ïùò?¨Ïûê" : "?§Ï†Ñ?¨Ïûê"}Î°??ÑÌôò`}
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

        {/* ?êÎü¨ ?ÅÌÉú */}
        {hasError && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-4 pb-4 flex items-start gap-3">
              <WifiOff className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  ?îÍ≥† Ï°∞Ìöå ?§Ìå®
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {kiwoom.error || "?????ÜÎäî ?§Î•ò"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ?îÏïΩ Ïπ¥Îìú */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card className="hover-elevate transition-all duration-300 border-[hsl(var(--neon-cyan))]/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-xs md:text-sm font-medium">Ï¥??êÏÇ∞</CardTitle>
              <Wallet className="h-4 w-4 text-[hsl(var(--neon-cyan))]" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg md:text-2xl font-bold font-mono text-glow-cyan truncate" data-testid="text-total-assets">
                {isLoading ? <span className="text-muted-foreground text-base">Ï°∞Ìöå Ï§?..</span>
                  : (balance && balance.totalAssets > 0) ? fmt(balance.totalAssets)
                  : hasError ? <span className="text-muted-foreground text-sm">Ï°∞Ìöå ?§Ìå®</span>
                  : <span className="text-muted-foreground text-sm">-</span>}
              </div>
              {!selectedAccountId && <p className="text-xs text-muted-foreground">Í≥ÑÏ¢åÎ•??∞Í≤∞?¥Ï£º?∏Ïöî</p>}
              {selectedAccountId && isIdle && <p className="text-xs text-muted-foreground">?àÎ°úÍ≥†Ïπ® Î≤ÑÌäº?ºÎ°ú Ï°∞Ìöå</p>}
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-all duration-300 border-[hsl(var(--neon-green))]/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-xs md:text-sm font-medium">?âÍ??êÏùµ</CardTitle>
              <TrendingUp className="h-4 w-4 text-[hsl(var(--neon-green))]" />
            </CardHeader>
            <CardContent className="pt-0">
              <div
                className={`text-lg md:text-2xl font-bold font-mono truncate ${
                  (balance?.todayProfit ?? 0) > 0 ? "text-[hsl(var(--neon-green))]"
                  : (balance?.todayProfit ?? 0) < 0 ? "text-[hsl(var(--neon-red))]" : ""
                }`}
                data-testid="text-today-profit"
              >
                {isLoading ? <span className="text-muted-foreground text-base">Ï°∞Ìöå Ï§?..</span>
                  : balance ? fmt(balance.todayProfit)
                  : hasError ? <span className="text-muted-foreground text-sm">Ï°∞Ìöå ?§Ìå®</span>
                  : <span className="text-muted-foreground text-sm">-</span>}
              </div>
              <p className={`text-xs ${
                (balance?.todayProfitRate ?? 0) > 0 ? "text-[hsl(var(--neon-green))]"
                : (balance?.todayProfitRate ?? 0) < 0 ? "text-[hsl(var(--neon-red))]"
                : "text-muted-foreground"
              }`}>
                {isSuccess ? fmtPct(balance?.todayProfitRate) : ""}
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-all duration-300 border-[hsl(var(--neon-purple))]/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-xs md:text-sm font-medium">?àÏàòÍ∏?/CardTitle>
              <Target className="h-4 w-4 text-[hsl(var(--neon-purple))]" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg md:text-2xl font-bold font-mono" data-testid="text-total-return">
                {isLoading ? <span className="text-muted-foreground text-base">Ï°∞Ìöå Ï§?..</span>
                  : balance ? fmt(balance.depositAmount)
                  : hasError ? <span className="text-muted-foreground text-sm">Ï°∞Ìöå ?§Ìå®</span>
                  : <span className="text-muted-foreground text-sm">-</span>}
              </div>
              <p className="text-xs text-muted-foreground">Ï∂úÍ∏àÍ∞Ä?•Í∏à??/p>
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-all duration-300 border-primary/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-xs md:text-sm font-medium">Í±∞Îûò Î™®Îìú</CardTitle>
              <TrendingDown className={`h-4 w-4 ${selectedAccount?.accountType === "real" ? "text-[hsl(var(--neon-cyan))] animate-pulse-glow" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg md:text-2xl font-bold" data-testid="text-trading-mode">
                {selectedAccount ? (selectedAccount.accountType === "real" ? "?§Ï†Ñ" : "Î™®Ïùò") : (settings?.tradingMode === "real" ? "?§Ï†Ñ" : "Î™®Ïùò")}
              </div>
              <p className="text-xs text-muted-foreground">?§Ï†ï?êÏÑú Î≥ÄÍ≤?Í∞Ä??/p>
            </CardContent>
          </Card>
        </div>

        {/* ?¨Ìä∏?¥Î¶¨??& Î≥¥Ïú†Ï¢ÖÎ™© ??API Ï°∞Ìöå ?±Í≥µ ?úÏóêÎß??úÏãú */}
        {isSuccess && holdings && holdings.length > 0 && (
          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
            <Card className="hover-elevate">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  ?¨Ìä∏?¥Î¶¨??Íµ¨ÏÑ±
                  <div className="w-2 h-2 rounded-full bg-[hsl(var(--neon-cyan))] animate-pulse-glow" />
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">Ï¢ÖÎ™©Î≥?ÎπÑÏ§ë</CardDescription>
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
                  Î≥¥Ïú† Ï¢ÖÎ™©
                  <div className="w-2 h-2 rounded-full bg-[hsl(var(--neon-purple))] animate-pulse-glow" />
                </CardTitle>
                <CardDescription>Ï¢ÖÎ™©Î≥??òÏùµÎ•?/CardDescription>
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
                          <p className="font-mono text-sm">{h.quantity}Ï£?/p>
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

        {/* ?êÏÇ∞ Ï∂îÏù¥ ???§Ï†ú ?§ÎÉÖ???∞Ïù¥?∞Í? ?àÏùÑ ?åÎßå ?úÏãú */}
        {assetHistory.length > 0 && (
          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                ?êÏÇ∞ Ï∂îÏù¥
                <TrendingUp className="w-4 h-4 text-[hsl(var(--neon-green))]" />
              </CardTitle>
              <CardDescription>ÏµúÍ∑º 30??Ï¥ùÏûê??Î≥Ä??/CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={assetHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="totalAssets" stroke="#8884d8" name="Ï¥ùÏûê?? strokeWidth={2} />
                  <Line type="monotone" dataKey="profit" stroke="#82ca9d" name="?òÏùµ" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* ÏµúÍ∑º Í±∞Îûò */}
        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ÏµúÍ∑º Í±∞Îûò
              <div className="w-2 h-2 rounded-full bg-[hsl(var(--neon-cyan))] animate-pulse-glow" />
            </CardTitle>
            <CardDescription>ÏµúÍ∑º 5Í±¥Ïùò Îß§Îß§ ?¥Ïó≠</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTrades && recentTrades.length > 0 ? (
              <div className="space-y-3">
                {recentTrades.map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-semibold">{trade.stockName} ({trade.stockCode})</p>
                      <p className="text-xs text-muted-foreground">
                        {trade.orderType === 'buy' ? 'Îß§Ïàò' : 'Îß§ÎèÑ'} {trade.orderQuantity}Ï£?                        {" @ "}
                        {(trade.executedPrice ?? trade.orderPrice)
                          ? Number(trade.executedPrice ?? trade.orderPrice).toLocaleString("ko-KR")
                          : "-"}
                        ??                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {trade.orderStatus === "completed" ? "Ï≤¥Í≤∞?ÑÎ£å" :
                         trade.orderStatus === "partial" ? "Î∂ÄÎ∂ÑÏ≤¥Í≤? :
                         trade.orderStatus === "pending" ? "?ÄÍ∏? : "Ï∑®ÏÜå"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(trade.createdAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Í±∞Îûò ?¥Ïó≠???ÜÏäµ?àÎã§</p>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Í≥ÑÏ¢å ??†ú</AlertDialogTitle>
            <AlertDialogDescription>??Í≥ÑÏ¢åÎ•???†ú?òÏãúÍ≤†Ïäµ?àÍπå? ??†ú ?ÑÏóê??Î≥µÍµ¨?????ÜÏäµ?àÎã§.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ï∑®ÏÜå</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (selectedAccountId) deleteAccountMutation.mutate(selectedAccountId); }}
              data-testid="button-confirm-delete"
            >
              ??†ú
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
