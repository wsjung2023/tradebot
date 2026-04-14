import { useState, useMemo } from "react";
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
  stockCode: string;
  stockName?: string;
  orderType: 'buy' | 'sell';
  orderMethod: 'market' | 'limit' | 'conditional';
  orderPrice?: number;
  orderQuantity: number;
  executedQuantity?: number;
  executedPrice?: number;
  orderStatus: 'pending' | 'partial' | 'completed' | 'cancelled';
  createdAt: string;
  executedAt?: string;
}

interface TradingLog {
  id: number;
  accountId: number;
  action: string;
  details: any;
  success: boolean;
  errorMessage?: string;
  createdAt: string;
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

function buildPerfUrl(groupBy: string, startDate?: string, endDate?: string): string {
  const params = new URLSearchParams({ groupBy });
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  return `/api/trading-performance/summary?${params.toString()}`;
}

function DailyPerformanceTab() {
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const url = buildPerfUrl("day", startDate, endDate);
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

function MonthlyPerformanceTab() {
  const url = buildPerfUrl("month");
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

function StockPerformanceTab() {
  const url = buildPerfUrl("stock");
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

export default function TradeHistory() {
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ['/api/all-orders'],
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<TradingLog[]>({
    queryKey: ['/api/trading-logs'],
  });

  const completedOrders = orders.filter(o => o.orderStatus === 'completed');
  const buyOrders = completedOrders.filter(o => o.orderType === 'buy');
  const sellOrders = completedOrders.filter(o => o.orderType === 'sell');
  
  const totalBuyValue = buyOrders.reduce((sum, o) => 
    sum + (o.executedPrice || 0) * (o.executedQuantity || 0), 0
  );
  const totalSellValue = sellOrders.reduce((sum, o) => 
    sum + (o.executedPrice || 0) * (o.executedQuantity || 0), 0
  );
  const netProfit = totalSellValue - totalBuyValue;
  const profitPercentage = totalBuyValue > 0 ? (netProfit / totalBuyValue) * 100 : 0;

  const successfulActions = logs.filter(l => l.success).length;
  const successRate = logs.length > 0 ? (successfulActions / logs.length) * 100 : 0;

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
              className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}
              data-testid="text-net-profit"
            >
              {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString()}원
            </div>
            <p className="text-xs text-muted-foreground">
              {profitPercentage >= 0 ? '+' : ''}{profitPercentage.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">성공률</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-success-rate">
              {successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              성공 {successfulActions} / 전체 {logs.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 수익률</CardTitle>
            {profitPercentage >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div 
              className={`text-2xl font-bold ${profitPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}
              data-testid="text-avg-return"
            >
              {profitPercentage >= 0 ? '+' : ''}{profitPercentage.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              전체 거래 기준
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
                      {orders.map((order) => (
                        <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                          <TableCell className="text-sm">
                            {format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm')}
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
                          <TableCell>{getOrderStatusBadge(order.orderStatus)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                        <TableHead>액션</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>세부정보</TableHead>
                        <TableHead>에러 메시지</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                          <TableCell className="text-sm">
                            {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
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
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <DailyPerformanceTab />
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <MonthlyPerformanceTab />
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          <StockPerformanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
