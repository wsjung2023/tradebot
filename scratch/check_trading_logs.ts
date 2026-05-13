
import { db } from '../server/db';
import { sql, desc, gte } from 'drizzle-orm';
import * as schema from '../shared/schema';

async function checkTradingLogs() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`Checking trading logs from ${today.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}...`);

    const logs = await db.select().from(schema.tradingLogs)
        .where(gte(schema.tradingLogs.createdAt, today))
        .orderBy(desc(schema.tradingLogs.createdAt))
        .limit(100);

    console.log(`Found ${logs.length} trading logs for today.`);
    logs.forEach(log => {
        const time = new Date(log.createdAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
        console.log(`[${time}] Action: ${log.action} Success: ${log.success} Error: ${log.errorMessage || 'none'}`);
        if (log.details) {
            console.log(`   Details: ${JSON.stringify(log.details).slice(0, 100)}...`);
        }
    });
}

checkTradingLogs().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
