import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Settings() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-settings-title">설정</h1>
        <p className="text-muted-foreground">계정 및 거래 설정</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>설정</CardTitle>
          <CardDescription>계정, 알림, API 설정</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-12">
            설정 화면을 구현 중입니다
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
