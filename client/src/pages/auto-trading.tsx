import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bot, TrendingUp, TrendingDown, Minus, Settings, Activity, Trash2, Plus } from "lucide-react";

interface AiModel {
  id: number;
  userId: string;
  modelName: string;
  modelType: 'momentum' | 'value' | 'technical' | 'custom';
  description?: string;
  config: any;
  isActive: boolean;
  performance?: any;
  totalTrades: number;
  winRate?: string;
  totalReturn?: string;
  createdAt: string;
  updatedAt: string;
}

interface AiRecommendation {
  id: number;
  modelId: number;
  stockCode: string;
  stockName: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: string;
  targetPrice?: string;
  reasoning?: string;
  indicators?: any;
  isExecuted: boolean;
  createdAt: string;
  expiresAt?: string;
}

export default function AutoTrading() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  
  // Form state for new model
  const [modelName, setModelName] = useState("");
  const [modelType, setModelType] = useState<'momentum' | 'value' | 'technical' | 'custom'>('momentum');
  const [description, setDescription] = useState("");
  const [maxPositions, setMaxPositions] = useState("5");
  const [stopLossPercent, setStopLossPercent] = useState("5");
  const [takeProfitPercent, setTakeProfitPercent] = useState("10");

  // Fetch AI models
  const { data: models, isLoading: modelsLoading } = useQuery<AiModel[]>({
    queryKey: ['/api/ai/models'],
  });

  // Fetch recommendations for selected model
  const { data: recommendations } = useQuery<AiRecommendation[]>({
    queryKey: ['/api/ai/models', selectedModelId, 'recommendations'],
    enabled: !!selectedModelId,
  });

  // Create model mutation
  const createModelMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/ai/models', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/models'] });
      setCreateDialogOpen(false);
      resetForm();
      toast({
        title: "모델 생성 완료",
        description: "AI 매매 모델이 성공적으로 생성되었습니다",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "생성 실패",
        description: error.message || "모델 생성 중 오류가 발생했습니다",
      });
    },
  });

  // Toggle model active status
  const toggleModelMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return await apiRequest('PATCH', `/api/ai/models/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/models'] });
      toast({
        title: "상태 변경",
        description: "모델 상태가 업데이트되었습니다",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "상태 변경 실패",
        description: error.message || "상태 변경 중 오류가 발생했습니다",
      });
    },
  });

  // Delete model mutation
  const deleteModelMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/ai/models/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/models'] });
      toast({
        title: "모델 삭제",
        description: "AI 매매 모델이 삭제되었습니다",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "삭제 실패",
        description: error.message || "모델 삭제 중 오류가 발생했습니다",
      });
    },
  });

  const resetForm = () => {
    setModelName("");
    setModelType('momentum');
    setDescription("");
    setMaxPositions("5");
    setStopLossPercent("5");
    setTakeProfitPercent("10");
  };

  const handleCreateModel = () => {
    if (!modelName) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "모델 이름을 입력해주세요",
      });
      return;
    }

    const config = {
      maxPositions: parseInt(maxPositions),
      stopLossPercent: parseFloat(stopLossPercent),
      takeProfitPercent: parseFloat(takeProfitPercent),
    };

    createModelMutation.mutate({
      modelName,
      modelType,
      description,
      config,
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'buy':
        return <TrendingUp className="h-4 w-4" />;
      case 'sell':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionVariant = (action: string): "default" | "destructive" | "secondary" => {
    switch (action) {
      case 'sell':
        return 'destructive';
      case 'buy':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getModelTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      momentum: '모멘텀',
      value: '가치투자',
      technical: '기술적분석',
      custom: '커스텀',
    };
    return labels[type] || type;
  };

  if (modelsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-auto-trading-title">자동매매</h1>
          <p className="text-muted-foreground">AI 기반 자동매매 모델 관리</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-model">
              <Plus className="mr-2 h-4 w-4" />
              새 모델 생성
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>AI 매매 모델 생성</DialogTitle>
              <DialogDescription>
                새로운 자동매매 모델을 설정합니다
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modelName">모델 이름</Label>
                <Input
                  id="modelName"
                  placeholder="예: 삼성전자 모멘텀 전략"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  data-testid="input-model-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modelType">전략 유형</Label>
                <Select value={modelType} onValueChange={(v: any) => setModelType(v)}>
                  <SelectTrigger data-testid="select-model-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="momentum">모멘텀</SelectItem>
                    <SelectItem value="value">가치투자</SelectItem>
                    <SelectItem value="technical">기술적분석</SelectItem>
                    <SelectItem value="custom">커스텀</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">설명 (선택)</Label>
                <Textarea
                  id="description"
                  placeholder="모델에 대한 설명을 입력하세요"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="input-description"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxPositions">최대 포지션</Label>
                  <Input
                    id="maxPositions"
                    type="number"
                    value={maxPositions}
                    onChange={(e) => setMaxPositions(e.target.value)}
                    data-testid="input-max-positions"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stopLoss">손절 (%)</Label>
                  <Input
                    id="stopLoss"
                    type="number"
                    step="0.1"
                    value={stopLossPercent}
                    onChange={(e) => setStopLossPercent(e.target.value)}
                    data-testid="input-stop-loss"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="takeProfit">익절 (%)</Label>
                  <Input
                    id="takeProfit"
                    type="number"
                    step="0.1"
                    value={takeProfitPercent}
                    onChange={(e) => setTakeProfitPercent(e.target.value)}
                    data-testid="input-take-profit"
                  />
                </div>
              </div>
              <Button
                onClick={handleCreateModel}
                disabled={createModelMutation.isPending}
                className="w-full"
                data-testid="button-submit-model"
              >
                {createModelMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  "모델 생성"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!models || models.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">AI 매매 모델이 없습니다</p>
            <p className="text-sm text-muted-foreground mb-4">새 모델을 생성하여 자동매매를 시작하세요</p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-model">
              <Plus className="mr-2 h-4 w-4" />
              첫 모델 생성
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {models.map((model) => (
            <Card key={model.id} data-testid={`card-model-${model.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{model.modelName}</CardTitle>
                      <Badge variant="secondary">{getModelTypeLabel(model.modelType)}</Badge>
                    </div>
                    {model.description && (
                      <CardDescription>{model.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={model.isActive}
                      onCheckedChange={(checked) => {
                        toggleModelMutation.mutate({ id: model.id, isActive: checked });
                      }}
                      data-testid={`switch-model-${model.id}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteModelMutation.mutate(model.id)}
                      data-testid={`button-delete-${model.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-md border bg-card p-4">
                    <p className="text-xs text-muted-foreground">총 거래</p>
                    <p className="text-lg font-bold">{model.totalTrades}</p>
                  </div>
                  <div className="rounded-md border bg-card p-4">
                    <p className="text-xs text-muted-foreground">승률</p>
                    <p className="text-lg font-bold">
                      {model.winRate ? `${parseFloat(model.winRate).toFixed(1)}%` : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-md border bg-card p-4">
                    <p className="text-xs text-muted-foreground">수익률</p>
                    <p className="text-lg font-bold">
                      {model.totalReturn ? `${parseFloat(model.totalReturn).toFixed(2)}%` : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelectedModelId(model.id)}
                    data-testid={`button-view-recommendations-${model.id}`}
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    매매 신호 보기
                  </Button>
                  <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedModelId && (
        <Card>
          <CardHeader>
            <CardTitle>매매 신호</CardTitle>
            <CardDescription>
              {models?.find(m => m.id === selectedModelId)?.modelName} - AI 추천 종목
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!recommendations || recommendations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">매매 신호가 없습니다</p>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <div key={rec.id} className="rounded-md border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{rec.stockName}</p>
                          <span className="text-xs text-muted-foreground">({rec.stockCode})</span>
                          <Badge variant={getActionVariant(rec.action)}>
                            {rec.action === 'buy' ? '매수' : rec.action === 'sell' ? '매도' : '보유'}
                          </Badge>
                          <Badge variant="secondary">{parseFloat(rec.confidence).toFixed(0)}%</Badge>
                        </div>
                        {rec.reasoning && (
                          <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
                        )}
                        {rec.targetPrice && (
                          <p className="text-sm mt-1">
                            목표가: <span className="font-medium">₩{parseFloat(rec.targetPrice).toLocaleString()}</span>
                          </p>
                        )}
                      </div>
                      {getActionIcon(rec.action)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
