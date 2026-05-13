
import { storage } from '../server/storage/postgres.storage.js';
import * as schema from '../shared/schema.js';

async function debug() {
  const stockName = '유비쿼스홀딩스';
  console.log(`Searching for trade journal entries for: ${stockName}...`);
  
  try {
    const journals = await storage.db.select().from(schema.tradeJournal);
    const found = journals.filter((j: any) => j.stockName && j.stockName.includes(stockName));
    console.log('Trade Journal Entries:', JSON.stringify(found, null, 2));

    if (found.length > 0) {
      const performance = await storage.db.select().from(schema.tradingPerformance);
      const perfFound = performance.filter((p: any) => p.stockCode === found[0].stockCode);
      console.log('Trading Performance:', JSON.stringify(perfFound, null, 2));
    }
  } catch (err) {
    console.error('Error during search:', err);
  }

  process.exit(0);
}

debug().catch(console.error);
