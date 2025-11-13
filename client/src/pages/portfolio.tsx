import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Portfolio() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-portfolio-title">포트폴리오</h1>
        <p className="text-muted-foreground">보유 자산 관리</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>포트폴리오</CardTitle>
          <CardDescription>보유 종목 및 수익률</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-12">
            포트폴리오 화면을 구현 중입니다
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
