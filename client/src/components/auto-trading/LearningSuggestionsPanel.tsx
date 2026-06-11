// LearningSuggestionsPanel.tsx — 학습잡이 생성한 파라미터 변경 제안 검토 UI
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Check, X, ChevronRight, Bot, BarChart2, CheckCircle2, Clock } from "lucide-react";
import type { LearningSuggestion, LearningRecord } from "@shared/schema";

const PARAM_LABELS: Record<string, string> = {
  themeWeight: "테마 가중치",
  newsWeight: "뉴스 가중치",
  financialsWeight: "재무 가중치",
  liquidityWeight: "유동성 가중치",
  institutionalWeight: "기관 가중치",
  minAiConfidence: "AI 신뢰도 임계치",
  requireGoodFinancials: "재무 양호 필터",
  requireHighLiquidity: "유동성 필터",
  stopLossMode: "손절 모드",
  maxUnitsPerStock: "최대 유닛 수",
  entryLadderSettings: "분할매수 라더",
};

function formatValue(paramKey: string, value: string): string {
  if (paramKey === "entryLadderSettings") {
    try {
      const arr = JSON.parse(value);
      if (Array.isArray(arr)) return arr.map((s: any) => `${s.line}%×${s.units}`).join(", ");
    } catch {}
    return value;
  }
  if (paramKey === "requireGoodFinancials" || paramKey === "requireHighLiquidity") {
    return value === "true" ? "활성화" : "비활성화";
  }
  if (["themeWeight", "newsWeight", "financialsWeight", "liquidityWeight", "institutionalWeight", "minAiConfidence"].includes(paramKey)) {
    const n = parseFloat(value);
    return isNaN(n) ? value : `${n}`;
  }
  return value;
}

interface Props {
  modelId: number;
}

export function LearningSuggestionsPanel({ modelId }: Props) {
  const { toast } = useToast();

  const { data: suggestions = [], isLoading } = useQuery<LearningSuggestion[]>({
    queryKey: ["/api/auto-trading/suggestions", modelId, "pending,auto_applied"],
    queryFn: async () => {
      const resp = await apiRequest("GET", `/api/auto-trading/suggestions/${modelId}?status=pending,auto_applied&limit=20`);
      return resp.json();
    },
    enabled: !!modelId,
  });

  const { data: lastRecord } = useQuery<LearningRecord[]>({
    queryKey: ["/api/ai/models", modelId, "learning-records", 1],
    queryFn: async () => {
      const resp = await apiRequest("GET", `/api/ai/models/${modelId}/learning-records?limit=1`);
      return resp.json();
    },
    enabled: !!modelId,
  });

  const applyMutation = useMutation({
    mutationFn: async (id: number) => {
      const resp = await apiRequest("POST", `/api/auto-trading/suggestions/${id}/apply`);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auto-trading/suggestions", modelId, "pending,auto_applied"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auto-trading/suggestions/pending-count"] });
      toast({ title: "제안 적용됨", description: "파라미터가 업데이트되었습니다" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "적용 실패", description: e.message }),
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: number) => {
      const resp = await apiRequest("POST", `/api/auto-trading/suggestions/${id}/dismiss`);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auto-trading/suggestions", modelId, "pending,auto_applied"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auto-trading/suggestions/pending-count"] });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "무시 실패", description: e.message }),
  });

  const dismissAllMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/auto-trading/suggestions/${modelId}/dismiss-all`);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auto-trading/suggestions", modelId, "pending,auto_applied"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auto-trading/suggestions/pending-count"] });
      toast({ title: "모든 제안 무시됨" });
    },
  });

  if (isLoading) return null;

  const pending = suggestions.filter(s => s.status === 'pending');
  const autoApplied = suggestions.filter(s => s.status === 'auto_applied');
  const hasSuggestions = pending.length > 0 || autoApplied.length > 0;

  const last = lastRecord?.[0];
  const lastRunDate = last?.createdAt ? new Date(last.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  const lastAppliedChanges = last?.appliedChanges as any;
  const lastReason = lastAppliedChanges?.reason;
  const lastTotalTrades = last?.totalTrades;

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-base">학습 파라미터 제안</CardTitle>
            {hasSuggestions && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {suggestions.length}건
              </Badge>
            )}
          </div>
          {pending.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground text-xs"
              onClick={() => dismissAllMutation.mutate()}
              disabled={dismissAllMutation.isPending}
            >
              모두 무시
            </Button>
          )}
        </div>
        <CardDescription>매일 16:00 KST (장 종료 후) 학습잡이 성과 분석 후 생성한 제안입니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 빈 상태 */}
        {!hasSuggestions && (
          <div className="flex items-start gap-3 text-sm text-muted-foreground py-1">
            <Clock className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              {lastRunDate ? (
                <>
                  <span>마지막 학습: {lastRunDate}</span>
                  {lastReason === 'INSUFFICIENT_DATA' ? (
                    <span> — 데이터 부족 (현재 {lastTotalTrades ?? 0}건, 분석 시작 기준 20건)</span>
                  ) : (
                    <span> — 현재 파라미터가 최적 상태</span>
                  )}
                </>
              ) : (
                <span>아직 학습잡이 실행된 기록이 없습니다</span>
              )}
            </div>
          </div>
        )}

        {/* 검토 필요 섹션 */}
        {pending.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">검토 필요 ({pending.length}건)</p>
            {pending.map((s) => (
              <SuggestionRow
                key={s.id}
                suggestion={s}
                onApply={() => applyMutation.mutate(s.id)}
                onDismiss={() => dismissMutation.mutate(s.id)}
                isPending={applyMutation.isPending || dismissMutation.isPending}
              />
            ))}
          </div>
        )}

        {/* 자동 적용됨 섹션 */}
        {autoApplied.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-green-600 dark:text-green-400">자동 적용됨 ({autoApplied.length}건)</p>
            {autoApplied.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-3 bg-white dark:bg-slate-900 rounded-lg p-3 border border-green-100 dark:border-green-900 opacity-75"
              >
                <div className="mt-0.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{PARAM_LABELS[s.paramKey] ?? s.paramKey}</span>
                    <Badge variant="outline" className="text-[10px] py-0">
                      {s.source === "ai" ? "AI" : "규칙"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1.5">
                    <span className="line-through">{formatValue(s.paramKey, s.currentValue)}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span className="text-green-600 dark:text-green-400 font-medium">{formatValue(s.paramKey, s.suggestedValue)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.reasoning}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SuggestionRow({
  suggestion: s,
  onApply,
  onDismiss,
  isPending,
}: {
  suggestion: LearningSuggestion;
  onApply: () => void;
  onDismiss: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-start gap-3 bg-white dark:bg-slate-900 rounded-lg p-3 border border-blue-100 dark:border-blue-900">
      <div className="mt-0.5">
        {s.source === "ai" ? (
          <Bot className="h-4 w-4 text-purple-500" />
        ) : (
          <BarChart2 className="h-4 w-4 text-blue-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{PARAM_LABELS[s.paramKey] ?? s.paramKey}</span>
          <Badge variant="outline" className="text-[10px] py-0">
            {s.source === "ai" ? "AI" : "규칙"}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1.5">
          <span className="line-through">{formatValue(s.paramKey, s.currentValue)}</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{formatValue(s.paramKey, s.suggestedValue)}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{s.reasoning}</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400"
          onClick={onApply}
          disabled={isPending}
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          적용
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          onClick={onDismiss}
          disabled={isPending}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
