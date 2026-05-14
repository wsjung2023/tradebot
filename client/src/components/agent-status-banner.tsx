import { useState, useEffect, useRef } from "react";
import { WifiOff, X } from "lucide-react";
import { useAgentStatus } from "@/hooks/use-agent-status";

export function AgentStatusBanner() {
  const { data, isLoading } = useAgentStatus();
  const [dismissed, setDismissed] = useState(false);
  const prevActive = useRef<boolean | null>(null);

  const isActive = data?.isAgentActive ?? null;

  useEffect(() => {
    if (isActive === null) return;
    if (prevActive.current !== null && !prevActive.current && isActive) {
      setDismissed(false);
    }
    if (!isActive) {
      setDismissed(false);
    }
    prevActive.current = isActive;
  }, [isActive]);

  if (isLoading || isActive === null || isActive || dismissed) {
    return null;
  }

  return (
    <div
      data-testid="banner-agent-disconnected"
      className="flex items-center justify-between gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/30 text-destructive text-sm"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>
          집 PC 에이전트에 연결할 수 없습니다.
          에이전트가 실행 중인지 확인하세요.
        </span>
      </div>
      <button
        data-testid="button-dismiss-banner"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-md p-1 hover-elevate"
        aria-label="배너 닫기"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
