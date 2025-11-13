import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Watchlist() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-watchlist-title">관심종목</h1>
        <p className="text-muted-foreground">관심 종목 모니터링</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>관심종목</CardTitle>
          <CardDescription>실시간 시세 확인</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-12">
            관심종목 화면을 구현 중입니다
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
