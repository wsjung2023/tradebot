import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Save, Settings2, Loader2 } from "lucide-react";
import type { AutoTradingSettings as AutoTradingSettingsType, KiwoomAccount } from "@shared/schema";

interface Props {
  modelId: number;
  modelConfig: any;
  onAccountChange: (accountId: number | null) => void;
}

export function AutoTradingSettings({ modelId, modelConfig, onAccountChange }: Props) {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<AutoTradingSettingsType | null>({
    queryKey: ["/api/ai/models", modelId, "trading-settings"],
    queryFn: async () => {
      const resp = await apiRequest("GET", `/api/ai/models/${modelId}/trading-settings`);
      return resp.json();
    },
    enabled: !!modelId,
  });

  const { data: accounts = [] } = useQuery<KiwoomAccount[]>({
    queryKey: ["/api/accounts"],
  });

  const [defaultPositionSize, setDefaultPositionSize] = useState("1000000");
  const [maxPositionSize, setMaxPositionSize] = useState("10000000");
  const [maxDailyTrades, setMaxDailyTrades] = useState("5");
  const [minAiConfidence, setMinAiConfidence] = useState(70);
  const [themeWeight, setThemeWeight] = useState(20);
  const [newsWeight, setNewsWeight] = useState(15);
  const [financialsWeight, setFinancialsWeight] = useState(25);
  const [liquidityWeight, setLiquidityWeight] = useState(20);
  const [institutionalWeight, setInstitutionalWeight] = useState(20);
  const [requireGoodFinancials, setRequireGoodFinancials] = useState(true);
  const [requireHighLiquidity, setRequireHighLiquidity] = useState(true);
  const [requireMarketIssue, setRequireMarketIssue] = useState(false);
  const [enableDynamicExit, setEnableDynamicExit] = useState(true);
  const [stalePeriodDays, setStalePeriodDays] = useState("5");
  const [surgeThreshold, setSurgeThreshold] = useState("10");
  const [volumeSpikeMultiplier, setVolumeSpikeMultiplier] = useState("3");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  useEffect(() => {
    if (settings) {
      setDefaultPositionSize(settings.defaultPositionSize?.toString() || "1000000");
      setMaxPositionSize(settings.maxPositionSize?.toString() || "10000000");
      setMaxDailyTrades(settings.maxDailyTrades?.toString() || "5");
      setMinAiConfidence(parseFloat(settings.minAiConfidence?.toString() || "70"));
      setThemeWeight(parseFloat(settings.themeWeight?.toString() || "20"));
      setNewsWeight(parseFloat(settings.newsWeight?.toString() || "15"));
      setFinancialsWeight(parseFloat(settings.financialsWeight?.toString() || "25"));
      setLiquidityWeight(parseFloat(settings.liquidityWeight?.toString() || "20"));
      setInstitutionalWeight(parseFloat(settings.institutionalWeight?.toString() || "20"));
      setRequireGoodFinancials(settings.requireGoodFinancials ?? true);
      setRequireHighLiquidity(settings.requireHighLiquidity ?? true);
      setRequireMarketIssue(settings.requireMarketIssue ?? false);
      setEnableDynamicExit(settings.enableDynamicExit ?? true);
      setStalePeriodDays(settings.stalePeriodDays?.toString() || "5");
      setSurgeThreshold(settings.surgeThreshold?.toString() || "10");
      setVolumeSpikeMultiplier(settings.volumeSpikeMultiplier?.toString() || "3");
    }
  }, [settings]);

  useEffect(() => {
    if (modelConfig?.accountId) {
      setSelectedAccountId(String(modelConfig.accountId));
    }
  }, [modelConfig]);

  const weightSum = themeWeight + newsWeight + financialsWeight + liquidityWeight + institutionalWeight;

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const resp = await apiRequest("PUT", `/api/ai/models/${modelId}/trading-settings`, data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/models", modelId, "trading-settings"] });
      toast({ title: "자동매매 설정 저장 완료" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "저장 실패", description: e.message }),
  });

  const handleSave = () => {
    if (Math.abs(weightSum - 100) > 0.01) {
      toast({ variant: "destructive", title: "가중치 합계 오류", description: `AI 분석 가중치 합계가 100%여야 합니다. (현재: ${weightSum}%)` });
      return;
    }

    if (selectedAccountId && selectedAccountId !== (modelConfig?.accountId?.toString() || "")) {
      onAccountChange(parseInt(selectedAccountId));
    }

    saveMutation.mutate({
      defaultPositionSize,
      maxPositionSize,
      maxDailyTrades: parseInt(maxDailyTrades),
      minAiConfidence: minAiConfidence.toString(),
      themeWeight: themeWeight.toString(),
      newsWeight: newsWeight.toString(),
      financialsWeight: financialsWeight.toString(),
      liquidityWeight: liquidityWeight.toString(),
      institutionalWeight: institutionalWeight.toString(),
      requireGoodFinancials,
      requireHighLiquidity,
      requireMarketIssue,
      enableDynamicExit,
      stalePeriodDays: parseInt(stalePeriodDays),
      surgeThreshold,
      volumeSpikeMultiplier,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-settings" />
        </CardContent>
      </Card>
    );
  }

  const formatKRW = (val: string) => {
    const num = parseInt(val);
    if (isNaN(num)) return val;
    if (num >= 10000) return `${(num / 10000).toLocaleString()}만원`;
    return `${num.toLocaleString()}원`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4" />
          자동매매 설정
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-sm font-semibold">매매 계좌</Label>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger data-testid="select-trading-account">
              <SelectValue placeholder="계좌를 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={String(account.id)}>
                  {account.accountNumber} ({account.accountType === 'real' ? '실계좌' : '모의'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold">매매 금액</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">기본 매매금액</Label>
              <Input
                type="number"
                value={defaultPositionSize}
                onChange={(e) => setDefaultPositionSize(e.target.value)}
                data-testid="input-default-position-size"
              />
              <span className="text-xs text-muted-foreground">{formatKRW(defaultPositionSize)}</span>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">최대 매매금액</Label>
              <Input
                type="number"
                value={maxPositionSize}
                onChange={(e) => setMaxPositionSize(e.target.value)}
                data-testid="input-max-position-size"
              />
              <span className="text-xs text-muted-foreground">{formatKRW(maxPositionSize)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">일일 최대 거래 횟수</Label>
            <Input
              type="number"
              value={maxDailyTrades}
              onChange={(e) => setMaxDailyTrades(e.target.value)}
              data-testid="input-max-daily-trades"
            />
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold">AI 최소 신뢰도</Label>
          <div className="flex items-center gap-3">
            <Slider
              min={0}
              max={100}
              step={5}
              value={[minAiConfidence]}
              onValueChange={([v]) => setMinAiConfidence(v)}
              data-testid="slider-min-ai-confidence"
            />
            <span className="text-sm font-mono w-12 text-right">{minAiConfidence}%</span>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">AI 분석 가중치</Label>
            <span className={`text-xs font-mono ${Math.abs(weightSum - 100) > 0.01 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
              합계: {weightSum}%
            </span>
          </div>

          {[
            { label: "테마", value: themeWeight, setter: setThemeWeight, testId: "slider-theme-weight" },
            { label: "뉴스", value: newsWeight, setter: setNewsWeight, testId: "slider-news-weight" },
            { label: "재무", value: financialsWeight, setter: setFinancialsWeight, testId: "slider-financials-weight" },
            { label: "유동성", value: liquidityWeight, setter: setLiquidityWeight, testId: "slider-liquidity-weight" },
            { label: "기관", value: institutionalWeight, setter: setInstitutionalWeight, testId: "slider-institutional-weight" },
          ].map(({ label, value, setter, testId }) => (
            <div key={testId} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-10">{label}</span>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[value]}
                onValueChange={([v]) => setter(v)}
                data-testid={testId}
              />
              <span className="text-xs font-mono w-10 text-right">{value}%</span>
            </div>
          ))}
        </div>

        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold">진입 조건 필터</Label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">재무건전성 필수</Label>
              <Switch
                checked={requireGoodFinancials}
                onCheckedChange={setRequireGoodFinancials}
                data-testid="switch-require-financials"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">높은 유동성 필수</Label>
              <Switch
                checked={requireHighLiquidity}
                onCheckedChange={setRequireHighLiquidity}
                data-testid="switch-require-liquidity"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">시장 이슈 관련 종목만</Label>
              <Switch
                checked={requireMarketIssue}
                onCheckedChange={setRequireMarketIssue}
                data-testid="switch-require-market-issue"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">동적 청산</Label>
            <Switch
              checked={enableDynamicExit}
              onCheckedChange={setEnableDynamicExit}
              data-testid="switch-dynamic-exit"
            />
          </div>
          {enableDynamicExit && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">보유기간 (일)</Label>
                <Input
                  type="number"
                  value={stalePeriodDays}
                  onChange={(e) => setStalePeriodDays(e.target.value)}
                  data-testid="input-stale-period"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">급등 기준 (%)</Label>
                <Input
                  type="number"
                  value={surgeThreshold}
                  onChange={(e) => setSurgeThreshold(e.target.value)}
                  data-testid="input-surge-threshold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">거래량 배수</Label>
                <Input
                  type="number"
                  value={volumeSpikeMultiplier}
                  onChange={(e) => setVolumeSpikeMultiplier(e.target.value)}
                  data-testid="input-volume-spike"
                />
              </div>
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full" data-testid="button-save-trading-settings">
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "저장 중..." : "설정 저장"}
        </Button>
      </CardContent>
    </Card>
  );
}
