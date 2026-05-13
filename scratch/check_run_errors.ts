
import { db } from '../server/db';
import * as schema from '../shared/schema';

async function checkRunsError() {
    const runs = await db.select().from(schema.autoTradingRuns);
    runs.forEach(run => {
        if (run.lastError) {
            console.log(`User ${run.userId} LastError: ${run.lastError}`);
        }
    });
}

checkRunsError().then(() => process.exit(0));
