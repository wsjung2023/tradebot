// ChartFormulaList.tsx — 차트 수식 목록 카드 (평가/수정/삭제 + 결과 표시)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Pencil, Trash2, TrendingUp } from "lucide-react";
import type { ChartFormula } from "@shared/schema";

interface EvalResult { stockCode: string; formulaName: string; signalLine: { color: string; name: string; values: any[] }; }

interface Props {
  formulas: ChartFormula[];
  isLoading: boolean;
  isDeleting: boolean;
  evalDialogOpen: boolean;
  evaluatingFormulaId: number | null;
  evalStockCode: string;
  evalPeriod: string;
  evalResult: EvalResult | null;
  isEvaluating: boolean;
  onEdit: (f: ChartFormula) => void;
  onDelete: (id: number) => void;
  onOpenEvalDialog: (id: number) => void;
  onCloseEvalDialog: () => void;
  onEvalStockCodeChange: (v: string) => void;
  onEvalPeriodChange: (v: string) => void;
  onEvaluate: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  indicator: "bg-blue-500/20 text-blue-300",
  signal: "bg-green-500/20 text-green-300",
  oscillator: "bg-yellow-500/20 text-yellow-300",
  custom: "bg-purple-500/20 text-purple-300",
};

export function ChartFormulaList({ formulas, isLoading, isDeleting, evalDialogOpen, evalStockCode, evalPeriod, evalResult, isEvaluating, onEdit, onDelete, onOpenEvalDialog, onCloseEvalDialog, onEvalStockCodeChange, onEvalPeriodChange, onEvaluate }: Props) {
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-purple-500" /></div>;
  return (
    <>
      {formulas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground" data-testid="text-no-formulas">아직 차트 수식이 없습니다. 새 수식을 만들어보세요.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {formulas.map((formula) => (
            <Card key={formula.id} className="glass-card hover-elevate" data-testid={`card-formula-${formula.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg" data-testid={`text-formula-name-${formula.id}`}>{formula.formulaName}</CardTitle>
                      <Badge className={TYPE_COLORS[formula.formulaType] || TYPE_COLORS.custom}>{formula.formulaType}</Badge>
                      {formula.color && <span className="inline-block w-4 h-4 rounded-full border" style={{ backgroundColor: formula.color }} />}
                    </div>
                    <CardDescription className="text-sm mt-1">{formula.description}</CardDescription>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => onOpenEvalDialog(formula.id)} title="평가" data-testid={`button-evaluate-${formula.id}`}><Play className="h-4 w-4 text-green-400" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onEdit(formula)} title="수정" data-testid={`button-edit-formula-${formula.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(formula.id)} disabled={isDeleting} title="삭제" data-testid={`button-delete-formula-${formula.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardHeader>
              {formula.rawFormula && (
                <CardContent>
                  <p className="text-xs font-mono text-purple-400/70 bg-black/20 p-2 rounded truncate">{formula.rawFormula}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={evalDialogOpen} onOpenChange={(v) => !v && onCloseEvalDialog()}>
        <DialogContent className="glass-card max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-green-400" />수식 평가 (백테스트)</DialogTitle>
            <DialogDescription>종목 코드와 기간을 입력해 수식을 평가합니다</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>종목 코드</Label>
              <Input placeholder="예: 005930" value={evalStockCode} onChange={(e) => onEvalStockCodeChange(e.target.value)} data-testid="input-evaluate-stock-code" />
            </div>
            <div className="space-y-2">
              <Label>기간</Label>
              <Select value={evalPeriod} onValueChange={onEvalPeriodChange}>
                <SelectTrigger data-testid="select-evaluate-period"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="D">일봉</SelectItem>
                  <SelectItem value="W">주봉</SelectItem>
                  <SelectItem value="M">월봉</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={onEvaluate} disabled={isEvaluating} className="w-full" data-testid="button-run-evaluate">
              {isEvaluating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />평가 중...</> : "수식 평가 실행"}
            </Button>
            {evalResult && (
              <div className="mt-4 p-4 rounded-lg border bg-card space-y-2">
                <p className="font-medium text-sm">{evalResult.formulaName} — {evalResult.stockCode}</p>
                <p className="text-xs text-muted-foreground">데이터 포인트: {evalResult.signalLine?.values?.length ?? 0}개</p>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: evalResult.signalLine?.color || "#8b5cf6" }} />
                  <span className="text-xs">{evalResult.signalLine?.name}</span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
