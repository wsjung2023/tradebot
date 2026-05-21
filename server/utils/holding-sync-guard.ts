type HoldingLike = {
  quantity: number;
  averagePrice: string;
  currentPrice: string;
};

type GuardInput = {
  parsedHoldings: HoldingLike[];
  existingHoldingsCount: number;
  expectedStockEvalAmount?: number;
};

export type HoldingSyncGuardDecision = {
  preserveExisting: boolean;
  reason: "no_existing" | "empty_snapshot" | "partial_snapshot" | "ok";
  parsedEvalAmount: number;
  expectedStockEvalAmount: number;
  evalCoverage: number;
  parsedCount: number;
  existingCount: number;
};

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const normalized = String(value).replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateParsedEvalAmount(parsedHoldings: HoldingLike[]): number {
  return parsedHoldings.reduce((sum, h) => {
    const qty = Math.max(0, Number(h.quantity || 0));
    const avg = toNumber(h.averagePrice);
    const cur = toNumber(h.currentPrice);
    const basis = cur > 0 ? cur : avg;
    return sum + basis * qty;
  }, 0);
}

export function evaluateHoldingSyncGuard(input: GuardInput): HoldingSyncGuardDecision {
  const parsedCount = input.parsedHoldings.length;
  const existingCount = input.existingHoldingsCount;
  const expectedStockEvalAmount = Math.max(0, input.expectedStockEvalAmount || 0);
  const parsedEvalAmount = calculateParsedEvalAmount(input.parsedHoldings);
  const evalCoverage = expectedStockEvalAmount > 0 ? parsedEvalAmount / expectedStockEvalAmount : 1;

  if (existingCount <= 0) {
    return {
      preserveExisting: false,
      reason: "no_existing",
      parsedEvalAmount,
      expectedStockEvalAmount,
      evalCoverage,
      parsedCount,
      existingCount,
    };
  }

  if (parsedCount === 0) {
    return {
      preserveExisting: true,
      reason: "empty_snapshot",
      parsedEvalAmount,
      expectedStockEvalAmount,
      evalCoverage,
      parsedCount,
      existingCount,
    };
  }

  // Suspect partial snapshot when both count and value coverage drop sharply.
  // This prevents accidental mass deletion when broker temporarily returns incomplete holdings.
  const severeCountDrop = parsedCount <= Math.max(2, Math.floor(existingCount * 0.7));
  const severeEvalDrop = expectedStockEvalAmount > 0 && evalCoverage < 0.65;
  if (severeCountDrop && severeEvalDrop) {
    return {
      preserveExisting: true,
      reason: "partial_snapshot",
      parsedEvalAmount,
      expectedStockEvalAmount,
      evalCoverage,
      parsedCount,
      existingCount,
    };
  }

  return {
    preserveExisting: false,
    reason: "ok",
    parsedEvalAmount,
    expectedStockEvalAmount,
    evalCoverage,
    parsedCount,
    existingCount,
  };
}
