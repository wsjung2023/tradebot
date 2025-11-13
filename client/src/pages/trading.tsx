import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMarketStream } from "@/hooks/use-market-stream";
import { ConnectionStatus } from "@/components/connection-status";
import type { KiwoomAccount } from "@shared/schema";

export default function Trading() {
  const { toast } = useToast();
  const [stockCode, setStockCode] = useState("005930"); // Samsung Electronics
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  const [priceType, setPriceType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");

  // WebSocket real-time data with enhanced resilience
  const { prices, orderbooks, connectionStatus, errorMessage, retryCount, forceReconnect } = useMarketStream([stockCode], ["price", "orderbook"]);
  
  const stockPrice = prices[stockCode];
  const orderbook = orderbooks[stockCode];

  // Fallback to REST for chart data
  const { data: chartData = [] } = useQuery<any[]>({
    queryKey: ['/api/stocks', stockCode, 'chart'],
    enabled: !!stockCode,
  });

  const { data: accounts = [] } = useQuery<KiwoomAccount[]>({
    queryKey: ['/api/accounts'],
  });

  const orderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const res = await apiRequest('POST', '/api/orders', orderData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "주문 성공",
        description: `${orderType === 'buy' ? '매수' : '매도'} 주문이 접수되었습니다`,
      });
      setQuantity("");
      setPrice("");
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "주문 실패",
        description: error.message,
      });
    },
  });

  const handleSubmitOrder = () => {
    if (!accounts || accounts.length === 0) {
      toast({
        variant: "destructive",
        title: "계좌 없음",
        description: "먼저 계좌를 등록해주세요",
      });
      return;
    }

    if (!quantity || parseInt(quantity) <= 0) {
      toast({
        variant: "destructive",
        title: "수량 오류",
        description: "수량을 입력해주세요",
      });
      return;
    }

    if (priceType === 'limit' && (!price || parseFloat(price) <= 0)) {
      toast({
        variant: "destructive",
        title: "가격 오류",
        description: "가격을 입력해주세요",
      });
      return;
    }

    orderMutation.mutate({
      accountId: accounts[0].id,
      stockCode,
      stockName: stockPrice?.stockName || stockCode,
      orderType,
      orderMethod: priceType,
      orderQuantity: parseInt(quantity),
      orderPrice: priceType === 'limit' ? parseFloat(price) : undefined,
      orderStatus: 'pending',
      executedQuantity: 0,
    });
  };

  const formatCurrency = (value: number | undefined) => {
    if (!value) return "₩0";
    return `₩${value.toLocaleString('ko-KR')}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-trading-title">거래</h1>
        <p className="text-muted-foreground">실시간 매매 및 차트 분석</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Label>종목 코드:</Label>
          <Input
            placeholder="종목코드 입력 (예: 005930)"
            value={stockCode}
            onChange={(e) => setStockCode(e.target.value)}
            className="w-64"
            data-testid="input-stock-code"
          />
        </div>
        <ConnectionStatus
          status={connectionStatus}
          errorMessage={errorMessage}
          retryCount={retryCount}
          onReconnect={forceReconnect}
        />
      </div>

      {stockPrice && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">현재가</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono" data-testid="text-current-price">
                {formatCurrency(stockPrice.currentPrice)}
              </div>
              <p className={`text-xs ${stockPrice.changeRate > 0 ? 'text-green-600 dark:text-green-400' : stockPrice.changeRate < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                {stockPrice.changeRate > 0 ? '+' : ''}{stockPrice.changeRate}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">전일 대비</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-mono ${stockPrice.change > 0 ? 'text-green-600 dark:text-green-400' : stockPrice.change < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                {stockPrice.change > 0 ? '+' : ''}{formatCurrency(stockPrice.change)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">시가</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{formatCurrency(stockPrice.openPrice)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">거래량</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{stockPrice.volume?.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{stockPrice?.stockName || stockCode} 차트</CardTitle>
            <CardDescription>일봉 차트</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="close" stroke="#8884d8" strokeWidth={2} name="종가" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                차트 데이터 로딩 중...
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>호가</CardTitle>
            <CardDescription>실시간 매도/매수 호가</CardDescription>
          </CardHeader>
          <CardContent>
            {orderbook ? (
              <div className="space-y-1">
                <div className="font-semibold text-sm mb-2">매도 호가</div>
                {orderbook.sell?.slice(0, 5).reverse().map((item: any, idx: number) => (
                  <div key={`sell-${idx}`} className="flex justify-between text-sm p-1 bg-red-50 dark:bg-red-950/20">
                    <span className="text-red-600 dark:text-red-400">{formatCurrency(item.price)}</span>
                    <span className="text-muted-foreground">{item.quantity}</span>
                  </div>
                ))}
                <div className="h-px bg-border my-2" />
                <div className="font-semibold text-sm mb-2">매수 호가</div>
                {orderbook.buy?.slice(0, 5).map((item: any, idx: number) => (
                  <div key={`buy-${idx}`} className="flex justify-between text-sm p-1 bg-green-50 dark:bg-green-950/20">
                    <span className="text-green-600 dark:text-green-400">{formatCurrency(item.price)}</span>
                    <span className="text-muted-foreground">{item.quantity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                호가 데이터 로딩 중...
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>주문</CardTitle>
          <CardDescription>매수/매도 주문</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={orderType} onValueChange={(value: any) => setOrderType(value)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buy" data-testid="tab-buy">매수</TabsTrigger>
              <TabsTrigger value="sell" data-testid="tab-sell">매도</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>주문 유형</Label>
                <Select value={priceType} onValueChange={(value: any) => setPriceType(value)}>
                  <SelectTrigger data-testid="select-price-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">시장가</SelectItem>
                    <SelectItem value="limit">지정가</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>수량</Label>
                <Input
                  type="number"
                  placeholder="수량"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-testid="input-quantity"
                />
              </div>
            </div>

            {priceType === 'limit' && (
              <div className="space-y-2">
                <Label>가격</Label>
                <Input
                  type="number"
                  placeholder="가격"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  data-testid="input-price"
                />
              </div>
            )}

            <Button
              onClick={handleSubmitOrder}
              disabled={orderMutation.isPending}
              className={orderType === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
              data-testid="button-submit-order"
            >
              {orderMutation.isPending ? "주문 중..." : orderType === 'buy' ? '매수' : '매도'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
