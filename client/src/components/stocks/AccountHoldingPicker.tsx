import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SelectedStock } from "@/lib/stocks";

interface Holding {
  id: number;
  stockCode: string;
  stockName: string;
  quantity: number;
  averagePrice: string;
  currentPrice: string | null;
  profitLossRate: string | null;
}

interface Props {
  accountId: number | null;
  onSelect: (stock: SelectedStock) => void;
  className?: string;
}

export function AccountHoldingPicker({ accountId, onSelect, className }: Props) {
  const { data: holdings = [] } = useQuery<Holding[]>({
    queryKey: ["/api/accounts", accountId, "holdings"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/accounts/${accountId}/holdings`);
      return res.json();
    },
    enabled: !!accountId,
  });

  if (!accountId || holdings.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {holdings.map((h) => {
        const rate = h.profitLossRate ? parseFloat(h.profitLossRate) : null;
        const isPos = rate !== null && rate > 0;
        const isNeg = rate !== null && rate < 0;
        return (
          <button
            key={h.id}
            type="button"
            onClick={() =>
              onSelect({
                stockCode: h.stockCode,
                stockName: h.stockName,
                currentPrice: h.currentPrice ? parseFloat(h.currentPrice) : undefined,
              })
            }
            className="flex items-center gap-1 px-2 py-1 rounded-md border bg-background text-xs hover:bg-accent hover:border-primary/50 transition-colors"
          >
            <span className="font-medium">{h.stockName}</span>
            {rate !== null && (
              <Badge
                variant={isPos ? "default" : isNeg ? "destructive" : "secondary"}
                className="text-[10px] px-1 py-0 h-4"
              >
                {isPos ? "+" : ""}{rate.toFixed(2)}%
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
