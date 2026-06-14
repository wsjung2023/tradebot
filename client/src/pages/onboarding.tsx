import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Link2, Rocket, CheckCircle2, ChevronRight } from "lucide-react";

const STEPS = [
  {
    icon: Rocket,
    title: "AI 자동매매에 오신 걸 환영합니다",
    description: "키움증권 계좌를 연결하면 AI가 실시간으로 종목을 분석하고 자동매매를 실행합니다.",
    detail: "처음 설정은 3분이면 충분합니다. 지금부터 차근차근 안내해드릴게요.",
  },
  {
    icon: Link2,
    title: "키움증권 계좌 연결 방법",
    description: "PC에서 키움 에이전트를 실행하면 자동으로 계좌가 연결됩니다.",
    detail: "① 설정 → 계좌 관리 → 계좌 추가\n② 계좌번호와 비밀번호 입력\n③ 에이전트가 자동으로 토큰을 발급합니다\n\n계좌 없이도 AI 분석 기능은 바로 사용 가능합니다.",
  },
  {
    icon: Bot,
    title: "AI 모델 설정",
    description: "자동매매 → AI 모델 생성에서 매매 전략을 설정하세요.",
    detail: "각 모델마다 종목 선정 기준, 매수/매도 조건, 손절 기준을 개별로 설정할 수 있습니다.\n\n설정이 완료되면 모델을 활성화해서 자동매매를 시작하세요.",
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [, setLocation] = useLocation();

  const completeMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/auth/onboard");
      return resp.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], (old: any) => ({
        ...old,
        user: { ...old?.user, onboardedAt: new Date().toISOString() },
      }));
      setLocation("/");
    },
  });

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* 진행 표시 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? "w-8 bg-primary" : i < step ? "w-2 bg-primary/50" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

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
              <p className="text-sm whitespace-pre-line text-muted-foreground leading-relaxed">
                {current.detail}
              </p>
            </div>

            <div className="flex gap-3">
              {step > 0 && (
                <Button variant="outline" className="flex-1" onClick={() => setStep(s => s - 1)}>
                  이전
                </Button>
              )}
              <Button
                className="flex-1"
                disabled={completeMutation.isPending}
                onClick={() => {
                  if (isLast) {
                    completeMutation.mutate();
                  } else {
                    setStep(s => s + 1);
                  }
                }}
              >
                {isLast ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    시작하기
                  </>
                ) : (
                  <>
                    다음
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>

            {!isLast && (
              <button
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
              >
                건너뛰기
              </button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
