// AutoTradingLearningRecords.tsx — 자동매매 AI 모델 학습 기록 UI
// 거래 성과(승률·수익률·샤프비율·최대낙폭)와 패턴 인사이트(최적 진입/청산 라인)를 표시.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BrainCircuit } from "lucide-react";
import type { LearningRecord } from "@shared/schema";

interface Props {
  records: LearningRecord[];
  isLoading: boolean;
  selectedModelId: number | null;
  visibleCount: number;
  onVisibleCountChange: (count: number) => void;
  periodDays: number;
  onPeriodDaysChange: (days: number) => void;
}

const formatDate = (value?: Date | string | null) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const formatPercent = (value?: string | null) => {
  if (!value) return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return `${num.toFixed(2)}%`;
};

export function AutoTradingLearningRecords({
  records,
  isLoading,
  selectedModelId,
  visibleCount,
  onVisibleCountChange,
  periodDays,
  onPeriodDaysChange,
}: Props) {
  if (!selectedModelId) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground text-center">
          모델을 선택하면 최근 학습 이력을 확인할 수 있습니다.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><BrainCircuit className="h-4 w-4" />학습 이력</CardTitle>
        <CardDescription>선택한 AI 모델의 최근 최적화 실행 기록입니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex items-center gap-1 text-muted-foreground">
            기간
            <select
              className="border rounded px-2 py-1 bg-background"
              value={periodDays}
              onChange={(e) => onPeriodDaysChange(Number(e.target.value))}
              data-testid="select-learning-period"
            >
              <option value={7}>7일</option>
              <option value={30}>30일</option>
              <option value={90}>90일</option>
              <option value={365}>1년</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-1 text-muted-foreground">
            건수
            <select
              className="border rounded px-2 py-1 bg-background"
              value={visibleCount}
              onChange={(e) => onVisibleCountChange(Number(e.target.value))}
              data-testid="select-learning-visible-count"
            >
              <option value={10}>10개</option>
              <option value={20}>20개</option>
              <option value={50}>50개</option>
            </select>
          </label>
        </div>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">학습 이력이 아직 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {records.map((record) => (
              <div key={record.id} className="border rounded-md p-3 text-xs md:text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">#{record.id}</Badge>
                  <span className="text-muted-foreground">{formatDate(record.createdAt)}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div><span className="text-muted-foreground">승률</span><p className="font-medium">{formatPercent(record.winRate)}</p></div>
                  <div><span className="text-muted-foreground">평균수익</span><p className="font-medium">{formatPercent(record.avgReturn)}</p></div>
                  <div><span className="text-muted-foreground">총거래</span><p className="font-medium">{record.totalTrades ?? "-"}</p></div>
                  <div><span className="text-muted-foreground">기간</span><p className="font-medium">{`${formatDate(record.periodStart)} ~ ${formatDate(record.periodEnd)}`}</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
