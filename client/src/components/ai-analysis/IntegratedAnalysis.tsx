// IntegratedAnalysis.tsx — 뉴스 + 재무제표 + 기술적 분석 통합 AI 분석 컴포넌트
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Newspaper, BarChart3, TrendingUp, TrendingDown, Minus,
  Search, Loader2, AlertTriangle, Zap, ShieldCheck, Target,
  ChevronRight, ExternalLink, RefreshCw,
} from "lucide-react";

// ─── 타입 ─────────────────────────────────────────────────────────────────
interface NewsArticle {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface IntegratedResult {
  newsScore: number;
  financialScore: number;
  technicalScore: number;
  totalScore: number;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  targetPrice: number | null;
  newsSentiment: 'positive' | 'negative' | 'neutral';
  newsAnalysis: string;
  financialAnalysis: string;
  technicalAnalysis: string;
  summary: string;
  risks: string[];
  catalysts: string[];
  news?: { articles: NewsArticle[]; fetchedAt: string };
  financialRatios?: { per: string; pbr: string; eps: string; bps: string; roe: string };
}

// ─── 유틸 ────────────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 70) return 'text-cyan-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-rose-400';
}
function scoreBarColor(score: number): string {
  if (score >= 70) return 'bg-cyan-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-rose-500';
}
function sentimentBadge(s: 'positive' | 'negative' | 'neutral') {
  if (s === 'positive') return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 no-default-active-elevate">긍정</Badge>;
  if (s === 'negative') return <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 no-default-active-elevate">부정</Badge>;
  return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 no-default-active-elevate">중립</Badge>;
}
function actionLabel(a: 'buy' | 'sell' | 'hold') {
  if (a === 'buy') return { text: '매수', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/40' };
  if (a === 'sell') return { text: '매도', color: 'text-rose-400', bg: 'bg-rose-500/20 border-rose-500/40' };
  return { text: '보유', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/40' };
}
function formatPubDate(pubDate: string): string {
  try {
    return new Date(pubDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return pubDate; }
}

// ─── 점수 게이지 바 ───────────────────────────────────────────────────────
function ScoreBar({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">{icon}{label}</span>
        <span className={`font-bold tabular-nums ${scoreColor(score)}`}>{score}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${scoreBarColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ─── 재무비율 테이블 ──────────────────────────────────────────────────────
function FinancialTable({ ratios }: { ratios: NonNullable<IntegratedResult['financialRatios']> }) {
  const rows = [
    { label: 'PER (주가수익비율)', value: ratios.per ? `${parseFloat(ratios.per).toFixed(2)}배` : '-' },
    { label: 'PBR (주가순자산비율)', value: ratios.pbr ? `${parseFloat(ratios.pbr).toFixed(2)}배` : '-' },
    { label: 'EPS (주당순이익)', value: ratios.eps ? `₩${Number(ratios.eps).toLocaleString()}` : '-' },
    { label: 'BPS (주당순자산)', value: ratios.bps ? `₩${Number(ratios.bps).toLocaleString()}` : '-' },
    { label: 'ROE (자기자본이익률)', value: ratios.roe ? `${parseFloat(ratios.roe).toFixed(2)}%` : '-' },
  ];
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="text-left p-3 font-medium text-muted-foreground">지표</th>
            <th className="text-right p-3 font-medium text-muted-foreground">값</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
              <td className="p-3 text-muted-foreground">{row.label}</td>
              <td className="p-3 text-right font-mono font-medium">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 뉴스 카드 ────────────────────────────────────────────────────────────
function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-md border border-border bg-muted/10 hover-elevate">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {sentimentBadge(article.sentiment)}
          <span className="text-xs text-muted-foreground">{article.source}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{formatPubDate(article.pubDate)}</span>
        </div>
        {article.link && (
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground shrink-0"
            data-testid={`link-news-${article.title.slice(0, 10)}`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
      <p className="text-sm font-medium leading-snug">{article.title}</p>
      {article.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{article.description}</p>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────
export function IntegratedAnalysis() {
  const { toast } = useToast();
  const [stockCode, setStockCode] = useState('');
  const [stockName, setStockName] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [result, setResult] = useState<IntegratedResult | null>(null);

  const { data: accounts = [] } = useQuery<any[]>({ queryKey: ['/api/accounts'] });

  const analysisMutation = useMutation({
    mutationFn: async (data: { stockCode: string; stockName: string; currentPrice: number }) => {
      const resp = await apiRequest('POST', '/api/ai/integrated-analysis', data);
      return resp.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: '통합 분석 완료', description: `${stockName} 분석이 완료되었습니다` });
    },
    onError: (e: any) => {
      toast({ variant: 'destructive', title: '분석 실패', description: e.message });
    },
  });

  // 종목 검색 — stockCode 입력 후 자동으로 가격 조회
  const searchMutation = useMutation({
    mutationFn: async (code: string) => {
      const resp = await apiRequest('GET', `/api/stocks/${code}/price`);
      return resp.json();
    },
    onSuccess: (data) => {
      if (data?.stk_nm) setStockName(data.stk_nm);
      if (data?.cur_prc) setCurrentPrice(String(Math.abs(Number(data.cur_prc))));
    },
  });

  function handleSearch() {
    if (!stockCode.trim()) return;
    searchMutation.mutate(stockCode.trim());
  }

  function handleAnalyze() {
    if (!stockCode || !stockName || !currentPrice) {
      toast({ variant: 'destructive', title: '입력 오류', description: '종목코드, 종목명, 현재가를 모두 입력해주세요' });
      return;
    }
    analysisMutation.mutate({ stockCode, stockName, currentPrice: parseFloat(currentPrice) });
  }

  const action = result ? actionLabel(result.action) : null;

  return (
    <div className="space-y-6">
      {/* 입력 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            뉴스 + 재무 + 기술 통합 분석
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-2 flex-1 min-w-40">
              <Input
                placeholder="종목코드 (예: 005930)"
                value={stockCode}
                onChange={e => setStockCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                data-testid="input-integrated-stock-code"
                className="w-36"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleSearch}
                disabled={searchMutation.isPending}
                data-testid="button-integrated-search"
              >
                {searchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            <Input
              placeholder="종목명 (예: 삼성전자)"
              value={stockName}
              onChange={e => setStockName(e.target.value)}
              data-testid="input-integrated-stock-name"
              className="flex-1 min-w-32"
            />
            <Input
              placeholder="현재가"
              value={currentPrice}
              onChange={e => setCurrentPrice(e.target.value)}
              data-testid="input-integrated-price"
              className="w-32"
              type="number"
            />
            <Button
              onClick={handleAnalyze}
              disabled={analysisMutation.isPending}
              data-testid="button-integrated-analyze"
            >
              {analysisMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />분석 중...</>
                : <><Zap className="w-4 h-4 mr-2" />통합 분석</>
              }
            </Button>
          </div>
          {analysisMutation.isPending && (
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              뉴스 수집 및 재무 데이터 분석 중... (10~20초 소요)
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          {/* 종합 결과 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 종합 점수 */}
            <Card className="md:col-span-1">
              <CardContent className="pt-6 text-center space-y-3">
                <div className="text-5xl font-bold tabular-nums" style={{ color: scoreColor(result.totalScore).replace('text-', '') }} data-testid="text-total-score">
                  <span className={scoreColor(result.totalScore)}>{result.totalScore}</span>
                </div>
                <p className="text-sm text-muted-foreground">종합 점수</p>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border text-lg font-bold ${action!.bg} ${action!.color}`} data-testid="text-integrated-action">
                  {result.action === 'buy' && <TrendingUp className="w-5 h-5" />}
                  {result.action === 'sell' && <TrendingDown className="w-5 h-5" />}
                  {result.action === 'hold' && <Minus className="w-5 h-5" />}
                  {action!.text}
                </div>
                <div className="text-sm text-muted-foreground">신뢰도 <span className="font-bold text-foreground">{result.confidence}%</span></div>
                {result.targetPrice && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">목표가 </span>
                    <span className="font-bold text-cyan-400" data-testid="text-target-price">₩{result.targetPrice.toLocaleString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 세부 점수 */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">세부 분석 점수</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScoreBar label="뉴스 감성" score={result.newsScore} icon={<Newspaper className="w-3.5 h-3.5" />} />
                <ScoreBar label="재무 건전성" score={result.financialScore} icon={<BarChart3 className="w-3.5 h-3.5" />} />
                <ScoreBar label="기술적 흐름" score={result.technicalScore} icon={<TrendingUp className="w-3.5 h-3.5" />} />
              </CardContent>
            </Card>
          </div>

          {/* AI 분석 요약 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                GPT-4 종합 투자 의견
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed" data-testid="text-integrated-summary">{result.summary}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-cyan-400 flex items-center gap-1"><Newspaper className="w-3 h-3" />뉴스 분석</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{result.newsAnalysis}</p>
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-violet-400 flex items-center gap-1"><BarChart3 className="w-3 h-3" />재무 분석</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{result.financialAnalysis}</p>
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-emerald-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" />기술적 분석</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{result.technicalAnalysis}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-rose-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />리스크 요인</h4>
                  <ul className="space-y-1">
                    {result.risks.map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-rose-400" />{r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-emerald-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3" />상승 촉매</h4>
                  <ul className="space-y-1">
                    {result.catalysts.map((c, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" />{c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 재무제표 + 뉴스 2열 레이아웃 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 재무 지표 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-violet-400" />
                  재무 지표
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.financialRatios ? (
                  <FinancialTable ratios={result.financialRatios} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                    <BarChart3 className="w-8 h-8 opacity-30" />
                    <p className="text-sm">키움 API 계좌 연동 후 재무 데이터를 확인할 수 있습니다</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 실시간 뉴스 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between flex-wrap gap-2">
                  <span className="flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-cyan-400" />
                    실시간 뉴스
                  </span>
                  {result.news?.fetchedAt && (
                    <span className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      {new Date(result.news.fetchedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.news?.articles?.length ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {result.news.articles.map((article, i) => (
                      <NewsCard key={i} article={article} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Newspaper className="w-8 h-8 opacity-30" />
                    <p className="text-sm">관련 뉴스가 없습니다</p>
                    <p className="text-xs">네이버 뉴스 API 연동 후 실시간 뉴스를 확인할 수 있습니다</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
