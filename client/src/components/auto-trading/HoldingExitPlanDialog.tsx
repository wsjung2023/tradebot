import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Sparkles } from "lucide-react";
import type { ExitStage } from "@shared/schema";

interface PortfolioHolding {
  id: number;
  stockCode: string;
  stockName: string;
  quantity: number;
  averagePrice: string;
  currentPrice: string;
  profitLoss: string;
  profitLossRate: string;
  accountId: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: number;
  holding: PortfolioHolding;
}

const TRIGGER_LABELS: Record<string, string> = {
  profit_rate: '익절률(%)',
  rainbow_line: '레인보우라인(CL)',
  loss_rate: '손절률(%)',
};

function formatKST(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
}

export function HoldingExitPlanDialog({ open, onOpenChange, modelId, holding }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // 수기 설정 상태
  const [takeProfitPct, setTakeProfitPct] = useState('');
  const [stopLossPct, setStopLossPct] = useState('');
  const [stages, setStages] = useState<Omit<ExitStage, 'fulfilled'>[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const planKey = ['/api/auto-trading/exit-plan', modelId, holding.stockCode];

  const { data, isLoading } = useQuery<{ plan: any }>({
    queryKey: planKey,
    queryFn: () => fetch(`/api/auto-trading/exit-plan/${modelId}/${holding.stockCode}`).then(r => r.json()),
    enabled: open,
    onSuccess: (d) => {
      if (!initialLoaded && d?.plan) {
        setTakeProfitPct(d.plan.takeProfitPercent ?? '');
        setStopLossPct(d.plan.stopLossPercent ?? '');
        const s = (d.plan.exitStages as ExitStage[] | null) ?? [];
        setStages(s.map(({ fulfilled: _f, ...rest }) => rest));
        setInitialLoaded(true);
      }
    },
  });

  const plan = data?.plan;

  const generateMutation = useMutation({
    mutationFn: () => fetch(`/api/auto-trading/exit-plan/${modelId}/${holding.stockCode}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
    }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: planKey });
      setInitialLoaded(false); // 다음 load 시 상태 갱신
      toast({ title: 'AI 매도 계획 생성 완료', description: `${d.plan?.exitStages?.length ?? 0}단계 생성됨` });
    },
    onError: (e: any) => toast({ title: '생성 실패', description: e.message, variant: 'destructive' }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: object) => fetch(`/api/auto-trading/exit-plan/${modelId}/${holding.stockCode}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKey });
      toast({ title: '저장 완료' });
    },
    onError: (e: any) => toast({ title: '저장 실패', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`/api/auto-trading/exit-plan/${modelId}/${holding.stockCode}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKey });
      setTakeProfitPct(''); setStopLossPct(''); setStages([]); setInitialLoaded(false);
      toast({ title: '계획 삭제 완료' });
    },
    onError: (e: any) => toast({ title: '삭제 실패', description: e.message, variant: 'destructive' }),
  });

  function handleSave() {
    saveMutation.mutate({
      takeProfitPercent: takeProfitPct ? parseFloat(takeProfitPct) : null,
      stopLossPercent: stopLossPct ? parseFloat(stopLossPct) : null,
      exitStages: stages.length > 0 ? stages.map((s, i) => ({ ...s, priority: i + 1, fulfilled: false })) : null,
    });
  }

  function addStage() {
    setStages(prev => [...prev, { priority: prev.length + 1, triggerType: 'profit_rate', triggerValue: 10, sellRatio: 0.5, label: `${prev.length + 1}차 매도` }]);
  }

  function removeStage(idx: number) {
    setStages(prev => prev.filter((_, i) => i !== idx));
  }

  function updateStage(idx: number, key: string, value: any) {
    setStages(prev => prev.map((s, i) => i === idx ? { ...s, [key]: value } : s));
  }

  const profitRate = plan?.exitStages
    ? null
    : holding.averagePrice && holding.currentPrice
      ? (((parseFloat(holding.currentPrice) - parseFloat(holding.averagePrice)) / parseFloat(holding.averagePrice)) * 100).toFixed(2)
      : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setInitialLoaded(false); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>매도 전략 — {holding.stockName} ({holding.stockCode})</DialogTitle>
          <p className="text-sm text-muted-foreground">
            평단 {parseFloat(holding.averagePrice || '0').toLocaleString()}원 · 현재 {parseFloat(holding.currentPrice || '0').toLocaleString()}원
            {profitRate && <span className={parseFloat(profitRate) >= 0 ? ' text-green-500' : ' text-red-500'}> · {parseFloat(profitRate) >= 0 ? '+' : ''}{profitRate}%</span>}
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Tabs defaultValue="ai">
            <TabsList className="mb-4">
              <TabsTrigger value="ai">AI 계획</TabsTrigger>
              <TabsTrigger value="manual">수기 설정</TabsTrigger>
            </TabsList>

            {/* ── AI 계획 탭 ── */}
            <TabsContent value="ai" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {plan?.source === 'ai_batch' && plan?.generatedAt && (
                    <span>마지막 생성: {formatKST(plan.generatedAt)} (AI 배치)</span>
                  )}
                  {plan?.source === 'manual' && <span>수기 설정 중</span>}
                  {!plan && <span>아직 계획 없음</span>}
                </div>
                <Button size="sm" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                  {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  AI 계획 생성
                </Button>
              </div>

              {plan?.aiReasoning && (
                <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{plan.aiReasoning}</div>
              )}

              {plan?.exitStages && (plan.exitStages as ExitStage[]).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">순서</TableHead>
                      <TableHead>조건</TableHead>
                      <TableHead>비중</TableHead>
                      <TableHead>설명</TableHead>
                      <TableHead className="w-16">상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(plan.exitStages as ExitStage[]).map((s) => (
                      <TableRow key={s.priority} className={s.fulfilled ? 'opacity-40' : ''}>
                        <TableCell>{s.priority}</TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{TRIGGER_LABELS[s.triggerType] ?? s.triggerType}</span><br />
                          <span className="font-medium">{s.triggerValue}{s.triggerType === 'rainbow_line' ? '%CL' : '%'}</span>
                        </TableCell>
                        <TableCell>{(s.sellRatio * 100).toFixed(0)}%</TableCell>
                        <TableCell className="text-sm">{s.label}</TableCell>
                        <TableCell>{s.fulfilled ? <Badge variant="secondary">완료</Badge> : <Badge variant="outline">대기</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-center text-muted-foreground py-4">AI 계획 없음. 위 버튼으로 생성하세요.</p>
              )}

              {plan && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="text-destructive">
                    계획 삭제
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ── 수기 설정 탭 ── */}
            <TabsContent value="manual" className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>익절 기준 (%)</Label>
                  <Input type="number" min="0" step="0.5" placeholder="모델 기본값 사용" value={takeProfitPct} onChange={e => setTakeProfitPct(e.target.value)} />
                  <p className="text-xs text-muted-foreground">설정 시 모델 기본값 대신 적용</p>
                </div>
                <div className="space-y-1">
                  <Label>손절 기준 (%)</Label>
                  <Input type="number" min="0" step="0.5" placeholder="모델 기본값 사용" value={stopLossPct} onChange={e => setStopLossPct(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>분할매도 단계</Label>
                  <Button size="sm" variant="outline" onClick={addStage}>
                    <Plus className="h-4 w-4 mr-1" /> 단계 추가
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">각 단계는 잔여 수량 기준 비중으로 매도합니다.</p>

                {stages.length === 0 && (
                  <p className="text-sm text-center text-muted-foreground py-4 border rounded-md">단계 없음 — 단순 익절/손절 % 설정만 사용</p>
                )}

                {stages.map((s, idx) => (
                  <div key={idx} className="flex gap-2 items-start p-3 border rounded-md">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">조건 타입</Label>
                        <Select value={s.triggerType} onValueChange={v => updateStage(idx, 'triggerType', v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="profit_rate">익절률(%)</SelectItem>
                            <SelectItem value="rainbow_line">레인보우라인(CL)</SelectItem>
                            <SelectItem value="loss_rate">손절률(%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">값 ({s.triggerType === 'rainbow_line' ? 'CL%' : '%'})</Label>
                        <Input className="h-8 text-xs" type="number" value={s.triggerValue} onChange={e => updateStage(idx, 'triggerValue', parseFloat(e.target.value))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">매도 비중 (%)</Label>
                        <Input className="h-8 text-xs" type="number" min="1" max="100" value={Math.round(s.sellRatio * 100)} onChange={e => updateStage(idx, 'sellRatio', parseFloat(e.target.value) / 100)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">설명</Label>
                        <Input className="h-8 text-xs" value={s.label} onChange={e => updateStage(idx, 'label', e.target.value)} />
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeStage(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  저장
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
