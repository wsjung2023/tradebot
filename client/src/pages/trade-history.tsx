import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, subDays } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  BarChart3,
  CheckCircle2,
  XCircle,
  Calendar,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Order {
  id: number;
  accountId: number;
  accountName?: string | null;
  accountNumber?: string | null;
  accountType?: "mock" | "real" | null;
  accountIsActive?: boolean | null;
  stockCode: string;
  stockName?: string;
  orderType: 'buy' | 'sell';
  orderMethod: 'market' | 'limit' | 'conditional';
  orderPrice?: number;
  orderQuantity: number;
  executedQuantity?: number;
  executedPrice?: number;
  orderStatus: 'pending' | 'partial' | 'completed' | 'cancelled' | 'failed';
  errorMessage?: string | null;
  createdAt: string;
  executedAt?: string;
}

interface TradingLog {
  id: number;
  accountId: number;
  accountName?: string | null;
  accountNumber?: string | null;
  accountType?: "mock" | "real" | null;
  accountIsActive?: boolean | null;
  action: string;
  details: any;
  success: boolean;
  errorMessage?: string;
  createdAt: string;
}

interface TradeAccount {
  id: number;
  accountNumber: string;
  accountName?: string | null;
  accountType: "mock" | "real";
  isActive?: boolean;
}

interface PerformanceSummary {
  groupKey: string;
  stockName?: string;
  buyCount: number;
  sellCount: number;
  totalCount: number;
  totalPnL: number;
  winRate: number;
  avgProfitRate: number;
}

function formatKRW(val: number): string {
  return val.toLocaleString("ko-KR") + "원";
}

function pnlColor(val: number): string {
  if (val > 0) return "text-green-600 dark:text-green-400";
  if (val < 0) return "text-red-600 dark:text-red-400";
  return "";
}

function appendAccountFilters(
  params: URLSearchParams,
  accountStatus: "active" | "all" | "archived",
  accountType: "all" | "mock" | "real",
  accountId: string,
) {
  params.set("accountStatus", accountStatus);
  params.set("activeOnly", accountStatus === "active" ? "true" : "false");
  if (accountType !== "all") params.set("accountType", accountType);
  if (accountId !== "all") params.set("accountId", accountId);
}

function buildPerfUrl(
  groupBy: string,
  startDate?: string,
  endDate?: string,
  accountStatus: "active" | "all" | "archived" = "active",
  accountType: "all" | "mock" | "real" = "all",
  accountId = "all",
): string {
  const params = new URLSearchParams({ groupBy });
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  appendAccountFilters(params, accountStatus, accountType, accountId);
  return `/api/trading-performance/summary?${params.toString()}`;
}

type AccountFilterProps = {
  accountStatus: "active" | "all" | "archived";
  accountType: "all" | "mock" | "real";
  accountId: string;
};

function DailyPerformanceTab({ accountStatus, accountType, accountId }: AccountFilterProps) {
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const url = buildPerfUrl("day", startDate, endDate, accountStatus, accountType, accountId);
  const { data = [], isLoading, isError } = useQuery<PerformanceSummary[]>({
    queryKey: [url],
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" />
          일별 성과
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
            data-testid="input-daily-start"
          />
          <span className="text-muted-foreground text-sm">~</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
            data-testid="input-daily-end"
          />
        </div>

        {isError ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground" data-testid="text-daily-error">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">데이터를 불러올 수 없습니다</span>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-daily-empty">
            거래 데이터가 없습니다
          </div>
        ) : (
          <>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="groupKey" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip
                    formatter={(value: number) => formatKRW(value)}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{ fontSize: 12, borderRadius: 6 }}
                  />
                  <Bar dataKey="totalPnL" name="실현손익" radius={[3, 3, 0, 0]}>
                    {data.map((entry, index) => (
                      <Cell key={index} fill={entry.totalPnL >= 0 ? "#22c55e" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>날짜</TableHead>
                    <TableHead className="text-right">매수</TableHead>
                    <TableHead className="text-right">매도</TableHead>
                    <TableHead className="text-right">실현손익</TableHead>
                    <TableHead className="text-right">승률</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.groupKey} data-testid={`row-daily-${row.groupKey}`}>
                      <TableCell className="font-mono text-sm">{row.groupKey}</TableCell>
                      <TableCell className="text-right text-sm">{row.buyCount}건</TableCell>
                      <TableCell className="text-right text-sm">{row.sellCount}건</TableCell>
                      <TableCell className={`text-right font-mono text-sm ${pnlColor(row.totalPnL)}`}>
                        {row.totalPnL > 0 ? "+" : ""}{formatKRW(row.totalPnL)}
                      </TableCell>
                      <TableCell className="text-right text-sm">{row.winRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MonthlyPerformanceTab({ accountStatus, accountType, accountId }: AccountFilterProps) {
  const url = buildPerfUrl("month", undefined, undefined, accountStatus, accountType, accountId);
  const { data = [], isLoading, isError } = useQuery<PerformanceSummary[]>({
    queryKey: [url],
  });

  const cumulativeData = useMemo(() => {
    let cumPnL = 0;
    return data.map((row) => {
      cumPnL += row.totalPnL;
      return { ...row, cumulativePnL: cumPnL };
    });
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          월별 성과
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground" data-testid="text-monthly-error">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">데이터를 불러올 수 없습니다</span>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-monthly-empty">
            거래 데이터가 없습니다
          </div>
        ) : (
          <>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="groupKey" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip
                    formatter={(value: number) => formatKRW(value)}
                    contentStyle={{ fontSize: 12, borderRadius: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativePnL"
                    name="누적 수익"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>월</TableHead>
                    <TableHead className="text-right">총 거래</TableHead>
                    <TableHead className="text-right">매수</TableHead>
                    <TableHead className="text-right">매도</TableHead>
                    <TableHead className="text-right">실현손익</TableHead>
                    <TableHead className="text-right">승률</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.groupKey} data-testid={`row-monthly-${row.groupKey}`}>
                      <TableCell className="font-mono text-sm">{row.groupKey}</TableCell>
                      <TableCell className="text-right text-sm">{row.totalCount}건</TableCell>
                      <TableCell className="text-right text-sm">{row.buyCount}건</TableCell>
                      <TableCell className="text-right text-sm">{row.sellCount}건</TableCell>
                      <TableCell className={`text-right font-mono text-sm ${pnlColor(row.totalPnL)}`}>
                        {row.totalPnL > 0 ? "+" : ""}{formatKRW(row.totalPnL)}
                      </TableCell>
                      <TableCell className="text-right text-sm">{row.winRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StockPerformanceTab({ accountStatus, accountType, accountId }: AccountFilterProps) {
  const url = buildPerfUrl("stock", undefined, undefined, accountStatus, accountType, accountId);
  const { data = [], isLoading, isError } = useQuery<PerformanceSummary[]>({
    queryKey: [url],
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          종목별 성과
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground" data-testid="text-stock-error">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">데이터를 불러올 수 없습니다</span>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-stock-empty">
            거래 데이터가 없습니다
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>종목</TableHead>
                  <TableHead className="text-right">거래 횟수</TableHead>
                  <TableHead className="text-right">평균 수익률</TableHead>
                  <TableHead className="text-right">총 손익</TableHead>
                  <TableHead className="text-right">승률</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.groupKey} data-testid={`row-stock-${row.groupKey}`}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{row.stockName || row.groupKey}</span>
                        <span className="text-xs text-muted-foreground font-mono">{row.groupKey}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{row.totalCount}건</TableCell>
                    <TableCell className={`text-right font-mono text-sm ${pnlColor(row.avgProfitRate)}`}>
                      {row.avgProfitRate > 0 ? "+" : ""}{row.avgProfitRate.toFixed(2)}%
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm ${pnlColor(row.totalPnL)}`}>
                      {row.totalPnL > 0 ? "+" : ""}{formatKRW(row.totalPnL)}
                    </TableCell>
                    <TableCell className="text-right text-sm">{row.winRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ORDERS_PAGE_SIZE = 20;
const LOGS_PAGE_SIZE = 20;

export default function TradeHistory() {
  const [accountStatus, setAccountStatus] = useState<"active" | "all" | "archived">("all");
  const [accountType, setAccountType] = useState<"all" | "mock" | "real">("all");
  const [accountId, setAccountId] = useState("all");
  const [ordersPage, setOrdersPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);

  const { data: accounts = [] } = useQuery<TradeAccount[]>({
    queryKey: ['/api/accounts'],
  });

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      if (accountStatus === "active" && account.isActive === false) return false;
      if (accountStatus === "archived" && account.isActive !== false) return false;
      if (accountType !== "all" && account.accountType !== accountType) return false;
      return true;
    });
  }, [accounts, accountStatus, accountType]);

  const accountFilterParams = useMemo(() => {
    const params = new URLSearchParams();
    appendAccountFilters(params, accountStatus, accountType, accountId);
    return params.toString();
  }, [accountStatus, accountType, accountId]);

  useEffect(() => {
    if (accountId === "all") return;
    if (!filteredAccounts.some((account) => String(account.id) === accountId)) {
      setAccountId("all");
    }
  }, [filteredAccounts, accountId]);

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: [`/api/all-orders?${accountFilterParams}`],
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<TradingLog[]>({
    queryKey: [`/api/trading-logs?${accountFilterParams}`],
  });

  // 헤더 요약 통계: trading_performance 기준 (실현 손익만 집계)
  const { data: perfByMonth = [] } = useQuery<PerformanceSummary[]>({
    queryKey: [buildPerfUrl("month", undefined, undefined, accountStatus, accountType, accountId)],
  });

  const completedOrders = orders.filter(o => o.orderStatus === 'completed');
  const buyOrders = completedOrders.filter(o => o.orderType === 'buy');
  const sellOrders = completedOrders.filter(o => o.orderType === 'sell');

  // 실현 손익 집계 (trading_performance 기반 — 매도 완료된 포지션만)
  const realizedPnL = perfByMonth.reduce((sum, p) => sum + (p.totalPnL || 0), 0);
  const totalSellCount = perfByMonth.reduce((sum, p) => sum + (p.sellCount || 0), 0);
  const weightedWinRate = totalSellCount > 0
    ? perfByMonth.reduce((sum, p) => sum + (p.winRate || 0) * (p.sellCount || 0), 0) / totalSellCount
    : 0;
  const weightedAvgRate = totalSellCount > 0
    ? perfByMonth.reduce((sum, p) => sum + (p.avgProfitRate || 0) * (p.sellCount || 0), 0) / totalSellCount
    : 0;

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" data-testid={`badge-status-${status}`}>체결완료</Badge>;
      case 'pending':
        return <Badge variant="secondary" data-testid={`badge-status-${status}`}>대기중</Badge>;
      case 'partial':
        return <Badge variant="secondary" data-testid={`badge-status-${status}`}>부분체결</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" data-testid={`badge-status-${status}`}>취소</Badge>;
      default:
        return <Badge variant="secondary" data-testid={`badge-status-${status}`}>{status}</Badge>;
    }
  };

  const getOrderTypeBadge = (type: 'buy' | 'sell') => {
    return type === 'buy' 
      ? <Badge variant="default" data-testid={`badge-type-${type}`}>매수</Badge>
      : <Badge variant="destructive" data-testid={`badge-type-${type}`}>매도</Badge>;
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">거래 내역</h1>
          <p className="text-sm text-muted-foreground">주문 내역 및 거래 로그 분석</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-2">
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
              data-testid={`button-trade-status-${option.value}`}
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
              variant={accountType === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setAccountType(option.value as "all" | "mock" | "real")}
              data-testid={`button-trade-type-${option.value}`}
            >
              {option.label}
            </Button>
          ))}
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-64" data-testid="select-trade-account">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 계좌</SelectItem>
              {filteredAccounts.map((account) => (
                <SelectItem key={account.id} value={String(account.id)}>
                  {account.accountName || account.accountNumber} ({account.accountType === "real" ? "실전" : "모의"}{account.isActive === false ? ", 보관" : ""})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 거래 횟수</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-trades">{completedOrders.length}</div>
            <p className="text-xs text-muted-foreground">
              매수 {buyOrders.length} / 매도 {sellOrders.length}
            </p>
          </CardContent>

        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">순손익</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}
              data-testid="text-net-profit"
            >
              {realizedPnL >= 0 ? '+' : ''}{realizedPnL.toLocaleString()}원
            </div>
            <p className="text-xs text-muted-foreground">실현 손익 기준</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">성공률</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-success-rate">
              {weightedWinRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              매도 완료 {totalSellCount}건 기준
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 수익률</CardTitle>
            {weightedAvgRate >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${weightedAvgRate >= 0 ? 'text-green-600' : 'text-red-600'}`}
              data-testid="text-avg-return"
            >
              {weightedAvgRate >= 0 ? '+' : ''}{weightedAvgRate.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              매도 완료 기준
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="orders" className="flex-1">
        <TabsList className="flex-wrap">
          <TabsTrigger value="orders" data-testid="tab-orders">주문 내역</TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">거래 로그</TabsTrigger>
          <TabsTrigger value="daily" data-testid="tab-daily">일별 성과</TabsTrigger>
          <TabsTrigger value="monthly" data-testid="tab-monthly">월별 성과</TabsTrigger>
          <TabsTrigger value="stock" data-testid="tab-stock">종목별 성과</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>주문 내역</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-orders">
                  주문 내역이 없습니다
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>시간</TableHead>
                        <TableHead>계좌</TableHead>
                        <TableHead>종목코드</TableHead>
                        <TableHead>종목명</TableHead>
                        <TableHead>구분</TableHead>
                        <TableHead className="text-right">주문가</TableHead>
                        <TableHead className="text-right">주문량</TableHead>
                        <TableHead className="text-right">체결가</TableHead>
                        <TableHead className="text-right">체결량</TableHead>
                        <TableHead>상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.slice((ordersPage - 1) * ORDERS_PAGE_SIZE, ordersPage * ORDERS_PAGE_SIZE).map((order) => (
                        <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                          <TableCell className="text-sm">
                            {format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{order.accountName || order.accountNumber || order.accountId}</div>
                            <div className="text-xs text-muted-foreground">
                              {order.accountType === "real" ? "실전" : "모의"}
                              {order.accountIsActive === false ? " · 보관" : ""}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">{order.stockCode}</TableCell>
                          <TableCell>{order.stockName || '-'}</TableCell>
                          <TableCell>{getOrderTypeBadge(order.orderType)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {order.orderPrice?.toLocaleString() || '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {order.orderQuantity.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {order.executedPrice?.toLocaleString() || '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {order.executedQuantity?.toLocaleString() || '-'}
                          </TableCell>
                          <TableCell>
                            {getOrderStatusBadge(order.orderStatus)}
                            {order.orderStatus === 'failed' && order.errorMessage && (
                              <div className="text-xs text-red-400 mt-0.5 max-w-[200px] truncate" title={order.errorMessage}>
                                {order.errorMessage}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    page={ordersPage}
                    totalItems={orders.length}
                    pageSize={ORDERS_PAGE_SIZE}
                    onPageChange={(p) => { setOrdersPage(p); }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>거래 로그</CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-logs">
                  거래 로그가 없습니다
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>시간</TableHead>
                        <TableHead>계좌</TableHead>
                        <TableHead>액션</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>세부정보</TableHead>
                        <TableHead>에러 메시지</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.slice((logsPage - 1) * LOGS_PAGE_SIZE, logsPage * LOGS_PAGE_SIZE).map((log) => (
                        <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                          <TableCell className="text-sm">
                            {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{log.accountName || log.accountNumber || log.accountId}</div>
                            <div className="text-xs text-muted-foreground">
                              {log.accountType === "real" ? "실전" : "모의"}
                              {log.accountIsActive === false ? " · 보관" : ""}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{log.action}</TableCell>
                          <TableCell>
                            {log.success ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="text-green-600">성공</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-600" />
                                <span className="text-red-600">실패</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                            {JSON.stringify(log.details)}
                          </TableCell>
                          <TableCell className="text-sm text-red-600">
                            {log.errorMessage || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    page={logsPage}
                    totalItems={logs.length}
                    pageSize={LOGS_PAGE_SIZE}
                    onPageChange={(p) => { setLogsPage(p); }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <DailyPerformanceTab accountStatus={accountStatus} accountType={accountType} accountId={accountId} />
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <MonthlyPerformanceTab accountStatus={accountStatus} accountType={accountType} accountId={accountId} />
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          <StockPerformanceTab accountStatus={accountStatus} accountType={accountType} accountId={accountId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
