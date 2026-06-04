import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Save, Settings2, Loader2, ShieldAlert, TrendingUp, LayoutList, Layers, Brain, SlidersHorizontal, AlertTriangle, Plus, Trash2, Search } from "lucide-react";
import type { AutoTradingSettings as AutoTradingSettingsType, KiwoomAccount } from "@shared/schema";

const STOP_LOSS_MODE_LABELS: Record<string, { label: string; desc: string }> = {
  disabled:      { label: '비활성', desc: '손절 없음. AI가 보유/청산 판단' },
  soft_ai_first: { label: 'AI 우선', desc: '손실 시 AI가 먼저 보유/청산 판단. 최종 안전장치만 유지' },
  conditional:   { label: '조건부', desc: 'CL구간 + 손실률 + 거래량 악화 복합조건 충족 시 손절' },
  hard:          { label: '강제', desc: '지정 손실률 도달 즉시 기계적 손절' },
};

interface Props {
  modelId: number;
  modelConfig: any;
  onAccountChange: (accountId: number | null) => void;
}

const LADDER_LINES = [50, 40, 30, 20, 10] as const;
const COOLDOWN_MODES = [
  { value: "interval_120m", label: "120분" },
  { value: "interval_60m", label: "60분" },
  { value: "interval_30m", label: "30분" },
  { value: "daily_three_slots", label: "하루 3회 (09:10 / 13:30 / 15:10)" },
  { value: "daily_once", label: "하루 1회" },
] as const;

type CandidateDecisionCooldownMode =
  | "interval_120m"
  | "interval_60m"
  | "interval_30m"
  | "daily_three_slots"
  | "daily_once";

type TimeCapitalPolicyMode = "shadow_only" | "mock_apply" | "disabled";

function clampUnit(value: unknown): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, n));
}

function lineUnitsToEntryLadder(lineUnits: Record<number, number> | null | undefined) {
  return LADDER_LINES.map((line) => ({
    line,
    units: clampUnit(lineUnits?.[line] ?? 1),
  }));
}

function entryLadderToLineUnits(entryLadder: { line: number; units: number }[]) {
  const map: Record<number, number> = {};
  for (const line of LADDER_LINES) {
    const step = entryLadder.find((row) => row.line === line);
    map[line] = clampUnit(step?.units ?? 1);
  }
  return map;
}

export function AutoTradingSettings({ modelId, modelConfig, onAccountChange }: Props) {
  const { toast } = useToast();

  // ── 기본 전략 설정 (모델 config 편집) ──
  const [cfgMaxPositions, setCfgMaxPositions] = useState("25");
  const [cfgStopLossColor, setCfgStopLossColor] = useState<'green' | 'blue'>("green");
  const [cfgStopLossPercent, setCfgStopLossPercent] = useState("5");
  const [cfgTakeProfitPercent, setCfgTakeProfitPercent] = useState("10");
  const [cfgUnitSize, setCfgUnitSize] = useState("500000");
  const [cfgLineUnits, setCfgLineUnits] = useState<Record<number, number>>({
    10: 1, 20: 1, 30: 1, 40: 1, 50: 1,
  });

  useEffect(() => {
    if (modelConfig) {
      setCfgMaxPositions(String(modelConfig.maxPositions ?? 25));
      const slc = modelConfig.stopLossConfig;
      if (slc) {
        setCfgStopLossColor(slc.color ?? 'green');
        setCfgStopLossPercent(String(slc.percent ?? 5));
      }
      setCfgTakeProfitPercent(String(modelConfig.takeProfitPercent ?? 10));
      setCfgUnitSize(String(modelConfig.unitSize ?? 500000));
      if (modelConfig.lineUnits && typeof modelConfig.lineUnits === 'object') {
        setCfgLineUnits(modelConfig.lineUnits);
        setEntryLadder(lineUnitsToEntryLadder(modelConfig.lineUnits));
      }
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
    const us = parseFloat(cfgUnitSize);
    if (isNaN(mp) || mp < 1) { toast({ variant: "destructive", title: "최대 보유 종목은 1 이상이어야 합니다" }); return; }
    if (isNaN(slp) || slp <= 0) { toast({ variant: "destructive", title: "손절 % 값이 올바르지 않습니다" }); return; }
    if (isNaN(tp) || tp <= 0) { toast({ variant: "destructive", title: "익절 % 값이 올바르지 않습니다" }); return; }
    if (isNaN(us) || us < 10000) { toast({ variant: "destructive", title: "1유닛 금액은 10,000원 이상이어야 합니다" }); return; }
    configSaveMutation.mutate({
      ...(modelConfig || {}),
      maxPositions: mp,
      stopLossConfig: { color: cfgStopLossColor, percent: slp },
      takeProfitPercent: tp,
      unitSize: us,
      lineUnits: cfgLineUnits,
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
  const [enableDynamicExit, setEnableDynamicExit] = useState(true);
  const [stalePeriodDays, setStalePeriodDays] = useState("5");
  const [surgeThreshold, setSurgeThreshold] = useState("10");
  const [volumeSpikeMultiplier, setVolumeSpikeMultiplier] = useState("3");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  // AI 설정
  const [minAiConfidence, setMinAiConfidence] = useState(70);
  const [themeWeight, setThemeWeight] = useState(20);
  const [newsWeight, setNewsWeight] = useState(15);
  const [financialsWeight, setFinancialsWeight] = useState(25);
  const [liquidityWeight, setLiquidityWeight] = useState(20);
  const [institutionalWeight, setInstitutionalWeight] = useState(20);
  const [requireGoodFinancials, setRequireGoodFinancials] = useState(true);
  const [financialsScoreThreshold, setFinancialsScoreThreshold] = useState(60);
  const [requireHighLiquidity, setRequireHighLiquidity] = useState(true);
  const [liquidityScoreThreshold, setLiquidityScoreThreshold] = useState(40);
  const [requireMarketIssue, setRequireMarketIssue] = useState(false);
  const [filterInvestmentWarnings, setFilterInvestmentWarnings] = useState(false);

  // 10~30%: 빨강/주황/노랑 (고점근처) → 매수 0, 익절 매도
  // 50%: 초록 CL 시작 → 첫 매수 타점
  // line = 저점→고점 위치(%). 50=CL(초록,첫매수), 40이하=추가매수, 60이상=매도
  const defaultRainbowLines = [
    { line: 10,  buyWeight: 10, sellWeight:   0 }, // 연보 (90% 하락) - 추가 매수
    { line: 20,  buyWeight: 20, sellWeight:   0 }, // 보라 (80% 하락) - 추가 매수
    { line: 30,  buyWeight: 30, sellWeight:   0 }, // 남색 (70% 하락) - 추가 매수
    { line: 40,  buyWeight: 40, sellWeight:   0 }, // 파랑 (60% 하락) - 추가 매수
    { line: 50,  buyWeight: 80, sellWeight:   0 }, // 초록 CL (50% 하락) - 핵심 매수
    { line: 60,  buyWeight:  0, sellWeight:  20 }, // 노랑 (40% 하락) - 매도 시작
    { line: 70,  buyWeight:  0, sellWeight:  50 }, // 주황 (30% 하락) - 매도
    { line: 80,  buyWeight:  0, sellWeight:  80 }, // 빨강 (20% 하락) - 강한 매도
    { line: 90,  buyWeight:  0, sellWeight:  90 }, // 핑크 (10% 하락) - 강한 매도
    { line: 100, buyWeight:  0, sellWeight: 100 }, // 흑 (최고점) - 과매수
  ];
  const [rainbowLineSettings, setRainbowLineSettings] = useState<{ line: number; buyWeight: number; sellWeight: number }[]>(defaultRainbowLines);

  // ── 신규 AI 전략 설정 ──
  const [baseUnitSize, setBaseUnitSize] = useState("500000");
  const [maxUnitsPerStock, setMaxUnitsPerStock] = useState("5");
  const [stopLossMode, setStopLossMode] = useState("soft_ai_first");
  const [hardCutLossPct, setHardCutLossPct] = useState("10");
  const [entryLadder, setEntryLadder] = useState<{ line: number; units: number }[]>([
    { line: 50, units: 1 }, { line: 40, units: 1 }, { line: 30, units: 1 },
    { line: 20, units: 1 }, { line: 10, units: 1 },
  ]);
  const [allowAiDoubleDown, setAllowAiDoubleDown] = useState(false);
  const [allowAiPartialTakeProfit, setAllowAiPartialTakeProfit] = useState(false);
  const [allowAiHoldBeyondTarget, setAllowAiHoldBeyondTarget] = useState(false);
  const [allowSpeculativeLeaderTrades, setAllowSpeculativeLeaderTrades] = useState(false);
  const [candidateDecisionCooldownMode, setCandidateDecisionCooldownMode] = useState<CandidateDecisionCooldownMode>("interval_120m");
  const [disableReevaluationForBoughtToday, setDisableReevaluationForBoughtToday] = useState(false);
  const [timeCapitalEnabled, setTimeCapitalEnabled] = useState(true);
  const [timeCapitalMode, setTimeCapitalMode] = useState<TimeCapitalPolicyMode>("mock_apply");
  const [timeCapitalWarnBelowScore, setTimeCapitalWarnBelowScore] = useState("-10");
  const [timeCapitalBlockBelowScore, setTimeCapitalBlockBelowScore] = useState("-25");
  const [timeCapitalBlockTrapRatePct, setTimeCapitalBlockTrapRatePct] = useState("40");
  const [timeCapitalMinClosedTrades, setTimeCapitalMinClosedTrades] = useState("20");
  const [timeCapitalScaleInBlockTrapRatePct, setTimeCapitalScaleInBlockTrapRatePct] = useState("35");
  const [timeCapitalTightenExitAfterDays, setTimeCapitalTightenExitAfterDays] = useState("20");
  const [timeCapitalTightenExitMinProfitPct, setTimeCapitalTightenExitMinProfitPct] = useState("2");
  const [conditionSequences, setConditionSequences] = useState<{ conditionId: string; name: string }[]>([]);

  useEffect(() => {
    setCfgLineUnits(entryLadderToLineUnits(entryLadder));
  }, [entryLadder]);

  // 키움 조건검색식 목록 (에이전트 연결 시 로드)
  const { data: kiwoomConditions = [] } = useQuery<{ condition_index: number; condition_name: string }[]>({
    queryKey: ["/api/kiwoom/conditions"],
    retry: false,
    staleTime: 60000,
  });

  useEffect(() => {
    if (settings) {
      const toInt = (v: any, def: string) => { const n = Math.floor(parseFloat(String(v ?? ''))); return (isFinite(n) && n > 0) ? String(n) : def; };
      setDefaultPositionSize(toInt(settings.defaultPositionSize, "1000000"));
      setMaxPositionSize(toInt(settings.maxPositionSize, "10000000"));
      setMaxDailyTrades(toInt(settings.maxDailyTrades, "5"));
      setEnableDynamicExit(settings.enableDynamicExit ?? true);
      setStalePeriodDays(toInt(settings.stalePeriodDays, "5"));
      setSurgeThreshold(toInt(settings.surgeThreshold, "10"));
      setVolumeSpikeMultiplier(toInt(settings.volumeSpikeMultiplier, "3"));
      if (settings.rainbowLineSettings && Array.isArray(settings.rainbowLineSettings) && (settings.rainbowLineSettings as any[]).length === 10) {
        setRainbowLineSettings(settings.rainbowLineSettings as any[]);
      }
      // AI 설정 로드
      setMinAiConfidence(parseFloat(settings.minAiConfidence?.toString() || "70"));
      setThemeWeight(parseFloat(settings.themeWeight?.toString() || "20"));
      setNewsWeight(parseFloat(settings.newsWeight?.toString() || "15"));
      setFinancialsWeight(parseFloat(settings.financialsWeight?.toString() || "25"));
      setLiquidityWeight(parseFloat(settings.liquidityWeight?.toString() || "20"));
      setInstitutionalWeight(parseFloat(settings.institutionalWeight?.toString() || "20"));
      setRequireGoodFinancials(settings.requireGoodFinancials ?? true);
      setFinancialsScoreThreshold(parseFloat(settings.financialsScoreThreshold?.toString() || "60"));
      setRequireHighLiquidity(settings.requireHighLiquidity ?? true);
      setLiquidityScoreThreshold(parseFloat(settings.liquidityScoreThreshold?.toString() || "40"));
      setRequireMarketIssue(settings.requireMarketIssue ?? false);
      setFilterInvestmentWarnings(settings.filterInvestmentWarnings ?? true);
      // 신규 설정 로드
      if (settings.baseUnitSize) setBaseUnitSize(settings.baseUnitSize.toString());
      if (settings.maxUnitsPerStock) setMaxUnitsPerStock(settings.maxUnitsPerStock.toString());
      const slp = settings.stopLossPolicy as any;
      if (slp?.mode) setStopLossMode(slp.mode);
      if (slp?.hardCutLossPct) setHardCutLossPct(String(slp.hardCutLossPct));
      if (settings.entryLadderSettings && Array.isArray(settings.entryLadderSettings)) {
        setEntryLadder(settings.entryLadderSettings as any);
      }
      if (modelConfig?.lineUnits && typeof modelConfig.lineUnits === "object") {
        setEntryLadder(lineUnitsToEntryLadder(modelConfig.lineUnits));
      }
      setAllowAiDoubleDown(settings.allowAiDoubleDown ?? false);
      setAllowAiPartialTakeProfit(settings.allowAiPartialTakeProfit ?? false);
      setAllowAiHoldBeyondTarget(settings.allowAiHoldBeyondTarget ?? false);
      setAllowSpeculativeLeaderTrades(settings.allowSpeculativeLeaderTrades ?? false);
      const storedCooldownMode = (settings.aiEntryPolicy as any)?.candidateDecisionCooldownMode;
      if (
        storedCooldownMode === "daily_three_slots"
        || storedCooldownMode === "daily_once"
        || storedCooldownMode === "interval_120m"
        || storedCooldownMode === "interval_60m"
        || storedCooldownMode === "interval_30m"
      ) {
        setCandidateDecisionCooldownMode(storedCooldownMode);
      }
      setDisableReevaluationForBoughtToday((settings.aiEntryPolicy as any)?.disableReevaluationForBoughtToday === true);
      const timeCapitalPolicy = (settings.aiEntryPolicy as any)?.timeCapitalPolicy ?? {};
      setTimeCapitalEnabled(timeCapitalPolicy.enabled !== false && timeCapitalPolicy.mode !== "disabled");
      if (
        timeCapitalPolicy.mode === "shadow_only"
        || timeCapitalPolicy.mode === "mock_apply"
        || timeCapitalPolicy.mode === "disabled"
      ) {
        setTimeCapitalMode(timeCapitalPolicy.mode);
      }
      setTimeCapitalWarnBelowScore(String(timeCapitalPolicy.warnBelowScore ?? -10));
      setTimeCapitalBlockBelowScore(String(timeCapitalPolicy.blockBelowScore ?? -25));
      setTimeCapitalBlockTrapRatePct(String(timeCapitalPolicy.blockTrapRatePct ?? 40));
      setTimeCapitalMinClosedTrades(String(timeCapitalPolicy.minClosedTradesForApply ?? 20));
      setTimeCapitalScaleInBlockTrapRatePct(String(timeCapitalPolicy.scaleInBlockTrapRatePct ?? 35));
      setTimeCapitalTightenExitAfterDays(String(timeCapitalPolicy.tightenExitAfterDays ?? 20));
      setTimeCapitalTightenExitMinProfitPct(String(timeCapitalPolicy.tightenExitMinProfitPct ?? 2));
      if (settings.conditionSearchSequences && Array.isArray(settings.conditionSearchSequences)) {
        setConditionSequences(settings.conditionSearchSequences as any);
      }
    }
  }, [settings, modelConfig]);

  useEffect(() => {
    if (modelConfig?.accountId) {
      setSelectedAccountId(String(modelConfig.accountId));
    }
  }, [modelConfig]);

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
    const totalWeight = themeWeight + newsWeight + financialsWeight + liquidityWeight + institutionalWeight;
    if (Math.abs(totalWeight - 100) > 0.01) {
      toast({ variant: "destructive", title: "AI 분석 가중치 합계가 100%여야 합니다", description: `현재 합계: ${totalWeight}%` });
      return;
    }

    if (selectedAccountId && selectedAccountId !== (modelConfig?.accountId?.toString() || "")) {
      onAccountChange(parseInt(selectedAccountId));
    }

    // entryLadder 검증
    const totalLadderUnits = entryLadder.reduce((s, r) => s + r.units, 0);
    const maxUParsed = parseInt(maxUnitsPerStock) || 5;
    if (totalLadderUnits > maxUParsed) {
      toast({ variant: "destructive", title: `라더 총 유닛(${totalLadderUnits})이 종목당 최대 유닛(${maxUParsed})을 초과합니다.` });
      return;
    }

    const syncedLineUnits = entryLadderToLineUnits(entryLadder);
    const parseNumberOr = (value: string, fallback: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const parseIntegerOr = (value: string, fallback: number) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    setCfgLineUnits(syncedLineUnits);
    void apiRequest("PATCH", `/api/ai/models/${modelId}`, {
      config: {
        ...(modelConfig || {}),
        lineUnits: syncedLineUnits,
      },
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/models"] });
    }).catch((e: any) => {
      toast({
        variant: "destructive",
        title: "라인별 유닛 동기화 실패",
        description: e?.message ?? "이전 형식(lineUnits) 동기화에 실패했습니다.",
      });
    });

    saveMutation.mutate({
      defaultPositionSize,
      maxPositionSize,
      maxDailyTrades: parseInt(maxDailyTrades),
      enableDynamicExit,
      stalePeriodDays: parseInt(stalePeriodDays),
      surgeThreshold,
      volumeSpikeMultiplier,
      rainbowLineSettings: parseFloat(cfgUnitSize) > 0
        ? rainbowLineSettings.map(r => r.line <= 50 ? { ...r, buyWeight: 100 } : r)
        : rainbowLineSettings,
      minAiConfidence,
      themeWeight,
      newsWeight,
      financialsWeight,
      liquidityWeight,
      institutionalWeight,
      requireGoodFinancials,
      financialsScoreThreshold,
      requireHighLiquidity,
      liquidityScoreThreshold,
      requireMarketIssue,
      filterInvestmentWarnings,
      // 신규 필드
      baseUnitSize,
      maxUnitsPerStock: maxUParsed,
      entryLadderSettings: entryLadder,
      stopLossPolicy: { mode: stopLossMode, hardCutLossPct: parseFloat(hardCutLossPct) || 10 },
      allowAiDoubleDown,
      allowAiPartialTakeProfit,
      allowAiHoldBeyondTarget,
      allowSpeculativeLeaderTrades,
      aiEntryPolicy: {
        ...((settings?.aiEntryPolicy as any) ?? {}),
        candidateDecisionCooldownMode,
        disableReevaluationForBoughtToday,
        timeCapitalPolicy: {
          ...(((settings?.aiEntryPolicy as any)?.timeCapitalPolicy as any) ?? {}),
          enabled: timeCapitalEnabled,
          mode: timeCapitalEnabled ? timeCapitalMode : "disabled",
          applyToReal: false,
          warnBelowScore: parseNumberOr(timeCapitalWarnBelowScore, -10),
          blockBelowScore: parseNumberOr(timeCapitalBlockBelowScore, -25),
          blockTrapRatePct: parseNumberOr(timeCapitalBlockTrapRatePct, 40),
          minClosedTradesForApply: parseIntegerOr(timeCapitalMinClosedTrades, 20),
          scaleInBlockTrapRatePct: parseNumberOr(timeCapitalScaleInBlockTrapRatePct, 35),
          scaleInBlockBelowScore: -12,
          tightenExitAfterDays: parseIntegerOr(timeCapitalTightenExitAfterDays, 20),
          tightenExitMinProfitPct: parseNumberOr(timeCapitalTightenExitMinProfitPct, 2),
          tightenExitPartialRatio: 0.5,
        },
      },
      conditionSearchSequences: conditionSequences,
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
  const formatAccountNumber = (accountNumber: string) => {
    const digits = accountNumber.replace(/\D/g, "");
    if (digits.length === 10) {
      const productCode = digits.slice(8);
      const productLabel = productCode === "11" ? "위탁" : productCode === "10" ? "위탁종합" : "상품코드";
      return `${digits.slice(0, 8)}-${productCode} · ${productLabel}`;
    }
    return accountNumber;
  };
  const selectedAccount = accounts.find((account) => String(account.id) === selectedAccountId);
  const selectedHasApiKey = !!(selectedAccount as KiwoomAccount & { hasApiKey?: boolean } | undefined)?.hasApiKey;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4" />
          자동매매 설정
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* ── 레거시 설정 감지 경고 ── */}
        {(modelConfig?.stopLossConfig || modelConfig?.lineUnits) && (
          <div className="flex gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-medium">구형 설정이 감지되었습니다</p>
              <p className="text-xs">
                이 모델은 <code className="font-mono">stopLossConfig</code> / <code className="font-mono">lineUnits</code> 형식을 사용 중입니다.
                아래 <strong>손절 정책</strong>·<strong>5단계 분할매수 라더</strong> 섹션에서 동일한 내용을 설정한 뒤 저장하면 신규 방식으로 전환됩니다.
              </p>
            </div>
          </div>
        )}

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

          {/* 유닛 설정 */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Layers className="h-3 w-3" />1유닛 금액
            </Label>
            <Input
              type="number"
              min={10000}
              step={10000}
              value={cfgUnitSize}
              onChange={(e) => {
                setCfgUnitSize(e.target.value);
                if (parseFloat(e.target.value) > 0) setBaseUnitSize(e.target.value);
              }}
              data-testid="input-cfg-unit-size"
            />
            <span className="text-xs text-muted-foreground">{formatKRW(cfgUnitSize)}</span>
            <p className="text-xs text-muted-foreground">매수 시 1유닛 기준 금액 (유닛 수 x 이 금액 = 매수금액)</p>
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
          <div
            className="rounded-md border bg-muted/30 px-3 py-3 space-y-2"
            data-testid="card-current-model-account"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">현재 연결 계좌</p>
                <p className="font-medium" data-testid="text-current-model-account">
                  {selectedAccount
                    ? `${selectedAccount.accountName || formatAccountNumber(selectedAccount.accountNumber)} (${formatAccountNumber(selectedAccount.accountNumber)})`
                    : "연결된 계좌 없음"}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {selectedAccount ? (
                  <>
                    <Badge variant={selectedAccount.accountType === "real" ? "default" : "secondary"}>
                      {selectedAccount.accountType === "real" ? "실전" : "모의"}
                    </Badge>
                    <Badge variant={selectedAccount.isActive === false ? "outline" : "secondary"}>
                      {selectedAccount.isActive === false ? "보관" : "활성"}
                    </Badge>
                    <Badge variant={selectedHasApiKey ? "secondary" : "destructive"}>
                      {selectedHasApiKey ? "API 키 등록" : "API 키 없음"}
                    </Badge>
                  </>
                ) : (
                  <Badge variant="destructive">계좌 미설정</Badge>
                )}
              </div>
            </div>
            {selectedAccount?.isActive === false && (
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                보관 계좌에 연결된 모델입니다. 새 계좌로 바꾼 뒤 저장하면 과거 실적은 유지되고 이후 거래만 새 계좌로 쌓입니다.
              </p>
            )}
          </div>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger data-testid="select-trading-account">
              <SelectValue placeholder="계좌를 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={String(account.id)}>
                  {account.accountName || formatAccountNumber(account.accountNumber)} ({account.accountType === 'real' ? '실계좌' : '모의'})
                  {account.isActive === false ? " · 보관" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">일일 최대 거래 횟수</Label>
            <Input
              type="number"
              value={maxDailyTrades}
              onChange={(e) => setMaxDailyTrades(e.target.value)}
              data-testid="input-max-daily-trades"
            />
          </div>
          <details className="rounded-md border border-border/60 p-3">
            <summary className="cursor-pointer text-sm font-medium">고급(예비값): 기본/최대 매매금액</summary>
            <p className="mt-2 text-xs text-muted-foreground">
              현재는 유닛 기반 설정이 우선이며, 아래 값은 예비 계산 경로에서 사용됩니다.
            </p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
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
          </details>
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

        {/* AI 최소 신뢰도 */}
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

        {/* AI 분석 가중치 */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">AI 분석 가중치</Label>
            <span className={`text-xs font-mono ${Math.abs(themeWeight + newsWeight + financialsWeight + liquidityWeight + institutionalWeight - 100) > 0.01 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
              합계: {themeWeight + newsWeight + financialsWeight + liquidityWeight + institutionalWeight}%
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

        {/* 진입 조건 필터 */}
        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold">진입 조건 필터</Label>
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">재무건전성 필수</Label>
                <Switch
                  checked={requireGoodFinancials}
                  onCheckedChange={setRequireGoodFinancials}
                  data-testid="switch-require-financials"
                />
              </div>
              {requireGoodFinancials && (
                <div className="flex items-center gap-2 pl-2">
                  <Label className="text-xs text-muted-foreground w-32">AI 재무점수 최소값</Label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={financialsScoreThreshold}
                    onChange={(e) => setFinancialsScoreThreshold(Number(e.target.value))}
                    className="w-16 text-xs border rounded px-2 py-1 text-center"
                  />
                  <span className="text-xs text-muted-foreground">점 이상</span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">높은 유동성 필수</Label>
                <Switch
                  checked={requireHighLiquidity}
                  onCheckedChange={setRequireHighLiquidity}
                  data-testid="switch-require-liquidity"
                />
              </div>
              {requireHighLiquidity && (
                <div className="flex items-center gap-2 pl-2">
                  <Label className="text-xs text-muted-foreground w-32">AI 유동성점수 최소값</Label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={liquidityScoreThreshold}
                    onChange={(e) => setLiquidityScoreThreshold(Number(e.target.value))}
                    className="w-16 text-xs border rounded px-2 py-1 text-center"
                  />
                  <span className="text-xs text-muted-foreground">점 이상</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">시장 이슈 관련 종목만</Label>
              <Switch
                checked={requireMarketIssue}
                onCheckedChange={setRequireMarketIssue}
                data-testid="switch-require-market-issue"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs">투자경고/위험/환기 필터</Label>
                <p className="text-[10px] text-muted-foreground">경고/위험/관리/환기 종목 매수 자동 차단</p>
              </div>
              <Switch
                checked={filterInvestmentWarnings}
                onCheckedChange={setFilterInvestmentWarnings}
                data-testid="switch-filter-investment-warnings"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold">레인보우 라인별 매수/매도 비중</Label>
          <p className="text-xs text-muted-foreground">240일 고점 대비 하락률별 매수/매도 비중. <span className="text-green-600 font-medium">50%=초록 CL(첫 매수)</span> / <span className="text-blue-500 font-medium">60~80%=파랑/남색(추가매수)</span> / <span className="text-orange-500 font-medium">10~30%=주황/노랑(익절구간)</span></p>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground font-medium pb-1">
              <span>라인 (하락%)</span>
              <span>매수 비중</span>
              <span>매도 비중</span>
            </div>
            {rainbowLineSettings.map((row, idx) => {
              const isCLLine = row.line <= 50;
              const unitLocked = isCLLine && parseFloat(cfgUnitSize) > 0;
              const displayBuyWeight = unitLocked ? 100 : row.buyWeight;
              return (
              <div key={row.line} className="grid grid-cols-3 gap-2 items-center">
                <span className="text-xs font-mono text-muted-foreground">{row.line}%</span>
                <div className="flex items-center gap-1">
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[displayBuyWeight]}
                    disabled={unitLocked}
                    onValueChange={([v]) => {
                      if (unitLocked) return;
                      const updated = [...rainbowLineSettings];
                      updated[idx] = { ...updated[idx], buyWeight: v };
                      setRainbowLineSettings(updated);
                    }}
                    className={unitLocked ? "opacity-50" : ""}
                    data-testid={`slider-rainbow-buy-${row.line}`}
                  />
                  <span className={`text-xs font-mono w-8 text-right ${unitLocked ? "text-cyan-500 font-bold" : ""}`}>{displayBuyWeight}%</span>
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
              );
            })}
          </div>
        </div>

        {/* ── 기본 유닛 / 종목당 상한 ── */}
        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Layers className="h-4 w-4" />유닛 및 자금 설정
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">기본 유닛 금액</Label>
              <Input type="number" min={10000} step={10000} value={baseUnitSize} onChange={(e) => setBaseUnitSize(e.target.value)} data-testid="input-base-unit-size" />
              <span className="text-xs text-muted-foreground">{formatKRW(baseUnitSize)}</span>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">종목당 최대 유닛</Label>
              <Input type="number" min={1} max={10} value={maxUnitsPerStock} onChange={(e) => setMaxUnitsPerStock(e.target.value)} data-testid="input-max-units-per-stock" />
              <span className="text-xs text-muted-foreground">최대 {maxUnitsPerStock}유닛 = {formatKRW(String(parseInt(baseUnitSize || '0') * parseInt(maxUnitsPerStock || '5')))}</span>
            </div>
          </div>
        </div>

        {/* ── 5단계 진입 라더 ── */}
        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <SlidersHorizontal className="h-4 w-4" />5단계 분할매수 라더
          </Label>
          <p className="text-xs text-muted-foreground">
            저장 시 <code className="font-mono">entryLadderSettings</code>와 이전 형식 <code className="font-mono">lineUnits</code>가 함께 동기화됩니다.
          </p>
          <p className="text-xs text-muted-foreground">각 CL라인 도달 시 진입할 유닛 수. 0이면 해당 라인에서 매수 안 함. AI가 2유닛을 제안할 수 있습니다 (AI 추가매수 허용 시).</p>
          <div className="grid grid-cols-5 gap-2">
            {entryLadder.map((step, idx) => (
              <div key={step.line} className="space-y-1 text-center">
                <Label className="text-xs text-muted-foreground block">{step.line}%</Label>
                <Input
                  type="number" min={0} max={5}
                  value={step.units}
                  onChange={(e) => {
                    const updated = [...entryLadder];
                    updated[idx] = { ...updated[idx], units: parseInt(e.target.value) || 0 };
                    setEntryLadder(updated);
                  }}
                  className="text-center"
                  data-testid={`input-ladder-${step.line}`}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">총 유닛: <span className="font-medium">{entryLadder.reduce((s, r) => s + r.units, 0)}</span> / 최대 {maxUnitsPerStock}</p>
        </div>

        {/* ── 손절 정책 ── */}
        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" />손절 정책
          </Label>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">손절 모드</Label>
            <Select value={stopLossMode} onValueChange={setStopLossMode}>
              <SelectTrigger data-testid="select-stop-loss-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STOP_LOSS_MODE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label} — {v.desc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {STOP_LOSS_MODE_LABELS[stopLossMode] && (
              <p className="text-xs text-muted-foreground">{STOP_LOSS_MODE_LABELS[stopLossMode].desc}</p>
            )}
          </div>
          {(stopLossMode === 'conditional' || stopLossMode === 'hard') && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">강제 손절 기준 손실률 (%)</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={50} step={0.5} value={hardCutLossPct} onChange={(e) => setHardCutLossPct(e.target.value)} className="flex-1" data-testid="input-hard-cut-loss" />
                <span className="text-sm text-muted-foreground whitespace-nowrap">% 손실 시</span>
              </div>
            </div>
          )}
        </div>

        {/* ── 조건검색식 설정 ── */}
        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold">선정/탈락 재평가 쿨다운</Label>
          <Select
            value={candidateDecisionCooldownMode}
            onValueChange={(value) => setCandidateDecisionCooldownMode(value as CandidateDecisionCooldownMode)}
          >
            <SelectTrigger data-testid="select-candidate-cooldown-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COOLDOWN_MODES.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            같은 종목은 선택한 주기 안에서 한 번만 재평가합니다. 중복 로그 폭증을 줄이고 판단 일관성을 높입니다.
          </p>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">당일 매수 종목 재평가 금지</p>
              <p className="text-xs text-muted-foreground">오늘 자동매수된 종목은 당일 후보 재평가(추가매수 판단)를 건너뜁니다.</p>
            </div>
            <Switch
              checked={disableReevaluationForBoughtToday}
              onCheckedChange={setDisableReevaluationForBoughtToday}
              data-testid="switch-disable-reeval-bought-today"
            />
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />시간·자본 효율 알고리즘
          </Label>
          <div className="rounded-md border border-cyan-200 bg-cyan-50/60 dark:bg-cyan-950/20 px-3 py-2 text-xs text-cyan-900 dark:text-cyan-100 space-y-1">
            <p className="font-medium">분석 데이터로 “빨리 수익 나는 자리”와 “돈이 오래 묶이는 자리”를 구분합니다.</p>
            <p>신규매수는 AI 신뢰도에 감점/가산을 적용하고, 위험한 추가매수 라인은 차단하며, 오래 보유한 수익 포지션은 이익실현을 보조합니다.</p>
            <p>기본값은 매도 완료 20건 이상부터 모의계좌만 실제 적용입니다. 기준 전에는 모의/실계좌 모두 Shadow 기록만 남깁니다.</p>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <p className="text-sm font-medium">시간·자본 효율 사용</p>
              <p className="text-xs text-muted-foreground">끄면 판단 로그에도 비활성으로 기록되고 매매에는 반영되지 않습니다.</p>
            </div>
            <Switch checked={timeCapitalEnabled} onCheckedChange={setTimeCapitalEnabled} data-testid="switch-time-capital-enabled" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">적용 모드</Label>
              <Select value={timeCapitalMode} onValueChange={(value) => setTimeCapitalMode(value as TimeCapitalPolicyMode)} disabled={!timeCapitalEnabled}>
                <SelectTrigger data-testid="select-time-capital-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock_apply">모의계좌 적용 + 실계좌 Shadow</SelectItem>
                  <SelectItem value="shadow_only">Shadow 기록만</SelectItem>
                  <SelectItem value="disabled">비활성</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">신규매수 경고 점수 이하</Label>
              <Input type="number" step="1" value={timeCapitalWarnBelowScore} onChange={(e) => setTimeCapitalWarnBelowScore(e.target.value)} data-testid="input-time-capital-warn-score" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">신규매수 차단 점수 이하</Label>
              <Input type="number" step="1" value={timeCapitalBlockBelowScore} onChange={(e) => setTimeCapitalBlockBelowScore(e.target.value)} data-testid="input-time-capital-block-score" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">자본묶임 차단률(%)</Label>
              <Input type="number" min="0" max="100" step="1" value={timeCapitalBlockTrapRatePct} onChange={(e) => setTimeCapitalBlockTrapRatePct(e.target.value)} data-testid="input-time-capital-trap-rate" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">적용 최소 매도 완료 건수</Label>
              <Input type="number" min="0" step="1" value={timeCapitalMinClosedTrades} onChange={(e) => setTimeCapitalMinClosedTrades(e.target.value)} data-testid="input-time-capital-min-closed-trades" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">추가매수 차단 자본묶임률(%)</Label>
              <Input type="number" min="0" max="100" step="1" value={timeCapitalScaleInBlockTrapRatePct} onChange={(e) => setTimeCapitalScaleInBlockTrapRatePct(e.target.value)} data-testid="input-time-capital-scale-trap-rate" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">매도 보조 보유일 기준</Label>
              <Input type="number" min="1" step="1" value={timeCapitalTightenExitAfterDays} onChange={(e) => setTimeCapitalTightenExitAfterDays(e.target.value)} data-testid="input-time-capital-exit-days" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs text-muted-foreground">매도 보조 최소 수익률(%)</Label>
              <Input type="number" min="0" step="0.1" value={timeCapitalTightenExitMinProfitPct} onChange={(e) => setTimeCapitalTightenExitMinProfitPct(e.target.value)} data-testid="input-time-capital-exit-profit" />
            </div>
          </div>
        </div>

        {/* ── 조건검색식 설정 ── */}
        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Search className="h-4 w-4" />조건검색식 (Kiwoom)
          </Label>
          <p className="text-xs text-muted-foreground">
            스캔 시 사용할 조건검색식 번호와 이름. 비어있으면 스캔이 실행되지 않습니다.
          </p>
          {conditionSequences.length === 0 && (
            <div className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              조건검색식이 없으면 후보 스캔이 실행되지 않습니다.
            </div>
          )}
          {kiwoomConditions.length === 0 && (
            <p className="text-xs text-muted-foreground">에이전트 연결 후 키움 조건목록이 로드됩니다.</p>
          )}
          <div className="space-y-2">
            {conditionSequences.map((seq, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                {kiwoomConditions.length > 0 ? (
                  <Select
                    value={seq.conditionId}
                    onValueChange={(val) => {
                      const found = kiwoomConditions.find(c => String(c.condition_index) === val);
                      const updated = [...conditionSequences];
                      updated[idx] = { conditionId: val, name: found?.condition_name ?? val };
                      setConditionSequences(updated);
                    }}
                  >
                    <SelectTrigger className="flex-1" data-testid={`select-condition-${idx}`}>
                      <SelectValue placeholder="조건식 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {kiwoomConditions.map(c => (
                        <SelectItem key={c.condition_index} value={String(c.condition_index)}>{c.condition_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <Input
                      value={seq.conditionId}
                      onChange={(e) => {
                        const updated = [...conditionSequences];
                        updated[idx] = { ...updated[idx], conditionId: e.target.value };
                        setConditionSequences(updated);
                      }}
                      placeholder="번호"
                      className="w-20 text-center font-mono"
                      data-testid={`input-condition-id-${idx}`}
                    />
                    <Input
                      value={seq.name}
                      onChange={(e) => {
                        const updated = [...conditionSequences];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setConditionSequences(updated);
                      }}
                      placeholder="이름"
                      className="flex-1"
                      data-testid={`input-condition-name-${idx}`}
                    />
                  </>
                )}
                <Button
                  size="icon" variant="ghost"
                  onClick={() => setConditionSequences(conditionSequences.filter((_, i) => i !== idx))}
                  data-testid={`button-remove-condition-${idx}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            size="sm" variant="outline" className="w-full gap-1.5"
            onClick={() => setConditionSequences([...conditionSequences, { conditionId: '', name: '' }])}
            data-testid="button-add-condition"
          >
            <Plus className="h-3.5 w-3.5" />조건검색식 추가
          </Button>
        </div>

        {/* ── AI 재량 설정 ── */}
        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Brain className="h-4 w-4" />AI 재량 설정
          </Label>
          <div className="space-y-2">
            {[
              { label: 'AI 추가매수 허용 (2유닛)', desc: '특정 하위 라인에서 AI가 2유닛 매수를 제안할 수 있음', value: allowAiDoubleDown, setter: setAllowAiDoubleDown, testId: 'switch-allow-double-down' },
              { label: 'AI 부분익절 허용', desc: '목표가 도달 전 AI가 일부 수량 익절을 제안할 수 있음', value: allowAiPartialTakeProfit, setter: setAllowAiPartialTakeProfit, testId: 'switch-allow-partial-profit' },
              { label: 'AI 목표초과 보유 허용', desc: '목표가 초과 후에도 AI가 추가 보유를 판단할 수 있음', value: allowAiHoldBeyondTarget, setter: setAllowAiHoldBeyondTarget, testId: 'switch-allow-hold-beyond' },
              { label: 'AI 세력/급등주 투자 허용', desc: '기본 필터를 통과하지 못해도 AI가 세력·테마 급등주 진입을 제안할 수 있음', value: allowSpeculativeLeaderTrades, setter: setAllowSpeculativeLeaderTrades, testId: 'switch-allow-speculative' },
            ].map(({ label, desc, value, setter, testId }) => (
              <div key={testId}>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{label}</Label>
                  <Switch checked={value} onCheckedChange={setter} data-testid={testId} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
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
