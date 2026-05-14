import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AIStockAnalysis } from "@/components/ai-analysis/AIStockAnalysis";
import { AIPortfolioAnalysis } from "@/components/ai-analysis/AIPortfolioAnalysis";
import { IntegratedAnalysis } from "@/components/ai-analysis/IntegratedAnalysis";
import { Zap } from "lucide-react";
import type { SelectedStock } from "@/lib/stocks";

export default function AIAnalysis() {
  const { toast } = useToast();
  const [selectedStock, setSelectedStock] = useState<SelectedStock | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<any>(null);

  const { data: accountsData = [] } = useQuery<any[]>({ queryKey: ["/api/accounts"] });

  const analyzeStockMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/ai/analyze-stock", data)).json(),
    onSuccess: (data) => { setAnalysis(data); toast({ title: "분석 완료", description: "AI 종목 분석이 완료되었습니다" }); },
    onError: (error: any) => toast({ variant: "destructive", title: "분석 실패", description: error.message }),
  });

  const analyzePortfolioMutation = useMutation({
    mutationFn: async (accountId: number) => (await apiRequest("POST", "/api/ai/analyze-portfolio", { accountId })).json(),
    onSuccess: (data) => { setPortfolioAnalysis(data); toast({ title: "포트폴리오 분석 완료" }); },
    onError: (error: any) => toast({ variant: "destructive", title: "분석 실패", description: error.message }),
  });

  const handleStockAnalysis = () => {
    if (!selectedStock?.stockCode || !selectedStock.stockName || !selectedStock.currentPrice) {
      toast({
        variant: "destructive",
        title: "종목 선택 필요",
        description: "검색 결과에서 종목을 선택해 코드, 종목명, 현재가를 함께 연결해주세요.",
      });
      return;
    }

    analyzeStockMutation.mutate({
      stockCode: selectedStock.stockCode,
      stockName: selectedStock.stockName,
      currentPrice: selectedStock.currentPrice,
    });
  };

  const handlePortfolioAnalysis = () => {
    if (!selectedAccountId) {
      toast({ variant: "destructive", title: "계좌 선택 필요", description: "분석할 계좌를 선택해주세요" });
      return;
    }
    analyzePortfolioMutation.mutate(selectedAccountId);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-ai-title">AI 분석</h1>
        <p className="text-muted-foreground">GPT-4 기반 종목 분석 및 추천</p>
      </div>
      <Tabs defaultValue="integrated" className="space-y-6">
        <TabsList>
          <TabsTrigger value="integrated" data-testid="tab-integrated-analysis" className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            통합 분석
          </TabsTrigger>
          <TabsTrigger value="stock" data-testid="tab-stock-analysis">종목 분석</TabsTrigger>
          <TabsTrigger value="portfolio" data-testid="tab-portfolio-analysis">포트폴리오 분석</TabsTrigger>
        </TabsList>

        <TabsContent value="integrated">
          <IntegratedAnalysis />
        </TabsContent>

        <AIStockAnalysis
          selectedStock={selectedStock}
          analysis={analysis}
          isPending={analyzeStockMutation.isPending}
          onSelectedStockChange={(stock) => {
            setSelectedStock(stock);
            setAnalysis(null);
          }}
          onAnalyze={handleStockAnalysis}
        />
        <AIPortfolioAnalysis
          accounts={accountsData}
          selectedAccountId={selectedAccountId}
          portfolioAnalysis={portfolioAnalysis}
          isPending={analyzePortfolioMutation.isPending}
          onAccountChange={setSelectedAccountId}
          onAnalyze={handlePortfolioAnalysis}
        />
      </Tabs>
    </div>
  );
}
