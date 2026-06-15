import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, DollarSign, TrendingUp, Activity } from "lucide-react";

interface AdminStats {
  totalUsers: number;
  byTier: Record<string, number>;
  activeSubscriptions: number;
  mrrUsd: number;
  recentUsers: { id: string; email: string; createdAt: string }[];
}

const TIER_LABEL: Record<string, string> = {
  free: 'Free',
  saas_basic: 'Basic ($85)',
  saas_pro: 'Pro ($180)',
  saas_enterprise: 'Enterprise ($320)',
};

const TIER_COLOR: Record<string, string> = {
  free: 'secondary',
  saas_basic: 'outline',
  saas_pro: 'default',
  saas_enterprise: 'default',
};

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => (await apiRequest('GET', '/api/admin/stats')).json(),
    refetchInterval: 30000,
  });

  if (isLoading || !stats) {
    return <div className="p-6 text-muted-foreground text-sm">로딩 중...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">어드민 대시보드</h1>

      {/* 핵심 지표 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">총 가입자</p>
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">유료 구독</p>
              <p className="text-2xl font-bold">{stats.activeSubscriptions}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-xs text-muted-foreground">예상 MRR</p>
              <p className="text-2xl font-bold">${stats.mrrUsd.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-xs text-muted-foreground">전환율</p>
              <p className="text-2xl font-bold">
                {stats.totalUsers > 0
                  ? `${Math.round((stats.activeSubscriptions / stats.totalUsers) * 100)}%`
                  : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 플랜별 분포 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">플랜별 분포</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(TIER_LABEL).map(([tier, label]) => {
              const count = stats.byTier[tier] ?? 0;
              const pct = stats.totalUsers > 0 ? Math.round((count / stats.totalUsers) * 100) : 0;
              return (
                <div key={tier} className="flex items-center gap-3">
                  <Badge variant={TIER_COLOR[tier] as any} className="w-28 justify-center text-xs">
                    {label}
                  </Badge>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{count}</span>
                  <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 최근 가입자 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 가입자</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">없음</p>
            ) : (
              <ul className="space-y-2">
                {stats.recentUsers.map(u => (
                  <li key={u.id} className="flex justify-between items-center text-sm">
                    <span className="font-mono text-xs truncate max-w-[200px]">{u.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
