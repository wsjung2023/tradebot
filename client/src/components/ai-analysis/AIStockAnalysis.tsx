// AIStockAnalysis.tsx — 종목 AI 분석 탭 (종목 코드/가격 입력 후 GPT 분석 결과 표시)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { Loader2, TrendingUp, TrendingDown, Minus, Brain, Target, AlertCircle } from "lucide-react";

interface StockAnalysis {
  action: "buy" | "sell" | "hold";
  confidence: number;
  targetPrice: number | null;
  reasoning: string;
  indicators: { trend?: string; momentum?: string; support?: number; resistance?: number };
}

interface Props {
  stockCode: string;
  stockName: string;
  currentPrice: string;
  analysis: StockAnalysis | null;
  isPending: boolean;
  onStockCodeChange: (v: string) => void;
  onStockNameChange: (v: string) => void;
  onCurrentPriceChange: (v: string) => void;
  onAnalyze: () => void;
}

const ACTION_ICONS: Record<string, JSX.Element> = {
  buy: <TrendingUp className="h-5 w-5" />,
  sell: <TrendingDown className="h-5 w-5 text-destructive" />,
  hold: <Minus className="h-5 w-5 text-muted-foreground" />,
};

const ACTION_VARIANTS: Record<string, "default" | "destructive" | "secondary"> = {
  buy: "default", sell: "destructive", hold: "secondary",
};

export function AIStockAnalysis({ stockCode, stockName, currentPrice, analysis, isPending, onStockCodeChange, onStockNameChange, onCurrentPriceChange, onAnalyze }: Props) {
  return (
    <TabsContent value="stock" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />종목 AI 분석</CardTitle>
          <CardDescription>GPT-4를 활용하여 선택한 종목을 분석하여 매매 추천을 제공합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stockCode">종목 코드</Label>
              <Input id="stockCode" placeholder="예: 005930" value={stockCode} onChange={(e) => onStockCodeChange(e.target.value)} data-testid="input-stock-code" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stockName">종목명</Label>
              <Input id="stockName" placeholder="예: 삼성전자" value={stockName} onChange={(e) => onStockNameChange(e.target.value)} data-testid="input-stock-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentPrice">현재가</Label>
              <Input id="currentPrice" type="number" placeholder="예: 70000" value={currentPrice} onChange={(e) => onCurrentPriceChange(e.target.value)} data-testid="input-current-price" />
            </div>
          </div>
          <Button onClick={onAnalyze} disabled={isPending} data-testid="button-analyze-stock">
            {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />분석 중...</> : <><Brain className="h-4 w-4 mr-2" />AI 분석 시작</>}
          </Button>
        </CardContent>
      </Card>

      {analysis && (
        <Card data-testid="card-analysis-result">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>분석 결과</span>
              <Badge variant={ACTION_VARIANTS[analysis.action] || "secondary"}>
                <span className="flex items-center gap-1">{ACTION_ICONS[analysis.action]}{analysis.action === "buy" ? "매수" : analysis.action === "sell" ? "매도" : "관망"}</span>
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-md border bg-card p-6">
                <p className="text-sm text-muted-foreground mb-2">신뢰도</p>
                <p className="text-2xl font-bold">{(analysis.confidence * 100).toFixed(1)}%</p>
              </div>
              <div className="rounded-md border bg-card p-6">
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1"><Target className="h-4 w-4" />목표가</p>
                <p className="text-2xl font-bold">{analysis.targetPrice ? `${analysis.targetPrice.toLocaleString()}원` : "미정"}</p>
              </div>
              <div className="rounded-md border bg-card p-6">
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1"><AlertCircle className="h-4 w-4" />추세</p>
                <p className="text-lg font-medium">{analysis.indicators?.trend || "분석 중"}</p>
              </div>
            </div>
            <div className="rounded-md border bg-card p-4">
              <p className="text-sm font-medium mb-2">AI 분석 의견</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{analysis.reasoning}</p>
            </div>
            {analysis.indicators && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {analysis.indicators.support && <div className="rounded-md border bg-card p-4"><p className="text-xs text-muted-foreground">지지선</p><p className="font-medium">{analysis.indicators.support.toLocaleString()}원</p></div>}
                {analysis.indicators.resistance && <div className="rounded-md border bg-card p-4"><p className="text-xs text-muted-foreground">저항선</p><p className="font-medium">{analysis.indicators.resistance.toLocaleString()}원</p></div>}
                {analysis.indicators.momentum && <div className="rounded-md border bg-card p-4"><p className="text-xs text-muted-foreground">모멘텀</p><p className="font-medium">{analysis.indicators.momentum}</p></div>}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </TabsContent>
  );
}
