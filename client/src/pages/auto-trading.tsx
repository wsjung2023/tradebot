// auto-trading.tsx — AI 자동매매 모델 관리 및 매매 신호 페이지
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AutoTradingModelDialog } from "@/components/auto-trading/AutoTradingModelDialog";
import { AutoTradingModelList } from "@/components/auto-trading/AutoTradingModelList";
import { AutoTradingRecommendations } from "@/components/auto-trading/AutoTradingRecommendations";
import { AutoTradingLearningRecords } from "@/components/auto-trading/AutoTradingLearningRecords";
import type { AiModel, AiRecommendation, LearningRecord } from "@shared/schema";
import { Bot } from "lucide-react";

export default function AutoTrading() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [modelName, setModelName] = useState("");
  const [modelType, setModelType] = useState<"momentum" | "value" | "technical" | "custom">("momentum");
  const [description, setDescription] = useState("");
  const [maxPositions, setMaxPositions] = useState("5");
  const [stopLossPercent, setStopLossPercent] = useState("5");
  const [takeProfitPercent, setTakeProfitPercent] = useState("10");
  const [learningVisibleCount, setLearningVisibleCount] = useState(10);
  const [learningPeriodDays, setLearningPeriodDays] = useState(30);

  const { data: models = [], isLoading: modelsLoading } = useQuery<AiModel[]>({ queryKey: ["/api/ai/models"] });
  const { data: recommendations = [] } = useQuery<AiRecommendation[]>({
    queryKey: ["/api/ai/models", selectedModelId, "recommendations"],
    enabled: !!selectedModelId,
  });
  const { data: learningRecords = [], isLoading: recordsLoading } = useQuery<LearningRecord[]>({
    queryKey: ["/api/ai/models", selectedModelId, "learning-records", learningVisibleCount],
    queryFn: async () => {
      if (!selectedModelId) return [];
      const resp = await apiRequest("GET", `/api/ai/models/${selectedModelId}/learning-records?limit=${learningVisibleCount}`);
      return resp.json();
    },
    enabled: !!selectedModelId,
  });

  const filteredLearningRecords = learningRecords.filter((record) => {
    if (!record.createdAt) return true;
    const createdAt = new Date(record.createdAt).getTime();
    if (Number.isNaN(createdAt)) return true;
    return Date.now() - createdAt <= learningPeriodDays * 24 * 60 * 60 * 1000;
  });

  const createModelMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/ai/models", data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ai/models"] }); resetForm(); toast({ title: "AI 모델 생성됨" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "생성 실패", description: e.message }),
  });

  const toggleModelMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => (await apiRequest("PATCH", `/api/ai/models/${id}`, { isActive })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ai/models"] }),
    onError: (e: any) => toast({ variant: "destructive", title: "상태 변경 실패", description: e.message }),
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/ai/models/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ai/models"] }); if (selectedModelId) setSelectedModelId(null); toast({ title: "모델 삭제됨" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "삭제 실패", description: e.message }),
  });

  const resetForm = () => { setModelName(""); setModelType("momentum"); setDescription(""); setMaxPositions("5"); setStopLossPercent("5"); setTakeProfitPercent("10"); setCreateDialogOpen(false); };

  const handleCreateModel = () => {
    if (!modelName.trim()) { toast({ variant: "destructive", title: "모델 이름을 입력해주세요" }); return; }
    createModelMutation.mutate({ modelName, modelType, description, config: { maxPositions: parseInt(maxPositions), stopLossPercent: parseFloat(stopLossPercent), takeProfitPercent: parseFloat(takeProfitPercent) } });
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Bot className="h-7 w-7" />AI 자동매매</h1>
          <p className="text-muted-foreground mt-1">AI 모델을 생성하고 자동매매 신호를 확인하세요</p>
        </div>
        <AutoTradingModelDialog
          open={createDialogOpen} modelName={modelName} modelType={modelType}
          description={description} maxPositions={maxPositions}
          stopLossPercent={stopLossPercent} takeProfitPercent={takeProfitPercent}
          isPending={createModelMutation.isPending}
          onOpenChange={setCreateDialogOpen}
          onModelNameChange={setModelName} onModelTypeChange={setModelType}
          onDescriptionChange={setDescription} onMaxPositionsChange={setMaxPositions}
          onStopLossChange={setStopLossPercent} onTakeProfitChange={setTakeProfitPercent}
          onCreate={handleCreateModel}
        />
      </div>
      <AutoTradingModelList
        models={models} isLoading={modelsLoading}
        isToggling={toggleModelMutation.isPending} isDeleting={deleteModelMutation.isPending}
        selectedModelId={selectedModelId}
        onSelect={setSelectedModelId}
        onToggle={(id, isActive) => toggleModelMutation.mutate({ id, isActive })}
        onDelete={(id) => deleteModelMutation.mutate(id)}
      />
      <AutoTradingRecommendations recommendations={recommendations as AiRecommendation[]} />
      <AutoTradingLearningRecords
        records={filteredLearningRecords}
        isLoading={recordsLoading}
        selectedModelId={selectedModelId}
        visibleCount={learningVisibleCount}
        onVisibleCountChange={setLearningVisibleCount}
        periodDays={learningPeriodDays}
        onPeriodDaysChange={setLearningPeriodDays}
      />
    </div>
  );
}
