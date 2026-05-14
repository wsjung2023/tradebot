
import { db } from '../server/db';
import * as schema from '../shared/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
  const logs = await db.select().from(schema.candidateDecisionLogs).orderBy(desc(schema.candidateDecisionLogs.decidedAt)).limit(3);
  console.log(JSON.stringify(logs, null, 2));
}
main().catch(console.error).finally(() => process.exit(0));
