
const { Pool } = require('pg');

async function debug() {
  const pool = new Pool({
    connectionString: "postgresql://postgres:1qaz@WSX@localhost:5432/tradebot"
  });
  
  try {
    const res = await pool.query(`
      SELECT m.id, m.model_name, m.config, s.enable_dynamic_exit, s.volume_spike_multiplier, s.stop_loss_policy
      FROM ai_models m
      JOIN auto_trading_settings s ON m.id = s.model_id
      WHERE m.id = (SELECT model_id FROM trade_journal WHERE stock_name = '유비쿼스홀딩스' LIMIT 1)
    `);
    
    console.log('--- SETTINGS & CONFIG ---');
    console.log(JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

debug();
