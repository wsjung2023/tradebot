import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { Loader2, TrendingUp, TrendingDown, Minus, Brain, Target, AlertCircle, Download } from "lucide-react";
import { StockSelector } from "@/components/stocks/StockSelector";
import { buildMarkdownTimestamp, downloadMarkdownFile } from "@/lib/markdown-download";
import type { SelectedStock } from "@/lib/stocks";

interface StockAnalysis {
  action: "buy" | "sell" | "hold";
  confidence: number;
  targetPrice: number | null;
  reasoning: string;
  indicators: { trend?: string; momentum?: string; support?: number; resistance?: number };
}

interface Props {
  selectedStock: SelectedStock | null;
  analysis: StockAnalysis | null;
  isPending: boolean;
  onSelectedStockChange: (value: SelectedStock | null) => void;
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

const TREND_LABELS: Record<string, string> = {
  bullish: "상승",
  bearish: "하락",
  neutral: "중립",
};

const MOMENTUM_LABELS: Record<string, string> = {
  strong: "강함",
  weak: "약함",
  neutral: "중립",
};

export function AIStockAnalysis({ selectedStock, analysis, isPending, onSelectedStockChange, onAnalyze }: Props) {
  const handleDownloadMarkdown = () => {
    if (!analysis) return;

    const stockCode = selectedStock?.stockCode || "-";
    const stockName = selectedStock?.stockName || "-";
    const currentPrice = typeof selectedStock?.currentPrice === "number"
      ? `₩${selectedStock.currentPrice.toLocaleString("ko-KR")}`
      : "미확인";
    const targetPrice = analysis.targetPrice ? `₩${analysis.targetPrice.toLocaleString("ko-KR")}` : "미정";
    const support = analysis.indicators?.support ? `₩${analysis.indicators.support.toLocaleString("ko-KR")}` : "-";
    const resistance = analysis.indicators?.resistance ? `₩${analysis.indicators.resistance.toLocaleString("ko-KR")}` : "-";
    const trend = TREND_LABELS[analysis.indicators?.trend || ""] || analysis.indicators?.trend || "-";
    const momentum = MOMENTUM_LABELS[analysis.indicators?.momentum || ""] || analysis.indicators?.momentum || "-";
    const action = analysis.action === "buy" ? "매수" : analysis.action === "sell" ? "매도" : "관망";

    const markdown = [
      `# 종목 AI 분석 리포트`,
      ``,
      `- 생성시각: ${new Date().toLocaleString("ko-KR")}`,
      `- 종목코드: ${stockCode}`,
      `- 종목명: ${stockName}`,
      `- 현재가: ${currentPrice}`,
      ``,
      `## 분석 요약`,
      `- 액션: ${action}`,
      `- 신뢰도: ${analysis.confidence.toFixed(1)}%`,
      `- 목표가: ${targetPrice}`,
      `- 추세: ${trend}`,
      `- 모멘텀: ${momentum}`,
      `- 지지선: ${support}`,
      `- 저항선: ${resistance}`,
      ``,
      `## AI 분석 의견`,
      analysis.reasoning || "-",
      ``,
    ].join("\n");

    downloadMarkdownFile(`stock-analysis-${stockCode}-${buildMarkdownTimestamp()}`, markdown);
  };

  return (
    <TabsContent value="stock" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />종목 AI 분석</CardTitle>
          <CardDescription>검색 결과에서 종목을 선택하면 코드, 종목명, 현재가를 한 번에 연결해 분석합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StockSelector
            label="분석할 종목"
            value={selectedStock}
            onChange={onSelectedStockChange}
            placeholder="종목명 또는 코드 입력 (예: 삼성전자, 005930)"
            inputTestId="input-stock-code"
            allowManualCode
          />
          <Button onClick={onAnalyze} disabled={isPending || !selectedStock?.stockCode} data-testid="button-analyze-stock">
            {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />분석 중...</> : <><Brain className="h-4 w-4 mr-2" />AI 분석 시작</>}
          </Button>
        </CardContent>
      </Card>

      {analysis && (
        <Card data-testid="card-analysis-result">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span>분석 결과</span>
                <Badge variant={ACTION_VARIANTS[analysis.action] || "secondary"}>
                  <span className="flex items-center gap-1">{ACTION_ICONS[analysis.action]}{analysis.action === "buy" ? "매수" : analysis.action === "sell" ? "매도" : "관망"}</span>
                </Badge>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleDownloadMarkdown} data-testid="button-download-stock-markdown">
                <Download className="h-4 w-4 mr-2" />
                Markdown 다운로드
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-md border bg-card p-6">
                <p className="text-sm text-muted-foreground mb-2">신뢰도</p>
                <p className="text-2xl font-bold">{analysis.confidence.toFixed(1)}%</p>
              </div>
              <div className="rounded-md border bg-card p-6">
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1"><Target className="h-4 w-4" />목표가</p>
                <p className="text-2xl font-bold">{analysis.targetPrice ? `${analysis.targetPrice.toLocaleString()}원` : "미정"}</p>
              </div>
              <div className="rounded-md border bg-card p-6">
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1"><AlertCircle className="h-4 w-4" />추세</p>
                <p className="text-lg font-medium">{TREND_LABELS[analysis.indicators?.trend || ""] || analysis.indicators?.trend || "분석 중"}</p>
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
                {analysis.indicators.momentum && <div className="rounded-md border bg-card p-4"><p className="text-xs text-muted-foreground">모멘텀</p><p className="font-medium">{MOMENTUM_LABELS[analysis.indicators.momentum] || analysis.indicators.momentum}</p></div>}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </TabsContent>
  );
}
