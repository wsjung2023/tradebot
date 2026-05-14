
import { pool } from '../server/db';

async function main() {
  const res = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'orders'
  `);
  console.log(res.rows.map(r => r.column_name).join(', '));
}
main().catch(console.error).finally(() => process.exit(0));
