import { storage } from '../server/storage/index.ts';

(async () => {
  try {
    const entries = await storage.getTradeJournalEntries('02cd2af7-cbed-4dd2-81c0-fa6ff84b109c', {
      startDate: '2026-05-03',
      endDate: '2026-05-10'
    });
    console.log(`API returned ${entries.length} entries.`);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
