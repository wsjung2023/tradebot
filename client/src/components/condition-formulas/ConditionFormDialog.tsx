// ConditionFormDialog.tsx — 조건식 생성/수정 다이얼로그 (조건명, 시장구분, 수식 입력 폼)
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save } from "lucide-react";
import type { ConditionFormula } from "@shared/schema";

interface FormValues { conditionName: string; description: string; marketType: string; rawFormula: string; }

interface Props {
  open: boolean;
  editing: ConditionFormula | null;
  form: FormValues;
  isPending: boolean;
  onOpenChange: (v: boolean) => void;
  onFormChange: (field: keyof FormValues, value: string) => void;
  onSubmit: () => void;
}

export function ConditionFormDialog({ open, editing, form, isPending, onOpenChange, onFormChange, onSubmit }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-add-condition">
          <Plus className="h-4 w-4" /> 새 조건식
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-glow-cyan">{editing ? "조건식 수정" : "새 조건식 만들기"}</DialogTitle>
          <DialogDescription>종목 스크리닝을 위한 조건식을 {editing ? "수정" : "생성"}합니다</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>조건식 이름</Label>
            <Input placeholder="예: 골든크로스 전략" value={form.conditionName} onChange={(e) => onFormChange("conditionName", e.target.value)} data-testid="input-condition-name" />
          </div>
          <div className="space-y-2">
            <Label>설명</Label>
            <Input placeholder="조건식 설명" value={form.description} onChange={(e) => onFormChange("description", e.target.value)} data-testid="input-condition-description" />
          </div>
          <div className="space-y-2">
            <Label>시장 구분</Label>
            <Select value={form.marketType} onValueChange={(v) => onFormChange("marketType", v)}>
              <SelectTrigger data-testid="select-market-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체</SelectItem>
                <SelectItem value="KOSPI">KOSPI</SelectItem>
                <SelectItem value="KOSDAQ">KOSDAQ</SelectItem>
                <SelectItem value="KONEX">KONEX</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>조건 수식</Label>
            <Textarea placeholder="수식을 입력하세요&#10;예: RSI(14) < 30 AND MA(5) > MA(20)" value={form.rawFormula} onChange={(e) => onFormChange("rawFormula", e.target.value)} rows={5} data-testid="input-condition-formula" className="font-mono text-sm" />
          </div>
          <Button onClick={onSubmit} disabled={isPending} className="w-full" data-testid="button-submit-condition">
            <Save className="h-4 w-4 mr-2" />
            {isPending ? "저장 중..." : editing ? "수정 저장" : "조건식 생성"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
