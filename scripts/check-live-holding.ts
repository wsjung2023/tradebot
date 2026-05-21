import { storage } from "../server/storage";
import { getUserKiwoomService } from "../server/services/user-kiwoom.service";
import { parseHoldingItem } from "../server/utils/balance-parser";

function normalizeStockCode(code: unknown): string {
  return String(code ?? "").trim().replace(/^A/i, "");
}

function parseQty(value: unknown): number {
  const s = String(value ?? "").replace(/,/g, "").trim();
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

function pickSellableQty(raw: Record<string, unknown>): number | null {
  const candidates = [
    raw.ord_psbl_qty,
    raw.sell_psbl_qty,
    raw.mdpos_qty,
    raw.poss_qty,
    raw.sellable_qty,
    raw.ordable_qty,
    raw.orderable_qty,
  ];
  for (const v of candidates) {
    if (v === undefined || v === null || String(v).trim() === "") continue;
    return Math.max(0, parseQty(v));
  }
  return null;
}

async function main() {
  const accountId = Number(process.env.CHECK_ACCOUNT_ID || "20");
  const targetStockCode = normalizeStockCode(process.env.CHECK_STOCK_CODE || "402490");

  const account = await storage.getKiwoomAccount(accountId);
  if (!account) {
    throw new Error(`account not found: ${accountId}`);
  }

  const userKiwoom = getUserKiwoomService();
  const bal = await userKiwoom.getBalance(
    account.userId,
    account.accountNumber,
    (account.accountType as "mock" | "real") || "mock",
    account.id,
  );

  const output2 = Array.isArray((bal as any)?.output2) ? (bal as any).output2 as Array<Record<string, unknown>> : [];
  const rows = output2.map((raw) => {
    const parsed = parseHoldingItem(raw);
    return {
      stockCode: normalizeStockCode(parsed.stockCode),
      stockName: parsed.stockName,
      quantity: parseQty(parsed.quantity),
      sellableQty: pickSellableQty(raw),
      raw,
    };
  });

  const target = rows.find((r) => r.stockCode === targetStockCode);

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    account: {
      id: account.id,
      userId: account.userId,
      accountNumber: account.accountNumber,
      accountType: account.accountType,
    },
    targetStockCode,
    holdingsCount: rows.length,
    found: !!target,
    target: target
      ? {
          stockCode: target.stockCode,
          stockName: target.stockName,
          quantity: target.quantity,
          sellableQty: target.sellableQty,
        }
      : null,
  }, null, 2));
}

main().catch((e) => {
  console.error("[check-live-holding] failed:", e?.message || e);
  process.exit(1);
});

