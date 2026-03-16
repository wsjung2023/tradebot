// watchlist.tsx — 관심종목 페이지 (종목명 검색, Kiwoom 새로고침, 실시간 시세)
import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMarketStream } from "@/hooks/use-market-stream";

interface WatchlistItem {
  id: number;
  userId: string;
  stockCode: string;
  stockName: string;
  createdAt: string;
}

interface StockSearchResult {
  stockCode: string;
  stockName: string;
  currentPrice?: string;
  marketName?: string;
}

export default function Watchlist() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stockCode, setStockCode] = useState("");
  const [stockName, setStockName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: watchlist = [], isLoading } = useQuery<WatchlistItem[]>({
    queryKey: ["/api/watchlist"],
  });

  const stockCodes = watchlist.map(item => item.stockCode);
  const { prices: marketData } = useMarketStream(stockCodes);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setStockCode(value);
    setStockName("");
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await apiRequest("GET", `/api/stocks/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data.slice(0, 10) : []);
        setShowDropdown(true);
      } catch { setSearchResults([]); }
    }, 300);
  };

  const handleSelectResult = (result: StockSearchResult) => {
    setStockCode(result.stockCode);
    setStockName(result.stockName);
    setSearchQuery(`${result.stockCode} ${result.stockName}`);
    setShowDropdown(false);
  };

  const addMutation = useMutation({
    mutationFn: async (data: { stockCode: string; stockName?: string }) =>
      await apiRequest("POST", "/api/watchlist", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      setDialogOpen(false);
      setStockCode(""); setStockName(""); setSearchQuery(""); setSearchResults([]);
      toast({ title: "추가 완료", description: "관심종목에 추가되었습니다" });
    },
    onError: (error: any) => toast({ variant: "destructive", title: "추가 실패", description: error.message }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => await apiRequest("DELETE", `/api/watchlist/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "삭제 완료" });
    },
    onError: (error: any) => toast({ variant: "destructive", title: "삭제 실패", description: error.message }),
  });

  const syncMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/watchlist/sync-kiwoom")).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "키움 새로고침 완료", description: "관심종목 시세가 업데이트되었습니다" });
    },
    onError: (error: any) => toast({ variant: "destructive", title: "새로고침 실패", description: error.message }),
  });

  const handleAdd = () => {
    if (!stockCode.trim()) {
      toast({ variant: "destructive", title: "입력 오류", description: "종목을 검색하여 선택해주세요" });
      return;
    }
    addMutation.mutate({ stockCode: stockCode.trim(), stockName: stockName.trim() || undefined });
  };

  const getPriceChange = (code: string) => {
    const data = marketData[code];
    if (!data || !data.currentPrice) return null;
    return { change: data.change || 0, changePercent: data.changeRate || 0, isPositive: (data.change || 0) >= 0 };
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">관심종목</h1>
          <p className="text-sm text-muted-foreground">실시간 시세 모니터링</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} data-testid="button-sync-kiwoom">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            키움 새로고침
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setSearchQuery(""); setSearchResults([]); setShowDropdown(false); } }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-watchlist"><Plus className="h-4 w-4 mr-2" />종목 추가</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>관심종목 추가</DialogTitle>
                <DialogDescription>종목명 또는 코드로 검색하세요</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2 relative">
                  <label className="text-sm font-medium">종목 검색</label>
                  <Input
                    placeholder="종목명 또는 코드 입력 (예: 삼성전자, 005930)"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    data-testid="input-stock-search"
                    autoComplete="off"
                  />
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.map((result) => (
                        <button
                          key={result.stockCode}
                          className="w-full text-left px-3 py-2 hover:bg-accent flex justify-between items-center text-sm"
                          onMouseDown={() => handleSelectResult(result)}
                        >
                          <span className="font-medium">{result.stockName}</span>
                          <span className="text-muted-foreground font-mono">{result.stockCode}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {stockCode && (
                  <div className="text-sm text-muted-foreground px-1">
                    선택: <span className="font-mono font-medium text-foreground">{stockCode}</span>
                    {stockName && <span className="ml-2 text-foreground">{stockName}</span>}
                  </div>
                )}
                <Button onClick={handleAdd} disabled={addMutation.isPending || !stockCode} className="w-full" data-testid="button-submit-watchlist">
                  {addMutation.isPending ? "추가 중..." : "추가"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>관심종목 목록</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
          ) : watchlist.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-watchlist">
              관심종목이 없습니다. 종목을 추가해보세요.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>종목코드</TableHead><TableHead>종목명</TableHead>
                    <TableHead className="text-right">현재가</TableHead>
                    <TableHead className="text-right">전일대비</TableHead>
                    <TableHead className="text-right">등락률</TableHead>
                    <TableHead>상태</TableHead><TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {watchlist.map((item) => {
                    const priceChange = getPriceChange(item.stockCode);
                    const currentData = marketData[item.stockCode];
                    return (
                      <TableRow key={item.id} data-testid={`row-watchlist-${item.id}`}>
                        <TableCell className="font-mono font-medium">{item.stockCode}</TableCell>
                        <TableCell className="font-medium">{item.stockName}</TableCell>
                        <TableCell className="text-right font-mono">
                          {currentData ? currentData.currentPrice.toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {priceChange ? (
                            <div className={`flex items-center justify-end gap-1 ${priceChange.isPositive ? "text-green-600" : "text-red-600"}`}>
                              {priceChange.isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                              <span className="font-mono">{priceChange.isPositive ? "+" : ""}{priceChange.change.toLocaleString()}</span>
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {priceChange ? (
                            <span className={`font-mono ${priceChange.isPositive ? "text-green-600" : "text-red-600"}`}>
                              {priceChange.isPositive ? "+" : ""}{priceChange.changePercent.toFixed(2)}%
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {currentData ? (
                            <Badge variant="default" data-testid={`badge-status-${item.id}`}>실시간</Badge>
                          ) : (
                            <Badge variant="secondary" data-testid={`badge-status-${item.id}`}>대기중</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => removeMutation.mutate(item.id)} disabled={removeMutation.isPending} data-testid={`button-delete-${item.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
