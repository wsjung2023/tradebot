import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, subDays } from "date-fns";
import { Search, Loader2 } from "lucide-react";

interface TradeJournalEntry {
  id: number;
  tradeDate: string;
  tradeTime: string;
  stockCode: string;
  stockName: string;
  tradeType: string;
  price: string;
  quantity: number;
  totalAmount: string;
  avgPrice: string;
  rainbowLine: number | null;
  profitRate: string;
  profitLoss: string;
  exitReason: string | null;
  isAutoTrading: boolean;
  memo: string | null;
}

function formatKRW(val: number | string): string {
  return Number(val).toLocaleString("ko-KR");
}

function pnlColor(val: number | string): string {
  const num = Number(val);
  if (num > 0) return "text-green-600 dark:text-green-400 font-medium";
  if (num < 0) return "text-red-600 dark:text-red-400 font-medium";
  return "";
}

function formatTradeDate(dateStr: string, timeStr: string) {
  if (!dateStr || dateStr.length !== 8) return `${dateStr} ${timeStr}`;
  return `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)} ${timeStr}`;
}

function getTradeTypeBadge(type: string) {
  switch (type) {
    case 'buy': return <Badge variant="default" className="bg-red-500 hover:bg-red-600 text-white">신규매수</Badge>;
    case 'additional_buy': return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600 text-white">추가매수</Badge>;
    case 'sell': return <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-600 text-white">목표매도</Badge>;
    case 'exit_sell': return <Badge variant="outline" className="text-blue-600 border-blue-600">청산매도</Badge>;
    default: return <Badge variant="outline">{type}</Badge>;
  }
}

export default function TradeJournalPage() {
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [stockCode, setStockCode] = useState("");
  const [tradeType, setTradeType] = useState("all");
  const [searchTrigger, setSearchTrigger] = useState(0);

  const urlParams = new URLSearchParams();
  if (startDate) urlParams.set("startDate", startDate);
  if (endDate) urlParams.set("endDate", endDate);
  if (stockCode) urlParams.set("stockCode", stockCode);
  if (tradeType !== "all") urlParams.set("tradeType", tradeType);

  const { data: entries, isLoading } = useQuery<TradeJournalEntry[]>({
    queryKey: ["trade-journal", searchTrigger],
    queryFn: async () => {
      const res = await fetch(`/api/trade-journal?${urlParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch trade journal");
      return res.json();
    },
  });

  const handleSearch = () => {
    setSearchTrigger(prev => prev + 1);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">매매 저널 (Trade Journal)</h1>
          <p className="text-muted-foreground mt-1">개별 매수/매도 트랜잭션 기록 및 상세 조회</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">시작일</label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">종료일</label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">거래 타입</label>
              <Select value={tradeType} onValueChange={setTradeType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="buy">신규매수</SelectItem>
                  <SelectItem value="additional_buy">추가매수</SelectItem>
                  <SelectItem value="sell">목표매도</SelectItem>
                  <SelectItem value="exit_sell">청산매도</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">종목코드 (선택)</label>
              <Input 
                type="text" 
                placeholder="예: 005930" 
                value={stockCode} 
                onChange={(e) => setStockCode(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <Button onClick={handleSearch} className="gap-2">
              <Search className="w-4 h-4" />
              조회
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex justify-between items-center">
            거래 내역
            <Badge variant="secondary">{entries?.length || 0}건 조회됨</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-20 flex justify-center items-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !entries || entries.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground border rounded-lg bg-muted/20">
              조회된 거래 내역이 없습니다.
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[160px]">일시</TableHead>
                    <TableHead>종목</TableHead>
                    <TableHead>구분</TableHead>
                    <TableHead className="text-right">단가/수량</TableHead>
                    <TableHead className="text-right">거래금액</TableHead>
                    <TableHead className="text-center">CL선</TableHead>
                    <TableHead className="text-right">실현손익</TableHead>
                    <TableHead>메모/사유</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {formatTradeDate(entry.tradeDate, entry.tradeTime)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{entry.stockName}</div>
                        <div className="text-xs text-muted-foreground">{entry.stockCode}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          {getTradeTypeBadge(entry.tradeType)}
                          {!entry.isAutoTrading && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">수동</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>{formatKRW(entry.price)}원</div>
                        <div className="text-xs text-muted-foreground">{formatKRW(entry.quantity)}주</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatKRW(entry.totalAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.rainbowLine ? (
                          <Badge variant="secondary" className="font-mono">{entry.rainbowLine}%</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {(entry.tradeType === 'sell' || entry.tradeType === 'exit_sell') ? (
                          <>
                            <div className={pnlColor(entry.profitLoss)}>
                              {Number(entry.profitLoss) > 0 ? "+" : ""}{formatKRW(entry.profitLoss)}
                            </div>
                            <div className={`text-xs ${pnlColor(entry.profitRate)}`}>
                              {Number(entry.profitRate) > 0 ? "+" : ""}{Number(entry.profitRate).toFixed(2)}%
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="text-sm truncate" title={entry.memo || entry.exitReason || "-"}>
                          {entry.memo || entry.exitReason || "-"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
