import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, ZoomIn, ZoomOut } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

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
  defaultPeriod?: "D" | "W" | "M";
  period?: "D" | "W" | "M";
  onPeriodChange?: (p: "D" | "W" | "M") => void;
  defaultChartType?: "candle" | "line";
  overlayLine?: OverlayLine | null;
  signalDots?: SignalDot[];
  formulaSelector?: React.ReactNode;
  className?: string;
}

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

const RAINBOW_LINES = [
  { key: "line0",  label: "MIN", color: "#7c3aed", width: 1.5, dash: ""    },
  { key: "line1",  label: "",    color: "#ef4444", width: 0.7, dash: "3 2" },
  { key: "line2",  label: "",    color: "#f97316", width: 0.7, dash: "3 2" },
  { key: "line3",  label: "",    color: "#eab308", width: 0.7, dash: "3 2" },
  { key: "line4",  label: "",    color: "#94a3b8", width: 0.7, dash: "3 2" },
  { key: "line5",  label: "CL",  color: "#22c55e", width: 2,   dash: ""    },
  { key: "line6",  label: "",    color: "#94a3b8", width: 0.7, dash: "3 2" },
  { key: "line7",  label: "",    color: "#3b82f6", width: 0.7, dash: "3 2" },
  { key: "line8",  label: "",    color: "#1e40af", width: 0.7, dash: "3 2" },
  { key: "line9",  label: "",    color: "#64748b", width: 0.7, dash: "3 2" },
  { key: "line10", label: "MAX", color: "#0f172a", width: 1.5, dash: ""    },
] as const;

const ZOOM_STEPS = [
  { bars: 5,   label: "1주" },
  { bars: 20,  label: "1개월" },
  { bars: 60,  label: "3개월" },
  { bars: 120, label: "6개월" },
  { bars: 240, label: "1년" },
  { bars: 480, label: "2년" },
] as const;

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
  const [zoomIdx, setZoomIdx] = useState(3);

  const period = controlledPeriod ?? internalPeriod;
  const setPeriod = (p: "D" | "W" | "M") => {
    setInternalPeriod(p);
    onPeriodChange?.(p);
  };

  const zoomIn = useCallback(() => setZoomIdx((i) => Math.max(0, i - 1)), []);
  const zoomOut = useCallback(() => setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1)), []);
  const visibleBars = ZOOM_STEPS[zoomIdx].bars;

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
        return Array.isArray(data) ? [...data].reverse() : [];
      }
    },
  });

  const hasRainbowData = showRainbow && rawChartData.length > 0 && "line5" in (rawChartData[0] ?? {});

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!rawChartData.length) return [];
    const overlayMap: Record<string, number | null> = {};
    if (overlayLine) {
      for (const pt of overlayLine.values) overlayMap[pt.date] = pt.value;
    }

    const sliced = rawChartData.length > visibleBars
      ? rawChartData.slice(-visibleBars)
      : rawChartData;

    return sliced.map((bar) => ({
      ...bar,
      date: formatDateLabel(bar.date),
      candleRange: [bar.low, bar.high] as [number, number],
      formulaValue: overlayLine ? (overlayMap[bar.date] ?? null) : undefined,
    }));
  }, [rawChartData, overlayLine, visibleBars]);

  const rainbowLoading = chartLoading && showRainbow;

  const formatCurrency = (v: number) =>
    isNaN(v) ? "-" : `₩${Math.round(v).toLocaleString("ko-KR")}`;

  const chartState =
    !stockCode ? "empty"
    : chartLoading ? "loading"
    : chartError ? "error"
    : chartData.length === 0 ? "no-data"
    : "ready";

  const lastBar = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1">
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

          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={zoomIn} disabled={zoomIdx <= 0} data-testid="button-zoom-in">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center font-mono" data-testid="text-zoom-level">
              {ZOOM_STEPS[zoomIdx].label}
            </span>
            <Button size="icon" variant="ghost" onClick={zoomOut} disabled={zoomIdx >= ZOOM_STEPS.length - 1} data-testid="button-zoom-out">
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>

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
        <div className="relative">
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={chartData} margin={{ top: 4, right: hasRainbowData ? 48 : 4, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                interval={chartData.length > 60 ? Math.floor(chartData.length / 8) : "preserveStartEnd"}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v)}
              />
              <Tooltip
                formatter={(value: number | number[], name: string) => {
                  if (name === "가격" && Array.isArray(value)) {
                    return [`${formatCurrency(value[0])} ~ ${formatCurrency(value[1])}`, "고저"];
                  }
                  if (RAINBOW_LINES.some((l) => l.key === name || l.label === name)) return [null, null];
                  return [formatCurrency(Number(value)), name];
                }}
                content={hasRainbowData ? undefined : undefined}
              />

              {hasRainbowData &&
                RAINBOW_LINES.map((cfg) => (
                  <Line
                    key={cfg.key}
                    type="stepAfter"
                    dataKey={cfg.key}
                    stroke={cfg.color}
                    strokeWidth={cfg.width}
                    dot={false}
                    isAnimationActive={false}
                    name={cfg.key}
                    connectNulls
                    strokeDasharray={cfg.dash || undefined}
                  />
                ))}

              {chartType === "line" && (
                <Line type="monotone" dataKey="close" stroke="#8884d8" strokeWidth={2} dot={false} name="종가" />
              )}
              {chartType === "candle" && (
                <Bar
                  dataKey="candleRange"
                  shape={CandleStickShape}
                  maxBarSize={visibleBars <= 20 ? 18 : visibleBars <= 60 ? 10 : 6}
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

          {hasRainbowData && lastBar && (
            <RainbowLabels lastBar={lastBar} height={height} chartData={chartData} />
          )}
        </div>
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

function RainbowLabels({ lastBar, height: _height, chartData }: { lastBar: ChartPoint; height: number; chartData: ChartPoint[] }) {
  const allPrices: number[] = [];
  for (const bar of chartData) {
    allPrices.push(bar.high, bar.low);
    for (const cfg of RAINBOW_LINES) {
      const v = (bar as Record<string, unknown>)[cfg.key];
      if (typeof v === "number" && v > 0) allPrices.push(v);
    }
  }
  if (allPrices.length === 0) return null;

  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const range = maxPrice - minPrice;
  if (range <= 0) return null;

  const keyLines = RAINBOW_LINES.filter((l) => l.label);

  return (
    <div className="absolute right-0 top-1 bottom-5 w-12 pointer-events-none" style={{ marginRight: 0 }}>
      {keyLines.map((cfg) => {
        const price = (lastBar as Record<string, unknown>)[cfg.key];
        if (typeof price !== "number" || price <= 0) return null;
        const pct = 1 - (price - minPrice) / range;
        const topPx = 4 + pct * (_height - 28);
        return (
          <span
            key={cfg.key}
            className="absolute text-[9px] font-bold leading-none"
            style={{ top: topPx, right: 2, color: cfg.color }}
          >
            {cfg.label}
          </span>
        );
      })}
    </div>
  );
}

function formatDateLabel(raw: string): string {
  if (!raw) return raw;
  const s = raw.replace(/[-\/]/g, "");
  if (s.length >= 8) return `${s.slice(4, 6)}/${s.slice(6, 8)}`;
  if (s.length >= 6) return `${s.slice(2, 4)}/${s.slice(4, 6)}`;
  return raw;
}
