
import { pool } from '../server/db';

async function main() {
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'orders'
  `);
  console.log('Columns in "orders":');
  console.log(JSON.stringify(res.rows, null, 2));

  const res2 = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'candidate_decision_logs'
  `);
  console.log('Columns in "candidate_decision_logs":');
  console.log(JSON.stringify(res2.rows, null, 2));
}
main().catch(console.error).finally(() => process.exit(0));
