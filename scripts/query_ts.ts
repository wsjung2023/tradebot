import { pool } from '../server/db.ts';
(async () => {
  const result = await pool.query("SELECT user_id FROM kiwoom_accounts WHERE id = 20");
  console.log("user_id:", result.rows[0]?.user_id);
  await pool.end();
})();
