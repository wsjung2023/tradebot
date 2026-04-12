// AutoTradingModelDialog.tsx — AI 자동매매 모델 생성 다이얼로그
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
  maxPositions: string;
  stopLossColor: 'green' | 'blue';
  stopLossPercent: string;
  takeProfitPercent: string;
  isPending: boolean;
  onOpenChange: (v: boolean) => void;
  onModelNameChange: (v: string) => void;
  onModelTypeChange: (v: any) => void;
  onDescriptionChange: (v: string) => void;
  onMaxPositionsChange: (v: string) => void;
  onStopLossColorChange: (v: 'green' | 'blue') => void;
  onStopLossChange: (v: string) => void;
  onTakeProfitChange: (v: string) => void;
  onCreate: () => void;
}

const CL_COLOR_LABELS: Record<'green' | 'blue', string> = {
  green: '초록 (30~50%)',
  blue:  '파랑 (10~20%)',
};

export function AutoTradingModelDialog({
  open, modelName, modelType, description,
  maxPositions, stopLossColor, stopLossPercent, takeProfitPercent,
  isPending, onOpenChange, onModelNameChange, onModelTypeChange,
  onDescriptionChange, onMaxPositionsChange,
  onStopLossColorChange, onStopLossChange, onTakeProfitChange, onCreate,
}: Props) {
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

          {/* 최대 보유 종목 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">최대 보유 종목</Label>
            <Input
              type="number"
              min={1}
              value={maxPositions}
              onChange={(e) => onMaxPositionsChange(e.target.value)}
              data-testid="input-max-positions"
            />
            <p className="text-xs text-muted-foreground">이 수 이상 보유 시 신규 매수 차단</p>
          </div>

          {/* 손절 — CL선 색 기준 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">손절 설정 (CL선 색 기준)</Label>
            <div className="flex gap-2">
              <Select value={stopLossColor} onValueChange={(v) => onStopLossColorChange(v as 'green' | 'blue')}>
                <SelectTrigger className="flex-1" data-testid="select-stop-loss-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="green">
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                      초록 CL (30~50%)
                    </span>
                  </SelectItem>
                  <SelectItem value="blue">
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
                      파랑 CL (10~20%)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 flex-1">
                <Input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={stopLossPercent}
                  onChange={(e) => onStopLossChange(e.target.value)}
                  data-testid="input-stop-loss"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">% 하락 시</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              CL선이 <strong>{CL_COLOR_LABELS[stopLossColor]}</strong> 구간일 때 -{stopLossPercent}% 이상 손실이면 손절
            </p>
          </div>

          {/* 익절 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">익절 설정</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0.1}
                step={0.5}
                value={takeProfitPercent}
                onChange={(e) => onTakeProfitChange(e.target.value)}
                className="flex-1"
                data-testid="input-take-profit"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">% 수익 시 익절</span>
            </div>
            <p className="text-xs text-muted-foreground">+{takeProfitPercent}% 이상 수익이면 전량 익절</p>
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
