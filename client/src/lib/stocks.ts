export interface StockSearchResult {
  stockCode: string;
  stockName: string;
  currentPrice?: string | number;
  marketName?: string;
}

export interface SelectedStock {
  stockCode: string;
  stockName: string;
  currentPrice?: number;
  marketName?: string;
}

export function normalizePrice(value?: string | number | null): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number"
    ? value
    : Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toSelectedStock(stock?: StockSearchResult | null): SelectedStock | null {
  if (!stock?.stockCode || !stock?.stockName) return null;

  return {
    stockCode: stock.stockCode,
    stockName: stock.stockName,
    currentPrice: normalizePrice(stock.currentPrice),
    marketName: stock.marketName,
  };
}
