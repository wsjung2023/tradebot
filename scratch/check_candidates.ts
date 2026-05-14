
import { db } from '../server/db';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';

async function checkCandidates() {
    const userId = '02cd2af7-cbed-4dd2-81c0-fa6ff84b109c';
    const candidates = await db.select().from(schema.candidateStocks).where(eq(schema.candidateStocks.userId, userId));
    console.log(`Found ${candidates.length} candidate stocks for user ${userId}.`);
    candidates.forEach(c => {
        console.log(`[${c.stockCode}] ${c.stockName} Source: ${c.source} ScannedAt: ${c.scannedAt?.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
        console.log(`   EvaluatedAt: ${c.evaluatedAt?.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} SkipReason: ${c.skipReason}`);
    });
}

checkCandidates().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
