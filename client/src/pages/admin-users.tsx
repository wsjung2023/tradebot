import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, ShieldCheck, ShieldOff } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  authProvider: string;
  isEmailVerified: boolean;
  createdAt: string;
  subscription: {
    tier: string;
    status: string;
    aumTier: string | null;
  } | null;
}

const AUM_LABELS: Record<string, string> = {
  under_20m: '2천만 미만',
  under_50m: '5천만 미만',
  under_100m: '1억 미만',
  over_100m: '1억 이상',
};

const TIER_COLORS: Record<string, string> = {
  free: 'secondary',
  saas_basic: 'default',
  saas_pro: 'default',
  saas_enterprise: 'default',
};

export default function AdminUsers() {
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const resp = await apiRequest('GET', '/api/admin/users');
      return resp.json();
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      setLoadingId(id);
      const resp = await apiRequest('PATCH', `/api/admin/users/${id}/role`, { role });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: '역할 변경됨' });
    },
    onError: (e: any) => toast({ title: '실패', description: e.message, variant: 'destructive' }),
    onSettled: () => setLoadingId(null),
  });

  const tierMutation = useMutation({
    mutationFn: async ({ id, tier }: { id: string; tier: string }) => {
      const resp = await apiRequest('PATCH', `/api/admin/users/${id}/subscription`, { tier });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: '구독 티어 변경됨' });
    },
    onError: (e: any) => toast({ title: '실패', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-6 w-6" />
        <h1 className="text-2xl font-bold">유저 관리</h1>
        <Badge variant="outline">{users.length}명</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>전체 유저</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">로딩 중...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left pb-2 pr-4">이메일</th>
                    <th className="text-left pb-2 pr-4">가입</th>
                    <th className="text-left pb-2 pr-4">인증</th>
                    <th className="text-left pb-2 pr-4">역할</th>
                    <th className="text-left pb-2 pr-4">구독</th>
                    <th className="text-left pb-2 pr-4">AUM</th>
                    <th className="text-left pb-2">가입일</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-4 font-mono text-xs">{u.email}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-xs">{u.authProvider}</Badge>
                      </td>
                      <td className="py-2 pr-4">
                        {u.isEmailVerified
                          ? <span className="text-green-500 text-xs">인증됨</span>
                          : <span className="text-red-400 text-xs">미인증</span>}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <Select
                          value={u.subscription?.tier ?? 'free'}
                          onValueChange={(tier) => tierMutation.mutate({ id: u.id, tier })}
                        >
                          <SelectTrigger className="h-7 text-xs w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free" className="text-xs">free</SelectItem>
                            <SelectItem value="saas_basic" className="text-xs">saas_basic</SelectItem>
                            <SelectItem value="saas_pro" className="text-xs">saas_pro</SelectItem>
                            <SelectItem value="saas_enterprise" className="text-xs">saas_enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        {u.subscription?.aumTier ? AUM_LABELS[u.subscription.aumTier] ?? u.subscription.aumTier : '-'}
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={loadingId === u.id}
                          onClick={() => roleMutation.mutate({ id: u.id, role: u.role === 'admin' ? 'user' : 'admin' })}
                          title={u.role === 'admin' ? '일반 유저로 변경' : '관리자로 승격'}
                        >
                          {u.role === 'admin'
                            ? <ShieldOff className="h-4 w-4 text-muted-foreground" />
                            : <ShieldCheck className="h-4 w-4 text-blue-500" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
