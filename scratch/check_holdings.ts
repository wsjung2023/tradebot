
import { db } from '../server/db';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';

async function checkHoldings() {
    const userId = '02cd2af7-cbed-4dd2-81c0-fa6ff84b109c';
    const accounts = await db.select().from(schema.kiwoomAccounts).where(eq(schema.kiwoomAccounts.userId, userId));
    
    for (const acct of accounts) {
        const holdings = await db.select().from(schema.holdings).where(eq(schema.holdings.accountId, acct.id));
        console.log(`Account ${acct.accountNumber} (${acct.accountType}) has ${holdings.length} holdings.`);
        holdings.forEach(h => {
            console.log(`- ${h.stockName}(${h.stockCode}): Qty: ${h.quantity} AvgPrice: ${h.averagePrice}`);
        });
    }
}

checkHoldings().then(() => process.exit(0));
