// ChartFormulaFormDialog.tsx — 차트 수식 생성/수정 다이얼로그 (기본설정 + 수식&스타일 탭)
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Save } from "lucide-react";
import type { ChartFormula } from "@shared/schema";

interface FormData { formulaName: string; description: string; formulaType: string; rawFormula: string; color: string; lineStyle: string; lineWidth: string; }

interface Props {
  open: boolean;
  editing: ChartFormula | null;
  formData: FormData;
  isPending: boolean;
  onOpenChange: (v: boolean) => void;
  onFormChange: (field: keyof FormData, value: string) => void;
  onSubmit: () => void;
}

export function ChartFormulaFormDialog({ open, editing, formData, isPending, onOpenChange, onFormChange, onSubmit }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-add-formula"><Plus className="h-4 w-4" />새 수식</Button>
      </DialogTrigger>
      <DialogContent className="glass-card max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-glow-purple">{editing ? "수식 수정" : "새 차트 수식 만들기"}</DialogTitle>
          <DialogDescription>차트에 표시할 커스텀 지표 수식을 {editing ? "수정" : "생성"}합니다</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic" data-testid="tab-trigger-basic">기본 설정</TabsTrigger>
            <TabsTrigger value="formula" data-testid="tab-trigger-formula">수식 & 스타일</TabsTrigger>
          </TabsList>
          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <Label>수식 이름</Label>
              <Input placeholder="예: 골든크로스 시그널" value={formData.formulaName} onChange={(e) => onFormChange("formulaName", e.target.value)} data-testid="input-formula-name" />
            </div>
            <div className="space-y-2">
              <Label>설명</Label>
              <Input placeholder="수식 설명" value={formData.description} onChange={(e) => onFormChange("description", e.target.value)} data-testid="input-formula-description" />
            </div>
            <div className="space-y-2">
              <Label>수식 유형</Label>
              <Select value={formData.formulaType} onValueChange={(v) => onFormChange("formulaType", v)}>
                <SelectTrigger data-testid="select-formula-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indicator">보조지표</SelectItem>
                  <SelectItem value="signal">매매신호</SelectItem>
                  <SelectItem value="oscillator">오실레이터</SelectItem>
                  <SelectItem value="custom">커스텀</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
          <TabsContent value="formula" className="space-y-4">
            <div className="space-y-2">
              <Label>수식 코드</Label>
              <Textarea placeholder="수식을 입력하세요&#10;예: MA(close, 5) - MA(close, 20)" value={formData.rawFormula} onChange={(e) => onFormChange("rawFormula", e.target.value)} rows={6} data-testid="input-raw-formula" className="font-mono text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>색상</Label>
                <Input type="color" value={formData.color} onChange={(e) => onFormChange("color", e.target.value)} data-testid="input-formula-color" />
              </div>
              <div className="space-y-2">
                <Label>선 스타일</Label>
                <Select value={formData.lineStyle} onValueChange={(v) => onFormChange("lineStyle", v)}>
                  <SelectTrigger data-testid="select-line-style"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">실선</SelectItem>
                    <SelectItem value="dashed">점선</SelectItem>
                    <SelectItem value="dotted">점</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>선 두께</Label>
                <Select value={formData.lineWidth} onValueChange={(v) => onFormChange("lineWidth", v)}>
                  <SelectTrigger data-testid="select-line-width"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">얇게</SelectItem>
                    <SelectItem value="2">보통</SelectItem>
                    <SelectItem value="3">두껍게</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <Button onClick={onSubmit} disabled={isPending} className="w-full mt-2" data-testid="button-submit-formula">
          <Save className="h-4 w-4 mr-2" />{isPending ? "저장 중..." : editing ? "수정 저장" : "수식 생성"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
