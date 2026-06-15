import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Rocket, Link2, Bot, CheckCircle2, ChevronRight, CreditCard,
  Key, Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── 단계 정의 ──────────────────────────────────────────────────────────────

const PRIVATE_STEPS = [
  {
    id: 'welcome',
    icon: Rocket,
    title: 'AI 자동매매에 오신 걸 환영합니다',
    description: '키움증권 계좌를 연결하면 AI가 실시간으로 종목을 분석하고 자동매매를 실행합니다.',
    detail: '처음 설정은 3분이면 충분합니다. 지금부터 차근차근 안내해드릴게요.',
  },
  {
    id: 'account',
    icon: Link2,
    title: '키움증권 계좌 연결 방법',
    description: 'PC에서 키움 에이전트를 실행하면 자동으로 계좌가 연결됩니다.',
    detail: '① 설정 → 계좌 관리 → 계좌 추가\n② 계좌번호와 비밀번호 입력\n③ 에이전트가 자동으로 토큰을 발급합니다\n\n계좌 없이도 AI 분석 기능은 바로 사용 가능합니다.',
  },
  {
    id: 'model',
    icon: Bot,
    title: 'AI 모델 설정',
    description: '자동매매 → AI 모델 생성에서 매매 전략을 설정하세요.',
    detail: '각 모델마다 종목 선정 기준, 매수/매도 조건, 손절 기준을 개별로 설정할 수 있습니다.\n\n설정이 완료되면 모델을 활성화해서 자동매매를 시작하세요.',
  },
];

// ── 헬퍼 컴포넌트 ───────────────────────────────────────────────────────────

function ProgressBar({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all ${
            i === current ? 'w-8 bg-primary' : i < current ? 'w-2 bg-primary/50' : 'w-2 bg-muted'
          }`}
        />
      ))}
    </div>
  );
}

// ── Private 온보딩 (3단계 정보성) ──────────────────────────────────────────

function PrivateOnboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const current = PRIVATE_STEPS[step];
  const Icon = current.icon;
  const isLast = step === PRIVATE_STEPS.length - 1;

  return (
    <>
      <ProgressBar total={PRIVATE_STEPS.length} current={step} />
      <Card>
        <CardContent className="p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 rounded-full bg-primary/10">
              <Icon className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">{current.title}</h2>
            <p className="text-muted-foreground">{current.description}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm whitespace-pre-line text-muted-foreground leading-relaxed">{current.detail}</p>
          </div>
          <div className="flex gap-3">
            {step > 0 && (
              <Button variant="outline" className="flex-1" onClick={() => setStep(s => s - 1)}>이전</Button>
            )}
            <Button className="flex-1" onClick={() => isLast ? onComplete() : setStep(s => s + 1)}>
              {isLast ? <><CheckCircle2 className="h-4 w-4 mr-2" />시작하기</> : <>다음<ChevronRight className="h-4 w-4 ml-2" /></>}
            </Button>
          </div>
          {!isLast && (
            <button className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={onComplete}>
              건너뛰기
            </button>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ── SaaS 온보딩 (5단계 액션 포함) ──────────────────────────────────────────

const PLAN_INFO = [
  { tier: 'saas_basic', name: 'Basic', price: '$85/월', limit: '실계좌 1개, AI 10회/일' },
  { tier: 'saas_pro', name: 'Pro', price: '$180/월', limit: '실계좌 2개, AI 50회/일, 자동적용' },
  { tier: 'saas_enterprise', name: 'Enterprise', price: '$320/월', limit: '실계좌 5개, AI 300회/일, 자동적용' },
];

function SaaSOnboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const TOTAL = 5;

  // Step 2 — 계좌 추가
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'real' | 'mock'>('mock');
  const [accountDone, setAccountDone] = useState(false);

  // Step 3 — API 키 (안내만)

  // Step 4 — AI 모델 생성
  const [modelName, setModelName] = useState('');
  const [modelType, setModelType] = useState<'momentum' | 'value' | 'technical' | 'custom'>('momentum');
  const [modelDone, setModelDone] = useState(false);

  const createAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/accounts', {
        accountNumber, accountType, accountName: `${accountType === 'real' ? '실전' : '모의'} 계좌`,
      });
      return res.json();
    },
    onSuccess: () => {
      setAccountDone(true);
      toast({ title: '계좌 추가 완료' });
    },
    onError: (e: any) => toast({ title: '계좌 추가 실패', description: e.message, variant: 'destructive' }),
  });

  const createModelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/ai/models', {
        modelName, modelType, config: {},
      });
      const model = await res.json();
      // 기본 trading-settings 생성 (가중치 균등 배분)
      await apiRequest('PUT', `/api/ai/models/${model.id}/trading-settings`, {
        themeWeight: '20', newsWeight: '20', financialsWeight: '20',
        liquidityWeight: '20', institutionalWeight: '20',
      });
      return model;
    },
    onSuccess: () => {
      setModelDone(true);
      toast({ title: 'AI 모델 생성 완료' });
    },
    onError: (e: any) => toast({ title: '모델 생성 실패', description: e.message, variant: 'destructive' }),
  });

  const steps = [
    // 0: 환영
    {
      icon: Rocket,
      title: 'AI 자동매매에 오신 걸 환영합니다',
      body: (
        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground leading-relaxed space-y-2">
          <p>설정은 5단계로 진행됩니다:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>플랜 선택 (구독 결제)</li>
            <li>키움증권 계좌 추가</li>
            <li>API 키 등록</li>
            <li>AI 매매 모델 생성</li>
          </ol>
          <p className="text-xs mt-2">각 단계는 건너뛰고 나중에 설정할 수 있습니다.</p>
        </div>
      ),
    },
    // 1: 플랜 선택
    {
      icon: CreditCard,
      title: '플랜 선택',
      body: (
        <div className="space-y-3">
          {PLAN_INFO.map(p => (
            <div key={p.tier} className="border rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{p.name} — {p.price}</p>
                <p className="text-xs text-muted-foreground">{p.limit}</p>
              </div>
            </div>
          ))}
          <Button className="w-full" onClick={() => { onComplete(); setLocation('/billing'); }}>
            <CreditCard className="h-4 w-4 mr-2" />구독 페이지에서 결제하기
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            무료 플랜(Free)으로 계속 → AI 분석 미사용, 실계좌 연결 불가
          </p>
        </div>
      ),
    },
    // 2: 계좌 추가
    {
      icon: Link2,
      title: '키움증권 계좌 추가',
      body: accountDone ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <Check className="h-10 w-10 text-green-500" />
          <p className="text-sm text-muted-foreground">계좌가 추가되었습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">계좌번호</Label>
            <Input
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value)}
              placeholder="81277026 (8자리)"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">계좌 유형</Label>
            <Select value={accountType} onValueChange={(v: any) => setAccountType(v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mock">모의투자</SelectItem>
                <SelectItem value="real">실전투자</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            disabled={!accountNumber || createAccountMutation.isPending}
            onClick={() => createAccountMutation.mutate()}
          >
            계좌 추가
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            나중에 계좌 관리 페이지에서 추가할 수 있습니다.
          </p>
        </div>
      ),
    },
    // 3: API 키 안내
    {
      icon: Key,
      title: '키움 API 키 등록',
      body: (
        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground leading-relaxed space-y-2">
          <p>계좌 관리 → 계좌 행 오른쪽 열쇠 아이콘 클릭 → APP KEY / APP SECRET 입력</p>
          <p className="text-xs">키움 OpenAPI 사이트에서 앱키를 발급받으세요.</p>
          <p className="text-xs font-medium text-foreground">모의투자 계좌는 공유 키를 사용하므로 별도 입력이 필요하지 않습니다.</p>
        </div>
      ),
    },
    // 4: AI 모델 생성
    {
      icon: Bot,
      title: 'AI 매매 모델 생성',
      body: modelDone ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <Check className="h-10 w-10 text-green-500" />
          <p className="text-sm text-muted-foreground">모델이 생성되었습니다. 자동매매 페이지에서 설정을 완료해주세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">모델 이름</Label>
            <Input
              value={modelName}
              onChange={e => setModelName(e.target.value)}
              placeholder="내 첫 번째 모델"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">전략 유형</Label>
            <Select value={modelType} onValueChange={(v: any) => setModelType(v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="momentum">모멘텀</SelectItem>
                <SelectItem value="value">가치주</SelectItem>
                <SelectItem value="technical">기술적 분석</SelectItem>
                <SelectItem value="custom">커스텀</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            disabled={!modelName || createModelMutation.isPending}
            onClick={() => createModelMutation.mutate()}
          >
            모델 생성
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            나중에 자동매매 페이지에서 만들 수 있습니다.
          </p>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <>
      <ProgressBar total={TOTAL} current={step} />
      <Card>
        <CardContent className="p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="p-4 rounded-full bg-primary/10">
              <Icon className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold">{current.title}</h2>
          </div>

          {current.body}

          <div className="flex gap-3">
            {step > 0 && (
              <Button variant="outline" className="flex-1" onClick={() => setStep(s => s - 1)}>이전</Button>
            )}
            <Button
              className="flex-1"
              onClick={() => isLast ? onComplete() : setStep(s => s + 1)}
            >
              {isLast ? <><CheckCircle2 className="h-4 w-4 mr-2" />시작하기</> : <>다음<ChevronRight className="h-4 w-4 ml-2" /></>}
            </Button>
          </div>

          {step !== 1 && (
            <button
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={isLast ? onComplete : () => setStep(s => s + 1)}
            >
              {isLast ? '완료' : '건너뛰기'}
            </button>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const [, setLocation] = useLocation();

  const { data: billingConfig } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/billing/config'],
    queryFn: async () => (await apiRequest('GET', '/api/billing/config')).json(),
  });

  const completeMutation = useMutation({
    mutationFn: async () => (await apiRequest('POST', '/api/auth/onboard')).json(),
    onSuccess: () => {
      queryClient.setQueryData(['/api/auth/me'], (old: any) => ({
        ...old,
        user: { ...old?.user, onboardedAt: new Date().toISOString() },
      }));
      setLocation('/');
    },
  });

  const handleComplete = () => completeMutation.mutate();

  if (billingConfig === undefined) {
    return <div className="min-h-screen flex items-center justify-center" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {billingConfig.enabled
          ? <SaaSOnboarding onComplete={handleComplete} />
          : <PrivateOnboarding onComplete={handleComplete} />}
      </div>
    </div>
  );
}
