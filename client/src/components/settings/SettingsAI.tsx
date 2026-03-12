// SettingsAI.tsx — AI 분석 모델 선택 설정 카드 (GPT 모델 선택)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain } from "lucide-react";

interface Props {
  aiModel?: string;
  isPending: boolean;
  onModelChange: (value: string) => void;
}

export function SettingsAI({ aiModel, isPending, onModelChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />AI 모델 설정</CardTitle>
        <CardDescription>AI 분석에 사용할 OpenAI 모델을 선택하세요</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ai-model">AI 모델</Label>
          <Select value={aiModel || "gpt-5.1"} onValueChange={onModelChange} disabled={isPending}>
            <SelectTrigger id="ai-model" data-testid="select-ai-model"><SelectValue placeholder="AI 모델 선택" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-5.1">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2"><span className="font-medium">GPT-5.1</span><Badge variant="default" className="text-xs">권장</Badge></div>
                  <span className="text-xs text-muted-foreground">최신 추론 모델, 수익률 45% 향상</span>
                </div>
              </SelectItem>
              <SelectItem value="gpt-5.1-chat-latest">
                <div className="flex flex-col"><span className="font-medium">GPT-5.1 Chat (Latest)</span><span className="text-xs text-muted-foreground">대화형 응답 최적화, 빠른 인터랙션용</span></div>
              </SelectItem>
              <SelectItem value="gpt-5-mini">
                <div className="flex flex-col"><span className="font-medium">GPT-5 Mini</span><span className="text-xs text-muted-foreground">비용 효율적인 대량 분석</span></div>
              </SelectItem>
              <SelectItem value="gpt-4.1">
                <div className="flex flex-col"><span className="font-medium">GPT-4.1</span><span className="text-xs text-muted-foreground">멀티모달 (텍스트, PDF 분석)</span></div>
              </SelectItem>
              <SelectItem value="gpt-4o">
                <div className="flex flex-col"><span className="font-medium">GPT-4o</span><span className="text-xs text-muted-foreground">범용형 (레거시 채널)</span></div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>✦ <strong>GPT-5.1 (권장)</strong>: 최신 추론 모델, 트레이딩에 최적화, 수익률 45% 향상</p>
          <p>✦ <strong>GPT-5.1 Chat (Latest)</strong>: 대화형 응답 최적화, 빠른 인터랙션/요약 분석에 적합</p>
          <p>✦ <strong>GPT-5 Mini</strong>: 비용 절감, 대량 분석 및 자동화된 스캔에 적합</p>
          <p>✦ <strong>GPT-4.1</strong>: 멀티모달 지원, 텍스트/PDF/이미지 분석 필요시 사용</p>
          <p>✦ <strong>GPT-4o</strong>: 범용형 모델, 레거시 채널 호환 (신규 사용 비권장)</p>
        </div>
      </CardContent>
    </Card>
  );
}
