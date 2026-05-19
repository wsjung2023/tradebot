
import { db } from '../server/db';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const logs = await db.select().from(schema.candidateDecisionLogs).where(eq(schema.candidateDecisionLogs.stockCode, '001780')).limit(1);
  console.log(JSON.stringify(logs, null, 2));
}
main().catch(console.error).finally(() => process.exit(0));
