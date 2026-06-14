import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AIStockAnalysis } from "@/components/ai-analysis/AIStockAnalysis";
import { AIPortfolioAnalysis } from "@/components/ai-analysis/AIPortfolioAnalysis";
import { IntegratedAnalysis } from "@/components/ai-analysis/IntegratedAnalysis";
import { AccountHoldingPicker } from "@/components/stocks/AccountHoldingPicker";
import { Zap } from "lucide-react";
import type { SelectedStock } from "@/lib/stocks";

export default function AIAnalysis() {
  const { toast } = useToast();
  const [selectedStock, setSelectedStock] = useState<SelectedStock | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [pickerAccountId, setPickerAccountId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<any>(null);

  const { data: accountsData = [] } = useQuery<any[]>({ queryKey: ["/api/accounts"] });

  const analyzeStockMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/ai/analyze-stock", data)).json(),
    onSuccess: (data) => { setAnalysis(data); toast({ title: "분석 완료", description: "AI 종목 분석이 완료되었습니다" }); },
    onError: (error: any) => {
      const isLimit = error.message?.includes('AI_ANALYSIS_LIMIT_EXCEEDED') || error.message?.includes('일일 한도');
      toast({ variant: "destructive",
        title: isLimit ? "AI 분석 일일 한도 초과" : "분석 실패",
        description: isLimit ? "오늘의 AI 분석 횟수를 모두 사용했습니다. 내일 다시 시도하거나 플랜을 업그레이드해주세요." : error.message,
      });
    },
  });

  const analyzePortfolioMutation = useMutation({
    mutationFn: async (accountId: number) => (await apiRequest("POST", "/api/ai/analyze-portfolio", { accountId })).json(),
    onSuccess: (data) => { setPortfolioAnalysis(data); toast({ title: "포트폴리오 분석 완료" }); },
    onError: (error: any) => {
      const isLimit = error.message?.includes('AI_ANALYSIS_LIMIT_EXCEEDED') || error.message?.includes('일일 한도');
      toast({ variant: "destructive",
        title: isLimit ? "AI 분석 일일 한도 초과" : "분석 실패",
        description: isLimit ? "오늘의 AI 분석 횟수를 모두 사용했습니다. 내일 다시 시도하거나 플랜을 업그레이드해주세요." : error.message,
      });
    },
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

  const effectivePickerAccountId = pickerAccountId ?? (accountsData[0]?.id ?? null);

  const handleHoldingSelect = (stock: SelectedStock) => {
    setSelectedStock(stock);
    setAnalysis(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-ai-title">AI 분석</h1>
        <p className="text-muted-foreground">GPT-4 기반 종목 분석 및 추천</p>
      </div>

      {/* 보유 종목 바로가기 */}
      {accountsData.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {accountsData.length > 1 && (
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">계좌</Label>
              <Select
                value={effectivePickerAccountId?.toString() ?? ""}
                onValueChange={(v) => setPickerAccountId(parseInt(v))}
              >
                <SelectTrigger className="w-52 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountsData.map((a: any) => (
                    <SelectItem key={a.id} value={a.id.toString()} className="text-xs">
                      {a.accountName || a.accountNumber} ({a.accountType === "real" ? "실전" : "모의"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <AccountHoldingPicker
            accountId={effectivePickerAccountId}
            onSelect={handleHoldingSelect}
          />
        </div>
      )}

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
          <IntegratedAnalysis externalStock={selectedStock} />
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
