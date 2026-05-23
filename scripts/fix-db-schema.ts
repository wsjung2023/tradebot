import { pool } from '../server/db';

async function main() {
  console.log('Starting DB schema fix...');

  try {
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS details jsonb');
    console.log('Column "details" added to "orders" table.');
  } catch (err) {
    console.error('Error adding details to orders:', err);
  }

  try {
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS error_message text');
    console.log('Column "error_message" added to "orders" table.');
  } catch (err) {
    console.error('Error adding error_message to orders:', err);
  }

  try {
    await pool.query('ALTER TABLE trading_performance ADD COLUMN IF NOT EXISTS details jsonb');
    console.log('Column "details" added to "trading_performance" table.');
  } catch (_err) {
    console.log('Note: trading_performance check done.');
  }

  try {
    await pool.query('ALTER TABLE trading_logs ADD COLUMN IF NOT EXISTS details jsonb');
    console.log('Column "details" added to "trading_logs" table.');
  } catch (_err) {
    console.log('Note: trading_logs check done.');
  }
}

main().catch(console.error).finally(() => process.exit(0));
