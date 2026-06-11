// SettingsAI.tsx — AI 분석 모델 선택 + 월 예산 설정 + 학습 잡 정책 카드
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, DollarSign, GraduationCap } from "lucide-react";

interface Props {
  aiModel?: string;
  isPending: boolean;
  onModelChange: (value: string) => void;
}

// 학습 정책 기본값
const LP_DEFAULTS = { minTradesForAnalysis: 20, minTradesForAutoApply: 50, autoApplyMinWinRate: 45, autoApplyMinReturn: 0, autoApplyMaxDrawdown: 30 };

function LearningPolicySection() {
  const { toast } = useToast();
  const [lp, setLp] = useState(LP_DEFAULTS);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);

  const { data: models = [] } = useQuery<any[]>({
    queryKey: ['/api/ai/models'],
    queryFn: () => apiRequest('GET', '/api/ai/models').then(r => r.json()),
  });

  // 첫 번째 활성 모델 자동 선택
  useEffect(() => {
    if (models.length > 0 && !selectedModelId) {
      setSelectedModelId(models[0].id);
    }
  }, [models]);

  const { data: tsData } = useQuery<any>({
    queryKey: ['/api/ai/models', selectedModelId, 'trading-settings'],
    queryFn: () => apiRequest('GET', `/api/ai/models/${selectedModelId}/trading-settings`).then(r => r.json()),
    enabled: !!selectedModelId,
  });

  useEffect(() => {
    if (tsData !== undefined) {
      const p = tsData?.learningPolicy;
      if (p) setLp({ ...LP_DEFAULTS, ...p });
      else setLp(LP_DEFAULTS);
    }
  }, [tsData]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest('PATCH', `/api/ai/models/${selectedModelId}/trading-settings`, { learningPolicy: lp }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/models', selectedModelId, 'trading-settings'] });
      toast({ title: '학습 잡 정책 저장됨' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: '저장 실패', description: e.message }),
  });

  const field = (key: keyof typeof LP_DEFAULTS, label: string, desc: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" className="h-8 text-xs" value={lp[key]} onChange={e => setLp(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))} />
      <p className="text-[10px] text-muted-foreground">{desc}</p>
    </div>
  );

  if (models.length === 0) return null;

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">학습 잡 정책</span>
      </div>
      <p className="text-xs text-muted-foreground">학습 잡이 매일 돌 때 분석 및 자동 적용 기준입니다. 모델별로 설정됩니다.</p>

      {models.length > 1 && (
        <Select value={String(selectedModelId)} onValueChange={v => setSelectedModelId(Number(v))}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{models.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.modelName}</SelectItem>)}</SelectContent>
        </Select>
      )}

      <div className="grid grid-cols-2 gap-3">
        {field('minTradesForAnalysis', '분석 시작 최소 거래 수', '이 건수 미만이면 분석 없이 스킵 (기본 20)')}
        {field('minTradesForAutoApply', '자동 적용 최소 거래 수', '이 건수 이상 + 아래 조건 충족 시 파라미터 자동 변경 (기본 50)')}
        {field('autoApplyMinWinRate', '자동 적용 최소 승률 (%)', '기본 45%')}
        {field('autoApplyMinReturn', '자동 적용 최소 수익률 (%)', '기본 0% (플러스 수익 필요)')}
        {field('autoApplyMaxDrawdown', '자동 적용 최대 낙폭 (%)', '기본 30%')}
      </div>
      <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !selectedModelId}>
        {saveMutation.isPending ? '저장 중...' : '학습 정책 저장'}
      </Button>
    </div>
  );
}

export function SettingsAI({ aiModel, isPending, onModelChange }: Props) {
  const { toast } = useToast();

  const { data: budgetData } = useQuery<{ budgetUsd: number; blockOnExceed: boolean }>({
    queryKey: ["/api/ai/budget"],
    queryFn: () => apiRequest("GET", "/api/ai/budget").then(r => r.json()),
  });

  const [budgetInput, setBudgetInput] = useState("");
  const [blockOnExceed, setBlockOnExceed] = useState(false);

  // budgetData 로드 후 로컬 상태 동기화
  const budgetUsd = budgetData?.budgetUsd ?? 0;
  const budgetBlock = budgetData?.blockOnExceed ?? false;

  const saveBudgetMutation = useMutation({
    mutationFn: async (data: { budgetUsd: number; blockOnExceed: boolean }) =>
      (await apiRequest("POST", "/api/ai/budget", data)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/budget"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/usage-daily"] });
      toast({ title: "예산 설정 저장됨" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "저장 실패", description: e.message }),
  });

  const handleSaveBudget = () => {
    const val = parseFloat(budgetInput || String(budgetUsd));
    if (isNaN(val) || val < 0) {
      toast({ variant: "destructive", title: "유효하지 않은 금액" });
      return;
    }
    saveBudgetMutation.mutate({ budgetUsd: val, blockOnExceed });
  };

  const effectiveBlock = budgetData ? budgetBlock : blockOnExceed;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />AI 모델 설정</CardTitle>
        <CardDescription>AI 분석에 사용할 OpenAI 모델을 선택하세요</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 모델 선택 */}
        <div className="space-y-2">
          <Label htmlFor="ai-model">AI 모델</Label>
          <Select value={aiModel || "gpt-5-mini"} onValueChange={onModelChange} disabled={isPending}>
            <SelectTrigger id="ai-model" data-testid="select-ai-model"><SelectValue placeholder="AI 모델 선택" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-5-mini">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2"><span className="font-medium">GPT-5 Mini</span><Badge variant="default" className="text-xs">기본</Badge></div>
                  <span className="text-xs text-muted-foreground">비용 효율적인 대량 분석 (입력 $0.25 / 출력 $2.00)</span>
                </div>
              </SelectItem>
              <SelectItem value="gpt-5.4-mini">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2"><span className="font-medium">GPT-5.4 Mini</span><Badge variant="secondary" className="text-xs">추천</Badge></div>
                  <span className="text-xs text-muted-foreground">최신 소형 모델, 성능·속도 우수 (입력 $0.75 / 출력 $4.50)</span>
                </div>
              </SelectItem>
              <SelectItem value="gpt-5.1">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2"><span className="font-medium">GPT-5.1</span></div>
                  <span className="text-xs text-muted-foreground">최신 추론 모델, 고성능 분석 (입력 $1.25 / 출력 $10.00)</span>
                </div>
              </SelectItem>
              <SelectItem value="gpt-5.1-chat-latest">
                <div className="flex flex-col"><span className="font-medium">GPT-5.1 Chat (Latest)</span><span className="text-xs text-muted-foreground">대화형 응답 최적화 (입력 $1.25 / 출력 $10.00)</span></div>
              </SelectItem>
              <SelectItem value="gpt-4.1">
                <div className="flex flex-col"><span className="font-medium">GPT-4.1</span><span className="text-xs text-muted-foreground">멀티모달 (텍스트/PDF) (입력 $2.00 / 출력 $8.00)</span></div>
              </SelectItem>
              <SelectItem value="gpt-4o">
                <div className="flex flex-col"><span className="font-medium">GPT-4o</span><span className="text-xs text-muted-foreground">범용형 (레거시 채널) (입력 $2.50 / 출력 $10.00)</span></div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>✦ <strong>GPT-5 Mini (기본)</strong>: 비용 절감, 대량 분석 및 자동화된 스캔에 적합 (입력 $0.25 / 출력 $2.00)</p>
          <p>✦ <strong>GPT-5.4 Mini</strong>: 최신 소형 모델 중 최강 성능, gpt-5-mini 대비 3배 비용·2배 속도 (입력 $0.75 / 출력 $4.50)</p>
          <p>✦ <strong>GPT-5.1</strong>: 추론 모델, 고성능 분석용 (입력 $1.25 / 출력 $10.00)</p>
          <p>✦ <strong>GPT-5.1 Chat (Latest)</strong>: 대화형 응답 최적화, 빠른 인터랙션/요약 분석 (입력 $1.25 / 출력 $10.00)</p>
          <p>✦ <strong>GPT-4.1</strong>: 멀티모달 지원, 텍스트/PDF/이미지 분석 필요시 사용 (입력 $2.00 / 출력 $8.00)</p>
          <p>✦ <strong>GPT-4o</strong>: 범용형 모델, 레거시 채널 호환 (입력 $2.50 / 출력 $10.00)</p>
        </div>

        {/* 월 예산 설정 */}
        <div className="border-t pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">월 AI 사용 예산</span>
            {budgetUsd > 0 && (
              <Badge variant="outline" className="text-xs">현재 ${budgetUsd.toFixed(2)}</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              step="0.5"
              placeholder={budgetUsd > 0 ? String(budgetUsd) : "예: 5.00"}
              value={budgetInput}
              onChange={e => setBudgetInput(e.target.value)}
              className="w-36"
            />
            <span className="flex items-center text-sm text-muted-foreground">USD / 월</span>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="block-on-exceed"
              checked={budgetData ? budgetBlock : blockOnExceed}
              onCheckedChange={v => {
                setBlockOnExceed(v);
                if (budgetData) {
                  saveBudgetMutation.mutate({ budgetUsd: budgetUsd, blockOnExceed: v });
                }
              }}
            />
            <Label htmlFor="block-on-exceed" className="text-sm">
              예산 초과 시 AI 호출 차단
            </Label>
          </div>
          {effectiveBlock && (
            <p className="text-xs text-amber-600">
              ⚠ 예산 초과 시 자동매매 AI 판단이 중단됩니다. 당일 매수/추가매수가 실행되지 않을 수 있습니다.
            </p>
          )}
          <Button
            size="sm"
            onClick={handleSaveBudget}
            disabled={saveBudgetMutation.isPending || !budgetInput}
          >
            예산 저장
          </Button>
        </div>

        <LearningPolicySection />
      </CardContent>
    </Card>
  );
}
