// AutoTradingRecommendations.tsx — AI 자동매매 매매 신호 및 추천 종목 카드
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AiRecommendation } from "@shared/schema";

const ACTION_LABELS: Record<string, string> = { buy: "매수", sell: "매도", hold: "관망" };
const ACTION_VARIANTS: Record<string, "default" | "destructive" | "secondary"> = { buy: "default", sell: "destructive", hold: "secondary" };
const ACTION_ICONS: Record<string, JSX.Element> = {
  buy: <TrendingUp className="h-4 w-4" />,
  sell: <TrendingDown className="h-4 w-4" />,
  hold: <Minus className="h-4 w-4" />,
};

interface Props { recommendations: AiRecommendation[]; }

export function AutoTradingRecommendations({ recommendations }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>매매 신호</CardTitle>
        <CardDescription>AI 모델이 생성한 최근 매매 추천 목록</CardDescription>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <p className="text-center text-muted-foreground py-8" data-testid="text-no-recommendations">아직 매매 신호가 없습니다</p>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div key={rec.id} className="rounded-md border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{rec.stockName}</span>
                      <span className="text-xs text-muted-foreground">({rec.stockCode})</span>
                      <Badge variant={ACTION_VARIANTS[rec.action] || "secondary"} className="flex items-center gap-1">
                        {ACTION_ICONS[rec.action]}{ACTION_LABELS[rec.action] || rec.action}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>신뢰도: {(parseFloat(String(rec.confidence)) * 100).toFixed(0)}%</span>
                      {rec.targetPrice && <span>목표가: {parseFloat(rec.targetPrice).toLocaleString()}원</span>}
                    </div>
                    {rec.reasoning && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rec.reasoning}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
