
import { storage } from './server/storage';

async function checkDecisions() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
  console.log(`Checking decisions for ${today}...`);

  // We want to see logs around 13:00 KST
  // KST is UTC+9, so 13:00 KST is 04:00 UTC
  const startTime = new Date(today + 'T03:30:00Z');
  const endTime = new Date(today + 'T04:30:00Z');

  try {
    const logs = await storage.db.select().from(storage.schema.candidateDecisionLogs)
      .where(sql`decided_at >= ${startTime} AND decided_at <= ${endTime}`)
      .orderBy(desc(storage.schema.candidateDecisionLogs.decidedAt));

    console.log(`Found ${logs.length} decision logs around 1 PM KST.`);
    logs.forEach(log => {
      console.log(`[${log.decidedAt.toISOString()}] Stock: ${log.stockName}(${log.stockCode}) Accepted: ${log.accepted} Reason: ${log.rejectReason}`);
      if (log.aiDecision) {
        console.log(`   AI Cooldown Key: ${log.aiDecision.cooldownKey}`);
        console.log(`   AI Skip Reason: ${log.aiDecision.skipReason}`);
      }
    });

    const candidates = await storage.db.select().from(storage.schema.candidateStocks);
    console.log(`Current candidate stocks: ${candidates.length}`);
    candidates.forEach(c => {
      console.log(`Stock: ${c.stockName}(${c.stockCode}) EvaluatedAt: ${c.evaluatedAt?.toISOString()} SkipReason: ${c.skipReason}`);
    });

  } catch (err) {
    console.error('Error querying database:', err);
  }
}

// Since storage uses Drizzle and we might need to import 'sql' and 'desc'
import { sql, desc } from 'drizzle-orm';

checkDecisions().then(() => process.exit(0));
