import { createKiwoomService } from "../server/services/kiwoom";

async function main() {
  console.log("[tmp-fetch-balance] start");
  const appKey = process.env.KIWOOM_APP_KEY_MOCK || "";
  const appSecret = process.env.KIWOOM_APP_SECRET_MOCK || "";
  console.log("[tmp-fetch-balance] key_len", appKey.length, "secret_len", appSecret.length);

  const service = createKiwoomService({
    appKey,
    appSecret,
    accountType: "mock",
  });

  const result = await service.getAccountBalance("81208166", "mock");
  const output2 = Array.isArray((result as any)?.output2) ? (result as any).output2 : [];
  console.log("[tmp-fetch-balance] holdings_count", output2.length);
  console.log("[tmp-fetch-balance] output1", (result as any)?.output1);
  console.log(
    "[tmp-fetch-balance] first_rows",
    output2.slice(0, 12).map((row: any) => ({
      code: row.acnt_pdno || row.stk_cd,
      name: row.prdt_name || row.stk_nm,
      qty: row.hldg_qty || row.rmnd_qty,
      price: row.prpr || row.cur_prc,
    })),
  );
  process.exit(0);
}

main().catch((error: any) => {
  console.error("[tmp-fetch-balance] failed", error?.message || error);
  process.exit(1);
});
