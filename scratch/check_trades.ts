import { storage } from "../server/storage";
import { db } from "../server/db";
import * as schema from "../shared/schema";

async function check() {
  try {
    const allUsers = await db.select().from(schema.users);
    console.log("All Users:", allUsers.map(u => u.id));

    for (const user of allUsers) {
      console.log(`\n--- User: ${user.id} ---`);
      const trades = await storage.getTradeJournalEntries(user.id, { limit: 5 });
      console.log("Recent Trades:", JSON.stringify(trades, null, 2));
      
      const runs = await storage.getAutoTradingRun(user.id);
      console.log("Auto Trading Runs Status:", runs?.state, runs?.lastCycleAt);
      
      const accounts = await storage.getKiwoomAccounts(user.id);
      console.log("Accounts:", accounts.map(a => `${a.accountNumber} (${a.accountType}) [Last Fetch: ${a.lastBalanceFetchedAt}]`));
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

check();
