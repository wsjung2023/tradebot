import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { SelectedStock, StockSearchResult } from "@/lib/stocks";
import { normalizePrice, toSelectedStock } from "@/lib/stocks";

interface StockSelectorProps {
  value: SelectedStock | null;
  onChange: (stock: SelectedStock | null) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  inputTestId?: string;
  allowManualCode?: boolean;
}

export function StockSelector({
  value,
  onChange,
  placeholder = "종목명 또는 코드 입력",
  label,
  disabled,
  className,
  inputTestId,
  allowManualCode = false,
}: StockSelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [manualLookupPending, setManualLookupPending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionRequestIdRef = useRef(0);

  useEffect(() => {
    if (!value) {
      setQuery("");
      return;
    }

    setQuery(`${value.stockCode} ${value.stockName}`.trim());
  }, [value?.stockCode, value?.stockName]);

  useEffect(() => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const runSearch = async (nextQuery: string) => {
    if (nextQuery.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await apiRequest("GET", `/api/stocks/search?q=${encodeURIComponent(nextQuery)}`);
      const data = await response.json();
      const items = Array.isArray(data) ? data.slice(0, 10) : [];
      setResults(items);
      setShowDropdown(items.length > 0);
    } catch {
      setResults([]);
      setShowDropdown(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (nextValue: string) => {
    setQuery(nextValue);
    onChange(null);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      void runSearch(nextValue);
    }, 250);
  };

  const hydrateSelectedStock = async (stock: SelectedStock | null) => {
    if (!stock?.stockCode) {
      onChange(stock);
      return;
    }

    const requestId = ++selectionRequestIdRef.current;
    onChange(stock);

    if (stock.currentPrice && stock.currentPrice > 0 && stock.stockName) {
      return;
    }

    try {
      const [infoResponse, priceResponse] = await Promise.allSettled([
        apiRequest("GET", `/api/stocks/${stock.stockCode}/info`),
        apiRequest("GET", `/api/stocks/${stock.stockCode}/price`),
      ]);

      let nextStock = stock;

      if (infoResponse.status === "fulfilled") {
        const info = await infoResponse.value.json();
        nextStock = {
          ...nextStock,
          stockName: info?.name || nextStock.stockName,
          marketName: info?.marketName || nextStock.marketName,
          currentPrice: normalizePrice(info?.currentPrice) ?? nextStock.currentPrice,
        };
      }

      if (priceResponse.status === "fulfilled") {
        const price = await priceResponse.value.json();
        nextStock = {
          ...nextStock,
          stockName: price?.stockName || nextStock.stockName,
          currentPrice: normalizePrice(price?.currentPrice) ?? nextStock.currentPrice,
        };
      }

      if (selectionRequestIdRef.current === requestId) {
        onChange(nextStock);
      }
    } catch {
      if (selectionRequestIdRef.current === requestId) {
        onChange(stock);
      }
    }
  };

  const handleSelect = (result: StockSearchResult) => {
    const selected = toSelectedStock(result);
    void hydrateSelectedStock(selected);
    setQuery(`${result.stockCode} ${result.stockName}`.trim());
    setResults([]);
    setShowDropdown(false);
  };

  const handleBlur = async () => {
    setTimeout(() => setShowDropdown(false), 150);

    if (!allowManualCode || value || !/^\d{6}$/.test(query.trim())) {
      return;
    }

    setManualLookupPending(true);
    try {
      const response = await apiRequest("GET", `/api/stocks/${query.trim()}/info`);
      const info = await response.json();
      await hydrateSelectedStock({
        stockCode: query.trim(),
        stockName: info?.name || query.trim(),
        marketName: info?.marketName,
        currentPrice: normalizePrice(info?.currentPrice),
      });
    } catch {
      onChange(null);
    } finally {
      setManualLookupPending(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="relative">
        <Input
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          onBlur={() => {
            void handleBlur();
          }}
          autoComplete="off"
          data-testid={inputTestId}
        />
        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-background shadow-lg">
            {results.map((result) => (
              <button
                key={`${result.stockCode}-${result.stockName}`}
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={() => handleSelect(result)}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{result.stockName}</span>
                  {result.marketName && (
                    <span className="text-xs text-muted-foreground">{result.marketName}</span>
                  )}
                </div>
                <span className="font-mono text-muted-foreground">{result.stockCode}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {value ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>선택됨</span>
          <Badge variant="outline" className="font-mono">{value.stockCode}</Badge>
          <span className="text-foreground">{value.stockName}</span>
          {typeof value.currentPrice === "number" && value.currentPrice > 0 && (
            <span className="font-mono">₩{value.currentPrice.toLocaleString("ko-KR")}</span>
          )}
        </div>
      ) : query.trim().length >= 2 ? (
        <p className="text-xs text-muted-foreground">
          {isSearching || manualLookupPending
            ? "종목 정보를 확인하는 중입니다..."
            : "검색 결과에서 종목을 선택하면 코드/종목명/현재가가 함께 연결됩니다."}
        </p>
      ) : null}
    </div>
  );
}
