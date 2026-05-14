// chart-formula-editor.tsx — 차트 커스텀 수식 에디터 페이지 (생성/수정/평가/삭제)
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChartFormulaFormDialog } from "@/components/chart-formula/ChartFormulaFormDialog";
import { ChartFormulaList } from "@/components/chart-formula/ChartFormulaList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import type { ChartFormula } from "@shared/schema";

const DEFAULT_FORM = { formulaName: "", description: "", formulaType: "indicator", rawFormula: "", color: "#8b5cf6", lineStyle: "solid", lineWidth: "2" };

export default function ChartFormulaEditor() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<ChartFormula | null>(null);
  const [evalDialogOpen, setEvalDialogOpen] = useState(false);
  const [evaluatingFormulaId, setEvaluatingFormulaId] = useState<number | null>(null);
  const [evalStockCode, setEvalStockCode] = useState("");
  const [evalPeriod, setEvalPeriod] = useState("D");
  const [evalResult, setEvalResult] = useState<any>(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);

  const { data: formulas = [], isLoading } = useQuery<ChartFormula[]>({ queryKey: ["/api/chart-formulas"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/chart-formulas", data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/chart-formulas"] }); handleCloseDialog(); toast({ title: "수식 생성됨" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "생성 실패", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => (await apiRequest("PUT", `/api/chart-formulas/${id}`, data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/chart-formulas"] }); handleCloseDialog(); toast({ title: "수식 수정됨" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "수정 실패", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/chart-formulas/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/chart-formulas"] }); toast({ title: "수식 삭제됨" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "삭제 실패", description: e.message }),
  });

  const evaluateMutation = useMutation({
    mutationFn: async ({ id, stockCode, period }: { id: number; stockCode: string; period: string }) =>
      (await apiRequest("POST", `/api/chart-formulas/${id}/evaluate`, { stockCode, period })).json(),
    onSuccess: (data) => { setEvalResult(data); toast({ title: "평가 완료" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "평가 실패", description: e.message }),
  });

  const handleSubmit = () => {
    if (!formData.formulaName.trim()) { toast({ variant: "destructive", title: "수식 이름을 입력해주세요" }); return; }
    if (editingFormula) { updateMutation.mutate({ id: editingFormula.id, data: formData }); }
    else { createMutation.mutate(formData); }
  };

  const handleEdit = (formula: ChartFormula) => {
    setEditingFormula(formula);
    setFormData({ formulaName: formula.formulaName, description: formula.description || "", formulaType: formula.formulaType || "indicator", rawFormula: formula.rawFormula || "", color: formula.color || "#8b5cf6", lineStyle: (formula as any).lineStyle || "solid", lineWidth: String((formula as any).lineWidth || "2") });
    setIsAddDialogOpen(true);
  };

  const handleCloseDialog = () => { setIsAddDialogOpen(false); setEditingFormula(null); setFormData(DEFAULT_FORM); };

  const handleEvaluate = () => {
    if (!evalStockCode || !evaluatingFormulaId) { toast({ variant: "destructive", title: "종목 코드를 입력해주세요" }); return; }
    evaluateMutation.mutate({ id: evaluatingFormulaId, stockCode: evalStockCode, period: evalPeriod });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><TrendingUp className="h-7 w-7 text-purple-400" />차트 수식 에디터</h1>
          <p className="text-muted-foreground mt-1">커스텀 차트 지표 수식을 만들고 관리하세요</p>
        </div>
        <ChartFormulaFormDialog
          open={isAddDialogOpen} editing={editingFormula} formData={formData}
          isPending={createMutation.isPending || updateMutation.isPending}
          onOpenChange={(v) => { if (!v) handleCloseDialog(); else setIsAddDialogOpen(true); }}
          onFormChange={(field, value) => setFormData((prev) => ({ ...prev, [field]: value }))}
          onSubmit={handleSubmit}
        />
      </div>

      <ChartFormulaList
        formulas={formulas} isLoading={isLoading} isDeleting={deleteMutation.isPending}
        evalDialogOpen={evalDialogOpen} evaluatingFormulaId={evaluatingFormulaId}
        evalStockCode={evalStockCode} evalPeriod={evalPeriod} evalResult={evalResult}
        isEvaluating={evaluateMutation.isPending}
        onEdit={handleEdit} onDelete={(id) => deleteMutation.mutate(id)}
        onOpenEvalDialog={(id) => { setEvaluatingFormulaId(id); setEvalResult(null); setEvalDialogOpen(true); }}
        onCloseEvalDialog={() => { setEvalDialogOpen(false); setEvaluatingFormulaId(null); }}
        onEvalStockCodeChange={setEvalStockCode} onEvalPeriodChange={setEvalPeriod}
        onEvaluate={handleEvaluate}
      />

      <Card className="glass-card border-purple-500/20">
        <CardHeader><CardTitle className="text-glow-purple">💡 수식 작성 팁</CardTitle><CardDescription>차트 수식 작성 가이드</CardDescription></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <code className="text-purple-300">MA(close, 5)</code> — 5일 이동평균</p>
          <p>• <code className="text-purple-300">RSI(14)</code> — 14일 RSI 지표</p>
          <p>• <code className="text-purple-300">MACD(12, 26, 9)</code> — MACD 지표</p>
          <p>• 수식 평가 버튼으로 실제 차트 데이터에 적용해볼 수 있습니다</p>
        </CardContent>
      </Card>
    </div>
  );
}
