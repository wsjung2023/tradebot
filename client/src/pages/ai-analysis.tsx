// ai-analysis.tsx — AI 분석 페이지 (종목 분석 / 포트폴리오 분석 탭 구성)
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AIStockAnalysis } from "@/components/ai-analysis/AIStockAnalysis";
import { AIPortfolioAnalysis } from "@/components/ai-analysis/AIPortfolioAnalysis";

export default function AIAnalysis() {
  const { toast } = useToast();
  const [stockCode, setStockCode] = useState("");
  const [stockName, setStockName] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<any>(null);

  const { data: accountsData = [] } = useQuery<any[]>({ queryKey: ["/api/accounts"] });

  const analyzeStockMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/ai/analyze-stock", data)).json(),
    onSuccess: (data) => { setAnalysis(data); toast({ title: "분석 완료", description: "AI 종목 분석이 완료되었습니다" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "분석 실패", description: e.message }),
  });

  const analyzePortfolioMutation = useMutation({
    mutationFn: async (accountId: number) => (await apiRequest("POST", "/api/ai/analyze-portfolio", { accountId })).json(),
    onSuccess: (data) => { setPortfolioAnalysis(data); toast({ title: "포트폴리오 분석 완료" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "분석 실패", description: e.message }),
  });

  const handleStockAnalysis = () => {
    if (!stockCode || !stockName || !currentPrice) {
      toast({ variant: "destructive", title: "입력 오류", description: "모든 필드를 입력해주세요" }); return;
    }
    analyzeStockMutation.mutate({ stockCode, stockName, currentPrice: parseFloat(currentPrice) });
  };

  const handlePortfolioAnalysis = () => {
    if (!selectedAccountId) {
      toast({ variant: "destructive", title: "계좌 선택 필요", description: "분석할 계좌를 선택해주세요" }); return;
    }
    analyzePortfolioMutation.mutate(selectedAccountId);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-ai-title">AI 분석</h1>
        <p className="text-muted-foreground">GPT-4 기반 종목 분석 및 추천</p>
      </div>
      <Tabs defaultValue="stock" className="space-y-6">
        <TabsList>
          <TabsTrigger value="stock" data-testid="tab-stock-analysis">종목 분석</TabsTrigger>
          <TabsTrigger value="portfolio" data-testid="tab-portfolio-analysis">포트폴리오 분석</TabsTrigger>
        </TabsList>
        <AIStockAnalysis
          stockCode={stockCode} stockName={stockName} currentPrice={currentPrice}
          analysis={analysis} isPending={analyzeStockMutation.isPending}
          onStockCodeChange={setStockCode} onStockNameChange={setStockName}
          onCurrentPriceChange={setCurrentPrice} onAnalyze={handleStockAnalysis}
        />
        <AIPortfolioAnalysis
          accounts={accountsData} selectedAccountId={selectedAccountId}
          portfolioAnalysis={portfolioAnalysis} isPending={analyzePortfolioMutation.isPending}
          onAccountChange={setSelectedAccountId} onAnalyze={handlePortfolioAnalysis}
        />
      </Tabs>
    </div>
  );
}
