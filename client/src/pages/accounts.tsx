import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Wallet, Trash2, TrendingUp } from "lucide-react";

interface KiwoomAccount {
  id: number;
  userId: string;
  accountNumber: string;
  accountName: string;
  accountType: 'real' | 'mock';
  createdAt: string;
}

interface AccountBalance {
  totalAssets: string;
  cashBalance: string;
  stockValue: string;
}

export default function Accounts() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<'real' | 'mock'>('mock');

  const { data: accounts = [], isLoading } = useQuery<KiwoomAccount[]>({
    queryKey: ['/api/accounts'],
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: { accountNumber: string; accountName: string; accountType: 'real' | 'mock' }) => {
      const res = await apiRequest('POST', '/api/accounts', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      toast({
        title: "계좌 추가 성공",
        description: "키움 계좌가 성공적으로 추가되었습니다",
      });
      setIsDialogOpen(false);
      setAccountNumber("");
      setAccountName("");
      setAccountType('mock');
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "계좌 추가 실패",
        description: error.message,
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/accounts/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      toast({
        title: "계좌 삭제 성공",
        description: "계좌가 삭제되었습니다",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "계좌 삭제 실패",
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accountNumber || !accountName) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "모든 필드를 입력해주세요",
      });
      return;
    }

    createAccountMutation.mutate({
      accountNumber,
      accountName,
      accountType,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">로딩중...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gradient-cyber">계좌 관리</h1>
          <p className="text-muted-foreground mt-2">
            키움증권 계좌를 연동하고 관리하세요
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-account" className="hover-elevate active-elevate-2">
              <Plus className="h-4 w-4 mr-2" />
              계좌 추가
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-add-account">
            <DialogHeader>
              <DialogTitle>계좌 추가</DialogTitle>
              <DialogDescription>
                키움증권 계좌 정보를 입력하세요
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">계좌번호</Label>
                  <Input
                    id="accountNumber"
                    data-testid="input-account-number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="0000000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountName">계좌 이름</Label>
                  <Input
                    id="accountName"
                    data-testid="input-account-name"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="메인 계좌"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountType">계좌 유형</Label>
                  <Select
                    value={accountType}
                    onValueChange={(value: 'real' | 'mock') => setAccountType(value)}
                  >
                    <SelectTrigger id="accountType" data-testid="select-account-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mock">모의투자</SelectItem>
                      <SelectItem value="real">실전투자</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  data-testid="button-submit"
                  disabled={createAccountMutation.isPending}
                  className="hover-elevate active-elevate-2"
                >
                  {createAccountMutation.isPending ? "추가 중..." : "추가"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">등록된 계좌가 없습니다</h3>
            <p className="text-muted-foreground mb-4">
              키움증권 계좌를 추가하여 자동매매를 시작하세요
            </p>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-first-account">
              <Plus className="h-4 w-4 mr-2" />
              첫 계좌 추가하기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-cyan-500" />
              연동된 계좌 ({accounts.length})
            </CardTitle>
            <CardDescription>
              등록된 키움증권 계좌 목록입니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>계좌 이름</TableHead>
                  <TableHead>계좌번호</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>등록일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id} data-testid={`row-account-${account.id}`}>
                    <TableCell className="font-medium">
                      {account.accountName}
                    </TableCell>
                    <TableCell>
                      {account.accountNumber}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={account.accountType === 'real' ? 'default' : 'secondary'}
                        data-testid={`badge-type-${account.id}`}
                      >
                        {account.accountType === 'real' ? '실전투자' : '모의투자'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(account.createdAt).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-delete-${account.id}`}
                        onClick={() => {
                          if (confirm('정말 이 계좌를 삭제하시겠습니까?')) {
                            deleteAccountMutation.mutate(account.id);
                          }
                        }}
                        disabled={deleteAccountMutation.isPending}
                        className="hover-elevate"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass-card border-cyan-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-glow-cyan">
              <TrendingUp className="h-5 w-5" />
              계좌 연동 안내
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>• 키움증권 HTS에서 계좌번호를 확인하세요</p>
            <p>• 모의투자 계좌로 먼저 테스트해보세요</p>
            <p>• 실전 계좌는 신중하게 연동하세요</p>
            <p>• API 키는 설정 페이지에서 입력하세요</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-glow-purple">
              <Wallet className="h-5 w-5" />
              보안 안내
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>• 계좌 정보는 안전하게 암호화됩니다</p>
            <p>• API 키는 절대 공유하지 마세요</p>
            <p>• 정기적으로 API 키를 갱신하세요</p>
            <p>• 의심스러운 활동은 즉시 차단됩니다</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
