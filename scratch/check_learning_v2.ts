
import { db } from '../server/db';
import * as schema from '../shared/schema';
import { desc } from 'drizzle-orm';

async function checkLearning() {
    const records = await db.select().from(schema.learningRecords)
        .orderBy(desc(schema.learningRecords.createdAt))
        .limit(10);

    console.log(`Found ${records.length} recent learning records.`);
    records.forEach(r => {
        console.log(`[${r.createdAt?.toLocaleString()}] Model: ${r.modelId} Score: ${r.performanceScore} Action: ${r.actionTaken}`);
    });
}

checkLearning().then(() => process.exit(0));
