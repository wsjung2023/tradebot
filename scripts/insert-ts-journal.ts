import { pool } from '../server/db.ts';

const USER_ID = "02cd2af7-cbed-4dd2-81c0-fa6ff84b109c";

(async () => {
  try {
    const result = await pool.query("SELECT * FROM trading_performance WHERE stock_name LIKE '%TS인베스트%' OR stock_name LIKE '%티에스인베스트%' ORDER BY entry_time ASC");
    
    console.log(`Found ${result.rows.length} trades.`);

    for (const row of result.rows) {
      const kstDate = new Date(new Date(row.entry_time).getTime() + 9 * 3600000);
      const tradeDate = kstDate.toISOString().slice(0, 10).replace(/-/g, '');
      const tradeTime = kstDate.toISOString().slice(11, 19);

      const insertQuery = `
        INSERT INTO trade_journal (
          user_id, account_id, model_id, stock_code, stock_name,
          trade_date, trade_time, trade_type, price, quantity,
          total_amount, avg_price, rainbow_line, profit_rate,
          profit_loss, ai_confidence, is_auto_trading, memo
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18
        )
        ON CONFLICT (user_id, stock_code, trade_date, trade_time) DO NOTHING
      `;

      const values = [
        USER_ID,
        20, // account_id from orders
        row.model_id,
        row.stock_code,
        row.stock_name,
        tradeDate,
        tradeTime,
        'buy', // trade_type
        row.entry_price,
        row.quantity,
        (parseFloat(row.entry_price) * row.quantity).toFixed(2), // total_amount
        '0', // avg_price
        row.entry_rainbow_line,
        '0', // profit_rate
        '0', // profit_loss
        row.entry_ai_confidence,
        true, // is_auto_trading
        '기존 거래 기록 복원' // memo
      ];

      await pool.query(insertQuery, values);
      console.log(`Inserted trade for ${row.stock_name} at ${tradeDate} ${tradeTime}`);
    }

    console.log("Migration for TS Investment completed successfully.");
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await pool.end();
  }
})();
