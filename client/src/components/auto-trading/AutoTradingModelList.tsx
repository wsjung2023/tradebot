// AutoTradingModelList.tsx — AI 자동매매 모델 목록 카드 (활성화/삭제/성과 지표)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AiModel } from "@shared/schema";

const MODEL_TYPE_LABELS: Record<string, string> = { momentum: "모멘텀", value: "가치투자", technical: "기술적분석", custom: "커스텀" };

interface Props {
  models: AiModel[];
  isLoading: boolean;
  isToggling: boolean;
  isDeleting: boolean;
  selectedModelId: number | null;
  onSelect: (id: number) => void;
  onToggle: (id: number, isActive: boolean) => void;
  onDelete: (id: number) => void;
}

export function AutoTradingModelList({ models, isLoading, isToggling, isDeleting, selectedModelId, onSelect, onToggle, onDelete }: Props) {
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!models || models.length === 0) return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground text-center" data-testid="text-no-models">아직 AI 모델이 없습니다. 새 모델을 생성해보세요.</p>
      </CardContent>
    </Card>
  );
  return (
    <div className="space-y-4">
      {models.map((model) => (
        <Card key={model.id} className={selectedModelId === model.id ? "border-primary" : ""} onClick={() => onSelect(model.id)} data-testid={`card-model-${model.id}`} style={{ cursor: "pointer" }}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base md:text-lg truncate">{model.modelName}</CardTitle>
                <Badge variant="outline" className="mt-1 text-xs">{MODEL_TYPE_LABELS[model.modelType] || model.modelType}</Badge>
                <CardDescription className="text-xs md:text-sm line-clamp-2 mt-1">{model.description}</CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={model.isActive} onCheckedChange={(v) => { onToggle(model.id, v); }} disabled={isToggling} data-testid={`switch-model-${model.id}`} onClick={(e) => e.stopPropagation()} />
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onDelete(model.id); }} disabled={isDeleting} data-testid={`button-delete-model-${model.id}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border bg-card p-2 md:p-4">
                <p className="text-xs text-muted-foreground">총 수익률</p>
                <p className="font-bold text-sm md:text-base">{model.totalReturn ? `${parseFloat(model.totalReturn).toFixed(1)}%` : "—"}</p>
              </div>
              <div className="rounded-md border bg-card p-2 md:p-4">
                <p className="text-xs text-muted-foreground">승률</p>
                <p className="font-bold text-sm md:text-base">{model.winRate ? `${parseFloat(model.winRate).toFixed(1)}%` : "—"}</p>
              </div>
              <div className="rounded-md border bg-card p-2 md:p-4">
                <p className="text-xs text-muted-foreground">총 거래</p>
                <p className="font-bold text-sm md:text-base">{model.totalTrades ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
