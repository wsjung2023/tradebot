
import { db } from '../server/db';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';

async function checkAccount20() {
    const acct = await db.select().from(schema.kiwoomAccounts).where(eq(schema.kiwoomAccounts.id, 20));
    console.log(JSON.stringify(acct, null, 2));
}

checkAccount20().then(() => process.exit(0));
