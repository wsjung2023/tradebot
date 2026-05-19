
import { pool } from '../server/db';

async function main() {
  console.log('Starting DB schema fix...');
  try {
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS details jsonb');
    console.log('✅ Column "details" added to "orders" table.');
  } catch (err) {
    console.error('❌ Error adding column to orders:', err);
  }

  // Check trading_performance just in case
  try {
    await pool.query('ALTER TABLE trading_performance ADD COLUMN IF NOT EXISTS details jsonb');
    console.log('✅ Column "details" added to "trading_performance" table.');
  } catch (err) {
    console.log('Note: trading_performance check done.');
  }

  // Check trading_logs
  try {
    await pool.query('ALTER TABLE trading_logs ADD COLUMN IF NOT EXISTS details jsonb');
    console.log('✅ Column "details" added to "trading_logs" table.');
  } catch (err) {
    console.log('Note: trading_logs check done.');
  }
}

main().catch(console.error).finally(() => process.exit(0));
