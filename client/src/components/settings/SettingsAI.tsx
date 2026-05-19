// SettingsAI.tsx — AI 분석 모델 선택 + 월 예산 설정 카드
import { useState } from "react";
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
import { Brain, DollarSign } from "lucide-react";

interface Props {
  aiModel?: string;
  isPending: boolean;
  onModelChange: (value: string) => void;
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
      </CardContent>
    </Card>
  );
}
