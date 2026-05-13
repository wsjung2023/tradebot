
import { storage } from '../server/storage';

async function debug() {
  const stockCode = '015750'; // 성우하이텍
  console.log(`Checking orders for ${stockCode}...`);
  const accounts = await storage.getKiwoomAccounts('user_id_here'); // Wait, I need to know the user id or account id.
  // Let's just get all orders.
  const allOrders = await storage.getOrders(1, 1000); // Assuming accountId 1 or similar
  const filtered = allOrders.filter(o => o.stockCode === stockCode);
  console.log('Orders:', JSON.stringify(filtered, null, 2));

  const holdings = await storage.getHoldings(1);
  const holding = holdings.find(h => h.stockCode === stockCode);
  console.log('Current Holding:', JSON.stringify(holding, null, 2));
  process.exit(0);
}

debug().catch(console.error);
