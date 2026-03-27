// condition-formulas.tsx — 종목 스크리닝 조건식 관리 페이지 (생성/수정/실행/삭제)
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ConditionFormDialog } from "@/components/condition-formulas/ConditionFormDialog";
import { ConditionList } from "@/components/condition-formulas/ConditionList";
import type { ConditionFormula } from "@shared/schema";
import { Filter, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FormValues { conditionName: string; description: string; marketType: string; rawFormula: string; }

const DEFAULT_FORM: FormValues = { conditionName: "", description: "", marketType: "ALL", rawFormula: "" };

export default function ConditionFormulasPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<ConditionFormula | null>(null);
  const [form, setForm] = useState<FormValues>(DEFAULT_FORM);

  const { data: conditions = [], isLoading } = useQuery<ConditionFormula[]>({ queryKey: ["/api/conditions"] });

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/conditions"] }); toast({ title: "조건식 삭제됨" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "삭제 실패", description: e.message }),
  });

  const runMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/conditions/${id}/run`, {})).json(),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["/api/conditions"] }); toast({ title: "스크리닝 완료", description: `${data.matchCount}개 종목 매칭` }); },
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
      <ConditionList
        conditions={conditions} isLoading={isLoading}
        isRunning={runMutation.isPending} isDeleting={deleteMutation.isPending}
        onEdit={handleEdit} onRun={(id) => runMutation.mutate(id)} onDelete={(id) => deleteMutation.mutate(id)}
      />
    </div>
  );
}
