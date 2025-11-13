import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WifiOff, Wifi, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import type { ConnectionStatus } from "@/hooks/use-market-stream";

interface ConnectionStatusProps {
  status: ConnectionStatus;
  errorMessage?: string | null;
  retryCount?: number;
  onReconnect?: () => void;
}

const statusConfig = {
  connecting: {
    icon: RefreshCw,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    borderColor: "border-yellow-500/30",
    label: "연결 중",
  },
  online: {
    icon: CheckCircle2,
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    borderColor: "border-green-500/30",
    label: "연결됨",
  },
  degraded: {
    icon: AlertTriangle,
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    borderColor: "border-orange-500/30",
    label: "불안정",
  },
  offline: {
    icon: WifiOff,
    color: "text-gray-400",
    bgColor: "bg-gray-500/20",
    borderColor: "border-gray-500/30",
    label: "오프라인",
  },
  failed: {
    icon: WifiOff,
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/30",
    label: "연결 실패",
  },
};

export function ConnectionStatus({ status, errorMessage, retryCount, onReconnect }: ConnectionStatusProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  if (status === 'online') {
    return (
      <Badge
        variant="outline"
        className={`${config.bgColor} ${config.borderColor} ${config.color} gap-1.5`}
        data-testid="connection-status-badge"
      >
        <Icon className={`w-3 h-3 ${status === 'connecting' ? 'animate-spin' : 'animate-pulse-glow'}`} />
        {config.label}
      </Badge>
    );
  }

  return (
    <Alert className={`${config.bgColor} ${config.borderColor}`} data-testid="connection-status-alert">
      <Icon className={`w-4 h-4 ${config.color} ${status === 'connecting' ? 'animate-spin' : ''}`} />
      <AlertDescription className="flex items-center justify-between">
        <div>
          <span className={`font-semibold ${config.color}`}>{config.label}</span>
          {errorMessage && (
            <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
          )}
          {retryCount !== undefined && retryCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              재시도 횟수: {retryCount}/10
            </p>
          )}
        </div>
        {(status === 'failed' || status === 'offline' || status === 'degraded') && onReconnect && (
          <Button
            size="sm"
            variant="outline"
            onClick={onReconnect}
            className="ml-4"
            data-testid="button-reconnect"
          >
            <RefreshCw className="w-3 h-3 mr-2" />
            재연결
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
