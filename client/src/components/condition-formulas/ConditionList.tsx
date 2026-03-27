// ConditionList.tsx — 조건식 목록 카드 (실행/수정/삭제 + 결과 표시)
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Play, Pencil, Trash2, Loader2, List } from "lucide-react";
import type { ConditionFormula } from "@shared/schema";

const MARKET_COLORS: Record<string, string> = {
  KOSPI: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  KOSDAQ: "bg-green-500/20 text-green-300 border-green-500/30",
  KONEX: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  ALL: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

interface Props {
  conditions: ConditionFormula[];
  isLoading: boolean;
  isRunning: boolean;
  isDeleting: boolean;
  activeConditionId?: number;
  onEdit: (f: ConditionFormula) => void;
  onRun: (id: number) => void;
  onDelete: (id: number) => void;
  onShowResults: (f: ConditionFormula) => void;
}

export function ConditionList({ conditions, isLoading, isRunning, isDeleting, activeConditionId, onEdit, onRun, onDelete, onShowResults }: Props) {
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-cyan-500" /></div>;
  return (
    <div className="space-y-4">
      <Card className="glass-card border-cyan-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-glow-cyan">조건식 목록</CardTitle>
            <Badge variant="outline">{conditions.length}개</Badge>
          </div>
          <CardDescription>생성된 조건식을 실행하여 종목을 스크리닝하세요</CardDescription>
        </CardHeader>
        <CardContent>
          {conditions.length === 0 ? (
            <p className="text-center text-muted-foreground py-12" data-testid="text-no-conditions">아직 조건식이 없습니다. 새 조건식을 만들어보세요.</p>
          ) : (
            <div className="space-y-3">
              {conditions.map((formula) => {
                const isActive = formula.id === activeConditionId;
                const hasResults = (formula.matchCount ?? 0) > 0;
                return (
                  <div
                    key={formula.id}
                    className={`flex items-start justify-between p-4 rounded-lg border transition-colors ${isActive ? "border-cyan-500/50 bg-cyan-500/5" : "border-cyan-500/10 hover:border-cyan-500/30"}`}
                    data-testid={`condition-item-${formula.id}`}
                  >
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-glow-cyan">{formula.conditionName}</span>
                        <Badge className={MARKET_COLORS[formula.marketType] || MARKET_COLORS.ALL}>{formula.marketType}</Badge>
                        {formula.matchCount != null && (
                          <button
                            onClick={() => onShowResults(formula)}
                            className="cursor-pointer"
                            title="결과 보기"
                          >
                            <Badge variant={hasResults ? "default" : "secondary"} className={hasResults ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/30" : ""}>
                              {formula.matchCount}종목 매칭
                            </Badge>
                          </button>
                        )}
                      </div>
                      {formula.description && <p className="text-sm text-muted-foreground">{formula.description}</p>}
                      {formula.rawFormula && <p className="text-xs font-mono text-cyan-400/70 truncate">{formula.rawFormula}</p>}
                    </div>
                    <div className="flex gap-1 ml-3 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => onRun(formula.id)} disabled={isRunning} title="스크리닝 실행" data-testid={`button-run-${formula.id}`}>
                        {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 text-cyan-400" />}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => onShowResults(formula)} title="결과 보기" data-testid={`button-results-${formula.id}`}>
                        <List className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => onEdit(formula)} title="수정" data-testid={`button-edit-${formula.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid={`button-delete-${formula.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="glass-card">
                          <AlertDialogHeader>
                            <AlertDialogTitle>조건식 삭제</AlertDialogTitle>
                            <AlertDialogDescription>"{formula.conditionName}"을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(formula.id)} disabled={isDeleting}>삭제</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
