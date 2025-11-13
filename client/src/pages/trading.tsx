import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Trading() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-trading-title">거래</h1>
        <p className="text-muted-foreground">실시간 차트 및 주문</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>거래 화면</CardTitle>
          <CardDescription>차트, 호가, 주문을 한 화면에서</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-12">
            거래 화면을 구현 중입니다
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
