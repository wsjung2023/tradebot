
import { db } from '../server/db';
import * as schema from '../shared/schema';

async function main() {
  console.log('--- Kiwoom Accounts ---');
  const accounts = await db.select().from(schema.kiwoomAccounts);
  accounts.forEach(a => {
    console.log(`ID: ${a.id} | Acct: ${a.accountNumber} | Type: ${a.accountType} | Active: ${a.isActive} | AppKey: ${a.appKey ? 'SET' : 'NULL'}`);
  });

  console.log('\n--- Active AI Models ---');
  const models = await db.select().from(schema.aiModels).where(eq(schema.aiModels.isActive, true));
  models.forEach(m => {
    console.log(`ID: ${m.id} | Name: ${m.modelName} | Config: ${JSON.stringify(m.config)}`);
  });
}

import { eq } from 'drizzle-orm';
main().catch(console.error).finally(() => process.exit(0));
