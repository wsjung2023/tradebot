import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, TrendingUp, AlertCircle, CheckCircle2, XCircle, Brain, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RainbowChart } from "@/components/rainbow-chart";

interface BackAttackRecommendation {
  stockCode: string;
  stockName: string;
  currentPrice: number;
  currentPosition: number;
  clWidth: number;
  recommendation: string;
  signals: {
    nearCL: boolean;
    clWidthGood: boolean;
    inBuyZone: boolean;
    inSellZone: boolean;
  };
  rainbowAnalysis: {
    current: number;
    cl: number;
    high240: number;
    low240: number;
    clWidth: number;
    currentPosition: number;
    lines: Array<{ label: string; value: number; color: string }>;
    chartData: any[];
    signals: any;
    recommendation: string;
  };
  aiAnalysis?: {
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    targetPrice?: number;
    reasoning: string;
    keyIndicators: string[];
  } | null;
  priority: 'high' | 'medium';
}

interface ScanResult {
  message: string;
  conditionName: string;
  totalMatches: number;
  processedCount: number;
  recommendationCount: number;
  errorCount?: number;
  recommendations: BackAttackRecommendation[];
  errors?: Array<{ stockCode: string; stockName: string; error: string }>;
}

export default function BackAttackScan() {
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedStock, setSelectedStock] = useState<BackAttackRecommendation | null>(null);

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/auto-trading/backattack-scan', {});
      return res.json();
    },
    onSuccess: (data: ScanResult) => {
      setScanResult(data);
      if (data.recommendations.length > 0) {
        setSelectedStock(data.recommendations[0]);
        toast({
          title: "스캔 완료",
          description: `${data.recommendationCount}개의 추천 종목을 발견했습니다.`,
        });
      } else {
        toast({
          title: "스캔 완료",
          description: "조건에 맞는 종목이 없습니다.",
          variant: "default",
        });
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "스캔 실패",
        description: error.message,
      });
    },
  });

  const handleScan = () => {
    setScanResult(null);
    setSelectedStock(null);
    scanMutation.mutate();
  };

  const getPriorityBadge = (priority: 'high' | 'medium') => {
    return priority === 'high' 
      ? <Badge variant="default" data-testid={`badge-priority-high`}>높은 우선순위</Badge>
      : <Badge variant="secondary" data-testid={`badge-priority-medium`}>중간 우선순위</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-backattack-title">뒷차기2 자동 스캔</h1>
        <p className="text-muted-foreground">HTS 조건검색 자동 실행 + 레인보우 차트 분석</p>
      </div>

      {/* 스캔 버튼 */}
      <Card>
        <CardHeader>
          <CardTitle>조건 검색</CardTitle>
          <CardDescription>
            키움 HTS의 "뒷차기2" 조건식을 자동으로 실행하고, 각 종목에 레인보우 차트 분석을 적용합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleScan}
            disabled={scanMutation.isPending}
            size="lg"
            data-testid="button-scan"
          >
            {scanMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                스캔 중...
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 h-4 w-4" />
                뒷차기2 스캔 시작
              </>
            )}
          </Button>
          
          {scanMutation.isPending && (
            <p className="text-sm text-muted-foreground mt-2">
              HTS에서 조건을 실행하고, 종목별로 레인보우 차트를 분석하는 중입니다. 
              잠시만 기다려주세요...
            </p>
          )}
        </CardContent>
      </Card>

      {/* 스캔 결과 요약 */}
      {scanResult && (
        <Card>
          <CardHeader>
            <CardTitle>스캔 결과</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">조건식 매칭</p>
                <p className="text-2xl font-bold" data-testid="text-total-matches">{scanResult.totalMatches}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">처리 완료</p>
                <p className="text-2xl font-bold" data-testid="text-processed-count">{scanResult.processedCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">추천 종목</p>
                <p className="text-2xl font-bold text-primary" data-testid="text-recommendation-count">{scanResult.recommendationCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">에러</p>
                <p className="text-2xl font-bold" data-testid="text-error-count">{scanResult.errorCount || 0}</p>
              </div>
            </div>

            {scanResult.errorCount && scanResult.errorCount > 0 && scanResult.errors && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>일부 종목 분석 실패</AlertTitle>
                <AlertDescription>
                  {scanResult.errorCount}개 종목 분석 중 오류가 발생했습니다.
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm">오류 상세보기</summary>
                    <ul className="mt-2 space-y-1 text-xs">
                      {scanResult.errors.map((err, idx) => (
                        <li key={idx}>
                          {err.stockName} ({err.stockCode}): {err.error}
                        </li>
                      ))}
                    </ul>
                  </details>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* 추천 종목 리스트 및 상세 */}
      {scanResult && scanResult.recommendations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 종목 리스트 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>추천 종목 ({scanResult.recommendationCount})</CardTitle>
              <CardDescription>우선순위 순으로 정렬됨</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-auto">
              {scanResult.recommendations.map((rec, idx) => (
                <Card 
                  key={rec.stockCode}
                  className={`cursor-pointer hover-elevate ${selectedStock?.stockCode === rec.stockCode ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedStock(rec)}
                  data-testid={`card-stock-${rec.stockCode}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold" data-testid={`text-stock-name-${rec.stockCode}`}>{rec.stockName}</h3>
                        <p className="text-sm text-muted-foreground" data-testid={`text-stock-code-${rec.stockCode}`}>{rec.stockCode}</p>
                      </div>
                      {getPriorityBadge(rec.priority)}
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">현재가</span>
                        <span className="font-mono font-semibold">₩{rec.currentPrice.toLocaleString('ko-KR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CL 위치</span>
                        <span className="font-mono">{rec.currentPosition.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CL 폭</span>
                        <span className="font-mono">{rec.clWidth.toFixed(1)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* 선택된 종목 상세 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle data-testid="text-selected-stock-name">{selectedStock?.stockName || '종목을 선택하세요'}</CardTitle>
                  <CardDescription data-testid="text-selected-stock-code">{selectedStock?.stockCode}</CardDescription>
                </div>
                {selectedStock && getPriorityBadge(selectedStock.priority)}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedStock ? (
                <>
                  {/* 레인보우 차트 */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">레인보우 차트</h3>
                    <RainbowChart
                      data={selectedStock.rainbowAnalysis.chartData}
                      current={selectedStock.currentPrice}
                      currentPosition={selectedStock.currentPosition}
                      clWidth={selectedStock.clWidth}
                      recommendation={selectedStock.recommendation}
                      signals={selectedStock.signals}
                      showMetrics={true}
                    />
                  </div>

                  {/* AI 분석 결과 */}
                  {selectedStock.aiAnalysis && (
                    <div className="border-t pt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Brain className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold">AI 종합 분석</h3>
                      </div>
                      
                      <div className="space-y-4">
                        {/* 추천 액션 및 신뢰도 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground mb-1">추천 액션</p>
                            <div className="flex items-center gap-2">
                              {selectedStock.aiAnalysis.action === 'buy' && (
                                <Badge variant="default" className="bg-green-600">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  BUY
                                </Badge>
                              )}
                              {selectedStock.aiAnalysis.action === 'sell' && (
                                <Badge variant="destructive">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  SELL
                                </Badge>
                              )}
                              {selectedStock.aiAnalysis.action === 'hold' && (
                                <Badge variant="secondary">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  HOLD
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="p-4 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground mb-1">신뢰도</p>
                            <p className="text-2xl font-bold">{selectedStock.aiAnalysis.confidence}%</p>
                          </div>
                          
                          {selectedStock.aiAnalysis.targetPrice && (
                            <div className="p-4 bg-muted/50 rounded-lg">
                              <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                                <Target className="h-3 w-3" />
                                목표가
                              </p>
                              <p className="text-xl font-bold font-mono">
                                ₩{selectedStock.aiAnalysis.targetPrice.toLocaleString('ko-KR')}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* 분석 근거 */}
                        <div>
                          <p className="text-sm font-semibold mb-2">분석 근거</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {selectedStock.aiAnalysis.reasoning}
                          </p>
                        </div>

                        {/* 주요 지표 */}
                        <div>
                          <p className="text-sm font-semibold mb-2">주요 지표</p>
                          <ul className="space-y-1">
                            {selectedStock.aiAnalysis.keyIndicators.map((indicator, idx) => (
                              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                <span>{indicator}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI 분석 없음 표시 */}
                  {!selectedStock.aiAnalysis && (
                    <div className="border-t pt-6">
                      <Alert>
                        <Brain className="h-4 w-4" />
                        <AlertTitle>AI 분석 없음</AlertTitle>
                        <AlertDescription>
                          이 종목은 AI 분석이 실행되지 않았거나 분석에 실패했습니다.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  왼쪽에서 종목을 선택하면 레인보우 차트와 AI 분석이 표시됩니다.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 스캔 안내 */}
      {!scanResult && !scanMutation.isPending && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>뒷차기2 조건 검색</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>코스피 60일내 29.5% 상승 OR 코스닥 20% 상승</li>
              <li>240일 신고가 달성</li>
              <li>거래대금 2억원 이상</li>
              <li>CL (50% 라인) 근처 ±3%</li>
              <li>최근 5일간 CL 위 유지</li>
            </ul>
            <p className="mt-2 text-sm">
              스캔을 시작하면 자동으로 HTS에서 조건을 실행하고, 
              40-60% 구간(주력 매수 구간) + CL폭 10% 이상인 종목만 추천합니다.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
