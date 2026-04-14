import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Newspaper, Plus, Trash2, CalendarDays, Loader2 } from "lucide-react";
import type { MarketIssue } from "@shared/schema";

const ISSUE_TYPES = [
  { value: "news", label: "뉴스" },
  { value: "theme", label: "테마" },
  { value: "volume", label: "거래량" },
  { value: "price", label: "가격" },
  { value: "sector", label: "업종" },
] as const;

const IMPACT_LEVELS = [
  { value: "low", label: "낮음" },
  { value: "medium", label: "보통" },
  { value: "high", label: "높음" },
] as const;

function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, "");
}

function formatDate(d: string): string {
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return d;
}

function impactBadgeVariant(level: string) {
  switch (level) {
    case "high": return "destructive" as const;
    case "medium": return "secondary" as const;
    default: return "outline" as const;
  }
}

export function MarketIssuesManager() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(todayKST());
  const [stockCode, setStockCode] = useState("");
  const [stockName, setStockName] = useState("");
  const [issueType, setIssueType] = useState<string>("theme");
  const [impactLevel, setImpactLevel] = useState<string>("medium");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");

  const dateForInput = selectedDate.length === 8
    ? `${selectedDate.slice(0, 4)}-${selectedDate.slice(4, 6)}-${selectedDate.slice(6, 8)}`
    : selectedDate;

  const { data: issues = [], isLoading } = useQuery<MarketIssue[]>({
    queryKey: ["/api/market-issues", selectedDate],
    queryFn: async () => {
      const resp = await apiRequest("GET", `/api/market-issues?date=${selectedDate}`);
      return resp.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const resp = await apiRequest("POST", "/api/market-issues", data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market-issues", selectedDate] });
      setStockCode("");
      setStockName("");
      setIssueTitle("");
      setIssueDescription("");
      toast({ title: "시장 이슈 종목 등록됨" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "등록 실패", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/market-issues/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market-issues", selectedDate] });
      toast({ title: "이슈 종목 삭제됨" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "삭제 실패", description: e.message }),
  });

  const handleCreate = () => {
    if (!stockCode.trim()) {
      toast({ variant: "destructive", title: "종목코드를 입력하세요" });
      return;
    }
    if (!stockName.trim()) {
      toast({ variant: "destructive", title: "종목명을 입력하세요" });
      return;
    }
    createMutation.mutate({
      issueDate: selectedDate,
      stockCode: stockCode.trim(),
      stockName: stockName.trim(),
      issueType,
      impactLevel,
      issueTitle: issueTitle.trim() || undefined,
      issueDescription: issueDescription.trim() || undefined,
    });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value.replace(/-/g, ""));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Newspaper className="h-5 w-5" />
          시장 이슈 종목 관리
        </CardTitle>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateForInput}
            onChange={handleDateChange}
            className="w-[160px]"
            data-testid="input-market-issue-date"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">종목코드</label>
            <Input
              placeholder="005930"
              value={stockCode}
              onChange={(e) => setStockCode(e.target.value)}
              className="w-[100px]"
              data-testid="input-market-issue-stock-code"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">종목명</label>
            <Input
              placeholder="삼성전자"
              value={stockName}
              onChange={(e) => setStockName(e.target.value)}
              className="w-[120px]"
              data-testid="input-market-issue-stock-name"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">유형</label>
            <Select value={issueType} onValueChange={setIssueType}>
              <SelectTrigger className="w-[100px]" data-testid="select-market-issue-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">영향도</label>
            <Select value={impactLevel} onValueChange={setImpactLevel}>
              <SelectTrigger className="w-[90px]" data-testid="select-market-issue-impact">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPACT_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">제목 (선택)</label>
            <Input
              placeholder="이슈 제목"
              value={issueTitle}
              onChange={(e) => setIssueTitle(e.target.value)}
              className="w-[180px]"
              data-testid="input-market-issue-title"
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            data-testid="button-create-market-issue"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            등록
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="text-no-market-issues">
            {formatDate(selectedDate)} 등록된 시장 이슈 종목이 없습니다
          </div>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">종목코드</TableHead>
                  <TableHead>종목명</TableHead>
                  <TableHead className="w-[80px]">유형</TableHead>
                  <TableHead className="w-[80px]">영향도</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => (
                  <TableRow key={issue.id} data-testid={`row-market-issue-${issue.id}`}>
                    <TableCell className="font-mono text-sm">{issue.stockCode}</TableCell>
                    <TableCell className="font-medium">{issue.stockName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {ISSUE_TYPES.find((t) => t.value === issue.issueType)?.label || issue.issueType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={impactBadgeVariant(issue.impactLevel)}>
                        {IMPACT_LEVELS.find((l) => l.value === issue.impactLevel)?.label || issue.impactLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {issue.issueTitle || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(issue.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-market-issue-${issue.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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
  );
}
