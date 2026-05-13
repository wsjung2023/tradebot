
import { db } from '../server/db';
import { sql, desc, eq } from 'drizzle-orm';
import * as schema from '../shared/schema';

async function checkTodayDecisions() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`Checking decisions from ${today.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}...`);

    const logs = await db.select().from(schema.candidateDecisionLogs)
        .where(sql`decided_at >= ${today}`)
        .orderBy(desc(schema.candidateDecisionLogs.decidedAt));

    console.log(`Found ${logs.length} logs for today.`);
    logs.forEach(log => {
        const time = new Date(log.decidedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
        console.log(`[${time}] ${log.stockName}(${log.stockCode}) Accepted: ${log.accepted} Reason: ${log.rejectReason}`);
        const ai = log.aiDecision as any;
        if (ai && ai.cooldownKey) {
            console.log(`   Key: ${ai.cooldownKey} SkipReason: ${ai.skipReason || 'none'}`);
        }
    });
}

checkTodayDecisions().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
