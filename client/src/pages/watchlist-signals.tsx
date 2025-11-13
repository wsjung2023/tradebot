import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, Minus, Activity, RefreshCw, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WatchlistSignal } from "@shared/schema";

interface EnrichedSignal extends WatchlistSignal {
  stockCode?: string;
  stockName?: string;
}

// Signal type badge colors
const signalColors = {
  buy: "bg-red-500/20 text-red-400 border-red-500/30",
  sell: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  neutral: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export default function WatchlistSignalsPage() {
  const { toast } = useToast();

  // Fetch signals (enriched with stock info from backend join)
  const { data: signals = [], isLoading: loadingSignals, refetch: refetchSignals } = useQuery<EnrichedSignal[]>({
    queryKey: ["/api/watchlist-signals"],
  });

  // Delete signal mutation
  const deleteMutation = useMutation({
    mutationFn: async (signalId: number) => {
      const response = await fetch(`/api/watchlist-signals/${signalId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete signal");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "신호 삭제 완료",
        description: "매매신호가 삭제되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist-signals"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "신호 삭제 실패",
        description: error.message || "매매신호 삭제 중 오류가 발생했습니다.",
      });
    },
  });

  // Refresh signals
  const generateAllSignalsMutation = useMutation({
    mutationFn: async () => {
      // Backend will process all watchlist items automatically
      const response = await fetch("/api/watchlist-signals/generate-all", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to generate signals");
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "신호 생성 완료",
        description: "모든 관심종목의 매매신호가 생성되었습니다.",
      });
      refetchSignals();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "신호 생성 실패",
        description: error.message || "매매신호 생성 중 오류가 발생했습니다.",
      });
    },
  });

  const getSignalIcon = (signalType: string) => {
    switch (signalType) {
      case "buy":
        return <TrendingUp className="w-4 h-4" />;
      case "sell":
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getSignalText = (signalType: string) => {
    switch (signalType) {
      case "buy":
        return "매수";
      case "sell":
        return "매도";
      default:
        return "중립";
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-background via-background to-purple-950/10 animate-gradient-flow" />
      
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gradient-cyber mb-2" data-testid="heading-signals">
              관심종목 매매신호
            </h1>
            <p className="text-muted-foreground">
              차트 수식 기반 7색 시그널로 관심종목의 매매 타이밍을 분석합니다 (화면 0130)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse-glow" />
            <span className="text-sm text-purple-400">차트 시그널 분석</span>
          </div>
        </div>

        {/* Control Panel */}
        <Card className="glass-card border-cyan-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                <CardTitle className="text-glow-cyan">신호 생성 및 관리</CardTitle>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => refetchSignals()}
                  variant="outline"
                  size="sm"
                  data-testid="button-refresh"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  새로고침
                </Button>
                <Button
                  onClick={() => generateAllSignalsMutation.mutate()}
                  disabled={generateAllSignalsMutation.isPending}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  data-testid="button-generate"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  {generateAllSignalsMutation.isPending ? "생성 중..." : "신호 새로고침"}
                </Button>
              </div>
            </div>
            <CardDescription>
              관심종목의 차트 패턴을 분석하여 매매신호를 생성합니다
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Signals Table */}
        <Card className="glass-card border-green-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <CardTitle className="text-glow-green">매매신호 현황</CardTitle>
              </div>
              <Badge variant="outline" className="border-green-500/30 text-green-400">
                {signals.length}개 신호
              </Badge>
            </div>
            <CardDescription>
              최근 생성된 매매신호 목록
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSignals ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span className="ml-3 text-muted-foreground">신호를 불러오는 중...</span>
              </div>
            ) : signals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>생성된 매매신호가 없습니다.</p>
                <p className="text-sm mt-2">전체 신호 생성 버튼을 눌러 신호를 생성하세요.</p>
              </div>
            ) : (
              <div className="border border-border/50 rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>종목코드</TableHead>
                      <TableHead>종목명</TableHead>
                      <TableHead>신호유형</TableHead>
                      <TableHead className="text-right">신호강도</TableHead>
                      <TableHead className="text-right">현재가</TableHead>
                      <TableHead>생성시간</TableHead>
                      <TableHead className="text-right">동작</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {signals.map((signal, index) => (
                      <TableRow key={signal.id} data-testid={`row-signal-${index}`}>
                        <TableCell className="font-mono" data-testid={`text-stockcode-${index}`}>
                          {signal.stockCode}
                        </TableCell>
                        <TableCell className="font-medium" data-testid={`text-stockname-${index}`}>
                          {signal.stockName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${signalColors[(signal.currentSignal || 'neutral') as keyof typeof signalColors]}`}
                          >
                            <span className="flex items-center gap-1">
                              {getSignalIcon(signal.currentSignal || 'neutral')}
                              {getSignalText(signal.currentSignal || 'neutral')}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  Number(signal.signalStrength) > 70
                                    ? "bg-red-500"
                                    : Number(signal.signalStrength) > 30
                                    ? "bg-yellow-500"
                                    : "bg-blue-500"
                                }`}
                                style={{ width: `${Math.abs(Number(signal.signalStrength))}%` }}
                              />
                            </div>
                            <span className="font-mono text-sm w-12 text-right">
                              {Number(signal.signalStrength).toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          -
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(signal.lastCalculatedAt).toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(signal.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${index}`}
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="glass-card border-yellow-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Activity className="w-6 h-6 text-yellow-400" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-yellow-400">신호 강도 해석</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <span className="text-red-400 font-semibold">70% 이상:</span> 강한 매수 신호 - 적극 매수 고려</li>
                  <li>• <span className="text-yellow-400 font-semibold">30~70%:</span> 중립 신호 - 추가 분석 필요</li>
                  <li>• <span className="text-blue-400 font-semibold">30% 이하:</span> 강한 매도 신호 - 매도 고려</li>
                  <li>• 신호는 차트 수식 기반으로 자동 생성되며, 7색 시그널 라인으로 구성됩니다</li>
                  <li>• 차트수식 에디터에서 사용자 정의 수식을 작성할 수 있습니다</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
