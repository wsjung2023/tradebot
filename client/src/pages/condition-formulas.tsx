import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, RefreshCw, Zap, TrendingUp } from "lucide-react";
import { useState } from "react";
import type { ConditionFormula, InsertConditionFormula } from "@shared/schema";
import { insertConditionFormulaSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";

export default function ConditionFormulasPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<ConditionFormula | null>(null);

  // Fetch condition formulas
  const { data: conditions = [], isLoading } = useQuery<ConditionFormula[]>({
    queryKey: ['/api/conditions'],
  });

  // Create condition formula
  const createMutation = useMutation({
    mutationFn: async (data: Partial<InsertConditionFormula>) => {
      const res = await apiRequest('POST', '/api/conditions', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conditions'] });
      toast({
        title: "조건식 생성 완료",
        description: "새로운 조건검색 공식이 추가되었습니다.",
      });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "생성 실패",
        description: error.message,
      });
    },
  });

  // Update condition formula
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertConditionFormula> }) => {
      const res = await apiRequest('PUT', `/api/conditions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conditions'] });
      toast({
        title: "조건식 수정 완료",
        description: "조건검색 공식이 업데이트되었습니다.",
      });
      setEditingFormula(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "수정 실패",
        description: error.message,
      });
    },
  });

  // Delete condition formula
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/conditions/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conditions'] });
      toast({
        title: "조건식 삭제 완료",
        description: "조건검색 공식이 제거되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "삭제 실패",
        description: error.message,
      });
    },
  });

  // Load HTS conditions (mock for now, will integrate with Kiwoom API)
  const loadHTSConditionsMutation = useMutation({
    mutationFn: async () => {
      // TODO: Implement Kiwoom getConditionList API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      throw new Error("HTS 조건식 불러오기는 키움 API 연동 후 사용 가능합니다.");
    },
    onSuccess: () => {
      toast({
        title: "HTS 조건식 로드 완료",
        description: "저장된 조건식을 불러왔습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "HTS 로드 실패",
        description: error.message,
      });
    },
  });

  // Create form schema from insertConditionFormulaSchema, excluding userId and formulaAst
  const formSchema = insertConditionFormulaSchema
    .omit({ userId: true, formulaAst: true })
    .extend({
      rawFormula: z.string().optional(), // Make rawFormula optional for now
    });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      conditionName: "",
      marketType: "ALL",
      rawFormula: "",
      description: null,
      isActive: true,
      isRealTimeMonitoring: false,
    },
  });

  const handleSubmit = (values: any) => {
    // Normalize empty strings to null for optional fields
    const normalizedValues = {
      ...values,
      description: values.description?.trim() || null,
      rawFormula: values.rawFormula?.trim() || null,
    };
    
    if (editingFormula) {
      updateMutation.mutate({ id: editingFormula.id, data: normalizedValues });
    } else {
      createMutation.mutate(normalizedValues);
    }
  };

  const handleEdit = (formula: ConditionFormula) => {
    setEditingFormula(formula);
    form.reset({
      conditionName: formula.conditionName,
      marketType: formula.marketType as any,
      rawFormula: formula.rawFormula || "",
      description: formula.description || "",
      isActive: formula.isActive,
      isRealTimeMonitoring: formula.isRealTimeMonitoring,
    });
    setIsAddDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setEditingFormula(null);
    form.reset();
  };

  const getMarketColor = (market: string) => {
    switch (market) {
      case 'KOSPI':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'KOSDAQ':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'KONEX':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'ALL':
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 animate-gradient-flow" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gradient-cyber mb-2">
            조건검색 공식 관리
          </h1>
          <p className="text-muted-foreground">
            HTS 조건검색 공식을 관리하고 실시간 스크리닝에 활용하세요
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => loadHTSConditionsMutation.mutate()}
            disabled={loadHTSConditionsMutation.isPending}
            variant="outline"
            className="hover-elevate"
            data-testid="button-load-hts"
          >
            {loadHTSConditionsMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            HTS 조건식 가져오기
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={handleCloseDialog}>
            <DialogTrigger asChild>
              <Button className="hover-elevate" data-testid="button-add-condition">
                <Plus className="h-4 w-4 mr-2" />
                조건식 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl text-glow-cyan">
                  {editingFormula ? "조건식 수정" : "새 조건식 추가"}
                </DialogTitle>
                <DialogDescription>
                  조건검색 공식을 설정하여 실시간 종목 스크리닝에 활용하세요
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="conditionName"
                    rules={{ required: "조건식 이름을 입력하세요" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>조건식 이름 *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="예: 상승 돌파 종목"
                            data-testid="input-condition-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="marketType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>시장 유형 *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-market-type">
                              <SelectValue placeholder="시장 선택" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ALL">전체</SelectItem>
                            <SelectItem value="KOSPI">KOSPI</SelectItem>
                            <SelectItem value="KOSDAQ">KOSDAQ</SelectItem>
                            <SelectItem value="KONEX">KONEX</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rawFormula"
                    rules={{ required: "조건식 공식을 입력하세요" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>조건식 공식 *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="예: CL > MA(20) AND VOL > 1000000"
                            rows={3}
                            data-testid="textarea-raw-formula"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>설명</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value || ""}
                            placeholder="조건식에 대한 설명을 입력하세요"
                            rows={3}
                            data-testid="textarea-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCloseDialog}
                      data-testid="button-cancel"
                    >
                      취소
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-submit"
                    >
                      {(createMutation.isPending || updateMutation.isPending) ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          저장 중...
                        </>
                      ) : (
                        editingFormula ? "수정" : "추가"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Conditions List */}
      <Card className="glass-card border-cyan-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-glow-cyan">
                <Zap className="h-5 w-5 text-cyan-400 animate-pulse-glow" />
                조건검색 공식 목록
              </CardTitle>
              <CardDescription>
                등록된 조건식: {conditions.length}개
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
          ) : conditions.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                등록된 조건식이 없습니다
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                "조건식 추가" 버튼을 클릭하여 새 조건식을 등록하세요
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>조건식 이름</TableHead>
                    <TableHead>시장</TableHead>
                    <TableHead>공식</TableHead>
                    <TableHead className="w-[80px]">실시간</TableHead>
                    <TableHead className="w-[80px]">매칭</TableHead>
                    <TableHead className="w-[100px]">상태</TableHead>
                    <TableHead className="w-[120px] text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conditions.map((condition) => (
                    <TableRow
                      key={condition.id}
                      className="hover-elevate cursor-pointer"
                      data-testid={`row-condition-${condition.id}`}
                    >
                      <TableCell className="font-medium">
                        {condition.conditionName}
                      </TableCell>
                      <TableCell>
                        <Badge className={getMarketColor(condition.marketType)}>
                          {condition.marketType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-sm truncate font-mono">
                        {condition.rawFormula || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={condition.isRealTimeMonitoring ? "default" : "outline"}
                          className={condition.isRealTimeMonitoring ? "animate-pulse-glow" : ""}
                        >
                          {condition.isRealTimeMonitoring ? 'ON' : 'OFF'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {condition.matchCount || 0}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={condition.isActive ? "default" : "secondary"}
                          className={condition.isActive ? "animate-pulse-glow" : ""}
                        >
                          {condition.isActive ? '활성' : '비활성'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(condition)}
                            data-testid={`button-edit-${condition.id}`}
                          >
                            수정
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                data-testid={`button-delete-${condition.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="glass-card">
                              <AlertDialogHeader>
                                <AlertDialogTitle>조건식 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{condition.conditionName}" 조건식을 삭제하시겠습니까?
                                  이 작업은 되돌릴 수 없습니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(condition.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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

      {/* Info Card */}
      <Card className="glass-card border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-purple-300">💡 조건검색 활용 팁</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <strong>기술적 분석</strong>: 이동평균선, RSI, MACD 등 기술 지표 기반 조건</p>
          <p>• <strong>재무 분석</strong>: PER, PBR, ROE 등 재무비율 기반 조건</p>
          <p>• <strong>커스텀</strong>: 복합 조건 및 사용자 정의 로직</p>
          <p>• HTS에서 저장한 조건식을 "HTS 조건식 가져오기"로 불러올 수 있습니다</p>
        </CardContent>
      </Card>
    </div>
  );
}
