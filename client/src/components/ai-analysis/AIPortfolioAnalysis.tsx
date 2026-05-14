// AIPortfolioAnalysis.tsx — 포트폴리오 AI 분석 탭 (계좌 선택 후 전체 전략/리스크/종목 추천 표시)
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, TrendingDown, Minus, Brain } from "lucide-react";

interface PortfolioAnalysis {
  overallStrategy: string;
  riskAssessment: string;
  recommendations: Array<{ stockCode: string; stockName: string; action: "buy" | "sell" | "hold"; reason: string }>;
}

interface Props {
  accounts: any[];
  selectedAccountId: number | null;
  portfolioAnalysis: PortfolioAnalysis | null;
  isPending: boolean;
  onAccountChange: (id: number) => void;
  onAnalyze: () => void;
}

const ACTION_LABELS: Record<string, string> = { buy: "매수", sell: "매도", hold: "관망" };
const ACTION_VARIANTS: Record<string, "default" | "destructive" | "secondary"> = { buy: "default", sell: "destructive", hold: "secondary" };
const ACTION_ICONS: Record<string, JSX.Element> = {
  buy: <TrendingUp className="h-5 w-5" />,
  sell: <TrendingDown className="h-5 w-5 text-destructive" />,
  hold: <Minus className="h-5 w-5 text-muted-foreground" />,
};

export function AIPortfolioAnalysis({ accounts, selectedAccountId, portfolioAnalysis, isPending, onAccountChange, onAnalyze }: Props) {
  return (
    <TabsContent value="portfolio" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />포트폴리오 AI 분석</CardTitle>
          <CardDescription>보유 종목 전체를 분석하여 최적화 전략을 제공합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account">분석할 계좌 선택</Label>
            <Select value={selectedAccountId?.toString()} onValueChange={(v) => onAccountChange(parseInt(v))}>
              <SelectTrigger data-testid="select-account"><SelectValue placeholder="계좌를 선택하세요" /></SelectTrigger>
              <SelectContent>
                {accounts && accounts.length > 0
                  ? accounts.map((a: any) => <SelectItem key={a.id} value={a.id.toString()}>{a.accountNumber} - {a.accountName}</SelectItem>)
                  : <SelectItem value="none" disabled>등록된 계좌가 없습니다</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={onAnalyze} disabled={isPending || !selectedAccountId} className="w-full md:w-auto" data-testid="button-analyze-portfolio">
            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />AI 분석 중...</> : <><Brain className="mr-2 h-4 w-4" />포트폴리오 분석</>}
          </Button>
        </CardContent>
      </Card>

      {portfolioAnalysis && (
        <div className="space-y-6" data-testid="card-portfolio-result">
          <Card>
            <CardHeader><CardTitle>전체 전략</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap" data-testid="text-overall-strategy">{portfolioAnalysis.overallStrategy}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>리스크 평가</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap" data-testid="text-risk-assessment">{portfolioAnalysis.riskAssessment}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>종목별 추천</CardTitle></CardHeader>
            <CardContent>
              {portfolioAnalysis.recommendations.length === 0
                ? <p className="text-center text-muted-foreground py-8">추천 내역이 없습니다</p>
                : <div className="space-y-3">
                    {portfolioAnalysis.recommendations.map((rec, idx) => (
                      <div key={idx} className="rounded-md border bg-card p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium">{rec.stockName}</p>
                              <span className="text-xs text-muted-foreground">({rec.stockCode})</span>
                              <Badge variant={ACTION_VARIANTS[rec.action] || "secondary"}>{ACTION_LABELS[rec.action] || rec.action}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{rec.reason}</p>
                          </div>
                          {ACTION_ICONS[rec.action]}
                        </div>
                      </div>
                    ))}
                  </div>}
            </CardContent>
          </Card>
        </div>
      )}
    </TabsContent>
  );
}
