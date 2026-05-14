
import { db } from '../server/db';
import * as schema from '../shared/schema';

async function checkAutoTradingRun() {
    const runs = await db.select().from(schema.autoTradingRuns);
    console.log(`Auto trading runs: ${runs.length}`);
    runs.forEach(run => {
        console.log(`User: ${run.userId} State: ${run.state} LastCycle: ${run.lastCycleAt?.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
        console.log(`LastHeartbeat: ${run.lastHeartbeatAt?.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    });
}

checkAutoTradingRun().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
