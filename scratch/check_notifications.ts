
import { db } from '../server/db';
import * as schema from '../shared/schema';
import { gte, desc } from 'drizzle-orm';

async function checkNotifications() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const notifications = await db.select().from(schema.engineNotifications)
        .where(gte(schema.engineNotifications.createdAt, today))
        .orderBy(desc(schema.engineNotifications.createdAt))
        .limit(100);

    console.log(`Found ${notifications.length} notifications today.`);
    notifications.forEach(n => {
        const time = new Date(n.createdAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
        console.log(`[${time}] [${n.severity}] [${n.type}] ${n.message}`);
    });
}

checkNotifications().then(() => process.exit(0));
