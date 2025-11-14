import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RainbowChartProps {
  data: any[];
  current?: number;
  currentPosition?: number;
  clWidth?: number;
  recommendation?: string;
  signals?: {
    nearCL: boolean;
    clWidthGood: boolean;
    inBuyZone: boolean;
    inSellZone: boolean;
  };
  showMetrics?: boolean;
}

// 레인보우 차트 11개 라인 색상 (BackAttackLine.md 기준)
const RAINBOW_COLORS = {
  line0: '#9333ea',   // 보라색 (Purple) - 저가
  line1: '#ef4444',   // 빨강 (Red) - 10%
  line2: '#f97316',   // 주황 (Orange) - 20%
  line3: '#eab308',   // 노랑 (Yellow) - 30%
  line4: '#52525b',   // 검정 (Dark Gray) - 40%
  line5: '#22c55e',   // 초록 (Green) - 50% CL (주력 매수 구간)
  line6: '#52525b',   // 검정 (Dark Gray) - 60%
  line7: '#3b82f6',   // 파랑 (Blue) - 70%
  line8: '#1e40af',   // 남색 (Navy) - 80%
  line9: '#52525b',   // 검정 (Dark Gray) - 90%
  line10: '#000000',  // 검정 (Black) - 100% 고가
};

const LINE_LABELS = {
  line0: '저가 (0%)',
  line1: '10%',
  line2: '20%',
  line3: '30%',
  line4: '40%',
  line5: 'CL (50%)',  // 주력 매수 구간
  line6: '60%',
  line7: '70%',
  line8: '80%',
  line9: '90%',
  line10: '고가 (100%)',
};

const getRecommendationBadge = (recommendation?: string) => {
  if (!recommendation) return null;
  
  const variants: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
    'strong-buy': { label: '강력 매수', variant: 'default' },
    'buy': { label: '매수', variant: 'default' },
    'hold': { label: '관망', variant: 'secondary' },
    'sell': { label: '매도', variant: 'destructive' },
    'strong-sell': { label: '강력 매도', variant: 'destructive' },
  };
  
  const config = variants[recommendation] || { label: recommendation, variant: 'secondary' as const };
  return <Badge variant={config.variant} data-testid={`badge-recommendation-${recommendation}`}>{config.label}</Badge>;
};

export function RainbowChart({ 
  data, 
  current, 
  currentPosition, 
  clWidth, 
  recommendation,
  signals,
  showMetrics = true 
}: RainbowChartProps) {
  return (
    <div className="space-y-4">
      {showMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>현재가</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono" data-testid="text-current-price">
                ₩{current?.toLocaleString('ko-KR') || 'N/A'}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>CL 위치</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono" data-testid="text-cl-position">
                {currentPosition?.toFixed(1)}%
              </div>
              {signals?.inBuyZone && (
                <Badge variant="default" className="mt-1" data-testid="badge-buy-zone">주력 매수 구간</Badge>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>CL 폭</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono" data-testid="text-cl-width">
                {clWidth?.toFixed(1)}%
              </div>
              {signals?.clWidthGood && (
                <Badge variant="default" className="mt-1" data-testid="badge-cl-width-good">수익 기회</Badge>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>추천</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {getRecommendationBadge(recommendation)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>레인보우 차트 (240일)</CardTitle>
          <CardDescription>
            11개 라인: 2년 고가/저가 기준, 초록 라인(CL)은 50% 되돌림 (주력 매수 구간)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  if (!value) return '';
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `₩${value.toLocaleString('ko-KR')}`}
              />
              <Tooltip 
                formatter={(value: any) => `₩${value.toLocaleString('ko-KR')}`}
                labelFormatter={(label) => {
                  if (!label) return '';
                  const date = new Date(label);
                  return date.toLocaleDateString('ko-KR');
                }}
              />
              
              {/* 11개 레인보우 라인 */}
              <Line type="monotone" dataKey="line0" stroke={RAINBOW_COLORS.line0} strokeWidth={2} dot={false} name={LINE_LABELS.line0} />
              <Line type="monotone" dataKey="line1" stroke={RAINBOW_COLORS.line1} strokeWidth={1.5} dot={false} name={LINE_LABELS.line1} />
              <Line type="monotone" dataKey="line2" stroke={RAINBOW_COLORS.line2} strokeWidth={1.5} dot={false} name={LINE_LABELS.line2} />
              <Line type="monotone" dataKey="line3" stroke={RAINBOW_COLORS.line3} strokeWidth={1.5} dot={false} name={LINE_LABELS.line3} />
              <Line type="monotone" dataKey="line4" stroke={RAINBOW_COLORS.line4} strokeWidth={1.5} dot={false} name={LINE_LABELS.line4} />
              
              {/* CL (50%) 라인 - 가장 중요, 굵게 */}
              <Line 
                type="monotone" 
                dataKey="line5" 
                stroke={RAINBOW_COLORS.line5} 
                strokeWidth={3} 
                dot={false} 
                name={LINE_LABELS.line5}
              />
              
              <Line type="monotone" dataKey="line6" stroke={RAINBOW_COLORS.line6} strokeWidth={1.5} dot={false} name={LINE_LABELS.line6} />
              <Line type="monotone" dataKey="line7" stroke={RAINBOW_COLORS.line7} strokeWidth={1.5} dot={false} name={LINE_LABELS.line7} />
              <Line type="monotone" dataKey="line8" stroke={RAINBOW_COLORS.line8} strokeWidth={1.5} dot={false} name={LINE_LABELS.line8} />
              <Line type="monotone" dataKey="line9" stroke={RAINBOW_COLORS.line9} strokeWidth={1.5} dot={false} name={LINE_LABELS.line9} />
              <Line type="monotone" dataKey="line10" stroke={RAINBOW_COLORS.line10} strokeWidth={2} dot={false} name={LINE_LABELS.line10} />
              
              {/* 현재가 표시 (가장 마지막 데이터포인트) */}
              {current && (
                <ReferenceLine y={current} stroke="#ec4899" strokeWidth={2} strokeDasharray="5 5">
                  <Label value={`현재가: ₩${current.toLocaleString('ko-KR')}`} position="right" fill="#ec4899" />
                </ReferenceLine>
              )}
            </LineChart>
          </ResponsiveContainer>
          
          {/* 범례 */}
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5" style={{ backgroundColor: RAINBOW_COLORS.line0 }}></div>
              <span>저가 (0%)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5" style={{ backgroundColor: RAINBOW_COLORS.line5 }}></div>
              <span className="font-semibold">CL (50% - 주력 매수)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5" style={{ backgroundColor: RAINBOW_COLORS.line10 }}></div>
              <span>고가 (100%)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5 border-t-2 border-dashed" style={{ borderColor: '#ec4899' }}></div>
              <span>현재가</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
