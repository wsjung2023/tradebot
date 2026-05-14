import { useQuery } from "@tanstack/react-query";

export interface AgentConnectionInfo {
  serverUrl: string;
  agentKeyConfigured: boolean;
  agentLastSeen: string | null;
  agentLastSeenSecondsAgo: number | null;
  isAgentActive: boolean;
  pollCount: number;
}

export function useAgentStatus() {
  return useQuery<AgentConnectionInfo>({
    queryKey: ["/api/kiwoom-agent/connection-info"],
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
}
