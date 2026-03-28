import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// ─── 타입 ───────────────────────────────────────────────────────────────────

type ChartPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  candleRange?: [number, number];
  formulaValue?: number | null;
};

type SignalDot = {
  id: number;
  chartDate: string;
  chartPrice: number;
  signal: "buy" | "hold";
};

type OverlayLine = {
  values: { date: string; value: number | null }[];
  color?: string;
  name?: string;
};

export interface StockCandleChartProps {
  stockCode: string;
  stockName?: string;
  height?: number;
  defaultShowRainbow?: boolean;
  /** 비제어(기본): defaultPeriod 사용. 제어: period + onPeriodChange 함께 전달 */
  defaultPeriod?: "D" | "W" | "M";
  period?: "D" | "W" | "M";
  onPeriodChange?: (p: "D" | "W" | "M") => void;
  defaultChartType?: "candle" | "line";
  overlayLine?: OverlayLine | null;
  signalDots?: SignalDot[];
  formulaSelector?: React.ReactNode;
  className?: string;
}

// ─── 캔들 렌더러 ─────────────────────────────────────────────────────────────

type CandlePayload = { open: number; close: number; high: number; low: number };

function isCandlePayload(p: unknown): p is CandlePayload {
  return (
    typeof p === "object" && p !== null &&
    typeof (p as CandlePayload).open === "number" &&
    typeof (p as CandlePayload).close === "number" &&
    typeof (p as CandlePayload).high === "number" &&
    typeof (p as CandlePayload).low === "number"
  );
}

function CandleStickShape(props: unknown) {
  if (typeof props !== "object" || props === null) return <g />;
  const p = props as Record<string, unknown>;
  const nx = Number(p.x ?? 0);
  const ny = Number(p.y ?? 0);
  const nw = Number(p.width ?? 0);
  const nh = Number(p.height ?? 0);
  if (!isCandlePayload(p.payload) || nh <= 0 || nw <= 0) return <g />;
  const { open, close, high, low } = p.payload;
  const isUp = close >= open;
  const color = isUp ? "#ef4444" : "#3b82f6";
  const centerX = nx + nw / 2;
  const range = high - low;
  if (range === 0) {
    return <g><line x1={centerX} y1={ny} x2={centerX} y2={ny + nh} stroke={color} strokeWidth={1} /></g>;
  }
  const bodyTopRaw = Math.max(open, close);
  const bodyBottomRaw = Math.min(open, close);
  const bodyTop = ny + nh * (high - bodyTopRaw) / range;
  const bodyH = Math.max(1, nh * (bodyTopRaw - bodyBottomRaw) / range);
  return (
    <g>
      <line x1={centerX} y1={ny} x2={centerX} y2={ny + nh} stroke={color} strokeWidth={1} />
      <rect x={nx + 1} y={bodyTop} width={Math.max(1, nw - 2)} height={bodyH} fill={color} stroke={color} strokeWidth={0.5} />
    </g>
  );
}

function ChartStatusMessage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center text-muted-foreground" style={{ minHeight: 200 }}>
      <AlertCircle className="h-5 w-5" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-md text-xs">{description}</p>}
    </div>
  );
}

// 레인보우 라인별 색상·두께 설정 (line0=MIN ~ line10=MAX)
const RAINBOW_LINE_CONFIG = [
  { key: "line0",  label: "MIN", color: "#7c3aed", width: 1.5 },
  { key: "line1",  label: "10%", color: "#ef4444", width: 1   },
  { key: "line2",  label: "20%", color: "#f97316", width: 1   },
  { key: "line3",  label: "30%", color: "#eab308", width: 1   },
  { key: "line4",  label: "40%", color: "#64748b", width: 1   },
  { key: "line5",  label: "CL",  color: "#22c55e", width: 2   },
  { key: "line6",  label: "60%", color: "#64748b", width: 1   },
  { key: "line7",  label: "70%", color: "#3b82f6", width: 1   },
  { key: "line8",  label: "80%", color: "#1e40af", width: 1   },
  { key: "line9",  label: "90%", color: "#334155", width: 1   },
  { key: "line10", label: "MAX", color: "#0f172a", width: 1.5 },
] as const;

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export function StockCandleChart({
  stockCode,
  stockName: _stockName,
  height = 320,
  defaultShowRainbow = false,
  defaultPeriod = "D",
  period: controlledPeriod,
  onPeriodChange,
  defaultChartType = "candle",
  overlayLine,
  signalDots,
  formulaSelector,
  className,
}: StockCandleChartProps) {
  const [chartType, setChartType] = useState<"candle" | "line">(defaultChartType);
  const [internalPeriod, setInternalPeriod] = useState<"D" | "W" | "M">(defaultPeriod);
  const [showRainbow, setShowRainbow] = useState(defaultShowRainbow);

  // 제어/비제어 period 지원
  const period = controlledPeriod ?? internalPeriod;
  const setPeriod = (p: "D" | "W" | "M") => {
    setInternalPeriod(p);
    onPeriodChange?.(p);
  };

  // 레인보우 ON → /rainbow-chart (per-bar OHLCV+라인, oldest-first)
  // 레인보우 OFF → /chart (OHLCV, newest-first → reverse)
  const { data: rawChartData = [], isPending: chartLoading, error: chartError } = useQuery<ChartPoint[]>({
    queryKey: ["stock-chart", stockCode, period, showRainbow],
    enabled: !!stockCode,
    queryFn: async () => {
      if (showRainbow) {
        const res = await apiRequest("GET", `/api/stocks/${stockCode}/rainbow-chart?period=${period}`);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } else {
        const res = await apiRequest("GET", `/api/stocks/${stockCode}/chart?period=${period}`);
        const data = await res.json();
        // Kiwoom는 최신순(newest-first) → oldest-first로 역순
        return Array.isArray(data) ? [...data].reverse() : [];
      }
    },
  });

  // 레인보우 ON 여부 (per-bar 데이터에 라인이 포함됨)
  const hasRainbowData = showRainbow && rawChartData.length > 0 && "line5" in (rawChartData[0] ?? {});

  // 차트 데이터 + 캔들 범위 + 수식 오버레이 병합
  const chartData = useMemo<ChartPoint[]>(() => {
    if (!rawChartData.length) return [];
    const overlayMap: Record<string, number | null> = {};
    if (overlayLine) {
      for (const pt of overlayLine.values) overlayMap[pt.date] = pt.value;
    }
    return rawChartData.map((bar) => ({
      ...bar,
      candleRange: [bar.low, bar.high] as [number, number],
      formulaValue: overlayLine ? (overlayMap[bar.date] ?? null) : undefined,
    }));
  }, [rawChartData, overlayLine]);

  // 레인보우 로딩 상태 (rainbow-chart 재요청 중)
  const rainbowLoading = chartLoading && showRainbow;

  const formatCurrency = (v: number) =>
    isNaN(v) ? "-" : `₩${Math.round(v).toLocaleString("ko-KR")}`;

  const chartState =
    !stockCode ? "empty"
    : chartLoading ? "loading"
    : chartError ? "error"
    : chartData.length === 0 ? "no-data"
    : "ready";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={chartType === "candle" ? "default" : "outline"}
            onClick={() => setChartType("candle")}
            className="text-xs"
            data-testid="button-chart-candle"
          >
            봉차트
          </Button>
          <Button
            size="sm"
            variant={chartType === "line" ? "default" : "outline"}
            onClick={() => setChartType("line")}
            className="text-xs"
            data-testid="button-chart-line"
          >
            선차트
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={(v: "D" | "W" | "M") => setPeriod(v)}>
            <SelectTrigger className="w-20" data-testid="select-chart-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="D">일봉</SelectItem>
              <SelectItem value="W">주봉</SelectItem>
              <SelectItem value="M">월봉</SelectItem>
            </SelectContent>
          </Select>

          {formulaSelector}

          {showRainbow && hasRainbowData && (
            <Badge variant="outline" className="text-xs">
              레인보우 240일
            </Badge>
          )}

          <Button
            size="sm"
            variant={showRainbow ? "default" : "outline"}
            onClick={() => setShowRainbow((v) => !v)}
            disabled={rainbowLoading || !stockCode}
            className="text-xs"
            data-testid="button-toggle-rainbow"
          >
            {rainbowLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {showRainbow ? "레인보우 ON" : "레인보우"}
          </Button>
        </div>
      </div>

      {chartState === "ready" ? (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            />
            <Tooltip
              formatter={(value: number | number[], name: string) => {
                if (name === "가격" && Array.isArray(value)) {
                  return [`${formatCurrency(value[0])} ~ ${formatCurrency(value[1])}`, "고저"];
                }
                return [formatCurrency(Number(value)), name];
              }}
            />

            {chartType === "line" && (
              <Line type="monotone" dataKey="close" stroke="#8884d8" strokeWidth={2} dot={false} name="종가" />
            )}
            {chartType === "candle" && (
              <Bar
                dataKey="candleRange"
                shape={CandleStickShape}
                maxBarSize={14}
                isAnimationActive={false}
                name="가격"
              />
            )}

            {overlayLine && (
              <Line
                type="monotone"
                dataKey="formulaValue"
                stroke={overlayLine.color || "#8b5cf6"}
                dot={false}
                strokeWidth={2}
                name={overlayLine.name || "수식"}
                connectNulls
              />
            )}

            {hasRainbowData &&
              RAINBOW_LINE_CONFIG.map((cfg) => (
                <Line
                  key={cfg.key}
                  type="stepAfter"
                  dataKey={cfg.key}
                  stroke={cfg.color}
                  strokeWidth={cfg.width}
                  dot={false}
                  isAnimationActive={false}
                  name={cfg.label}
                  connectNulls
                  strokeDasharray={cfg.label === "CL" || cfg.label === "MAX" || cfg.label === "MIN" ? "0" : "4 2"}
                  label={
                    cfg.label === "CL" || cfg.label === "MAX" || cfg.label === "MIN"
                      ? { value: cfg.label, fill: cfg.color, fontSize: 9, position: "insideTopRight" }
                      : undefined
                  }
                />
              ))}

            {signalDots?.map((signal, idx) => (
              <ReferenceDot
                key={`signal-${signal.id}-${idx}`}
                x={signal.chartDate}
                y={signal.chartPrice}
                r={5}
                fill={signal.signal === "buy" ? "#22c55e" : "#f59e0b"}
                stroke={signal.signal === "buy" ? "#15803d" : "#b45309"}
                ifOverflow="visible"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      ) : chartState === "loading" ? (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground" style={{ minHeight: height }}>
          <Loader2 className="h-4 w-4 animate-spin" /> 차트 데이터를 불러오는 중입니다.
        </div>
      ) : chartState === "error" ? (
        <ChartStatusMessage
          title="차트 조회에 실패했습니다."
          description={chartError instanceof Error ? chartError.message : "에이전트 연결 또는 응답 데이터를 확인해주세요."}
        />
      ) : chartState === "no-data" ? (
        <ChartStatusMessage
          title="차트 데이터가 없습니다."
          description="선택한 종목에 대한 응답은 왔지만 차트 데이터가 비어 있습니다."
        />
      ) : (
        <ChartStatusMessage
          title="종목을 먼저 선택해주세요."
          description="검색 결과에서 종목을 선택하면 차트가 표시됩니다."
        />
      )}
    </div>
  );
}
