
const { Pool } = require('pg');

async function debug() {
  const pool = new Pool({
    connectionString: "postgresql://postgres:1qaz@WSX@localhost:5432/tradebot"
  });
  
  try {
    const res = await pool.query(`
      SELECT trade_date, trade_time, stock_name, trade_type, exit_reason 
      FROM trade_journal 
      WHERE stock_name LIKE '%유비쿼스%'
      ORDER BY id DESC 
      LIMIT 5
    `);
    
    console.log('--- TRADE TIMES ---');
    console.log(JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

debug();
