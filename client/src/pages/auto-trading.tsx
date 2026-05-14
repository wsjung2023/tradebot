// auto-trading.tsx — AI 자동매매 모델 관리 및 매매 신호 페이지
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AutoTradingModelDialog } from "@/components/auto-trading/AutoTradingModelDialog";
import { AutoTradingModelList } from "@/components/auto-trading/AutoTradingModelList";
import { AutoTradingSettings } from "@/components/auto-trading/AutoTradingSettings";
import { AutoTradingRecommendations } from "@/components/auto-trading/AutoTradingRecommendations";
import { AutoTradingLearningRecords } from "@/components/auto-trading/AutoTradingLearningRecords";
import { MarketIssuesManager } from "@/components/auto-trading/MarketIssuesManager";
import type { AiModel, AiRecommendation, KiwoomAccount, LearningRecord } from "@shared/schema";
import { Bot } from "lucide-react";

type ModelType = "momentum" | "value" | "technical" | "custom";
const MODEL_TYPES: ModelType[] = ["momentum", "value", "technical", "custom"];

interface ModelConfig {
  maxPositions?: number;
  stopLossConfig?: { color: "green" | "blue"; percent: number };
  takeProfitPercent?: number;
  accountId?: number | null;
  [key: string]: unknown;
}

function toModelType(v: string): ModelType {
  return MODEL_TYPES.includes(v as ModelType) ? (v as ModelType) : "momentum";
}

function extractConfig(raw: unknown): ModelConfig {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as ModelConfig;
  }
  return {};
}

export default function AutoTrading() {
  const { toast } = useToast();

  // ── 생성 다이얼로그 상태 ──
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [modelName, setModelName] = useState("");
  const [modelType, setModelType] = useState<ModelType>("momentum");
  const [description, setDescription] = useState("");
  const [maxPositions, setMaxPositions] = useState("5");
  const [stopLossColor, setStopLossColor] = useState<"green" | "blue">("green");
  const [stopLossPercent, setStopLossPercent] = useState("5");
  const [takeProfitPercent, setTakeProfitPercent] = useState("10");
  const [createAccountId, setCreateAccountId] = useState("");

  // ── 수정 다이얼로그 상태 ──
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingModelId, setEditingModelId] = useState<number | null>(null);
  const [editModelName, setEditModelName] = useState("");
  const [editModelType, setEditModelType] = useState<ModelType>("momentum");
  const [editDescription, setEditDescription] = useState("");
  const [editMaxPositions, setEditMaxPositions] = useState("5");
  const [editStopLossColor, setEditStopLossColor] = useState<"green" | "blue">("green");
  const [editStopLossPercent, setEditStopLossPercent] = useState("5");
  const [editTakeProfitPercent, setEditTakeProfitPercent] = useState("10");
  const [editAccountId, setEditAccountId] = useState("");

  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [learningVisibleCount, setLearningVisibleCount] = useState(10);
  const [learningPeriodDays, setLearningPeriodDays] = useState(30);

  const { data: models = [], isLoading: modelsLoading } = useQuery<AiModel[]>({ queryKey: ["/api/ai/models"] });
  const { data: accounts = [] } = useQuery<KiwoomAccount[]>({ queryKey: ["/api/accounts"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/models"] });
      resetCreateForm();
      toast({ title: "AI 모델 생성됨" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "생성 실패", description: e.message }),
  });

  const updateModelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) =>
      (await apiRequest("PATCH", `/api/ai/models/${id}`, data)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/models"] });
      setEditDialogOpen(false);
      setEditingModelId(null);
      toast({ title: "모델 수정됨" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "수정 실패", description: e.message }),
  });

  const toggleModelMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      (await apiRequest("PATCH", `/api/ai/models/${id}`, { isActive })).json(),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/models"] });
      toast({
        title: isActive ? "자동매매 활성화됨" : "자동매매 비활성화됨",
        description: isActive
          ? "다음 스캔 사이클부터 이 모델이 작동합니다."
          : "이 모델의 자동매매가 중단됩니다.",
      });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "상태 변경 실패", description: e.message }),
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/ai/models/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/models"] });
      if (selectedModelId) setSelectedModelId(null);
      toast({ title: "모델 삭제됨" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "삭제 실패", description: e.message }),
  });

  const updateModelConfigMutation = useMutation({
    mutationFn: async ({ id, config }: { id: number; config: any }) =>
      (await apiRequest("PATCH", `/api/ai/models/${id}`, { config })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ai/models"] }),
  });

  const resetCreateForm = () => {
    setModelName("");
    setModelType("momentum");
    setDescription("");
    setMaxPositions("5");
    setStopLossColor("green");
    setStopLossPercent("5");
    setTakeProfitPercent("10");
    setCreateAccountId("");
    setCreateDialogOpen(false);
  };

  useEffect(() => {
    if (!createDialogOpen || createAccountId || accounts.length === 0) return;
    const preferred =
      accounts.find((a) => a.isActive && a.accountType === "mock") ??
      accounts.find((a) => a.isActive);
    if (preferred) {
      setCreateAccountId(String(preferred.id));
    }
  }, [createDialogOpen, createAccountId, accounts]);

  const handleCreateModel = () => {
    if (!modelName.trim()) {
      toast({ variant: "destructive", title: "모델 이름을 입력해주세요" });
      return;
    }
    if (!createAccountId) {
      toast({ variant: "destructive", title: "매매 계좌를 선택해주세요" });
      return;
    }

    createModelMutation.mutate({
      modelName,
      modelType,
      description,
      config: {
        maxPositions: parseInt(maxPositions, 10),
        stopLossConfig: { color: stopLossColor, percent: parseFloat(stopLossPercent) },
        takeProfitPercent: parseFloat(takeProfitPercent),
        accountId: parseInt(createAccountId, 10),
      },
    });
  };

  const handleEditClick = (model: AiModel) => {
    const cfg = extractConfig(model.config);
    setEditingModelId(model.id);
    setEditModelName(model.modelName);
    setEditModelType(toModelType(model.modelType));
    setEditDescription(model.description ?? "");
    setEditMaxPositions(String(cfg.maxPositions ?? "5"));
    setEditStopLossColor(cfg.stopLossConfig?.color ?? "green");
    setEditStopLossPercent(String(cfg.stopLossConfig?.percent ?? "5"));
    setEditTakeProfitPercent(String(cfg.takeProfitPercent ?? "10"));
    setEditAccountId(cfg.accountId != null ? String(cfg.accountId) : "");
    setEditDialogOpen(true);
  };

  const handleUpdateModel = () => {
    if (!editingModelId) return;
    if (!editModelName.trim()) {
      toast({ variant: "destructive", title: "모델 이름을 입력해주세요" });
      return;
    }

    const currentModel = models.find((m) => m.id === editingModelId);
    const currentConfig = extractConfig(currentModel?.config);

    updateModelMutation.mutate({
      id: editingModelId,
      data: {
        modelName: editModelName,
        modelType: editModelType,
        description: editDescription,
        config: {
          ...currentConfig,
          maxPositions: parseInt(editMaxPositions, 10),
          stopLossConfig: { color: editStopLossColor, percent: parseFloat(editStopLossPercent) },
          takeProfitPercent: parseFloat(editTakeProfitPercent),
          accountId: editAccountId ? parseInt(editAccountId, 10) : null,
        },
      },
    });
  };

  const selectedModel = models.find((m) => m.id === selectedModelId);

  const handleAccountChange = (accountId: number | null) => {
    if (!selectedModel) return;
    const currentConfig = extractConfig(selectedModel.config);
    updateModelConfigMutation.mutate({
      id: selectedModel.id,
      config: { ...currentConfig, accountId },
    });
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Bot className="h-7 w-7" />AI 자동매매
          </h1>
          <p className="text-muted-foreground mt-1">AI 모델을 생성하고 자동매매 신호를 확인하세요</p>
        </div>
        <AutoTradingModelDialog
          mode="create"
          open={createDialogOpen}
          modelName={modelName}
          modelType={modelType}
          description={description}
          maxPositions={maxPositions}
          stopLossColor={stopLossColor}
          stopLossPercent={stopLossPercent}
          takeProfitPercent={takeProfitPercent}
          selectedAccountId={createAccountId}
          accounts={accounts}
          isPending={createModelMutation.isPending}
          onOpenChange={setCreateDialogOpen}
          onModelNameChange={setModelName}
          onModelTypeChange={setModelType}
          onDescriptionChange={setDescription}
          onMaxPositionsChange={setMaxPositions}
          onStopLossColorChange={setStopLossColor}
          onStopLossChange={setStopLossPercent}
          onTakeProfitChange={setTakeProfitPercent}
          onAccountChange={setCreateAccountId}
          onCreate={handleCreateModel}
        />
      </div>

      {/* 수정 다이얼로그 (별도 인스턴스) */}
      <AutoTradingModelDialog
        mode="edit"
        open={editDialogOpen}
        modelName={editModelName}
        modelType={editModelType}
        description={editDescription}
        maxPositions={editMaxPositions}
        stopLossColor={editStopLossColor}
        stopLossPercent={editStopLossPercent}
        takeProfitPercent={editTakeProfitPercent}
        selectedAccountId={editAccountId}
        accounts={accounts}
        isPending={updateModelMutation.isPending}
        onOpenChange={(v) => {
          setEditDialogOpen(v);
          if (!v) setEditingModelId(null);
        }}
        onModelNameChange={setEditModelName}
        onModelTypeChange={setEditModelType}
        onDescriptionChange={setEditDescription}
        onMaxPositionsChange={setEditMaxPositions}
        onStopLossColorChange={setEditStopLossColor}
        onStopLossChange={setEditStopLossPercent}
        onTakeProfitChange={setEditTakeProfitPercent}
        onAccountChange={setEditAccountId}
        onCreate={() => {
          // edit mode: onUpdate handles submission
        }}
        onUpdate={handleUpdateModel}
      />

      <AutoTradingModelList
        models={models}
        isLoading={modelsLoading}
        isToggling={toggleModelMutation.isPending}
        isDeleting={deleteModelMutation.isPending}
        selectedModelId={selectedModelId}
        onSelect={setSelectedModelId}
        onToggle={(id, isActive) => toggleModelMutation.mutate({ id, isActive })}
        onEdit={handleEditClick}
        onDelete={(id) => deleteModelMutation.mutate(id)}
      />

      {selectedModelId && selectedModel && (
        <AutoTradingSettings
          modelId={selectedModelId}
          modelConfig={selectedModel.config}
          onAccountChange={handleAccountChange}
        />
      )}

      <MarketIssuesManager />
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
