import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, Edit2, Play, Code2, TrendingUp, AlertCircle } from "lucide-react";

interface ChartFormula {
  id: number;
  userId: string;
  formulaName: string;
  formulaType: string;
  description: string | null;
  formulaAst: any;
  rawFormula: string;
  outputType: string;
  color: string | null;
  lineWeight: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SignalLine {
  color: string;
  name: string;
  values: Array<{ date: string; value: number }>;
}

export default function ChartFormulaEditor() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<ChartFormula | null>(null);
  const [evaluateDialogOpen, setEvaluateDialogOpen] = useState(false);
  const [evaluatingFormulaId, setEvaluatingFormulaId] = useState<number | null>(null);
  const [evaluateStockCode, setEvaluateStockCode] = useState("");
  const [evaluatePeriod, setEvaluatePeriod] = useState("D");
  const [evaluationResult, setEvaluationResult] = useState<{
    stockCode: string;
    period: string;
    formulaName: string;
    signalLine: SignalLine;
  } | null>(null);

  const [formData, setFormData] = useState({
    formulaName: "",
    formulaType: "indicator",
    description: "",
    rawFormula: "",
    outputType: "line",
    color: "green",
    lineWeight: 1,
  });

  const { data: formulas = [], isLoading } = useQuery<ChartFormula[]>({
    queryKey: ['/api/chart-formulas'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('POST', '/api/chart-formulas', data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "차트 수식 생성 완료",
        description: "새로운 차트 수식이 추가되었습니다",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/chart-formulas'] });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "생성 실패",
        description: error.details || error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      const res = await apiRequest('PUT', `/api/chart-formulas/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "차트 수식 수정 완료",
        description: "차트 수식이 업데이트되었습니다",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/chart-formulas'] });
      setEditingFormula(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "수정 실패",
        description: error.details || error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/chart-formulas/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "차트 수식 삭제 완료",
        description: "차트 수식이 삭제되었습니다",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/chart-formulas'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "삭제 실패",
        description: error.message,
      });
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: async ({ id, stockCode, period }: { id: number; stockCode: string; period: string }) => {
      const res = await apiRequest('POST', `/api/chart-formulas/${id}/evaluate`, { stockCode, period });
      return res.json();
    },
    onSuccess: (data) => {
      setEvaluationResult(data);
      toast({
        title: "평가 완료",
        description: `${data.formulaName} 수식이 평가되었습니다`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "평가 실패",
        description: error.message,
      });
    },
  });

  const resetForm = () => {
    setFormData({
      formulaName: "",
      formulaType: "indicator",
      description: "",
      rawFormula: "",
      outputType: "line",
      color: "green",
      lineWeight: 1,
    });
  };

  const handleSubmit = () => {
    if (!formData.formulaName.trim() || !formData.rawFormula.trim()) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "수식 이름과 수식을 입력해주세요",
      });
      return;
    }

    if (editingFormula) {
      updateMutation.mutate({ id: editingFormula.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (formula: ChartFormula) => {
    setEditingFormula(formula);
    setFormData({
      formulaName: formula.formulaName,
      formulaType: formula.formulaType,
      description: formula.description || "",
      rawFormula: formula.rawFormula,
      outputType: formula.outputType,
      color: formula.color || "green",
      lineWeight: formula.lineWeight,
    });
    setIsAddDialogOpen(true);
  };

  const handleEvaluate = (formulaId: number) => {
    setEvaluatingFormulaId(formulaId);
    setEvaluateStockCode("");
    setEvaluatePeriod("D");
    setEvaluationResult(null);
    setEvaluateDialogOpen(true);
  };

  const runEvaluation = () => {
    if (!evaluatingFormulaId || !evaluateStockCode.trim()) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "종목 코드를 입력해주세요",
      });
      return;
    }
    evaluateMutation.mutate({
      id: evaluatingFormulaId,
      stockCode: evaluateStockCode,
      period: evaluatePeriod,
    });
  };

  const getColorBadge = (color: string | null) => {
    const colorMap: Record<string, string> = {
      red: "bg-red-500/20 text-red-400 border-red-500/30",
      orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      green: "bg-green-500/20 text-green-400 border-green-500/30",
      blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      indigo: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
      violet: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    };
    return colorMap[color || "green"] || colorMap.green;
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-background via-background to-purple-950/10 animate-gradient-flow" />
      
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gradient-cyber" data-testid="text-formula-title">
              차트 수식 에디터
            </h1>
            <p className="text-muted-foreground">7색 시그널 라인과 기술적 지표를 생성합니다</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              setEditingFormula(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-formula">
                <Plus className="mr-2 h-4 w-4" />
                새 수식
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{editingFormula ? "수식 수정" : "새 수식 추가"}</DialogTitle>
                <DialogDescription>
                  차트 수식을 생성하고 시그널 라인을 설정합니다
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="basic" data-testid="tab-trigger-basic">기본 정보</TabsTrigger>
                  <TabsTrigger value="formula" data-testid="tab-trigger-formula">수식 & 스타일</TabsTrigger>
                </TabsList>
                <TabsContent value="basic" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="formulaName">수식 이름 *</Label>
                    <Input
                      id="formulaName"
                      placeholder="예: 50% 되돌림 라인"
                      value={formData.formulaName}
                      onChange={(e) => setFormData({ ...formData, formulaName: e.target.value })}
                      data-testid="input-formula-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="formulaType">수식 유형</Label>
                    <Select
                      value={formData.formulaType}
                      onValueChange={(value) => setFormData({ ...formData, formulaType: value })}
                    >
                      <SelectTrigger data-testid="select-formula-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indicator" data-testid="option-formula-type-indicator">지표 (Indicator)</SelectItem>
                        <SelectItem value="signal" data-testid="option-formula-type-signal">시그널 (Signal)</SelectItem>
                        <SelectItem value="condition" data-testid="option-formula-type-condition">조건 (Condition)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">설명</Label>
                    <Textarea
                      id="description"
                      placeholder="수식 설명"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      data-testid="input-description"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="formula" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="rawFormula">수식 코드 *</Label>
                    <Textarea
                      id="rawFormula"
                      placeholder="예: avg(close, 20)"
                      value={formData.rawFormula}
                      onChange={(e) => setFormData({ ...formData, rawFormula: e.target.value })}
                      className="font-mono text-sm"
                      rows={6}
                      data-testid="input-raw-formula"
                    />
                    <p className="text-xs text-muted-foreground">
                      함수: avg, sum, highest, lowest, h, l, c, o, v, valuewhen
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="outputType">출력 형식</Label>
                      <Select
                        value={formData.outputType}
                        onValueChange={(value) => setFormData({ ...formData, outputType: value })}
                      >
                        <SelectTrigger data-testid="select-output-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="line" data-testid="option-output-type-line">라인 (Line)</SelectItem>
                          <SelectItem value="bar" data-testid="option-output-type-bar">바 (Bar)</SelectItem>
                          <SelectItem value="signal" data-testid="option-output-type-signal">시그널 (Signal)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="color">색상</Label>
                      <Select
                        value={formData.color}
                        onValueChange={(value) => setFormData({ ...formData, color: value })}
                      >
                        <SelectTrigger data-testid="select-color">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="red" data-testid="option-color-red">빨강 (Red)</SelectItem>
                          <SelectItem value="orange" data-testid="option-color-orange">주황 (Orange)</SelectItem>
                          <SelectItem value="yellow" data-testid="option-color-yellow">노랑 (Yellow)</SelectItem>
                          <SelectItem value="green" data-testid="option-color-green">초록 (Green)</SelectItem>
                          <SelectItem value="blue" data-testid="option-color-blue">파랑 (Blue)</SelectItem>
                          <SelectItem value="indigo" data-testid="option-color-indigo">남색 (Indigo)</SelectItem>
                          <SelectItem value="violet" data-testid="option-color-violet">보라 (Violet)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lineWeight">선 굵기</Label>
                      <Input
                        id="lineWeight"
                        type="number"
                        min="1"
                        max="5"
                        value={formData.lineWeight}
                        onChange={(e) => setFormData({ ...formData, lineWeight: parseInt(e.target.value) || 1 })}
                        data-testid="input-line-weight"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingFormula(null);
                    resetForm();
                  }}
                  data-testid="button-cancel"
                >
                  취소
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-formula"
                >
                  {editingFormula ? "수정" : "추가"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12">로딩 중...</div>
        ) : formulas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Code2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-no-formulas">등록된 차트 수식이 없습니다</p>
              <p className="text-sm text-muted-foreground mt-1">새 수식을 추가하여 시작하세요</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {formulas.map((formula) => (
              <Card key={formula.id} className="glass-card hover-elevate" data-testid={`card-formula-${formula.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg" data-testid={`text-formula-name-${formula.id}`}>
                          {formula.formulaName}
                        </CardTitle>
                        <Badge variant="outline" className={getColorBadge(formula.color)} data-testid={`badge-color-${formula.id}`}>
                          {formula.color}
                        </Badge>
                      </div>
                      {formula.description && (
                        <CardDescription className="text-sm">{formula.description}</CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/50 rounded-md p-3 font-mono text-xs overflow-x-auto" data-testid={`text-raw-formula-${formula.id}`}>
                    {formula.rawFormula}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">유형</p>
                      <p className="font-medium capitalize" data-testid={`text-type-${formula.id}`}>{formula.formulaType}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">출력</p>
                      <p className="font-medium capitalize" data-testid={`text-output-${formula.id}`}>{formula.outputType}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEvaluate(formula.id)}
                      data-testid={`button-evaluate-${formula.id}`}
                    >
                      <Play className="mr-1 h-3 w-3" />
                      평가
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(formula)}
                      data-testid={`button-edit-${formula.id}`}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`"${formula.formulaName}" 수식을 삭제하시겠습니까?`)) {
                          deleteMutation.mutate(formula.id);
                        }
                      }}
                      data-testid={`button-delete-${formula.id}`}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Evaluation Dialog */}
        <Dialog open={evaluateDialogOpen} onOpenChange={setEvaluateDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>차트 수식 평가</DialogTitle>
              <DialogDescription>
                종목 코드와 기간을 입력하여 수식을 평가합니다
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stockCode">종목 코드 *</Label>
                  <Input
                    id="stockCode"
                    placeholder="예: 005930 (삼성전자)"
                    value={evaluateStockCode}
                    onChange={(e) => setEvaluateStockCode(e.target.value)}
                    data-testid="input-stock-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="period">기간</Label>
                  <Select value={evaluatePeriod} onValueChange={setEvaluatePeriod}>
                    <SelectTrigger data-testid="select-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="D" data-testid="option-period-day">일봉</SelectItem>
                      <SelectItem value="W" data-testid="option-period-week">주봉</SelectItem>
                      <SelectItem value="M" data-testid="option-period-month">월봉</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {evaluationResult && (
                <Card className="glass-card border-purple-500/20">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-purple-400" />
                      <CardTitle className="text-glow-purple">평가 결과</CardTitle>
                    </div>
                    <CardDescription>
                      {evaluationResult.stockCode} - {evaluationResult.formulaName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">데이터 포인트</span>
                        <span className="font-medium" data-testid="text-data-points">{evaluationResult.signalLine.values.length}개</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">시그널 색상</span>
                        <Badge variant="outline" className={getColorBadge(evaluationResult.signalLine.color)} data-testid="badge-signal-color">
                          {evaluationResult.signalLine.color}
                        </Badge>
                      </div>
                      <div className="bg-muted/50 rounded-md p-3 max-h-48 overflow-y-auto" data-testid="container-signal-values">
                        <p className="text-xs font-mono text-muted-foreground mb-2">최근 5개 값:</p>
                        {evaluationResult.signalLine.values.slice(-5).reverse().map((point, idx) => (
                          <div key={idx} className="text-xs font-mono" data-testid={`text-signal-value-${idx}`}>
                            {point.date}: {point.value.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEvaluateDialogOpen(false);
                  setEvaluationResult(null);
                }}
                data-testid="button-close-evaluation"
              >
                닫기
              </Button>
              <Button
                onClick={runEvaluation}
                disabled={evaluateMutation.isPending}
                data-testid="button-run-evaluation"
              >
                <Play className="mr-2 h-4 w-4" />
                {evaluateMutation.isPending ? "평가 중..." : "평가 실행"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
