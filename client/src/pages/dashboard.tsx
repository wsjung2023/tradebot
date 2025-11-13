import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Wallet, Target, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Dashboard() {
  const { toast } = useToast();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<"mock" | "real">("mock");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['/api/accounts'],
  });

  const { data: settings } = useQuery({
    queryKey: ['/api/settings'],
  });

  const { data: balance } = useQuery({
    queryKey: ['/api/accounts', selectedAccountId, 'balance'],
    enabled: !!selectedAccountId,
  });

  const { data: holdings } = useQuery({
    queryKey: ['/api/accounts', selectedAccountId, 'holdings'],
    enabled: !!selectedAccountId,
  });

  // Auto-select first account if not selected
  useEffect(() => {
    if (!selectedAccountId && accounts && accounts.length > 0 && !accountsLoading) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, accountsLoading, selectedAccountId]);

  const addAccountMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/accounts', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      setDialogOpen(false);
      setAccountNumber("");
      setAccountName("");
      setAccountType("mock");
      toast({
        title: "계좌 추가 완료",
        description: "키움증권 계좌가 추가되었습니다",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "계좌 추가 실패",
        description: error.message,
      });
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
      toast({
        title: "계좌 삭제 완료",
      });
    },
  });

  const formatCurrency = (value: number | string | undefined) => {
    if (!value) return "₩0";
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `₩${num.toLocaleString('ko-KR')}`;
  };

  const formatPercent = (value: number | string | undefined) => {
    if (!value) return "0.00%";
    const num = typeof value === 'string' ? parseFloat(value) : value;
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  };

  const totalAssets = balance?.totalAssets || 0;
  const todayProfit = balance?.todayProfit || 0;
  const todayProfitRate = balance?.todayProfitRate || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">대시보드</h1>
          <p className="text-muted-foreground">AI 기반 자동매매 플랫폼</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-account">
              <Plus className="h-4 w-4 mr-2" />
              계좌 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>키움증권 계좌 추가</DialogTitle>
              <DialogDescription>
                키움증권 계좌 정보를 입력하세요
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="accountNumber">계좌번호</Label>
                <Input
                  id="accountNumber"
                  placeholder="1234-56-789012"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  data-testid="input-account-number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountName">계좌명 (선택)</Label>
                <Input
                  id="accountName"
                  placeholder="주식 계좌"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  data-testid="input-account-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountType">계좌 유형</Label>
                <Select value={accountType} onValueChange={(value: any) => setAccountType(value)}>
                  <SelectTrigger data-testid="select-account-type">
                    <SelectValue />
                  </SelectTrigger>
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

      {accounts && accounts.length > 0 && (
        <div className="flex items-center gap-4">
          <Label>계좌 선택:</Label>
          <Select
            value={selectedAccountId?.toString()}
            onValueChange={(value) => setSelectedAccountId(parseInt(value))}
          >
            <SelectTrigger className="w-64" data-testid="select-account">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc: any) => (
                <SelectItem key={acc.id} value={acc.id.toString()}>
                  {acc.accountName || acc.accountNumber} ({acc.accountType === 'real' ? '실계좌' : '모의투자'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAccountId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm("이 계좌를 삭제하시겠습니까?")) {
                  deleteAccountMutation.mutate(selectedAccountId);
                }
              }}
              data-testid="button-delete-account"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 자산</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-total-assets">
              {formatCurrency(totalAssets)}
            </div>
            <p className="text-xs text-muted-foreground">
              {!selectedAccountId && "계좌를 연결해주세요"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 수익</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-mono ${todayProfit > 0 ? 'text-green-600 dark:text-green-400' : todayProfit < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
              data-testid="text-today-profit"
            >
              {formatCurrency(todayProfit)}
            </div>
            <p className={`text-xs ${todayProfitRate > 0 ? 'text-green-600 dark:text-green-400' : todayProfitRate < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
              {formatPercent(todayProfitRate)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">누적 수익률</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-total-return">
              {formatPercent(balance?.totalReturn)}
            </div>
            <p className="text-xs text-muted-foreground">
              시작 이후
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">거래 모드</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-trading-mode">
              {settings?.tradingMode === 'real' ? '실전' : '모의'}
            </div>
            <p className="text-xs text-muted-foreground">
              설정에서 변경 가능
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>포트폴리오</CardTitle>
            <CardDescription>보유 종목 현황</CardDescription>
          </CardHeader>
          <CardContent>
            {holdings && holdings.length > 0 ? (
              <div className="space-y-2">
                {holdings.map((holding: any) => (
                  <div
                    key={holding.id}
                    className="flex items-center justify-between p-3 border rounded-md"
                    data-testid={`holding-${holding.stockCode}`}
                  >
                    <div>
                      <p className="font-medium">{holding.stockName}</p>
                      <p className="text-sm text-muted-foreground">{holding.stockCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono">{holding.quantity}주</p>
                      <p className={`text-sm ${holding.profitLossRate > 0 ? 'text-green-600' : holding.profitLossRate < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {formatPercent(holding.profitLossRate)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                보유 종목이 없습니다
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI 추천</CardTitle>
            <CardDescription>실시간 매매 신호</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              AI 모델을 활성화해주세요
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>최근 거래</CardTitle>
          <CardDescription>거래 내역</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            거래 내역이 없습니다
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
