import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Play, Square, RotateCcw, Clock, Activity, AlertCircle } from "lucide-react";

interface JobInfo {
  id: string;
  name: string;
  running: boolean;
  lastRun: string | null;
  nextRun: string | null;
  intervalMinutes: number;
  error: string | null;
}

export default function AdminJobs() {
  const { toast } = useToast();

  const { data: jobs = [], isLoading } = useQuery<JobInfo[]>({
    queryKey: ["/api/admin/jobs"],
    refetchInterval: 5000,
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/jobs/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "배치잡 시작됨" });
    },
    onError: () => toast({ variant: "destructive", title: "시작 실패" }),
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/jobs/${id}/stop`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "배치잡 중지됨" });
    },
    onError: () => toast({ variant: "destructive", title: "중지 실패" }),
  });

  const runNowMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/jobs/${id}/run`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "즉시 실행 완료" });
    },
    onError: () => toast({ variant: "destructive", title: "즉시 실행 실패" }),
  });

  const formatDate = (iso: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString("ko-KR");
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">배치잡 관리</h1>
        <p className="text-muted-foreground mt-1">
          자동매매, 학습, 데이터 정리 등 백그라운드 작업을 제어합니다.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
            <AlertCircle className="w-5 h-5" />
            <span>등록된 배치잡이 없습니다.</span>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <Card key={job.id} data-testid={`card-job-${job.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    {job.name}
                  </CardTitle>
                  <Badge
                    variant={job.running ? "default" : "secondary"}
                    data-testid={`status-job-${job.id}`}
                  >
                    {job.running ? "실행 중" : "중지됨"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>마지막 실행: {formatDate(job.lastRun)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>다음 실행: {formatDate(job.nextRun)}</span>
                  </div>
                </div>

                {job.error && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{job.error}</span>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {!job.running ? (
                    <Button
                      size="sm"
                      onClick={() => startMutation.mutate(job.id)}
                      disabled={startMutation.isPending}
                      data-testid={`button-start-${job.id}`}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      시작
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => stopMutation.mutate(job.id)}
                      disabled={stopMutation.isPending}
                      data-testid={`button-stop-${job.id}`}
                    >
                      <Square className="w-3 h-3 mr-1" />
                      중지
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runNowMutation.mutate(job.id)}
                    disabled={runNowMutation.isPending}
                    data-testid={`button-runnow-${job.id}`}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    즉시 실행
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
