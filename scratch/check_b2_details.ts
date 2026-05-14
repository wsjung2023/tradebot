
import { db } from '../server/db';
import { sql, and, eq, desc } from 'drizzle-orm';
import * as schema from '../shared/schema';

async function checkB2Decisions() {
    const cooldownKey = 'interval_120m:2026-05-11:market_b2';
    const logs = await db.select().from(schema.candidateDecisionLogs)
        .where(sql`${schema.candidateDecisionLogs.aiDecision}->>'cooldownKey' = ${cooldownKey}`)
        .orderBy(desc(schema.candidateDecisionLogs.decidedAt));

    console.log(`Found ${logs.length} logs for market_b2.`);
    logs.forEach(log => {
        const time = new Date(log.decidedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
        console.log(`[${time}] ${log.stockName}(${log.stockCode}) Accepted: ${log.accepted} Reason: ${log.rejectReason}`);
    });
}

checkB2Decisions().then(() => process.exit(0));
