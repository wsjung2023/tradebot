import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2, TrendingUp, AlertCircle, CheckCircle2, Star,
  Building2, BarChart3, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getRecommendationBadge } from "@/components/rainbow-chart";
import { StockCandleChart } from "@/components/stocks/StockCandleChart";

// ─── 타입 정의 ─────────────────────────────────────────────────────────────

interface ScannedStock {
  stockCode: string;
  stockName: string;
  currentPrice: number;
  changeRate: number;
  isRecommended: boolean;
  currentPosition: number;
  clWidth: number;
  CL: number;
  recommendation: string;
  signals: {
    nearCL: boolean;
    clWidthGood: boolean;
    inBuyZone: boolean;
    inSellZone: boolean;
  };
  rainbowAnalysis: {
    current: number;
    CL: number;
    clWidth: number;
    currentPosition: number;
    recommendation: string;
    lines: any[];
    chartData: any[];
    signals: any;
  };
}

interface ScanResult {
  message: string;
  conditionName: string;
  totalMatches: number;
  processedCount: number;
  recommendationCount: number;
  errorCount: number;
  stocks: ScannedStock[];
  errors?: Array<{ stockCode: string; stockName: string; error: string }>;
}

interface StockDetails {
  stockCode: string;
  name: string;
  marketName: string;
  currentPrice: number;
  per: string;
  pbr: string;
  roe: string;
  eps: string;
  bps: string;
  debtRatio: string;
  reserveRatio: string;
  revenue: string;
  operatingProfit: string;
  netIncome: string;
  totalAssets: string;
  totalDebt: string;
  capital: string;
}

// ─── 유틸 함수 ─────────────────────────────────────────────────────────────

function formatKRW(value: number) {
  if (!value) return '-';
  return `₩${value.toLocaleString('ko-KR')}`;
}

function formatFinancialValue(raw: string): string {
  if (!raw || raw === '-' || raw === '0') return '-';
  const n = Number(raw);
  if (isNaN(n) || n === 0) return '-';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(1)}조`;
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(0)}억`;
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(0)}만`;
  return `${sign}${abs.toLocaleString('ko-KR')}`;
}

function formatRatio(raw: string): string {
  if (!raw || raw === '-' || raw === '0') return '-';
  const n = Number(raw);
  if (isNaN(n)) return raw;
  return n.toFixed(2);
}

function ChangeRateBadge({ rate }: { rate: number }) {
  if (rate > 0) return (
    <span className="flex items-center gap-0.5 text-green-600 text-sm font-medium">
      <ArrowUpRight className="w-3.5 h-3.5" />
      +{rate.toFixed(2)}%
    </span>
  );
  if (rate < 0) return (
    <span className="flex items-center gap-0.5 text-red-500 text-sm font-medium">
      <ArrowDownRight className="w-3.5 h-3.5" />
      {rate.toFixed(2)}%
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-muted-foreground text-sm">
      <Minus className="w-3.5 h-3.5" />
      0.00%
    </span>
  );
}

function CLPositionBar({ position }: { position: number }) {
  const clipped = Math.max(0, Math.min(100, position));
  const color = position >= 40 && position <= 60
    ? 'bg-green-500'
    : position > 60 ? 'bg-blue-500' : 'bg-orange-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${clipped}%` }}
        />
      </div>
      <span className="text-xs font-mono w-12 text-right">{position.toFixed(1)}%</span>
    </div>
  );
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export default function BackAttackScan() {
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedStock, setSelectedStock] = useState<ScannedStock | null>(null);

  // 조건검색 스캔 뮤테이션
  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/auto-trading/backattack-scan', {});
      return res.json();
    },
    onSuccess: (data: ScanResult) => {
      setScanResult(data);
      setSelectedStock(data.stocks?.[0] ?? null);
      const count = data.stocks?.length ?? 0;
      const recommended = data.recommendationCount ?? 0;
      toast({
        title: "스캔 완료",
        description: `${count}개 종목 분석 완료${recommended > 0 ? ` (추천 ${recommended}개)` : ''}`,
      });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "스캔 실패", description: error.message });
    },
  });

  // 선택된 종목의 상세 정보 (PER, PBR, ROE 등) — 클릭 시 지연 로딩
  const detailsQuery = useQuery<StockDetails>({
    queryKey: ['/api/stocks', selectedStock?.stockCode, 'details'],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/${selectedStock!.stockCode}/details`, { credentials: 'include' });
      if (!res.ok) throw new Error('상세정보 조회 실패');
      return res.json();
    },
    enabled: !!selectedStock,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const handleScan = () => {
    setScanResult(null);
    setSelectedStock(null);
    scanMutation.mutate();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 헤더 */}
      <div className="p-6 border-b flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-backattack-title">뒷차기2 스캔</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              HTS 조건검색 자동 실행 → 레인보우 차트 분석 + 기업 정보
            </p>
          </div>
          <Button
            onClick={handleScan}
            disabled={scanMutation.isPending}
            data-testid="button-scan"
          >
            {scanMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />스캔 중...</>
            ) : (
              <><TrendingUp className="mr-2 h-4 w-4" />뒷차기2 스캔 시작</>
            )}
          </Button>
        </div>

        {/* 스캔 통계 */}
        {scanResult && (
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="text-sm">
              <span className="text-muted-foreground">조건식 매칭 </span>
              <span className="font-semibold" data-testid="text-total-matches">{scanResult.totalMatches}개</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">분석 완료 </span>
              <span className="font-semibold" data-testid="text-processed-count">{scanResult.processedCount}개</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">추천 종목 </span>
              <span className="font-semibold text-green-600" data-testid="text-recommendation-count">
                {scanResult.recommendationCount}개
              </span>
            </div>
            {(scanResult.errorCount ?? 0) > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">에러 </span>
                <span className="font-semibold text-destructive">{scanResult.errorCount}개</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 대기 화면 */}
      {!scanResult && !scanMutation.isPending && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
              <TrendingUp className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">뒷차기2 조건 검색 준비 완료</p>
              <p className="text-sm text-muted-foreground mt-1">
                HTS 조건식으로 종목을 스캔하고, 각 종목의 레인보우 차트와 기업정보를 분석합니다.
              </p>
            </div>
            <div className="text-left bg-muted/50 rounded-md p-4 text-sm space-y-1">
              <p className="font-medium text-xs text-muted-foreground mb-2">조건식 기준</p>
              <p>• 코스피 60일내 29.5% 상승 OR 코스닥 20% 상승</p>
              <p>• 240일 신고가 달성</p>
              <p>• 거래대금 2억원 이상</p>
              <p>• CL(50% 라인) 근처 ±3%</p>
            </div>
            <Button onClick={handleScan} size="lg">
              <TrendingUp className="mr-2 h-4 w-4" />
              스캔 시작
            </Button>
          </div>
        </div>
      )}

      {/* 스캔 중 */}
      {scanMutation.isPending && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-3">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
            <p className="font-medium">HTS에서 조건식 실행 중...</p>
            <p className="text-sm text-muted-foreground">
              에이전트가 조건식을 실행하고 각 종목의 레인보우 차트를 분석합니다.<br />
              종목 수에 따라 20~40초 소요됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 결과 없음 */}
      {scanResult && (scanResult.stocks?.length ?? 0) === 0 && (
        <div className="flex-1 flex items-center justify-center p-6">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>매칭 종목 없음</AlertTitle>
            <AlertDescription>
              현재 뒷차기2 조건에 매칭되는 종목이 없습니다.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* 결과 — 2패널 레이아웃 */}
      {scanResult && (scanResult.stocks?.length ?? 0) > 0 && (
        <div className="flex-1 flex overflow-hidden">
          {/* 좌측: 종목 리스트 */}
          <div className="w-72 border-r flex-shrink-0 overflow-y-auto">
            <div className="p-3 border-b bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">
                {scanResult.stocks.length}개 종목 (추천 먼저 정렬)
              </p>
            </div>
            {scanResult.stocks.map((stock) => (
              <button
                key={stock.stockCode}
                className={`w-full text-left p-4 border-b hover-elevate transition-colors ${
                  selectedStock?.stockCode === stock.stockCode
                    ? 'bg-accent/60'
                    : ''
                }`}
                onClick={() => setSelectedStock(stock)}
                data-testid={`button-select-stock-${stock.stockCode}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {stock.isRecommended && (
                        <Star className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                      )}
                      <p className="font-semibold text-sm truncate" data-testid={`text-stock-name-${stock.stockCode}`}>
                        {stock.stockName}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{stock.stockCode}</p>
                  </div>
                  {getRecommendationBadge(stock.recommendation)}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{formatKRW(stock.currentPrice)}</span>
                    <ChangeRateBadge rate={stock.changeRate} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">CL 위치</p>
                    <CLPositionBar position={stock.currentPosition} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>CL폭 {stock.clWidth.toFixed(1)}%</span>
                    {stock.signals.inBuyZone && (
                      <Badge variant="default" className="text-xs py-0">매수구간</Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {/* 에러 종목 */}
            {(scanResult.errors?.length ?? 0) > 0 && (
              <div className="p-3 border-t">
                <p className="text-xs text-muted-foreground font-medium mb-2">분석 실패</p>
                {scanResult.errors!.map((err) => (
                  <div key={err.stockCode} className="text-xs text-destructive py-1">
                    {err.stockName}({err.stockCode})
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 우측: 상세 패널 */}
          <div className="flex-1 overflow-y-auto">
            {!selectedStock ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">왼쪽에서 종목을 선택하세요</p>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* 종목 헤더 */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold" data-testid="text-selected-stock-name">
                        {selectedStock.stockName}
                      </h2>
                      {selectedStock.isRecommended && (
                        <Badge variant="default">
                          <Star className="w-3 h-3 mr-1" />
                          추천
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm" data-testid="text-selected-stock-code">
                      {selectedStock.stockCode}
                      {detailsQuery.data?.marketName && ` · ${detailsQuery.data.marketName}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold font-mono">{formatKRW(selectedStock.currentPrice)}</p>
                    <ChangeRateBadge rate={selectedStock.changeRate} />
                  </div>
                </div>

                {/* 기업 정보 카드 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      기업 정보 · 재무비율
                    </CardTitle>
                    <CardDescription className="text-xs">
                      키움 REST API 기준 최신 스냅샷 (3년치 제공 불가 — API 한계)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {detailsQuery.isLoading && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <Skeleton key={i} className="h-16 w-full rounded-md" />
                        ))}
                      </div>
                    )}
                    {detailsQuery.isError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>기업 정보 로드 실패 (에이전트 확인 필요)</AlertDescription>
                      </Alert>
                    )}
                    {detailsQuery.data && (
                      <div className="space-y-4">
                        {/* 재무비율 */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">밸류에이션 지표</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                              { label: 'PER', value: formatRatio(detailsQuery.data.per), unit: '배' },
                              { label: 'PBR', value: formatRatio(detailsQuery.data.pbr), unit: '배' },
                              { label: 'ROE', value: formatRatio(detailsQuery.data.roe), unit: '%' },
                              { label: 'EPS', value: detailsQuery.data.eps !== '-' ? formatKRW(Number(detailsQuery.data.eps)) : '-', unit: '' },
                              { label: 'BPS', value: detailsQuery.data.bps !== '-' ? formatKRW(Number(detailsQuery.data.bps)) : '-', unit: '' },
                              { label: '부채비율', value: formatRatio(detailsQuery.data.debtRatio), unit: '%' },
                              { label: '유보율', value: formatRatio(detailsQuery.data.reserveRatio), unit: '%' },
                            ].map(({ label, value, unit }) => (
                              <div key={label} className="rounded-md border p-3" data-testid={`info-${label}`}>
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className="text-base font-bold font-mono mt-0.5">
                                  {value}{value !== '-' && unit ? <span className="text-xs font-normal text-muted-foreground ml-0.5">{unit}</span> : null}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 재무제표 스냅샷 */}
                        {(detailsQuery.data.revenue !== '-' || detailsQuery.data.operatingProfit !== '-') && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">재무제표 (최신 스냅샷)</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {[
                                { label: '매출', value: formatFinancialValue(detailsQuery.data.revenue) },
                                { label: '영업이익', value: formatFinancialValue(detailsQuery.data.operatingProfit) },
                                { label: '순이익', value: formatFinancialValue(detailsQuery.data.netIncome) },
                                { label: '총자산', value: formatFinancialValue(detailsQuery.data.totalAssets) },
                                { label: '총부채', value: formatFinancialValue(detailsQuery.data.totalDebt) },
                                { label: '자본금', value: formatFinancialValue(detailsQuery.data.capital) },
                              ].map(({ label, value }) => (
                                <div key={label} className="rounded-md border p-3" data-testid={`financial-${label}`}>
                                  <p className="text-xs text-muted-foreground">{label}</p>
                                  <p className="text-base font-bold font-mono mt-0.5">{value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 봉차트 + 레인보우 오버레이 (거래 페이지와 공유 컴포넌트) */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      차트
                    </CardTitle>
                    <CardDescription className="text-xs">
                      봉차트 · BackAttack Line 레인보우 오버레이
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* CL 분석 요약 (스캔 결과에서 바로 표시) */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="rounded-md border p-2 text-center">
                        <p className="text-xs text-muted-foreground">CL 위치</p>
                        <p className="text-base font-bold font-mono">{selectedStock.currentPosition.toFixed(1)}%</p>
                      </div>
                      <div className="rounded-md border p-2 text-center">
                        <p className="text-xs text-muted-foreground">CL 폭</p>
                        <p className="text-base font-bold font-mono">{selectedStock.clWidth.toFixed(1)}%</p>
                      </div>
                      <div className="rounded-md border p-2 text-center">
                        <p className="text-xs text-muted-foreground">판단</p>
                        <div className="mt-0.5">{getRecommendationBadge(selectedStock.recommendation)}</div>
                      </div>
                    </div>

                    <StockCandleChart
                      stockCode={selectedStock.stockCode}
                      stockName={selectedStock.stockName}
                      height={360}
                      defaultShowRainbow={true}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
