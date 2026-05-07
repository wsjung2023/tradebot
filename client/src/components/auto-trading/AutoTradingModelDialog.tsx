// AutoTradingModelDialog.tsx — AI 자동매매 모델 생성/수정 다이얼로그
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Props {
  mode?: 'create' | 'edit';
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
  onUpdate?: () => void;
}

const MODEL_TYPE_INFO: Record<string, {
  label: string;
  description: string;
  badges: string[];
  stopLossDefault: string;
}> = {
  momentum: {
    label: '모멘텀',
    description: '강한 종목을 빠르게 추종하는 전략. 거래량·이슈·세력성 가중치 높음. 빠른 진입/빠른 익절 성향.',
    badges: ['거래량 중시', '이슈 추종', '조건부 손절'],
    stopLossDefault: 'conditional',
  },
  value: {
    label: '가치투자',
    description: '우량성과 가격 메리트를 우선하는 전략. 재무/저평가 가중치 높음. 보수적 분할매수, 손절 약함.',
    badges: ['재무 중시', '보수적 진입', '손절 약함'],
    stopLossDefault: 'soft_ai_first',
  },
  technical: {
    label: '기술적분석',
    description: '차트와 거래량 신호를 엄격히 따르는 전략. 레인보우 라인/추세 비중 높음. 시그널 진입 엄격.',
    badges: ['차트 중심', '신호 엄격', '강한 손절'],
    stopLossDefault: 'hard',
  },
  custom: {
    label: '커스텀',
    description: '모든 기준을 직접 조정하는 전략. 설정 탭에서 후보선정·진입·청산 정책을 세부 조정.',
    badges: ['자유 설정', 'AI 자율 판단'],
    stopLossDefault: 'soft_ai_first',
  },
};

// 초록 CL = 고점 대비 50% 하락 지점 (첫 매수 타점)
// 파랑 CL = 고점 대비 60~80% 하락 (추가 매수 구간)
const CL_COLOR_LABELS: Record<'green' | 'blue', string> = {
  green: '초록 CL (50% — 첫 매수 타점)',
  blue:  '파랑 CL (60~80% — 추가 매수 구간)',
};

export function AutoTradingModelDialog({
  mode = 'create',
  open, modelName, modelType, description,
  maxPositions, stopLossColor, stopLossPercent, takeProfitPercent,
  isPending, onOpenChange, onModelNameChange, onModelTypeChange,
  onDescriptionChange, onMaxPositionsChange,
  onStopLossColorChange, onStopLossChange, onTakeProfitChange,
  onCreate, onUpdate,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isEdit = mode === 'edit';
  const handleSubmit = isEdit ? (onUpdate ?? onCreate) : onCreate;
  const typeInfo = MODEL_TYPE_INFO[modelType] ?? MODEL_TYPE_INFO.custom;

  const content = (
    <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
      <DialogHeader className="shrink-0">
        <DialogTitle>{isEdit ? 'AI 모델 수정' : 'AI 자동매매 모델 생성'}</DialogTitle>
        <DialogDescription>{isEdit ? '모델 설정을 변경하세요' : '새로운 AI 트레이딩 모델을 설정하세요'}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
        <div className="space-y-2">
          <Label>모델 이름</Label>
          <Input placeholder="예: 모멘텀 전략 v1" value={modelName} onChange={(e) => onModelNameChange(e.target.value)} data-testid="input-model-name" />
        </div>

        {/* 전략 유형 */}
        <div className="space-y-2">
          <Label>전략 유형</Label>
          <Select value={modelType} onValueChange={onModelTypeChange}>
            <SelectTrigger data-testid="select-model-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="momentum">모멘텀 — 강한 종목 빠른 추종</SelectItem>
              <SelectItem value="value">가치투자 — 우량성·저평가 우선</SelectItem>
              <SelectItem value="technical">기술적분석 — 차트·거래량 신호 엄격</SelectItem>
              <SelectItem value="custom">커스텀 — 직접 설정</SelectItem>
            </SelectContent>
          </Select>
          {/* 선택된 유형 설명 */}
          <div data-testid="model-type-description" className="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1.5">
            <p className="text-muted-foreground">{typeInfo.description}</p>
            <div className="flex flex-wrap gap-1">
              {typeInfo.badges.map(b => (
                <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">손절 기본: <span className="font-medium text-foreground">{typeInfo.stopLossDefault}</span></p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>설명</Label>
          <Textarea placeholder="전략 설명" value={description} onChange={(e) => onDescriptionChange(e.target.value)} rows={2} data-testid="input-model-description" />
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

        {/* 고급 손절 규칙 (접기) */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full flex items-center justify-between px-2 text-muted-foreground hover:text-foreground">
              <span className="text-xs font-medium">고급 손절 규칙 (CL선 기준)</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            {/* 손절 사용 여부 토글 */}
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">CL선 손절 사용</p>
                <p className="text-xs text-muted-foreground">끄면 AI가 청산 시점을 판단합니다</p>
              </div>
              <Switch
                checked={stopLossPercent !== "0"}
                onCheckedChange={(v) => onStopLossChange(v ? "5" : "0")}
                data-testid="switch-stop-loss-enabled"
              />
            </div>

            {stopLossPercent !== "0" && (
              <>
                <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-200 space-y-1">
                  <p><strong>CL %</strong>는 240일 고점 대비 하락률(위치), <strong>손실 %</strong>는 내 매수가 대비 손익률입니다. 단위가 다릅니다.</p>
                  <p>초록 CL(50%)에서 매수한 종목이 더 떨어져 파랑(60~80%) 구간일 때 손절할지 설정합니다.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">CL선 색 기준 손절</Label>
                  <div className="flex gap-2">
                    <Select value={stopLossColor} onValueChange={(v) => onStopLossColorChange(v as 'green' | 'blue')}>
                      <SelectTrigger className="flex-1" data-testid="select-stop-loss-color">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="green">
                          <span className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                            초록 CL (50% — 첫 매수 타점)
                          </span>
                        </SelectItem>
                        <SelectItem value="blue">
                          <span className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
                            파랑 CL (60~80% — 추가 매수 구간)
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
              </>
            )}
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
          </CollapsibleContent>
        </Collapsible>

      </div>
      <div className="shrink-0 pt-2 border-t">
        <Button onClick={handleSubmit} disabled={isPending} className="w-full" data-testid="button-submit-model">
          <Save className="h-4 w-4 mr-2" />
          {isPending ? (isEdit ? "저장 중..." : "생성 중...") : (isEdit ? "저장" : "모델 생성")}
        </Button>
      </div>
    </DialogContent>
  );

  if (isEdit) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {content}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-create-model"><Plus className="h-4 w-4" />AI 모델 생성</Button>
      </DialogTrigger>
      {content}
    </Dialog>
  );
}
