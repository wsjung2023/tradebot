
import { db } from '../server/db';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';

async function checkUserSettings() {
    const userId = '02cd2af7-cbed-4dd2-81c0-fa6ff84b109c';
    const models = await db.select().from(schema.aiModels).where(eq(schema.aiModels.userId, userId));
    
    for (const model of models) {
        const settings = await db.select().from(schema.autoTradingSettings).where(eq(schema.autoTradingSettings.modelId, model.id));
        console.log(`Model ${model.modelName} (ID: ${model.id})`);
        if (settings[0]) {
            const s = settings[0];
            console.log(`- Cooldown: ${s.decisionCooldownMode}`);
            console.log(`- TakeProfit: ${JSON.stringify(model.config)}`); // Usually config has takeProfitPercent
            console.log(`- StopLossPolicy: ${JSON.stringify(s.stopLossPolicy)}`);
            console.log(`- DynamicExit: ${s.enableDynamicExit} Surge: ${s.surgeThreshold} Stale: ${s.stalePeriodDays}`);
        }
    }
}

checkUserSettings().then(() => process.exit(0));
