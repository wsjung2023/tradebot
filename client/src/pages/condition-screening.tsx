import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, Play, Plus, AlertCircle, Zap } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ConditionFormula, ConditionResult } from "@shared/schema";

interface KiwoomConditionItem {
  condition_index: number;
  condition_name: string;
}

interface KiwoomConditionResult {
  stock_code: string;
  stock_name: string;
  current_price?: string;
  change_rate?: string;
}

export default function ConditionScreeningPage() {
  const { toast } = useToast();
  const [selectedConditionId, setSelectedConditionId] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [screeningMode, setScreeningMode] = useState<"custom" | "kiwoom">("custom");
  const [enableAutoRefresh, setEnableAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60); // seconds - validated to be positive number
  const [selectedKiwoomSeq, setSelectedKiwoomSeq] = useState<string>("");
  const [kiwoomResults, setKiwoomResults] = useState<KiwoomConditionResult[]>([]);

  // Fetch user's condition formulas
  const { data: conditions = [], isLoading: loadingConditions } = useQuery<ConditionFormula[]>({
    queryKey: ["/api/conditions"],
  });

  const { data: kiwoomConditions = [], isLoading: loadingKiwoomConditions } = useQuery<KiwoomConditionItem[]>({
    queryKey: ["/api/kiwoom/conditions"],
  });

  // Fetch screening results for selected condition
  const { data: results = [], isLoading: loadingResults, refetch: refetchResults } = useQuery<ConditionResult[]>({
    queryKey: ["/api/conditions", selectedConditionId, "results"],
    enabled: !!selectedConditionId,
  });

  // Run condition search mutation
  const runMutation = useMutation({
    mutationFn: async (conditionId: number) => {
      setIsRunning(true);
      const response = await fetch(`/api/conditions/${conditionId}/run`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to run condition search");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "조건검색 실행 완료",
        description: "조건식이 성공적으로 실행되었습니다.",
      });
      refetchResults();
      setIsRunning(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "조건검색 실행 실패",
        description: error.message || "조건식 실행 중 오류가 발생했습니다.",
      });
      setIsRunning(false);
    },
  });

  const runKiwoomMutation = useMutation({
    mutationFn: async (seq: string) => {
      setIsRunning(true);
      const response = await fetch(`/api/kiwoom/conditions/${seq}/run`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to run Kiwoom condition search");
      }
      return await response.json();
    },
    onSuccess: (data: KiwoomConditionResult[]) => {
      setKiwoomResults(Array.isArray(data) ? data : []);
      toast({
        title: "키움 조건검색 실행 완료",
        description: "HTS 조건식 검색이 완료되었습니다.",
      });
      setIsRunning(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "키움 조건검색 실행 실패",
        description: error.message || "키움 조건식 실행 중 오류가 발생했습니다.",
      });
      setIsRunning(false);
    },
  });

  // Add to watchlist mutation
  const addToWatchlistMutation = useMutation({
    mutationFn: async (stockCode: string) => {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          stockCode,
          stockName: results.find(r => r.stockCode === stockCode)?.stockName || "",
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add to watchlist");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "관심종목 추가 완료",
        description: "종목이 관심종목에 추가되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "관심종목 추가 실패",
        description: error.message || "관심종목 추가 중 오류가 발생했습니다.",
      });
    },
  });

  const handleRun = () => {
    if (screeningMode === "kiwoom") {
      if (!selectedKiwoomSeq) {
        toast({
          variant: "destructive",
          title: "키움 조건식을 선택하세요",
          description: "실행할 키움 HTS 조건식을 먼저 선택해주세요.",
        });
        return;
      }
      runKiwoomMutation.mutate(selectedKiwoomSeq);
      return;
    }

    if (!selectedConditionId) {
      toast({
        variant: "destructive",
        title: "조건식을 선택하세요",
        description: "실행할 조건식을 먼저 선택해주세요.",
      });
      return;
    }
    runMutation.mutate(selectedConditionId);
  };

  const activeConditions = conditions.filter(c => c.isActive);
  const selectedCondition = conditions.find(c => c.id === selectedConditionId);

  // Auto-refresh implementation with validation
  useEffect(() => {
    if (!enableAutoRefresh || !selectedConditionId || !selectedCondition?.isRealTimeMonitoring) {
      return;
    }

    // Validate refreshInterval to prevent NaN or invalid values
    const validInterval = Number.isFinite(refreshInterval) && refreshInterval > 0 ? refreshInterval : 60;
    const intervalMs = validInterval * 1000;
    
    const intervalId = setInterval(() => {
      runMutation.mutate(selectedConditionId);
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [enableAutoRefresh, selectedConditionId, refreshInterval, selectedCondition]);

  return (
    <div className="min-h-screen relative">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-background via-background to-cyan-950/10 animate-gradient-flow" />
      
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gradient-cyber mb-2" data-testid="heading-screening">
              실시간 조건검색 스크리닝
            </h1>
            <p className="text-muted-foreground">
              조건식을 실행하여 실시간으로 종목을 검색합니다 (화면 0156)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse-glow" />
            <span className="text-sm text-cyan-400">실시간 스크리닝</span>
          </div>
        </div>

        {/* Control Panel */}
        <Card className="glass-card border-cyan-500/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-400" />
              <CardTitle className="text-glow-cyan">조건식 선택 및 실행</CardTitle>
            </div>
            <CardDescription>
              활성화된 조건식을 선택하여 실시간 검색을 실행합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">조건식</label>
                  <Tabs value={screeningMode} onValueChange={(value) => setScreeningMode(value as "custom" | "kiwoom")}>
                    <TabsList className="mb-3">
                      <TabsTrigger value="custom">커스텀 조건식</TabsTrigger>
                      <TabsTrigger value="kiwoom">Kiwoom HTS 조건식</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <Select
                    value={screeningMode === "custom" ? (selectedConditionId?.toString() || "") : selectedKiwoomSeq}
                    onValueChange={(value) => {
                      if (screeningMode === "custom") {
                        setSelectedConditionId(Number(value));
                      } else {
                        setSelectedKiwoomSeq(value);
                      }
                    }}
                    disabled={screeningMode === "custom" ? loadingConditions : loadingKiwoomConditions}
                  >
                    <SelectTrigger data-testid="select-condition">
                      <SelectValue placeholder={screeningMode === "custom" ? "조건식을 선택하세요" : "키움 HTS 조건식을 선택하세요"} />
                    </SelectTrigger>
                    <SelectContent>
                      {screeningMode === "custom" ? (
                        <>
                          {activeConditions.length === 0 && (
                            <div className="p-4 text-sm text-muted-foreground text-center" data-testid="text-no-conditions">
                              활성화된 조건식이 없습니다
                            </div>
                          )}
                          {activeConditions.map((condition) => (
                            <SelectItem key={condition.id} value={condition.id.toString()} data-testid={`option-condition-${condition.id}`}>
                              {condition.conditionName} ({condition.marketType})
                            </SelectItem>
                          ))}
                        </>
                      ) : (
                        <>
                          {kiwoomConditions.length === 0 && (
                            <div className="p-4 text-sm text-muted-foreground text-center" data-testid="text-no-kiwoom-conditions">
                              키움 HTS 조건식이 없습니다
                            </div>
                          )}
                          {kiwoomConditions.map((condition) => (
                            <SelectItem
                              key={condition.condition_index}
                              value={String(condition.condition_index)}
                              data-testid={`option-kiwoom-condition-${condition.condition_index}`}
                            >
                              [{condition.condition_index}] {condition.condition_name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              
              <Button
                onClick={handleRun}
                disabled={screeningMode === "custom" ? !selectedConditionId || isRunning : !selectedKiwoomSeq || isRunning}
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                data-testid="button-run"
              >
                <Play className="w-4 h-4 mr-2" />
                {isRunning ? "실행 중..." : "실행"}
              </Button>
            </div>

            {/* Auto-refresh controls */}
            {screeningMode === "custom" && selectedCondition?.isRealTimeMonitoring && (
              <div className="border border-cyan-500/30 rounded-lg p-4 bg-cyan-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <Label htmlFor="auto-refresh" className="text-sm font-medium text-cyan-400">
                      자동 갱신
                    </Label>
                  </div>
                  <Switch
                    id="auto-refresh"
                    checked={enableAutoRefresh}
                    onCheckedChange={setEnableAutoRefresh}
                    data-testid="switch-auto-refresh"
                  />
                </div>
                {enableAutoRefresh && (
                  <div className="flex items-center gap-3">
                    <Label htmlFor="refresh-interval" className="text-sm whitespace-nowrap">
                      갱신 주기:
                    </Label>
                    <Select
                      value={refreshInterval.toString()}
                      onValueChange={(value) => {
                        const numValue = Number(value);
                        if (Number.isFinite(numValue) && numValue > 0) {
                          setRefreshInterval(numValue);
                        }
                      }}
                    >
                      <SelectTrigger id="refresh-interval" className="w-32" data-testid="select-refresh-interval">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30" data-testid="interval-30">30초</SelectItem>
                        <SelectItem value="60" data-testid="interval-60">1분</SelectItem>
                        <SelectItem value="120" data-testid="interval-120">2분</SelectItem>
                        <SelectItem value="300" data-testid="interval-300">5분</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground" data-testid="text-auto-refresh-info">
                      {enableAutoRefresh && "자동으로 조건검색이 실행됩니다"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {selectedConditionId && (
          <Card className="glass-card border-purple-500/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-purple-400" />
                  <CardTitle className="text-glow-purple">검색 결과</CardTitle>
                </div>
                <Badge variant="outline" className="border-purple-500/30 text-purple-400" data-testid="badge-result-count">
                  {results.length}개 종목
                </Badge>
              </div>
              <CardDescription>
                조건식에 부합하는 종목 목록
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingResults ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  <span className="ml-3 text-muted-foreground">결과를 불러오는 중...</span>
                </div>
              ) : (screeningMode === "custom" ? results.length : kiwoomResults.length) === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>검색 결과가 없습니다.</p>
                  <p className="text-sm mt-2">실행 버튼을 눌러 조건검색을 시작하세요.</p>
                </div>
              ) : (
                <div className="border border-border/50 rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>종목코드</TableHead>
                        <TableHead>종목명</TableHead>
                        <TableHead className="text-right">현재가</TableHead>
                        <TableHead className="text-right">등락률</TableHead>
                        <TableHead className="text-right">거래량</TableHead>
                        <TableHead>검색시간</TableHead>
                        <TableHead className="text-right">동작</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(screeningMode === "custom" ? results : kiwoomResults).map((result: any, index) => (
                        <TableRow key={screeningMode === "custom" ? result.id : `${result.stock_code}-${index}`} data-testid={`row-result-${index}`}>
                          <TableCell className="font-mono" data-testid={`text-stockcode-${index}`}>
                            {screeningMode === "custom" ? result.stockCode : result.stock_code}
                          </TableCell>
                          <TableCell className="font-medium" data-testid={`text-stockname-${index}`}>
                            {screeningMode === "custom" ? result.stockName : result.stock_name}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {screeningMode === "custom" ? result.currentPrice?.toLocaleString() || "-" : Number(result.current_price || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {(screeningMode === "custom" ? result.changeRate : result.change_rate) ? (
                              <span
                                className={`font-mono ${
                                  Number(screeningMode === "custom" ? result.changeRate : result.change_rate) > 0
                                    ? "text-red-500"
                                    : Number(screeningMode === "custom" ? result.changeRate : result.change_rate) < 0
                                    ? "text-blue-500"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {Number(screeningMode === "custom" ? result.changeRate : result.change_rate) > 0 ? "+" : ""}
                                {Number(screeningMode === "custom" ? result.changeRate : result.change_rate).toFixed(2)}%
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {screeningMode === "custom" ? result.volume?.toLocaleString() || "-" : "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {screeningMode === "custom" ? new Date(result.createdAt).toLocaleString("ko-KR") : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addToWatchlistMutation.mutate(screeningMode === "custom" ? result.stockCode : result.stock_code)}
                              disabled={addToWatchlistMutation.isPending}
                              data-testid={`button-add-watchlist-${index}`}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              관심종목
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
        )}

        {/* Info */}
        {!selectedConditionId && (
          <Card className="glass-card border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-green-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-green-400">사용 방법</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 조건식 선택 드롭다운에서 실행할 조건식을 선택합니다</li>
                    <li>• 실행 버튼을 클릭하여 실시간 조건검색을 시작합니다</li>
                    <li>• 검색 결과에서 관심 있는 종목을 관심종목에 추가할 수 있습니다</li>
                    <li>• 조건식 관리는 "조건검색" 메뉴에서 수행할 수 있습니다</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
