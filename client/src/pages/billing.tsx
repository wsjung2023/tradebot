import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, CreditCard, AlertTriangle, Zap } from "lucide-react";

// Paddle.js 타입
declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: 'sandbox' | 'production') => void };
      Initialize: (opts: { token: string; eventCallback?: (data: { name: string; [k: string]: unknown }) => void }) => void;
      Checkout: { open: (opts: { transactionId?: string }) => void };
    };
  }
}

interface Plan {
  id: string;
  name: string;
  monthlyUsd: string | null;
  maxModels: number | null;
  maxAiCallsPerDay: number | null;
  features: Record<string, boolean>;
  isActive: boolean;
}

interface Subscription {
  tier: string;
  status: string;
  currentPeriodEnd: string | null;
  aumTier: string | null;
  isPaidPlan: boolean;
  paddleSubscriptionId: string | null;
}

interface BillingConfig {
  enabled: boolean;
  clientToken: string | null;
  sandbox: boolean;
}

const TIER_ORDER: Record<string, number> = {
  free: 0,
  saas_basic: 1,
  saas_pro: 2,
  saas_enterprise: 3,
};

const AUM_TIER_LABEL: Record<string, string> = {
  under_20m:  '2,000만원 이하',
  under_50m:  '2,000만원 초과 ~ 5,000만원 이하',
  under_100m: '5,000만원 초과 ~ 1억원 이하',
  over_100m:  '1억원 초과',
};

const STATUS_LABEL: Record<string, { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active:    { text: '구독 중',    variant: 'default' },
  trialing:  { text: '체험 중',    variant: 'secondary' },
  past_due:  { text: '결제 실패',  variant: 'destructive' },
  cancelled: { text: '해지 예정',  variant: 'outline' },
};

function usePaddleInit(clientToken: string | null | undefined, sandbox: boolean) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!clientToken || initialized.current) return;
    const init = () => {
      if (sandbox) window.Paddle!.Environment.set('sandbox');
      window.Paddle!.Initialize({ token: clientToken });
      initialized.current = true;
    };
    if (window.Paddle) { init(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.onload = init;
    document.head.appendChild(script);
    return () => { if (!initialized.current) document.head.removeChild(script); };
  }, [clientToken, sandbox]);
}

export default function Billing() {
  const { toast } = useToast();
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const { data: billingConfig } = useQuery<BillingConfig>({
    queryKey: ['/api/billing/config'],
    queryFn: async () => { const r = await apiRequest('GET', '/api/billing/config'); return r.json(); },
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['/api/billing/plans'],
    queryFn: async () => { const r = await apiRequest('GET', '/api/billing/plans'); return r.json(); },
  });

  const { data: subscription, isLoading: subLoading } = useQuery<Subscription>({
    queryKey: ['/api/billing/subscription'],
    queryFn: async () => { const r = await apiRequest('GET', '/api/billing/subscription'); return r.json(); },
  });

  usePaddleInit(billingConfig?.clientToken, billingConfig?.sandbox ?? false);

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const r = await apiRequest('POST', '/api/billing/checkout', { planId });
      return r.json() as Promise<{ transactionId?: string; error?: string }>;
    },
    onSuccess: (data, planId) => {
      setCheckingOut(null);
      if (data.error) {
        toast({ variant: 'destructive', title: '결제 오류', description: data.error });
        return;
      }
      if (!data.transactionId) {
        toast({ variant: 'destructive', title: '오류', description: '트랜잭션 ID를 받지 못했습니다.' });
        return;
      }
      if (!window.Paddle) {
        toast({ variant: 'destructive', title: 'Paddle 로드 실패', description: '페이지를 새로고침 후 다시 시도해주세요.' });
        return;
      }
      window.Paddle.Checkout.open({
        transactionId: data.transactionId,
      });
    },
    onError: (e: any) => {
      setCheckingOut(null);
      toast({ variant: 'destructive', title: '결제 오류', description: e.message });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest('POST', '/api/billing/subscription/cancel');
      return r.json();
    },
    onSuccess: () => {
      setCancelConfirm(false);
      toast({ title: '구독 해지 예약', description: '현재 구독 기간이 끝나면 해지됩니다.' });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/subscription'] });
    },
    onError: (e: any) => {
      setCancelConfirm(false);
      toast({ variant: 'destructive', title: '해지 실패', description: e.message });
    },
  });

  function handleUpgrade(planId: string) {
    setCheckingOut(planId);
    checkoutMutation.mutate(planId);
  }

  const paidPlans = plans.filter(p => p.id !== 'free' && p.isActive);
  const currentTierRank = TIER_ORDER[subscription?.tier ?? 'free'] ?? 0;

  if (!billingConfig?.enabled) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm">이 인스턴스는 Public SaaS 모드가 아닙니다. 구독 관리가 비활성화되어 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <div className="flex items-center gap-2">
        <CreditCard className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">구독 관리</h1>
      </div>

      {/* 현재 구독 상태 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">현재 구독</CardTitle>
        </CardHeader>
        <CardContent>
          {subLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />로딩 중...
            </div>
          ) : subscription ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-semibold text-lg">
                  {paidPlans.find(p => p.id === subscription.tier)?.name ?? (subscription.tier === 'free' ? '무료 (Free)' : subscription.tier)}
                </span>
                {subscription.isPaidPlan && (() => {
                  const s = STATUS_LABEL[subscription.status] ?? { text: subscription.status, variant: 'secondary' as const };
                  return <Badge variant={s.variant}>{s.text}</Badge>;
                })()}
              </div>
              {subscription.aumTier && (
                <p className="text-sm text-muted-foreground">
                  실계좌 운용자산: {AUM_TIER_LABEL[subscription.aumTier] ?? subscription.aumTier}
                </p>
              )}
              {subscription.currentPeriodEnd && (
                <p className="text-sm text-muted-foreground">
                  다음 결제일: {new Date(subscription.currentPeriodEnd).toLocaleDateString('ko-KR')}
                </p>
              )}
              {subscription.isPaidPlan && subscription.status === 'active' && !cancelConfirm && (
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => setCancelConfirm(true)}>
                  구독 해지
                </Button>
              )}
              {cancelConfirm && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-sm text-destructive flex-1">현재 기간 종료 후 해지됩니다. 계속하시겠습니까?</p>
                  <Button size="sm" variant="destructive" disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate()}>
                    {cancelMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '확인'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setCancelConfirm(false)}>취소</Button>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 플랜 비교 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">요금제 선택</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {paidPlans.map(plan => {
            const planRank = TIER_ORDER[plan.id] ?? 0;
            const isCurrent = subscription?.tier === plan.id;
            const isDowngrade = planRank < currentTierRank;
            const isUpgrade = planRank > currentTierRank;
            const isLoading = checkingOut === plan.id;

            return (
              <Card key={plan.id} className={`relative flex flex-col ${isCurrent ? 'border-primary ring-1 ring-primary' : ''} ${plan.id === 'saas_pro' ? 'border-blue-500' : ''}`}>
                {plan.id === 'saas_pro' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500 px-3 py-0.5 text-xs font-semibold text-white">
                      <Zap className="h-3 w-3" />인기
                    </span>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    {isCurrent && <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">현재 플랜</Badge>}
                  </div>
                  <div className="mt-1">
                    <span className="text-3xl font-bold">${plan.monthlyUsd}</span>
                    <span className="text-muted-foreground text-sm"> / 월</span>
                  </div>
                  <CardDescription className="text-xs mt-1">USD 청구</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <ul className="space-y-2 flex-1">
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      AI 모델 최대 {plan.maxModels}개
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      AI 분석 {plan.maxAiCallsPerDay?.toLocaleString()}회/일
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      자동매매
                    </li>
                    {plan.features.prioritySupport && (
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        우선 지원
                      </li>
                    )}
                    {plan.features.customStrategy && (
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        전략 커스터마이징
                      </li>
                    )}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isCurrent ? 'outline' : plan.id === 'saas_pro' ? 'default' : 'outline'}
                    disabled={isCurrent || isDowngrade || isLoading || checkoutMutation.isPending}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {isLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />처리 중...</>
                    ) : isCurrent ? '현재 플랜' : isDowngrade ? '다운그레이드 불가' : isUpgrade ? '업그레이드' : '선택'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 안내 */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground space-y-1">
            <span className="block">• 결제는 USD로 청구됩니다. 환율은 카드사 기준이 적용됩니다.</span>
            <span className="block">• 구독 티어는 실계좌 운용자산 합계 기준으로 자동 판정됩니다 (모의계좌 제외).</span>
            <span className="block">• 해지 시 현재 결제 기간이 끝날 때까지 서비스를 계속 이용할 수 있습니다.</span>
            <span className="block">• 플랜 다운그레이드는 고객 지원팀에 문의해주세요.</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
