import { pool } from '../server/db.ts';
(async () => {
  const result = await pool.query('SELECT id, email FROM users');
  console.log("Users:", result.rows);
  await pool.end();
})();
