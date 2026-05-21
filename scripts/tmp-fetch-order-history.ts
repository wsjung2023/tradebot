import { storage } from "../server/storage";
import { createKiwoomService } from "../server/services/kiwoom";
import { decrypt, isEncrypted } from "../server/utils/crypto";

function plain(value: string | null | undefined): string {
  if (!value) return "";
  return isEncrypted(value) ? decrypt(value) : value;
}

async function main() {
  const accountId = Number(process.env.CHECK_ACCOUNT_ID || "20");
  const date = process.env.CHECK_ORDER_DATE || "";

  const account = await storage.getKiwoomAccount(accountId);
  if (!account) throw new Error(`account not found: ${accountId}`);
  if (!account.kiwoomAppKey || !account.kiwoomAppSecret) {
    throw new Error(`account ${accountId} has no API credentials`);
  }

  const service = createKiwoomService({
    appKey: plain(account.kiwoomAppKey),
    appSecret: plain(account.kiwoomAppSecret),
    accountType: (account.accountType as "mock" | "real") || "mock",
  });

  const result = await service.getOrderHistory(account.accountNumber, date || undefined);
  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        accountId,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        requestDate: date || "(today)",
        keys: Object.keys(result || {}),
        output1Count: Array.isArray((result as any)?.output1) ? (result as any).output1.length : null,
        outputCount: Array.isArray((result as any)?.output) ? (result as any).output.length : null,
        sample: Array.isArray((result as any)?.output1)
          ? (result as any).output1.slice(0, 5)
          : Array.isArray((result as any)?.output)
            ? (result as any).output.slice(0, 5)
            : null,
        raw: result,
      },
      null,
      2,
    ),
  );

  process.exit(0);
}

main().catch((error: any) => {
  console.error("[tmp-fetch-order-history] failed", error?.message || error);
  process.exit(1);
});
