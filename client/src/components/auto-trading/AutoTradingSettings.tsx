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
import { Save, Settings2, Loader2, ShieldAlert, TrendingUp, LayoutList } from "lucide-react";
import type { AutoTradingSettings as AutoTradingSettingsType, KiwoomAccount } from "@shared/schema";

interface Props {
  modelId: number;
  modelConfig: any;
  onAccountChange: (accountId: number | null) => void;
}

export function AutoTradingSettings({ modelId, modelConfig, onAccountChange }: Props) {
  const { toast } = useToast();

  // ── 기본 전략 설정 (모델 config 편집) ──
  const [cfgMaxPositions, setCfgMaxPositions] = useState("5");
  const [cfgStopLossColor, setCfgStopLossColor] = useState<'green' | 'blue'>("green");
  const [cfgStopLossPercent, setCfgStopLossPercent] = useState("5");
  const [cfgTakeProfitPercent, setCfgTakeProfitPercent] = useState("10");

  useEffect(() => {
    if (modelConfig) {
      setCfgMaxPositions(String(modelConfig.maxPositions ?? 5));
      const slc = modelConfig.stopLossConfig;
      if (slc) {
        setCfgStopLossColor(slc.color ?? 'green');
        setCfgStopLossPercent(String(slc.percent ?? 5));
      }
      setCfgTakeProfitPercent(String(modelConfig.takeProfitPercent ?? 10));
    }
  }, [modelConfig]);

  const configSaveMutation = useMutation({
    mutationFn: async (config: any) => {
      const resp = await apiRequest("PATCH", `/api/ai/models/${modelId}`, { config });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/models"] });
      toast({ title: "기본 전략 설정 저장 완료" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "저장 실패", description: e.message }),
  });

  const handleConfigSave = () => {
    const mp = parseInt(cfgMaxPositions);
    const slp = parseFloat(cfgStopLossPercent);
    const tp = parseFloat(cfgTakeProfitPercent);
    if (isNaN(mp) || mp < 1) { toast({ variant: "destructive", title: "최대 보유 종목은 1 이상이어야 합니다" }); return; }
    if (isNaN(slp) || slp <= 0) { toast({ variant: "destructive", title: "손절 % 값이 올바르지 않습니다" }); return; }
    if (isNaN(tp) || tp <= 0) { toast({ variant: "destructive", title: "익절 % 값이 올바르지 않습니다" }); return; }
    configSaveMutation.mutate({
      ...(modelConfig || {}),
      maxPositions: mp,
      stopLossConfig: { color: cfgStopLossColor, percent: slp },
      takeProfitPercent: tp,
    });
  };

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

  const defaultRainbowLines = Array.from({ length: 10 }, (_, i) => ({
    line: (i + 1) * 10,
    buyWeight: i < 5 ? 20 - i * 4 : 0,
    sellWeight: i >= 5 ? (i - 4) * 20 : 0,
  }));
  const [rainbowLineSettings, setRainbowLineSettings] = useState<{ line: number; buyWeight: number; sellWeight: number }[]>(defaultRainbowLines);

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
      if (settings.rainbowLineSettings && Array.isArray(settings.rainbowLineSettings) && (settings.rainbowLineSettings as any[]).length === 10) {
        setRainbowLineSettings(settings.rainbowLineSettings as any[]);
      }
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
      rainbowLineSettings,
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

        {/* ── 기본 전략 설정 ── */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">기본 전략 설정</Label>

          {/* 최대 보유 종목 */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <LayoutList className="h-3 w-3" />최대 보유 종목
            </Label>
            <Input
              type="number"
              min={1}
              value={cfgMaxPositions}
              onChange={(e) => setCfgMaxPositions(e.target.value)}
              data-testid="input-cfg-max-positions"
            />
            <p className="text-xs text-muted-foreground">이 수 이상 보유 시 신규 매수 차단</p>
          </div>

          {/* 손절 — CL선 색 기준 */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />손절 설정 (CL선 색 기준)
            </Label>
            <div className="flex gap-2">
              <Select value={cfgStopLossColor} onValueChange={(v) => setCfgStopLossColor(v as 'green' | 'blue')}>
                <SelectTrigger className="flex-1" data-testid="select-cfg-stop-loss-color">
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
                  value={cfgStopLossPercent}
                  onChange={(e) => setCfgStopLossPercent(e.target.value)}
                  data-testid="input-cfg-stop-loss"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">% 손실 시</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              CL선이 <strong>{cfgStopLossColor === 'green' ? '초록(30~50%)' : '파랑(10~20%)'}</strong> 구간일 때 -{cfgStopLossPercent}% 이상 손실이면 손절
            </p>
          </div>

          {/* 익절 */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />익절 설정
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0.1}
                step={0.5}
                value={cfgTakeProfitPercent}
                onChange={(e) => setCfgTakeProfitPercent(e.target.value)}
                className="flex-1"
                data-testid="input-cfg-take-profit"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">% 수익 시 익절</span>
            </div>
            <p className="text-xs text-muted-foreground">+{cfgTakeProfitPercent}% 이상 수익이면 전량 익절 매도</p>
          </div>

          <Button
            onClick={handleConfigSave}
            disabled={configSaveMutation.isPending}
            size="sm"
            className="w-full"
            data-testid="button-save-model-config"
          >
            <Save className="h-3 w-3 mr-2" />
            {configSaveMutation.isPending ? "저장 중..." : "전략 설정 저장"}
          </Button>
        </div>

        <div className="border-t pt-4 space-y-3">
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

        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold">레인보우 라인별 매수/매도 비중</Label>
          <p className="text-xs text-muted-foreground">각 라인(고점 대비 하락률)별 매수/매도 비중을 설정합니다.</p>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground font-medium pb-1">
              <span>라인 (하락%)</span>
              <span>매수 비중</span>
              <span>매도 비중</span>
            </div>
            {rainbowLineSettings.map((row, idx) => (
              <div key={row.line} className="grid grid-cols-3 gap-2 items-center">
                <span className="text-xs font-mono text-muted-foreground">{row.line}%</span>
                <div className="flex items-center gap-1">
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[row.buyWeight]}
                    onValueChange={([v]) => {
                      const updated = [...rainbowLineSettings];
                      updated[idx] = { ...updated[idx], buyWeight: v };
                      setRainbowLineSettings(updated);
                    }}
                    data-testid={`slider-rainbow-buy-${row.line}`}
                  />
                  <span className="text-xs font-mono w-8 text-right">{row.buyWeight}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[row.sellWeight]}
                    onValueChange={([v]) => {
                      const updated = [...rainbowLineSettings];
                      updated[idx] = { ...updated[idx], sellWeight: v };
                      setRainbowLineSettings(updated);
                    }}
                    data-testid={`slider-rainbow-sell-${row.line}`}
                  />
                  <span className="text-xs font-mono w-8 text-right">{row.sellWeight}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full" data-testid="button-save-trading-settings">
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "저장 중..." : "설정 저장"}
        </Button>
      </CardContent>
    </Card>
  );
}
