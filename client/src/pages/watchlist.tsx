import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
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

export default function Watchlist() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stockCode, setStockCode] = useState("");
  const [stockName, setStockName] = useState("");

  const { data: watchlist = [], isLoading } = useQuery<WatchlistItem[]>({
    queryKey: ['/api/watchlist'],
  });

  const stockCodes = watchlist.map(item => item.stockCode);
  const { prices: marketData } = useMarketStream(stockCodes);

  const addMutation = useMutation({
    mutationFn: async (data: { stockCode: string; stockName?: string }) => {
      return await apiRequest('POST', '/api/watchlist', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlist'] });
      setDialogOpen(false);
      setStockCode("");
      setStockName("");
      toast({
        title: "추가 완료",
        description: "관심종목에 추가되었습니다",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "추가 실패",
        description: error.message || "관심종목 추가 중 오류가 발생했습니다",
      });
    },
  });

  const stockInfoMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest('GET', `/api/stocks/${code}/info`);
      return await response.json();
    },
    onSuccess: (info: any) => {
      if (info?.name) {
        setStockName(info.name);
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/watchlist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlist'] });
      toast({
        title: "삭제 완료",
        description: "관심종목에서 제거되었습니다",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "삭제 실패",
        description: error.message || "관심종목 삭제 중 오류가 발생했습니다",
      });
    },
  });

  const handleAdd = () => {
    if (!stockCode.trim()) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "종목코드를 입력해주세요",
      });
      return;
    }
    addMutation.mutate({ stockCode: stockCode.trim(), stockName: stockName.trim() || undefined });
  };

  const handleResolveStockName = () => {
    const normalizedCode = stockCode.trim();
    if (!/^\d{6}$/.test(normalizedCode)) return;
    if (stockName.trim()) return;
    stockInfoMutation.mutate(normalizedCode);
  };

  const handleRemove = (id: number) => {
    removeMutation.mutate(id);
  };

  const getPriceChange = (stockCode: string) => {
    const data = marketData[stockCode];
    if (!data || !data.currentPrice) return null;
    
    const change = data.change || 0;
    const changePercent = data.changeRate || 0;
    
    return {
      change,
      changePercent,
      isPositive: change >= 0,
    };
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">관심종목</h1>
          <p className="text-sm text-muted-foreground">실시간 시세 모니터링</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-watchlist">
              <Plus className="h-4 w-4 mr-2" />
              종목 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>관심종목 추가</DialogTitle>
              <DialogDescription>
                추가할 종목의 코드와 이름을 입력하세요
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">종목코드</label>
                <Input
                  placeholder="예: 005930"
                  value={stockCode}
                  onChange={(e) => setStockCode(e.target.value)}
                  onBlur={handleResolveStockName}
                  data-testid="input-stock-code"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">종목명 (선택)</label>
                <Input
                  placeholder="비워두면 자동 조회"
                  value={stockName}
                  onChange={(e) => setStockName(e.target.value)}
                  data-testid="input-stock-name"
                />
              </div>
              <Button 
                onClick={handleAdd}
                disabled={addMutation.isPending || stockInfoMutation.isPending}
                className="w-full"
                data-testid="button-submit-watchlist"
              >
                {addMutation.isPending ? "추가 중..." : stockInfoMutation.isPending ? "종목 확인 중..." : "추가"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>관심종목 목록</CardTitle>
        </CardHeader>
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
                    <TableHead>종목코드</TableHead>
                    <TableHead>종목명</TableHead>
                    <TableHead className="text-right">현재가</TableHead>
                    <TableHead className="text-right">전일대비</TableHead>
                    <TableHead className="text-right">등락률</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {watchlist.map((item) => {
                    const priceChange = getPriceChange(item.stockCode);
                    const currentData = marketData[item.stockCode];
                    
                    return (
                      <TableRow key={item.id} data-testid={`row-watchlist-${item.id}`}>
                        <TableCell className="font-mono font-medium">
                          {item.stockCode}
                        </TableCell>
                        <TableCell className="font-medium">{item.stockName}</TableCell>
                        <TableCell className="text-right font-mono">
                          {currentData ? currentData.currentPrice.toLocaleString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {priceChange ? (
                            <div className={`flex items-center justify-end gap-1 ${
                              priceChange.isPositive ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {priceChange.isPositive ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : (
                                <TrendingDown className="h-4 w-4" />
                              )}
                              <span className="font-mono">
                                {priceChange.isPositive ? '+' : ''}
                                {priceChange.change.toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {priceChange ? (
                            <span className={`font-mono ${
                              priceChange.isPositive ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {priceChange.isPositive ? '+' : ''}
                              {priceChange.changePercent.toFixed(2)}%
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {currentData ? (
                            <Badge variant="default" data-testid={`badge-status-${item.id}`}>
                              실시간
                            </Badge>
                          ) : (
                            <Badge variant="secondary" data-testid={`badge-status-${item.id}`}>
                              대기중
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleRemove(item.id)}
                            disabled={removeMutation.isPending}
                            data-testid={`button-delete-${item.id}`}
                          >
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
