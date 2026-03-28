import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, Area,
} from "recharts";
import { Badge } from "@/components/ui/badge";

interface RainbowChartProps {
  data: any[];
  current?: number;
  currentPosition?: number;
  clWidth?: number;
  recommendation?: string;
  signals?: {
    nearCL?: boolean;
    clWidthGood?: boolean;
    inBuyZone?: boolean;
    inSellZone?: boolean;
    aboveCL?: boolean;
  };
  showMetrics?: boolean;
  height?: number;
}

// 레인보우 차트 색상 (line0=저가/MIN → line10=고가/MAX)
const RAINBOW_COLORS = [
  '#7c3aed', // 0%  MIN - 보라
  '#ef4444', // 10%     - 빨강
  '#f97316', // 20%     - 주황
  '#eab308', // 30%     - 노랑
  '#64748b', // 40%     - 회색
  '#22c55e', // 50% CL  - 초록 (주력 매수)
  '#64748b', // 60%     - 회색
  '#3b82f6', // 70%     - 파랑
  '#1e40af', // 80%     - 남색
  '#334155', // 90%     - 어두운 회색
  '#0f172a', // 100% MAX - 거의 검정
];

const LINE_LABELS = [
  '0% (저가)', '10%', '20%', '30%', '40%',
  'CL (50%)', '60%', '70%', '80%', '90%', '100% (고가)',
];

export function getRecommendationBadge(recommendation?: string) {
  if (!recommendation) return null;
  const variants: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
    'strong-buy': { label: '강력 매수', variant: 'default' },
    'buy':        { label: '매수',      variant: 'default' },
    'hold':       { label: '관망',      variant: 'secondary' },
    'sell':       { label: '매도',      variant: 'destructive' },
    'strong-sell':{ label: '강력 매도', variant: 'destructive' },
  };
  const config = variants[recommendation] || { label: recommendation, variant: 'secondary' as const };
  return (
    <Badge variant={config.variant} data-testid={`badge-recommendation-${recommendation}`}>
      {config.label}
    </Badge>
  );
}

export function RainbowChart({
  data,
  current,
  currentPosition,
  clWidth,
  recommendation,
  signals,
  showMetrics = true,
  height = 420,
}: RainbowChartProps) {
  const formatPrice = (v: any) => {
    const n = Number(v);
    return isNaN(n) ? '' : `₩${n.toLocaleString('ko-KR')}`;
  };

  const formatDate = (v: string) => {
    if (!v) return '';
    const s = String(v).replace(/-/g, '');
    if (s.length === 8) return `${s.slice(4, 6)}/${s.slice(6, 8)}`;
    if (v.includes('-')) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`;
    }
    return v;
  };

  return (
    <div className="space-y-3">
      {showMetrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground mb-1">현재가</p>
            <p className="text-lg font-bold font-mono" data-testid="text-current-price">
              {current ? `₩${current.toLocaleString('ko-KR')}` : '-'}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground mb-1">CL 위치</p>
            <p className="text-lg font-bold font-mono" data-testid="text-cl-position">
              {currentPosition != null ? `${currentPosition.toFixed(1)}%` : '-'}
            </p>
            {signals?.inBuyZone && (
              <Badge variant="default" className="mt-1 text-xs" data-testid="badge-buy-zone">주력 매수 구간</Badge>
            )}
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground mb-1">CL 폭</p>
            <p className="text-lg font-bold font-mono" data-testid="text-cl-width">
              {clWidth != null ? `${clWidth.toFixed(1)}%` : '-'}
            </p>
            {signals?.clWidthGood && (
              <Badge variant="default" className="mt-1 text-xs" data-testid="badge-cl-width-good">수익 기회</Badge>
            )}
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground mb-1">레인보우 판단</p>
            <div className="mt-1">{getRecommendationBadge(recommendation)}</div>
          </div>
        </div>
      )}

      <div className="rounded-md border p-4">
        <p className="text-sm font-semibold mb-1">레인보우 차트 (240일 BackAttack Line)</p>
        <p className="text-xs text-muted-foreground mb-3">
          초록 라인(CL) = 50% 주력 매수 구간 | 분홍 = 실제 주가
        </p>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={formatDate}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 11 }}
              tickFormatter={formatPrice}
              width={80}
            />
            <Tooltip
              formatter={(value: any, name: string) => {
                if (name === '실제 주가') return [formatPrice(value), name];
                return [formatPrice(value), name];
              }}
              labelFormatter={formatDate}
              contentStyle={{ fontSize: 12 }}
            />

            {/* 11개 레인보우 라인 (line0=MIN, line10=MAX) */}
            {Array.from({ length: 11 }, (_, i) => (
              <Line
                key={`line${i}`}
                type="monotone"
                dataKey={`line${i}`}
                stroke={RAINBOW_COLORS[i]}
                strokeWidth={i === 5 ? 2.5 : 1}
                dot={false}
                name={LINE_LABELS[i]}
                legendType="none"
                strokeDasharray={i === 5 ? undefined : undefined}
                opacity={i === 5 ? 1 : 0.7}
              />
            ))}

            {/* 실제 주가 라인 */}
            <Line
              type="monotone"
              dataKey="close"
              stroke="#ec4899"
              strokeWidth={2}
              dot={false}
              name="실제 주가"
            />

            {/* 현재가 참고선 */}
            {current && (
              <ReferenceLine y={current} stroke="#ec4899" strokeDasharray="4 4" strokeWidth={1.5} />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* 범례 */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 rounded-full" style={{ backgroundColor: RAINBOW_COLORS[0] }} />
            <span>0% 저가</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 rounded-full" style={{ backgroundColor: RAINBOW_COLORS[5] }} />
            <span className="font-semibold text-foreground">50% CL (주력 매수)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 rounded-full" style={{ backgroundColor: RAINBOW_COLORS[10] }} />
            <span>100% 고가</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 rounded-full bg-pink-400" />
            <span>실제 주가</span>
          </div>
        </div>
      </div>
    </div>
  );
}
