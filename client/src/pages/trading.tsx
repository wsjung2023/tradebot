import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceDot,
} from "recharts";
import { TrendingUp, DollarSign, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMarketStream } from "@/hooks/use-market-stream";
import { ConnectionStatus } from "@/components/connection-status";
import type { KiwoomAccount } from "@shared/schema";
import { StockSelector } from "@/components/stocks/StockSelector";
import type { SelectedStock } from "@/lib/stocks";

type ChartSignal = {
  id: number;
  signal: "buy" | "hold";
  currentPrice: number | null;
  createdAt: string;
  chartDate?: string;
};

type ChartPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type ChartFormula = {
  id: number;
  formulaName: string;
};

type FormulaOverlayPoint = { date: string; value: number | null };
type FormulaOverlay = {
  stockCode: string;
  period: string;
  formulaName: string;
  signalLine?: {
    color?: string;
    name?: string;
    values?: FormulaOverlayPoint[];
  };
};

type RainbowLine = { price: number; label: string; color: string; width: number };
type RainbowData = {
  lines: RainbowLine[] | null;
  clWidth: number;
} | null;

type CandleShapeProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  payload?: {
    open: number;
    close: number;
    high: number;
    low: number;
    [key: string]: unknown;
  };
};

function CandleStickShape({ x, y, width, height, payload }: CandleShapeProps) {
  if (!payload || height <= 0 || width <= 0) return null;
  const { open, close, high, low } = payload;
  const isUp = close >= open;
  const color = isUp ? "#ef4444" : "#3b82f6";
  const centerX = x + width / 2;
  const range = high - low;
  if (range === 0) {
    return <line x1={centerX} y1={y} x2={centerX} y2={y + height} stroke={color} strokeWidth={1} />;
  }
  const bodyTopRaw = Math.max(open, close);
  const bodyBottomRaw = Math.min(open, close);
  const bodyTop = y + height * (high - bodyTopRaw) / range;
  const bodyH = Math.max(1, height * (bodyTopRaw - bodyBottomRaw) / range);
  return (
    <g>
      <line x1={centerX} y1={y} x2={centerX} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={x + 1} y={bodyTop} width={Math.max(1, width - 2)} height={bodyH} fill={color} stroke={color} strokeWidth={0.5} />
    </g>
  );
}

function ChartStatusMessage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex min-h-[250px] flex-col items-center justify-center gap-2 text-center text-muted-foreground md:min-h-[400px]">
      <AlertCircle className="h-5 w-5" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-md text-xs md:text-sm">{description}</p>}
    </div>
  );
}

export default function Trading() {
  const { toast } = useToast();
  const [selectedStock, setSelectedStock] = useState<SelectedStock | null>({
    stockCode: "005930",
    stockName: "삼성전자",
  });
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  const [priceType, setPriceType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [showRainbow, setShowRainbow] = useState(false);
  const [chartType, setChartType] = useState<"line" | "candle">("candle");
  const [chartPeriod, setChartPeriod] = useState<"D" | "W" | "M">("D");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [activeFormulaId, setActiveFormulaId] = useState<number | null>(null);
  const [formulaOverlay, setFormulaOverlay] = useState<FormulaOverlay | null>(null);

  const stockCode = selectedStock?.stockCode ?? "";
  const stockName = selectedStock?.stockName ?? stockCode;

  const { prices, orderbooks, connectionStatus, errorMessage, retryCount, forceReconnect } =
    useMarketStream(stockCode ? [stockCode] : [], ["price", "orderbook"]);

  const stockPrice = stockCode ? prices[stockCode] : undefined;
  const orderbook = stockCode ? orderbooks[stockCode] : undefined;

  useEffect(() => {
    if (stockPrice?.currentPrice && priceType === "market") {
      setPrice(String(stockPrice.currentPrice));
    }
  }, [stockPrice?.currentPrice, priceType]);

  const { data: chartData = [], isPending: isChartLoading, error: chartError } = useQuery<ChartPoint[]>({
    queryKey: ["stock-chart", stockCode, chartPeriod],
    enabled: !!stockCode,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/stocks/${stockCode}/chart?period=${chartPeriod}`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: chartFormulas = [] } = useQuery<ChartFormula[]>({
    queryKey: ["/api/chart-formulas"],
  });

  const { data: accounts = [] } = useQuery<KiwoomAccount[]>({
    queryKey: ["/api/accounts"],
  });

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0] || null;
  const tradingMode: "mock" | "real" = selectedAccount?.accountType as "mock" | "real" || "mock";

  const { data: chartSignals = [] } = useQuery<ChartSignal[]>({
    queryKey: ["stock-chart-signals", stockCode],
    enabled: !!stockCode,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/stocks/${stockCode}/chart-signals`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: rainbowData, isFetching: rainbowLoading } = useQuery<RainbowData>({
    queryKey: ["stock-rainbow", stockCode],
    enabled: !!stockCode && showRainbow,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/stocks/${stockCode}/rainbow-lines`);
      return response.json();
    },
  });

  useEffect(() => {
    if (!activeFormulaId || !stockCode) {
      setFormulaOverlay(null);
      return;
    }

    let cancelled = false;
    apiRequest("POST", `/api/chart-formulas/${activeFormulaId}/evaluate`, {
      stockCode,
      period: chartPeriod,
    })
      .then((res) => res.json())
      .then((data: FormulaOverlay) => {
        if (!cancelled) setFormulaOverlay(data);
      })
      .catch(() => {
        if (!cancelled) setFormulaOverlay(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeFormulaId, stockCode, chartPeriod]);

  const orderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await apiRequest("POST", "/api/orders", orderData);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "주문 성공", description: `${orderType === "buy" ? "매수" : "매도"} 주문이 접수되었습니다.` });
      setQuantity("");
      if (priceType !== "market") {
        setPrice("");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "주문 실패", description: error.message });
    },
  });

  const handleSubmitOrder = () => {
    if (!selectedAccount) {
      toast({ variant: "destructive", title: "계좌 없음", description: "먼저 계좌를 등록해주세요" });
      return;
    }
    if (!stockCode || !stockName) {
      toast({ variant: "destructive", title: "종목 선택 필요", description: "검색 결과에서 종목을 먼저 선택해주세요" });
      return;
    }
    if (!quantity || parseInt(quantity) <= 0) {
      toast({ variant: "destructive", title: "수량 오류", description: "수량을 입력해주세요" });
      return;
    }
    if (priceType === "limit" && (!price || parseFloat(price) <= 0)) {
      toast({ variant: "destructive", title: "가격 오류", description: "가격을 입력해주세요" });
      return;
    }

    orderMutation.mutate({
      accountId: selectedAccount.id,
      stockCode,
      stockName,
      orderType,
      orderMethod: priceType,
      orderQuantity: parseInt(quantity),
      orderPrice: priceType === "limit" ? parseFloat(price) : undefined,
      orderStatus: "pending",
      executedQuantity: 0,
    });
  };

  const formatCurrency = (value: number | undefined) => {
    if (!value) return "₩0";
    return `₩${value.toLocaleString("ko-KR")}`;
  };

  const normalizedSignalDots = useMemo(() => chartSignals
    .map((signal) => ({
      ...signal,
      chartDate:
        signal.chartDate ||
        String(signal.createdAt || "").replace(/[-:TZ.]/g, "").slice(0, 8),
      chartPrice:
        typeof signal.currentPrice === "number" && signal.currentPrice > 0
          ? signal.currentPrice
          : stockPrice?.currentPrice || 0,
    }))
    .filter((signal) => signal.chartDate && signal.chartPrice > 0)
    .slice(-200), [chartSignals, stockPrice?.currentPrice]);

  const rainbowLines: RainbowLine[] = rainbowData?.lines ?? [];
  const formulaValueMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const point of formulaOverlay?.signalLine?.values ?? []) {
      map.set(point.date, point.value);
    }
    return map;
  }, [formulaOverlay]);
  const mergedChartData = useMemo(
    () => chartData.map((candle) => ({
      ...candle,
      formulaValue: formulaValueMap.get(candle.date) ?? null,
      candleRange: [candle.low, candle.high],
    })),
    [chartData, formulaValueMap],
  );

  const chartState = !stockCode
    ? "empty"
    : isChartLoading
      ? "loading"
      : chartError
        ? "error"
        : chartData.length === 0
          ? "no-data"
          : "ready";

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-trading-title">거래</h1>
        <p className="text-sm md:text-base text-muted-foreground">실시간 매매 및 차트 분석</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[280px] flex-1">
              <StockSelector
                label="종목 선택"
                value={selectedStock}
                onChange={setSelectedStock}
                placeholder="종목명 또는 코드 입력 (예: 삼성전자, 005930)"
                inputTestId="input-stock-code"
                allowManualCode
              />
            </div>
            {accounts.length > 1 && (
              <div className="w-full sm:w-56 space-y-2">
                <Label className="text-sm">계좌</Label>
                <Select
                  value={selectedAccountId?.toString() || (accounts[0]?.id?.toString() ?? "")}
                  onValueChange={(value) => setSelectedAccountId(parseInt(value))}
                >
                  <SelectTrigger data-testid="select-trading-account">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.accountName || account.accountNumber} ({account.accountType === "real" ? "실전" : "모의"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedAccount && (
              <Badge
                variant={tradingMode === "real" ? "default" : "secondary"}
                data-testid="badge-trading-mode"
                className="w-fit"
              >
                {tradingMode === "real" ? "실전투자" : "모의투자"}
              </Badge>
            )}
          </div>
          <ConnectionStatus
            status={connectionStatus}
            errorMessage={errorMessage}
            retryCount={retryCount}
            onReconnect={forceReconnect}
          />
        </div>
      </div>

      {stockPrice && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">현재가</CardTitle>
              <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg md:text-2xl font-bold font-mono truncate" data-testid="text-current-price">
                {formatCurrency(stockPrice.currentPrice)}
              </div>
              <p className={`text-xs ${stockPrice.changeRate > 0 ? "text-green-600" : stockPrice.changeRate < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                {stockPrice.changeRate > 0 ? "+" : ""}{stockPrice.changeRate}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">전일 대비</CardTitle>
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className={`text-lg md:text-2xl font-bold font-mono truncate ${stockPrice.change > 0 ? "text-green-600" : stockPrice.change < 0 ? "text-red-600" : ""}`}>
                {stockPrice.change > 0 ? "+" : ""}{formatCurrency(stockPrice.change)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">시가</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg md:text-2xl font-bold font-mono truncate">{formatCurrency(stockPrice.openPrice)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">거래량</CardTitle>
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base md:text-lg">{stockPrice?.stockName || stockName || "종목 선택 필요"} 차트</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  {chartPeriod === "D" ? "일봉" : chartPeriod === "W" ? "주봉" : "월봉"} 차트
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={chartType === "candle" ? "default" : "outline"}
                    onClick={() => setChartType("candle")}
                    className="text-xs"
                    data-testid="button-chart-candle"
                  >
                    봉차트
                  </Button>
                  <Button
                    size="sm"
                    variant={chartType === "line" ? "default" : "outline"}
                    onClick={() => setChartType("line")}
                    className="text-xs"
                    data-testid="button-chart-line"
                  >
                    선차트
                  </Button>
                </div>
                <Select value={chartPeriod} onValueChange={(value: "D" | "W" | "M") => setChartPeriod(value)}>
                  <SelectTrigger className="w-24" data-testid="select-chart-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="D">일봉</SelectItem>
                    <SelectItem value="W">주봉</SelectItem>
                    <SelectItem value="M">월봉</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={activeFormulaId ? String(activeFormulaId) : "none"}
                  onValueChange={(value) => setActiveFormulaId(value === "none" ? null : Number(value))}
                >
                  <SelectTrigger className="w-40" data-testid="select-chart-formula">
                    <SelectValue placeholder="수식 없음" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">수식 없음</SelectItem>
                    {chartFormulas.map((formula) => (
                      <SelectItem key={formula.id} value={String(formula.id)}>
                        {formula.formulaName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {rainbowData && showRainbow && (
                  <Badge variant="outline" className="text-xs">
                    CL폭 {rainbowData.clWidth}%
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant={showRainbow ? "default" : "outline"}
                  onClick={() => setShowRainbow((value) => !value)}
                  disabled={rainbowLoading || !stockCode}
                  className="text-xs"
                >
                  {rainbowLoading ? "로딩..." : showRainbow ? "🌈 레인보우 ON" : "🌈 레인보우"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartState === "ready" ? (
              <ResponsiveContainer width="100%" height={250} className="md:!h-[400px]">
                <ComposedChart data={mergedChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  {chartType === "line" && (
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="#8884d8"
                      strokeWidth={2}
                      dot={false}
                      name="종가"
                    />
                  )}
                  {chartType === "candle" && (
                    <Bar
                      dataKey="candleRange"
                      shape={CandleStickShape}
                      maxBarSize={14}
                      isAnimationActive={false}
                      name="가격"
                    />
                  )}
                  {formulaOverlay && (
                    <Line
                      type="monotone"
                      dataKey="formulaValue"
                      stroke={formulaOverlay.signalLine?.color || "#8b5cf6"}
                      dot={false}
                      strokeWidth={2}
                      name={formulaOverlay.signalLine?.name || formulaOverlay.formulaName || "수식"}
                      connectNulls
                    />
                  )}
                  {showRainbow &&
                    rainbowLines.map((line) => (
                      <ReferenceLine
                        key={line.label}
                        y={line.price}
                        stroke={line.color}
                        strokeWidth={line.width}
                        strokeDasharray={line.label === "CL" ? "0" : "4 2"}
                        label={{ value: line.label, fill: line.color, fontSize: 10, position: "insideTopRight" }}
                      />
                    ))}
                  {normalizedSignalDots.map((signal, index) => (
                    <ReferenceDot
                      key={`signal-${signal.id}-${index}`}
                      x={signal.chartDate}
                      y={signal.chartPrice}
                      r={5}
                      fill={signal.signal === "buy" ? "#22c55e" : "#f59e0b"}
                      stroke={signal.signal === "buy" ? "#15803d" : "#b45309"}
                      ifOverflow="visible"
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            ) : chartState === "loading" ? (
              <div className="flex min-h-[250px] items-center justify-center md:min-h-[400px]">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 차트 데이터를 불러오는 중입니다.
                </div>
              </div>
            ) : chartState === "error" ? (
              <ChartStatusMessage
                title="차트 조회에 실패했습니다."
                description={chartError instanceof Error ? chartError.message : "에이전트 연결 또는 응답 데이터를 확인해주세요."}
              />
            ) : chartState === "no-data" ? (
              <ChartStatusMessage
                title="차트 데이터가 없습니다."
                description="선택한 종목에 대한 응답은 왔지만 차트 데이터가 비어 있습니다. 에이전트 응답과 종목 코드를 확인해주세요."
              />
            ) : (
              <ChartStatusMessage
                title="종목을 먼저 선택해주세요."
                description="검색 결과에서 종목을 선택하면 차트와 호가가 함께 연결됩니다."
              />
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
                {orderbook.sell?.slice(0, 5).reverse().map((item: any, index: number) => (
                  <div key={`sell-${index}`} className="flex justify-between text-sm p-1 bg-red-50 dark:bg-red-950/20">
                    <span className="text-red-600 dark:text-red-400">{formatCurrency(item.price)}</span>
                    <span className="text-muted-foreground">{item.quantity}</span>
                  </div>
                ))}
                <div className="h-px bg-border my-2" />
                <div className="font-semibold text-sm mb-2">매수 호가</div>
                {orderbook.buy?.slice(0, 5).map((item: any, index: number) => (
                  <div key={`buy-${index}`} className="flex justify-between text-sm p-1 bg-green-50 dark:bg-green-950/20">
                    <span className="text-green-600 dark:text-green-400">{formatCurrency(item.price)}</span>
                    <span className="text-muted-foreground">{item.quantity}</span>
                  </div>
                ))}
              </div>
            ) : stockCode ? (
              <p className="text-sm text-muted-foreground text-center py-8">실시간 호가를 기다리는 중입니다.</p>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">종목을 선택하면 호가를 표시합니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="hidden">
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
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium text-foreground">선택 종목</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                <Badge variant="outline" className="font-mono">{stockCode || "미선택"}</Badge>
                <span>{stockName || "검색 결과에서 종목을 선택해주세요."}</span>
                {stockPrice?.currentPrice ? <span className="font-mono">현재가 {formatCurrency(stockPrice.currentPrice)}</span> : null}
              </div>
            </div>
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
                  onChange={(event) => setQuantity(event.target.value)}
                  data-testid="input-quantity"
                />
              </div>
            </div>
            {priceType === "limit" && (
              <div className="space-y-2">
                <Label>가격</Label>
                <Input
                  type="number"
                  placeholder="가격"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  data-testid="input-price"
                />
              </div>
            )}
            <Button
              onClick={handleSubmitOrder}
              disabled={orderMutation.isPending || !stockCode}
              className={orderType === "buy" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
              data-testid="button-submit-order"
            >
              {orderMutation.isPending ? "주문 중..." : orderType === "buy" ? "매수" : "매도"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
