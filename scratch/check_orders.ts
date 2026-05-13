
import { db } from '../server/db';
import { sql, and, eq, desc, gte } from 'drizzle-orm';
import * as schema from '../shared/schema';

async function checkOrders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logs = await db.select().from(schema.orders)
        .where(gte(schema.orders.createdAt, today))
        .orderBy(desc(schema.orders.createdAt));

    console.log(`Found ${logs.length} orders for today.`);
    logs.forEach(log => {
        const time = new Date(log.createdAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
        console.log(`[${time}] ${log.stockName}(${log.stockCode}) Type: ${log.orderType} Status: ${log.orderStatus} Qty: ${log.orderQuantity}`);
    });
}

checkOrders().then(() => process.exit(0));
