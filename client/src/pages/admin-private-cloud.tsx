import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Server, Plus, RefreshCw, ExternalLink, Trash2, Loader2 } from "lucide-react";

interface PrivateCloudCustomer {
  id: number;
  name: string;
  email: string;
  company_name: string | null;
  subdomain: string;
  railway_url: string | null;
  status: 'pending' | 'provisioning' | 'active' | 'failed' | 'suspended';
  error_message: string | null;
  monthly_fee_krw: number | null;
  notes: string | null;
  created_at: string;
  provisioned_at: string | null;
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending:      { label: '대기중',     variant: 'secondary' },
  provisioning: { label: '프로비저닝 중', variant: 'default' },
  active:       { label: '운영중',     variant: 'default' },
  failed:       { label: '실패',       variant: 'destructive' },
  suspended:    { label: '정지',       variant: 'outline' },
};

function AddCustomerDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', companyName: '', subdomain: '', monthlyFeeKrw: '', notes: '' });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/private-cloud', {
        ...form,
        monthlyFeeKrw: form.monthlyFeeKrw ? parseInt(form.monthlyFeeKrw) : null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '고객 등록 완료', description: 'Railway 프로비저닝이 시작되었습니다.' });
      setOpen(false);
      setForm({ name: '', email: '', companyName: '', subdomain: '', monthlyFeeKrw: '', notes: '' });
      onSuccess();
    },
    onError: (e: any) => toast({ variant: 'destructive', title: '등록 실패', description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />새 고객 추가</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Private Cloud 고객 등록</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>담당자 이름 *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="홍길동" />
            </div>
            <div className="space-y-1">
              <Label>회사명</Label>
              <Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} placeholder="(주)고객사" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>이메일 *</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@company.com" />
          </div>
          <div className="space-y-1">
            <Label>서브도메인 *</Label>
            <div className="flex items-center gap-1">
              <Input value={form.subdomain} onChange={e => setForm(f => ({ ...f, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} placeholder="acme" className="flex-1" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">.wsj-aitradebot.live</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label>월 계약금 (원)</Label>
            <Input type="number" value={form.monthlyFeeKrw} onChange={e => setForm(f => ({ ...f, monthlyFeeKrw: e.target.value }))} placeholder="500000" />
          </div>
          <div className="space-y-1">
            <Label>메모</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="계약 특이사항 등" />
          </div>
          <Button className="w-full" disabled={!form.name || !form.email || !form.subdomain || addMutation.isPending} onClick={() => addMutation.mutate()}>
            {addMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />등록 중...</> : '등록 + 프로비저닝 시작'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPrivateCloud() {
  const { toast } = useToast();

  const { data: customers = [], refetch, isLoading } = useQuery<PrivateCloudCustomer[]>({
    queryKey: ['/api/admin/private-cloud'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/private-cloud');
      return res.json();
    },
    refetchInterval: 10000,
  });

  const reprovisionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/admin/private-cloud/${id}/reprovision`);
      return res.json();
    },
    onSuccess: () => { toast({ title: '프로비저닝 재시작' }); refetch(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/admin/private-cloud/${id}`);
      return res.json();
    },
    onSuccess: () => { toast({ title: '인스턴스 비활성화 완료' }); queryClient.invalidateQueries({ queryKey: ['/api/admin/private-cloud'] }); },
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Private Cloud 고객 관리</h1>
        </div>
        <AddCustomerDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/private-cloud'] })} />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />로딩 중...</div>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Server className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>등록된 Private Cloud 고객이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {customers.map(c => {
            const badge = STATUS_BADGE[c.status] ?? { label: c.status, variant: 'secondary' as const };
            return (
              <Card key={c.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{c.company_name || c.name}</span>
                        <Badge variant={badge.variant} className={c.status === 'active' ? 'bg-green-500 text-white' : c.status === 'provisioning' ? 'bg-blue-500 text-white' : ''}>
                          {c.status === 'provisioning' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {badge.label}
                        </Badge>
                        {c.monthly_fee_krw && (
                          <span className="text-xs text-muted-foreground">월 {c.monthly_fee_krw.toLocaleString()}원</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{c.email} · {c.subdomain}.wsj-aitradebot.live</div>
                      {c.railway_url && (
                        <a href={c.railway_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" />{c.railway_url}
                        </a>
                      )}
                      {c.error_message && (
                        <p className="text-xs text-destructive mt-1">오류: {c.error_message}</p>
                      )}
                      {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.status === 'failed' && (
                        <Button size="sm" variant="outline" onClick={() => reprovisionMutation.mutate(c.id)} disabled={reprovisionMutation.isPending}>
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />재시도
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => {
                        if (confirm(`${c.name} 인스턴스를 비활성화하시겠습니까? Railway 프로젝트가 삭제됩니다.`)) {
                          deleteMutation.mutate(c.id);
                        }
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
