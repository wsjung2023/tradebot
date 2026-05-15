// 모의계좌 .env 키 → DB 마이그레이션 (1회 실행용)
import * as dotenv from "dotenv";
dotenv.config();

import { encrypt } from "../server/utils/crypto";
import { db } from "../server/db";
import { kiwoomAccounts } from "../shared/schema";
import { eq } from "drizzle-orm";

async function migrate() {
  const appKey = process.env.KIWOOM_APP_KEY_MOCK || process.env.KIWOOM_APP_KEY;
  const appSecret = process.env.KIWOOM_APP_SECRET_MOCK || process.env.KIWOOM_APP_SECRET;

  if (!appKey || !appSecret || appKey === "stub") {
    console.error("❌ .env에 모의계좌 키 없음");
    process.exit(1);
  }

  const encKey = encrypt(appKey);
  const encSecret = encrypt(appSecret);

  // mock 타입이면서 키가 없는 계좌 전부 업데이트
  const result = await db
    .update(kiwoomAccounts)
    .set({ kiwoomAppKey: encKey, kiwoomAppSecret: encSecret })
    .where(eq(kiwoomAccounts.accountType, "mock"))
    .returning({ id: kiwoomAccounts.id, accountNumber: kiwoomAccounts.accountNumber });

  console.log(`✅ ${result.length}개 모의계좌에 키 저장 완료:`);
  result.forEach((r) => console.log(`  - id=${r.id} accountNumber=${r.accountNumber}`));
  process.exit(0);
}

migrate().catch((e) => { console.error(e); process.exit(1); });
