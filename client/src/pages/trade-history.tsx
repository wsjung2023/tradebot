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
import { format } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";

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

export default function TradeHistory() {
  // Fetch all orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ['/api/all-orders'],
  });

  // Fetch trading logs
  const { data: logs = [], isLoading: logsLoading } = useQuery<TradingLog[]>({
    queryKey: ['/api/trading-logs'],
  });

  // Calculate statistics
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

      {/* Statistics Cards */}
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

      {/* Tabs for Orders and Logs */}
      <Tabs defaultValue="orders" className="flex-1">
        <TabsList>
          <TabsTrigger value="orders" data-testid="tab-orders">주문 내역</TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">거래 로그</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
