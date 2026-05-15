// SettingsMasterKeys.tsx — 마스터 API 키 관리 카드 (OpenAI, DART, Kiwoom)
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Eye, EyeOff, CheckCircle, AlertCircle, Save } from "lucide-react";

interface MasterKeyItem {
  key: string;
  label: string;
  envHint: string;
  hasValue: boolean;
  masked: string;
}

function KeyRow({ item }: { item: MasterKeyItem }) {
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () =>
      (await apiRequest("PUT", `/api/master-settings/${encodeURIComponent(item.key)}`, { value })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master-settings"] });
      setValue("");
      toast({ title: "저장 완료", description: `${item.label} 업데이트됨` });
    },
    onError: (e: any) =>
      toast({ variant: "destructive", title: "저장 실패", description: e.message }),
  });

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {item.hasValue
            ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            : <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />}
          <span className="text-sm font-medium truncate">{item.label}</span>
        </div>
        {item.hasValue && (
          <p className="text-xs text-muted-foreground mt-0.5 pl-6 font-mono">{item.masked}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <Input
            type={show ? "text" : "password"}
            placeholder="새 값 입력"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="w-52 h-8 text-sm pr-8 font-mono"
          />
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-3"
          disabled={!value.trim() || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          <Save className="h-3.5 w-3.5 mr-1" />
          저장
        </Button>
      </div>
    </div>
  );
}

export function SettingsMasterKeys() {
  const { data: keys = [], isLoading } = useQuery<MasterKeyItem[]>({
    queryKey: ["/api/master-settings"],
  });

  // 키움 글로벌 키는 레거시 — 계좌별 키로 대체됨, UI에서만 숨김
  const groups = [
    { title: "AI / 공공데이터", items: keys.filter(k => k.key.includes("openai") || k.key.includes("dart")) },
  ];

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Key className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold">마스터 API 키 관리</h3>
          <p className="text-sm text-muted-foreground">암호화 저장 · 서버 재시작 없이 즉시 반영</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : (
        groups.map(group => (
          group.items.length > 0 && (
            <div key={group.title}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {group.title}
              </p>
              <div>
                {group.items.map(item => <KeyRow key={item.key} item={item} />)}
              </div>
            </div>
          )
        ))
      )}
    </div>
  );
}
