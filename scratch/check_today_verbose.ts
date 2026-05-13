
import { db } from '../server/db';
import { sql, desc } from 'drizzle-orm';
import * as schema from '../shared/schema';

async function checkTodayDecisionsVerbose() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logs = await db.select().from(schema.candidateDecisionLogs)
        .where(sql`decided_at >= ${today}`)
        .orderBy(desc(schema.candidateDecisionLogs.decidedAt));

    console.log(`Found ${logs.length} logs.`);
    logs.forEach(log => {
        const time = new Date(log.decidedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
        console.log(`[${time}] ${log.stockName}(${log.stockCode})`);
        console.log(`   AI Decision: ${JSON.stringify(log.aiDecision)}`);
    });
}

checkTodayDecisionsVerbose().then(() => process.exit(0));
