// AutoTradingModelDialog.tsx — AI 자동매매 모델 생성 다이얼로그 (모델명/유형/전략 설정)
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save } from "lucide-react";

interface Props {
  open: boolean;
  modelName: string; modelType: string; description: string;
  maxPositions: string; stopLossPercent: string; takeProfitPercent: string;
  isPending: boolean;
  onOpenChange: (v: boolean) => void;
  onModelNameChange: (v: string) => void;
  onModelTypeChange: (v: any) => void;
  onDescriptionChange: (v: string) => void;
  onMaxPositionsChange: (v: string) => void;
  onStopLossChange: (v: string) => void;
  onTakeProfitChange: (v: string) => void;
  onCreate: () => void;
}

export function AutoTradingModelDialog({ open, modelName, modelType, description, maxPositions, stopLossPercent, takeProfitPercent, isPending, onOpenChange, onModelNameChange, onModelTypeChange, onDescriptionChange, onMaxPositionsChange, onStopLossChange, onTakeProfitChange, onCreate }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-create-model"><Plus className="h-4 w-4" />AI 모델 생성</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI 자동매매 모델 생성</DialogTitle>
          <DialogDescription>새로운 AI 트레이딩 모델을 설정하세요</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>모델 이름</Label>
            <Input placeholder="예: 모멘텀 전략 v1" value={modelName} onChange={(e) => onModelNameChange(e.target.value)} data-testid="input-model-name" />
          </div>
          <div className="space-y-2">
            <Label>모델 유형</Label>
            <Select value={modelType} onValueChange={onModelTypeChange}>
              <SelectTrigger data-testid="select-model-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="momentum">모멘텀</SelectItem>
                <SelectItem value="value">가치투자</SelectItem>
                <SelectItem value="technical">기술적분석</SelectItem>
                <SelectItem value="custom">커스텀</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>설명</Label>
            <Textarea placeholder="전략 설명" value={description} onChange={(e) => onDescriptionChange(e.target.value)} rows={3} data-testid="input-model-description" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">최대 보유 종목</Label>
              <Input type="number" value={maxPositions} onChange={(e) => onMaxPositionsChange(e.target.value)} data-testid="input-max-positions" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">손절 (%)</Label>
              <Input type="number" value={stopLossPercent} onChange={(e) => onStopLossChange(e.target.value)} data-testid="input-stop-loss" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">익절 (%)</Label>
              <Input type="number" value={takeProfitPercent} onChange={(e) => onTakeProfitChange(e.target.value)} data-testid="input-take-profit" />
            </div>
          </div>
          <Button onClick={onCreate} disabled={isPending} className="w-full" data-testid="button-submit-model">
            <Save className="h-4 w-4 mr-2" />
            {isPending ? "생성 중..." : "모델 생성"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
