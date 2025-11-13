import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AIAnalysis() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-ai-title">AI 분석</h1>
        <p className="text-muted-foreground">GPT-4 기반 투자 분석</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI 분석</CardTitle>
          <CardDescription>인공지능 투자 추천</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-12">
            AI 분석 기능을 구현 중입니다
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
