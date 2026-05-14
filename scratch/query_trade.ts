
import { storage } from '../server/storage/postgres.storage.ts';
import { sql } from 'drizzle-orm';

async function debug() {
  try {
    const result = await (storage as any).db.execute(sql`
      SELECT "stockName", "tradeType", "exitReason", "price", "quantity", "createdAt" 
      FROM trade_journal 
      WHERE "stockName" LIKE '%유비쿼스홀딩스%' 
      ORDER BY "createdAt" DESC 
      LIMIT 10
    `);
    
    console.log('--- TRADE RECORDS ---');
    console.log(JSON.stringify(result.rows, null, 2));

  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

debug();
