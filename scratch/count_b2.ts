
import { db } from '../server/db';
import { sql, and, eq } from 'drizzle-orm';
import * as schema from '../shared/schema';

async function countMarketB2() {
    const cooldownKey = 'interval_120m:2026-05-11:market_b2';
    const logs = await db.select().from(schema.candidateDecisionLogs)
        .where(sql`${schema.candidateDecisionLogs.aiDecision}->>'cooldownKey' = ${cooldownKey}`);

    console.log(`Found ${logs.length} logs with cooldownKey ${cooldownKey}`);
    logs.forEach(log => {
        console.log(`[${log.decidedAt.toISOString()}] ${log.stockName}(${log.stockCode})`);
    });
}

countMarketB2().then(() => process.exit(0));
