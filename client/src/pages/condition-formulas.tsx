// condition-formulas.tsx — 종목 스크리닝 조건식 관리 페이지 (생성/수정/실행/삭제)
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ConditionFormDialog } from "@/components/condition-formulas/ConditionFormDialog";
import { ConditionList } from "@/components/condition-formulas/ConditionList";
import type { ConditionFormula } from "@shared/schema";
import { Filter, Zap, X, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface FormValues { conditionName: string; description: string; marketType: string; rawFormula: string; }

const DEFAULT_FORM: FormValues = { conditionName: "", description: "", marketType: "ALL", rawFormula: "" };

interface ScreeningResult {
  id: number;
  conditionId: number;
  stockCode: string;
  stockName: string;
  currentPrice: string | null;
  changeRate: string | null;
  matchScore: number | null;
  passedFilters: boolean;
  metadata: any;
  createdAt: string;
}

export default function ConditionFormulasPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<ConditionFormula | null>(null);
  const [form, setForm] = useState<FormValues>(DEFAULT_FORM);
  const [resultCondition, setResultCondition] = useState<ConditionFormula | null>(null);

  const { data: conditions = [], isLoading } = useQuery<ConditionFormula[]>({ queryKey: ["/api/conditions"] });

  const { data: screeningResults = [], isLoading: isResultsLoading } = useQuery<ScreeningResult[]>({
    queryKey: ["/api/conditions", resultCondition?.id, "results"],
    enabled: !!resultCondition,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/conditions", data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/conditions"] }); handleCloseDialog(); toast({ title: "조건식 생성됨" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "생성 실패", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => (await apiRequest("PUT", `/api/conditions/${id}`, data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/conditions"] }); handleCloseDialog(); toast({ title: "조건식 수정됨" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "수정 실패", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/conditions/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/conditions"] }); setResultCondition(null); toast({ title: "조건식 삭제됨" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "삭제 실패", description: e.message }),
  });

  const runMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/conditions/${id}/run`, {})).json(),
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conditions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conditions", id, "results"] });
      const found = conditions.find((c) => c.id === id);
      if (found) setResultCondition(found);
      const count = data.matchCount ?? 0;
      if (count === 0) {
        toast({ title: "스크리닝 완료", description: "현재 조건에 매칭된 종목이 없습니다." });
      } else {
        toast({ title: "스크리닝 완료", description: `${count}개 종목 매칭` });
      }
    },
    onError: (e: any) => toast({ variant: "destructive", title: "실행 실패", description: e.message }),
  });

  const loadHTSMutation = useMutation({
    mutationFn: async () => (await apiRequest("GET", "/api/conditions/hts-list")).json(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conditions"] });
      toast({ title: "HTS 조건식 불러오기 완료", description: `${data.imported}개 조건식을 가져왔습니다.` });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "불러오기 실패", description: e.message }),
  });

  const handleSubmit = () => {
    if (!form.conditionName.trim()) { toast({ variant: "destructive", title: "조건식 이름을 입력해주세요" }); return; }
    if (editingFormula) { updateMutation.mutate({ id: editingFormula.id, data: form }); }
    else { createMutation.mutate(form); }
  };

  const handleEdit = (formula: ConditionFormula) => {
    setEditingFormula(formula);
    setForm({ conditionName: formula.conditionName, description: formula.description || "", marketType: formula.marketType || "ALL", rawFormula: formula.rawFormula || "" });
    setIsAddDialogOpen(true);
  };

  const handleCloseDialog = () => { setIsAddDialogOpen(false); setEditingFormula(null); setForm(DEFAULT_FORM); };

  const handleShowResults = (formula: ConditionFormula) => {
    setResultCondition(formula);
    queryClient.invalidateQueries({ queryKey: ["/api/conditions", formula.id, "results"] });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Filter className="h-7 w-7 text-cyan-400" />조건식 관리</h1>
          <p className="text-muted-foreground mt-1">종목 스크리닝 조건식을 생성하고 실행하세요</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadHTSMutation.mutate()} disabled={loadHTSMutation.isPending} className="gap-2">
            <Zap className="h-4 w-4" />HTS 조건식 불러오기
          </Button>
          <ConditionFormDialog
            open={isAddDialogOpen} editing={editingFormula} form={form}
            isPending={createMutation.isPending || updateMutation.isPending}
            onOpenChange={(v) => { if (!v) handleCloseDialog(); else setIsAddDialogOpen(true); }}
            onFormChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ConditionList
          conditions={conditions} isLoading={isLoading}
          isRunning={runMutation.isPending} isDeleting={deleteMutation.isPending}
          activeConditionId={resultCondition?.id}
          onEdit={handleEdit}
          onRun={(id) => runMutation.mutate(id)}
          onDelete={(id) => deleteMutation.mutate(id)}
          onShowResults={handleShowResults}
        />

        {resultCondition && (
          <Card className="glass-card border-cyan-500/20">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-glow-cyan text-base truncate">
                  {resultCondition.conditionName} — 스크리닝 결과
                </CardTitle>
                <Button size="icon" variant="ghost" onClick={() => setResultCondition(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isResultsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
                </div>
              ) : screeningResults.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <p className="text-muted-foreground">매칭된 종목이 없습니다.</p>
                  <p className="text-xs text-muted-foreground">조건을 확인하거나 ▶ 버튼으로 다시 실행해 보세요.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-3">총 {screeningResults.length}개 종목 매칭</p>
                  {screeningResults.map((r) => {
                    const rate = parseFloat(r.changeRate ?? "0");
                    const isUp = rate > 0;
                    const isDown = rate < 0;
                    return (
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-cyan-500/10 hover:border-cyan-500/30 transition-colors" data-testid={`result-item-${r.id}`}>
                        <div>
                          <span className="font-medium text-sm">{r.stockName}</span>
                          <span className="text-xs text-muted-foreground ml-2">{r.stockCode}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          {r.currentPrice && (
                            <span className="font-mono">{Number(r.currentPrice).toLocaleString()}원</span>
                          )}
                          {r.changeRate && (
                            <Badge variant={isUp ? "default" : isDown ? "destructive" : "secondary"} className="gap-1 text-xs">
                              {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : null}
                              {isUp ? "+" : ""}{rate.toFixed(2)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
