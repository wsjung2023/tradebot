import { pool } from '../server/db.ts';

(async () => {
  try {
    const result = await pool.query("SELECT * FROM trade_journal");
    console.log(`Found ${result.rows.length} trades in trade_journal.`);
    console.log(result.rows);
  } catch (error) {
    console.error("error:", error);
  } finally {
    await pool.end();
  }
})();
