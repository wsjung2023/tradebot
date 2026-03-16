import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMarketStream } from "@/hooks/use-market-stream";
import { ConnectionStatus } from "@/components/connection-status";
import type { KiwoomAccount, ChartFormula } from "@shared/schema";

type ChartSignal = {
  id: number;
  signal: "buy" | "hold";
  currentPrice: number | null;
  createdAt: string;
  chartDate?: string;
};

export default function Trading() {
  const { toast } = useToast();
  const [stockCode, setStockCode] = useState("005930"); // Samsung Electronics
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  const [priceType, setPriceType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>("");
  const [formulaOverlay, setFormulaOverlay] = useState<any[]>([]);
  const [formulaColor, setFormulaColor] = useState<string>("#f59e0b");
  const [formulaName, setFormulaName] = useState<string>("");

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

  const { data: chartSignals = [] } = useQuery<ChartSignal[]>({
    queryKey: ['/api/stocks', stockCode, 'chart-signals'],
    enabled: !!stockCode,
  });


  const { data: chartFormulas = [] } = useQuery<ChartFormula[]>({
    queryKey: ["/api/chart-formulas"],
  });

  const evaluateFormulaMutation = useMutation({
    mutationFn: async ({ id, stockCode, period }: { id: number; stockCode: string; period: string }) => {
      const res = await apiRequest("POST", `/api/chart-formulas/${id}/evaluate`, { stockCode, period });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.signalLine) {
        setFormulaOverlay(data.signalLine.values || []);
        setFormulaColor(data.signalLine.color || "#f59e0b");
        setFormulaName(data.signalLine.name || "");
      }
    },
  });

  const handleFormulaSelect = (formulaId: string) => {
    setSelectedFormulaId(formulaId);
    if (!formulaId || !stockCode) return;
    evaluateFormulaMutation.mutate({ id: parseInt(formulaId), stockCode, period: "D" });
  };

  const orderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const res = await apiRequest('POST', '/api/orders', orderData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "二쇰Ц ?깃났",
        description: `${orderType === 'buy' ? '留ㅼ닔' : '留ㅻ룄'} 二쇰Ц???묒닔?섏뿀?듬땲??,
      });
      setQuantity("");
      setPrice("");
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "二쇰Ц ?ㅽ뙣",
        description: error.message,
      });
    },
  });

  const handleSubmitOrder = () => {
    if (!accounts || accounts.length === 0) {
      toast({
        variant: "destructive",
        title: "怨꾩쥖 ?놁쓬",
        description: "癒쇱? 怨꾩쥖瑜??깅줉?댁＜?몄슂",
      });
      return;
    }

    if (!quantity || parseInt(quantity) <= 0) {
      toast({
        variant: "destructive",
        title: "?섎웾 ?ㅻ쪟",
        description: "?섎웾???낅젰?댁＜?몄슂",
      });
      return;
    }

    if (priceType === 'limit' && (!price || parseFloat(price) <= 0)) {
      toast({
        variant: "destructive",
        title: "媛寃??ㅻ쪟",
        description: "媛寃⑹쓣 ?낅젰?댁＜?몄슂",
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
    if (!value) return "??";
    return `??{value.toLocaleString('ko-KR')}`;
  };

  const normalizedSignalDots = chartSignals
    .map((signal) => ({
      ...signal,
      chartDate: signal.chartDate || String(signal.createdAt || '').replace(/[-:TZ.]/g, '').slice(0, 8),
      chartPrice:
        typeof signal.currentPrice === 'number' && signal.currentPrice > 0
          ? signal.currentPrice
          : stockPrice?.currentPrice || 0,
    }))
    .filter((signal) => signal.chartDate && signal.chartPrice > 0)
    .slice(-200);


  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-trading-title">嫄곕옒</h1>
        <p className="text-sm md:text-base text-muted-foreground">?ㅼ떆媛?留ㅻℓ 諛?李⑦듃 遺꾩꽍</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <Label className="text-sm">醫낅ぉ 肄붾뱶:</Label>
          <Input
            placeholder="醫낅ぉ肄붾뱶 ?낅젰 (?? 005930)"
            value={stockCode}
            onChange={(e) => setStockCode(e.target.value)}
            className="w-full sm:w-64"
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
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">?꾩옱媛</CardTitle>
              <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg md:text-2xl font-bold font-mono truncate" data-testid="text-current-price">
                {formatCurrency(stockPrice.currentPrice)}
              </div>
              <p className={`text-xs ${stockPrice.changeRate > 0 ? 'text-green-600 dark:text-green-400' : stockPrice.changeRate < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                {stockPrice.changeRate > 0 ? '+' : ''}{stockPrice.changeRate}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">?꾩씪 ?鍮?/CardTitle>
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className={`text-lg md:text-2xl font-bold font-mono truncate ${stockPrice.change > 0 ? 'text-green-600 dark:text-green-400' : stockPrice.change < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                {stockPrice.change > 0 ? '+' : ''}{formatCurrency(stockPrice.change)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">?쒓?</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg md:text-2xl font-bold font-mono truncate">{formatCurrency(stockPrice.openPrice)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">嫄곕옒??/CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg md:text-2xl font-bold font-mono truncate">{stockPrice.volume?.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg">{stockPrice?.stockName || stockCode} 李⑦듃</CardTitle>
            <CardDescription className="text-xs md:text-sm">?쇰큺 李⑦듃 (珥덈줉=留ㅼ닔 ?쒓렇?? 二쇳솴=愿李??쒓렇??</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250} className="md:!h-[400px]">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="close" stroke="#8884d8" strokeWidth={2} name="醫낃?" />
                  {normalizedSignalDots.map((signal, index) => (
                    <ReferenceDot
                      key={`signal-${signal.id}-${index}`}
                      x={signal.chartDate}
                      y={signal.chartPrice}
                      r={5}
                      fill={signal.signal === 'buy' ? '#22c55e' : '#f59e0b'}
                      stroke={signal.signal === 'buy' ? '#15803d' : '#b45309'}
                      ifOverflow="visible"
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                李⑦듃 ?곗씠??濡쒕뵫 以?..
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>?멸?</CardTitle>
            <CardDescription>?ㅼ떆媛?留ㅻ룄/留ㅼ닔 ?멸?</CardDescription>
          </CardHeader>
          <CardContent>
            {orderbook ? (
              <div className="space-y-1">
                <div className="font-semibold text-sm mb-2">留ㅻ룄 ?멸?</div>
                {orderbook.sell?.slice(0, 5).reverse().map((item: any, idx: number) => (
                  <div key={`sell-${idx}`} className="flex justify-between text-sm p-1 bg-red-50 dark:bg-red-950/20">
                    <span className="text-red-600 dark:text-red-400">{formatCurrency(item.price)}</span>
                    <span className="text-muted-foreground">{item.quantity}</span>
                  </div>
                ))}
                <div className="h-px bg-border my-2" />
                <div className="font-semibold text-sm mb-2">留ㅼ닔 ?멸?</div>
                {orderbook.buy?.slice(0, 5).map((item: any, idx: number) => (
                  <div key={`buy-${idx}`} className="flex justify-between text-sm p-1 bg-green-50 dark:bg-green-950/20">
                    <span className="text-green-600 dark:text-green-400">{formatCurrency(item.price)}</span>
                    <span className="text-muted-foreground">{item.quantity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                ?멸? ?곗씠??濡쒕뵫 以?..
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>二쇰Ц</CardTitle>
          <CardDescription>留ㅼ닔/留ㅻ룄 二쇰Ц</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={orderType} onValueChange={(value: any) => setOrderType(value)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buy" data-testid="tab-buy">留ㅼ닔</TabsTrigger>
              <TabsTrigger value="sell" data-testid="tab-sell">留ㅻ룄</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>二쇰Ц ?좏삎</Label>
                <Select value={priceType} onValueChange={(value: any) => setPriceType(value)}>
                  <SelectTrigger data-testid="select-price-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">?쒖옣媛</SelectItem>
                    <SelectItem value="limit">吏?뺢?</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>?섎웾</Label>
                <Input
                  type="number"
                  placeholder="?섎웾"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-testid="input-quantity"
                />
              </div>
            </div>

            {priceType === 'limit' && (
              <div className="space-y-2">
                <Label>媛寃?/Label>
                <Input
                  type="number"
                  placeholder="媛寃?
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
              {orderMutation.isPending ? "二쇰Ц 以?.." : orderType === 'buy' ? '留ㅼ닔' : '留ㅻ룄'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

