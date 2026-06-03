import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, TrendingUp, TrendingDown, Wallet, BarChart3, Hash, Loader2, AlertCircle, Target } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HoldingExitPlanDialog } from "@/components/auto-trading/HoldingExitPlanDialog";

interface PortfolioHolding {
  id: number;
  accountId: number;
  stockCode: string;
  stockName: string;
  quantity: number;
  averagePrice: string;
  currentPrice: string | null;
  profitLoss: string | null;
  profitLossRate: string | null;
  updatedAt: string;
  accountName: string | null;
  accountNumber: string;
  accountType: "mock" | "real";
  isActive: boolean;
}

interface PortfolioAccount {
  id: number;
  accountNumber: string;
  accountType: "mock" | "real";
  isActive?: boolean;
  accountName?: string;
  lastTotalAssets?: string | null;
}

function num(val: string | null | undefined): number {
  if (val == null) return 0;
  return Number(val) || 0;
}

function formatCurrency(val: number): string {
  return val.toLocaleString("ko-KR") + "원";
}

function formatRate(val: number): string {
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

function maskAccount(accountNumber: string): string {
  if (accountNumber.length > 4) {
    return "***" + accountNumber.slice(-4);
  }
  return accountNumber;
}

interface AiModel { id: number; config: any; }

export default function Portfolio() {
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [accountStatus, setAccountStatus] = useState<"active" | "all" | "archived">("active");
  const [accountTypeFilter, setAccountTypeFilter] = useState<"all" | "mock" | "real">("all");
  const [exitPlanHolding, setExitPlanHolding] = useState<PortfolioHolding | null>(null);
  const [exitPlanOpen, setExitPlanOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: accountsData = [] } = useQuery<PortfolioAccount[]>({ queryKey: ["/api/accounts"] });
  const { data: modelsData = [] } = useQuery<AiModel[]>({ queryKey: ["/api/ai/models"] });

  const deleteAllPlansMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.all(
        modelsData.map((m: AiModel) =>
          fetch(`/api/auto-trading/exit-plans/${m.id}`, { method: 'DELETE' }).then(r => r.json())
        )
      );
      return results.reduce((sum: number, r: any) => sum + (r.deleted ?? 0), 0);
    },
    onSuccess: (deleted) => {
      qc.invalidateQueries({ queryKey: ['/api/auto-trading/exit-plan'] });
      toast({ title: `전체 매도 계획 삭제 완료`, description: `${deleted}개 계획 삭제됨` });
    },
    onError: () => toast({ title: '삭제 실패', variant: 'destructive' }),
  });

  const portfolioUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("activeOnly", accountStatus === "active" ? "true" : "false");
    if (accountTypeFilter !== "all") params.set("accountType", accountTypeFilter);
    if (selectedAccount !== "all") params.set("accountId", selectedAccount);
    const query = params.toString();
    return `/api/portfolio/holdings${query ? `?${query}` : ""}`;
  }, [accountStatus, accountTypeFilter, selectedAccount]);

  const { data, isLoading, isError } = useQuery<{ holdings: PortfolioHolding[] }>({
    queryKey: [portfolioUrl],
    refetchInterval: 60_000,
  });

  const holdings = data?.holdings ?? [];

  const accounts = useMemo(() => {
    return accountsData
      .filter((account) => {
        if (accountStatus === "active" && account.isActive === false) return false;
        if (accountStatus === "archived" && account.isActive !== false) return false;
        if (accountTypeFilter !== "all" && account.accountType !== accountTypeFilter) return false;
        return true;
      })
      .map((account) => ({
        id: account.id,
        name: account.accountName || maskAccount(account.accountNumber),
        number: account.accountNumber,
        accountType: account.accountType,
        isActive: account.isActive !== false,
      }));
  }, [accountsData, accountStatus, accountTypeFilter]);

  useEffect(() => {
    if (selectedAccount === "all") return;
    if (!accounts.some((account) => String(account.id) === selectedAccount)) {
      setSelectedAccount("all");
    }
  }, [accounts, selectedAccount]);

  const filtered = useMemo(() => {
    return holdings.filter((h) => {
      if (accountStatus === "active" && h.isActive === false) return false;
      if (accountStatus === "archived" && h.isActive !== false) return false;
      if (accountTypeFilter !== "all" && h.accountType !== accountTypeFilter) return false;
      if (selectedAccount !== "all" && String(h.accountId) !== selectedAccount) return false;
      return true;
    });
  }, [holdings, selectedAccount, accountStatus, accountTypeFilter]);

  const selectedAccountLabel = useMemo(() => {
    if (selectedAccount === "all") return "전체";
    const selected = accounts.find((acc) => String(acc.id) === selectedAccount);
    return selected?.name || "선택 계좌";
  }, [accounts, selectedAccount]);

  const summary = useMemo(() => {
    let totalInvested = 0;
    let totalEval = 0;
    let totalPnL = 0;
    for (const h of filtered) {
      const avgP = num(h.averagePrice);
      const curP = num(h.currentPrice);
      const qty = h.quantity;
      totalInvested += avgP * qty;
      totalEval += (curP || avgP) * qty;
      totalPnL += num(h.profitLoss);
    }
    const pnlRate = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    return { totalInvested, totalEval, totalPnL, pnlRate, count: filtered.length };
  }, [filtered]);

  const estimatedTotals = useMemo(() => {
    const targetAccountIds =
      selectedAccount === "all"
        ? Array.from(new Set(filtered.map((h) => h.accountId)))
        : [Number(selectedAccount)];

    const totalAssets = targetAccountIds.reduce((sum, accountId) => {
      const account = accountsData.find((a) => a.id === accountId);
      return sum + num(account?.lastTotalAssets || "0");
    }, 0);
    const cash = Math.max(0, totalAssets - summary.totalEval);
    return { totalAssets, cash };
  }, [accountsData, filtered, selectedAccount, summary.totalEval]);

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" data-testid="text-portfolio-title">
            <Briefcase className="h-7 w-7" />
            포트폴리오
          </h1>
          <p className="text-muted-foreground mt-1">전체 계좌 보유종목 통합 현황 (1분 자동갱신)</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 text-destructive border-destructive/40 hover:bg-destructive/10"
          onClick={() => {
            if (confirm('모든 종목의 매도 계획을 삭제합니다. 계속하시겠습니까?')) {
              deleteAllPlansMutation.mutate();
            }
          }}
          disabled={deleteAllPlansMutation.isPending}
          title="모든 종목의 매도 계획(ExitStage) 일괄 삭제"
        >
          {deleteAllPlansMutation.isPending ? '삭제 중...' : '전체 매도계획 삭제'}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card data-testid="card-total-invested">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Wallet className="h-3 w-3" />
              <span>총 투자금액</span>
            </div>
            <p className="text-lg font-bold" data-testid="text-total-invested">{isLoading ? "-" : formatCurrency(summary.totalInvested)}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-total-eval">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <BarChart3 className="h-3 w-3" />
              <span>평가금액</span>
            </div>
            <p className="text-lg font-bold" data-testid="text-total-eval">{isLoading ? "-" : formatCurrency(summary.totalEval)}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-total-pnl">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              {summary.totalPnL >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>총 손익</span>
            </div>
            <p className={`text-lg font-bold ${summary.totalPnL > 0 ? "text-green-600 dark:text-green-400" : summary.totalPnL < 0 ? "text-red-600 dark:text-red-400" : ""}`} data-testid="text-total-pnl">
              {isLoading ? "-" : `${summary.totalPnL > 0 ? "+" : ""}${formatCurrency(summary.totalPnL)} (${formatRate(summary.pnlRate)})`}
            </p>
          </CardContent>
        </Card>
        <Card data-testid="card-holding-count">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Hash className="h-3 w-3" />
              <span>보유 종목 수</span>
            </div>
            <p className="text-lg font-bold" data-testid="text-holding-count">{isLoading ? "-" : `${summary.count}개`}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {[
          { value: "active", label: "활성" },
          { value: "all", label: "전체상태" },
          { value: "archived", label: "보관" },
        ].map((option) => (
          <Button
            key={option.value}
            variant={accountStatus === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => setAccountStatus(option.value as "active" | "all" | "archived")}
            data-testid={`button-portfolio-status-${option.value}`}
          >
            {option.label}
          </Button>
        ))}
        {[
          { value: "all", label: "전체유형" },
          { value: "mock", label: "모의" },
          { value: "real", label: "실전" },
        ].map((option) => (
          <Button
            key={option.value}
            variant={accountTypeFilter === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => setAccountTypeFilter(option.value as "all" | "mock" | "real")}
            data-testid={`button-portfolio-type-${option.value}`}
          >
            {option.label}
          </Button>
        ))}
        <Button
          variant={selectedAccount === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedAccount("all")}
          data-testid="button-filter-all"
        >
          전체
        </Button>
        {accounts.map((acc) => (
          <Button
            key={acc.id}
            variant={selectedAccount === String(acc.id) ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedAccount(String(acc.id))}
            data-testid={`button-filter-account-${acc.id}`}
          >
            {acc.name} · {acc.accountType === "real" ? "실전" : "모의"}{acc.isActive ? "" : " · 보관"}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card data-testid="card-estimated-cash">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Wallet className="h-3 w-3" />
              <span>추정 예수금</span>
            </div>
            <p className="text-lg font-bold" data-testid="text-estimated-cash">
              {isLoading ? "-" : formatCurrency(estimatedTotals.cash)}
            </p>
          </CardContent>
        </Card>
        <Card data-testid="card-estimated-total-assets">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <BarChart3 className="h-3 w-3" />
              <span>추정 총자산</span>
            </div>
            <p className="text-lg font-bold" data-testid="text-estimated-total-assets">
              {isLoading ? "-" : formatCurrency(estimatedTotals.totalAssets)}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="flex items-center gap-2 flex-wrap" data-testid="portfolio-filter-badge-row">
        <Badge variant="secondary" data-testid="portfolio-filter-badge">
          현재 필터: {selectedAccountLabel}
        </Badge>
        <Badge variant="outline" data-testid="portfolio-filter-count-badge">
          표시 종목: {filtered.length}개
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">보유종목</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground" data-testid="text-holdings-error">
              <AlertCircle className="h-6 w-6" />
              <span className="text-sm">보유종목 데이터를 불러오지 못했습니다</span>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm" data-testid="text-no-holdings">
              보유 종목이 없습니다
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>종목</TableHead>
                    <TableHead className="hidden md:table-cell">계좌</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">매입가</TableHead>
                    <TableHead className="text-right">현재가</TableHead>
                    <TableHead className="text-right">손익</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">수익률</TableHead>
                    <TableHead className="text-center w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((h) => {
                    const pnl = num(h.profitLoss);
                    const rate = num(h.profitLossRate);
                    const pnlColor = pnl > 0 ? "text-green-600 dark:text-green-400" : pnl < 0 ? "text-red-600 dark:text-red-400" : "";
                    const exitPlanModel = modelsData.find((m: AiModel) => m.config?.accountId === h.accountId);
                    const canEditExitPlan = Boolean(exitPlanModel);
                    return (
                      <TableRow key={h.id} data-testid={`row-holding-${h.id}`}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{h.stockName}</span>
                            <span className="text-xs text-muted-foreground font-mono">{h.stockCode}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {h.accountName || maskAccount(h.accountNumber)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{h.quantity}</TableCell>
                        <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
                          {num(h.averagePrice).toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {num(h.currentPrice).toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm ${pnlColor}`}>
                          {pnl > 0 ? "+" : ""}{pnl.toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm hidden sm:table-cell ${pnlColor}`}>
                          {formatRate(rate)}
                        </TableCell>
                        <TableCell className="text-center w-10 px-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title={canEditExitPlan ? "매도 전략 설정" : "이 계좌에 연결된 자동매매 모델이 없어 매도계획을 설정할 수 없습니다"}
                            disabled={!canEditExitPlan}
                            onClick={() => {
                              if (!canEditExitPlan) return;
                              setExitPlanHolding(h);
                              setExitPlanOpen(true);
                            }}
                            data-testid={`button-exit-plan-${h.id}`}
                          >
                            <Target className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {exitPlanHolding && (() => {
        const model = modelsData.find((m: AiModel) => m.config?.accountId === exitPlanHolding.accountId);
        if (!model) return null;
        return (
          <HoldingExitPlanDialog
            open={exitPlanOpen}
            onOpenChange={(v) => { setExitPlanOpen(v); if (!v) setExitPlanHolding(null); }}
            modelId={model.id}
            holding={{
              ...exitPlanHolding,
              currentPrice: exitPlanHolding.currentPrice ?? "0",
              profitLoss: exitPlanHolding.profitLoss ?? "0",
              profitLossRate: exitPlanHolding.profitLossRate ?? "0",
            }}
          />
        );
      })()}
    </div>
  );
}
