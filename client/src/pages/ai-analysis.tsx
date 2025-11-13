import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, TrendingDown, Minus, Brain, Target, AlertCircle } from "lucide-react";

interface StockAnalysis {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  targetPrice: number | null;
  reasoning: string;
  indicators: {
    trend?: string;
    momentum?: string;
    support?: number;
    resistance?: number;
  };
}

interface PortfolioAnalysis {
  recommendations: Array<{
    stockCode: string;
    stockName: string;
    action: 'buy' | 'sell' | 'hold';
    reason: string;
  }>;
  overallStrategy: string;
  riskAssessment: string;
}

export default function AIAnalysis() {
  const { toast } = useToast();
  const [stockCode, setStockCode] = useState("");
  const [stockName, setStockName] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<PortfolioAnalysis | null>(null);

  const { data: accountsData } = useQuery({
    queryKey: ['/api/accounts'],
  });

  const analyzeStockMutation = useMutation({
    mutationFn: async (data: { stockCode: string; stockName: string; currentPrice: number }) => {
      const res = await apiRequest('POST', '/api/ai/analyze-stock', data);
      return res.json();
    },
    onSuccess: (data) => {
      setAnalysis(data);
      toast({
        title: "분석 완료",
        description: "AI 종목 분석이 완료되었습니다",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "분석 실패",
        description: error.message || "종목 분석 중 오류가 발생했습니다",
      });
    },
  });

  const analyzePortfolioMutation = useMutation({
    mutationFn: async (accountId: number) => {
      const res = await apiRequest('POST', '/api/ai/analyze-portfolio', { accountId });
      return res.json();
    },
    onSuccess: (data) => {
      setPortfolioAnalysis(data);
      toast({
        title: "포트폴리오 분석 완료",
        description: "AI 포트폴리오 분석이 완료되었습니다",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "분석 실패",
        description: error.message || "포트폴리오 분석 중 오류가 발생했습니다",
      });
    },
  });

  const handleStockAnalysis = () => {
    if (!stockCode || !stockName || !currentPrice) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "모든 필드를 입력해주세요",
      });
      return;
    }

    analyzeStockMutation.mutate({
      stockCode,
      stockName,
      currentPrice: parseFloat(currentPrice),
    });
  };

  const handlePortfolioAnalysis = () => {
    if (!selectedAccountId) {
      toast({
        variant: "destructive",
        title: "계좌 선택 필요",
        description: "분석할 계좌를 선택해주세요",
      });
      return;
    }

    analyzePortfolioMutation.mutate(selectedAccountId);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'buy':
        return <TrendingUp className="h-5 w-5" />;
      case 'sell':
        return <TrendingDown className="h-5 w-5 text-destructive" />;
      default:
        return <Minus className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getActionVariant = (action: string): "default" | "destructive" | "secondary" => {
    switch (action) {
      case 'sell':
        return 'destructive';
      case 'buy':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-ai-title">AI 분석</h1>
        <p className="text-muted-foreground">GPT-4 기반 투자 분석 및 추천</p>
      </div>

      <Tabs defaultValue="stock" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="stock" data-testid="tab-stock-analysis">종목 분석</TabsTrigger>
          <TabsTrigger value="portfolio" data-testid="tab-portfolio-analysis">포트폴리오 분석</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI 종목 분석
              </CardTitle>
              <CardDescription>
                GPT-4가 종목의 기술적 분석과 시장 동향을 분석하여 매매 추천을 제공합니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stockCode">종목 코드</Label>
                  <Input
                    id="stockCode"
                    placeholder="005930"
                    value={stockCode}
                    onChange={(e) => setStockCode(e.target.value)}
                    data-testid="input-stock-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stockName">종목명</Label>
                  <Input
                    id="stockName"
                    placeholder="삼성전자"
                    value={stockName}
                    onChange={(e) => setStockName(e.target.value)}
                    data-testid="input-stock-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentPrice">현재가</Label>
                  <Input
                    id="currentPrice"
                    type="number"
                    placeholder="70000"
                    value={currentPrice}
                    onChange={(e) => setCurrentPrice(e.target.value)}
                    data-testid="input-current-price"
                  />
                </div>
              </div>
              <Button
                onClick={handleStockAnalysis}
                disabled={analyzeStockMutation.isPending}
                className="w-full md:w-auto"
                data-testid="button-analyze-stock"
              >
                {analyzeStockMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    AI 분석 중...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    AI 분석 시작
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {analysis && (
            <Card data-testid="card-analysis-result">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>분석 결과</span>
                  <Badge variant={getActionVariant(analysis.action)} data-testid="badge-action">
                    {analysis.action === 'buy' ? '매수' : analysis.action === 'sell' ? '매도' : '보유'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-md border bg-card p-6">
                    <div className="flex items-center gap-3">
                      {getActionIcon(analysis.action)}
                      <div>
                        <p className="text-sm text-muted-foreground">추천</p>
                        <p className="text-lg font-bold capitalize" data-testid="text-recommendation">
                          {analysis.action === 'buy' ? '매수' : analysis.action === 'sell' ? '매도' : '보유'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border bg-card p-6">
                    <div className="flex items-center gap-3">
                      <Target className="h-5 w-5 text-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">신뢰도</p>
                        <p className="text-lg font-bold" data-testid="text-confidence">
                          {analysis.confidence}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border bg-card p-6">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">목표가</p>
                        <p className="text-lg font-bold" data-testid="text-target-price">
                          {analysis.targetPrice ? `₩${analysis.targetPrice.toLocaleString()}` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    분석 근거
                  </h3>
                  <div className="rounded-md border bg-muted/50 p-6">
                    <p className="text-sm whitespace-pre-wrap" data-testid="text-reasoning">
                      {analysis.reasoning}
                    </p>
                  </div>
                </div>

                {analysis.indicators && Object.keys(analysis.indicators).length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">기술적 지표</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {analysis.indicators.trend && (
                        <div className="rounded-md border bg-card p-4">
                          <p className="text-xs text-muted-foreground">추세</p>
                          <p className="font-medium capitalize">{analysis.indicators.trend}</p>
                        </div>
                      )}
                      {analysis.indicators.momentum && (
                        <div className="rounded-md border bg-card p-4">
                          <p className="text-xs text-muted-foreground">모멘텀</p>
                          <p className="font-medium capitalize">{analysis.indicators.momentum}</p>
                        </div>
                      )}
                      {analysis.indicators.support && (
                        <div className="rounded-md border bg-card p-4">
                          <p className="text-xs text-muted-foreground">지지선</p>
                          <p className="font-medium">₩{analysis.indicators.support.toLocaleString()}</p>
                        </div>
                      )}
                      {analysis.indicators.resistance && (
                        <div className="rounded-md border bg-card p-4">
                          <p className="text-xs text-muted-foreground">저항선</p>
                          <p className="font-medium">₩{analysis.indicators.resistance.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="portfolio" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                포트폴리오 AI 분석
              </CardTitle>
              <CardDescription>
                보유 종목 전체를 분석하여 최적화 전략을 제안합니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account">분석할 계좌 선택</Label>
                <Select
                  value={selectedAccountId?.toString()}
                  onValueChange={(value) => setSelectedAccountId(parseInt(value))}
                >
                  <SelectTrigger data-testid="select-account">
                    <SelectValue placeholder="계좌를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountsData && accountsData.length > 0 ? (
                      accountsData.map((account: any) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.accountNumber} - {account.accountName}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        등록된 계좌가 없습니다
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handlePortfolioAnalysis}
                disabled={analyzePortfolioMutation.isPending || !selectedAccountId}
                className="w-full md:w-auto"
                data-testid="button-analyze-portfolio"
              >
                {analyzePortfolioMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    AI 분석 중...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    포트폴리오 분석
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {portfolioAnalysis && (
            <div className="space-y-6" data-testid="card-portfolio-result">
              <Card>
                <CardHeader>
                  <CardTitle>전체 전략</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-overall-strategy">
                    {portfolioAnalysis.overallStrategy}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>리스크 평가</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-risk-assessment">
                    {portfolioAnalysis.riskAssessment}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>종목별 추천</CardTitle>
                </CardHeader>
                <CardContent>
                  {portfolioAnalysis.recommendations.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">추천 종목이 없습니다</p>
                  ) : (
                    <div className="space-y-3">
                      {portfolioAnalysis.recommendations.map((rec, idx) => (
                        <div key={idx} className="rounded-md border bg-card p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium">{rec.stockName}</p>
                                <span className="text-xs text-muted-foreground">({rec.stockCode})</span>
                                <Badge variant={getActionVariant(rec.action)}>
                                  {rec.action === 'buy' ? '매수' : rec.action === 'sell' ? '매도' : '보유'}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{rec.reason}</p>
                            </div>
                            {getActionIcon(rec.action)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
