import { pool } from '../server/db.ts';

async function main() {
  // 1. model 8 비활성화
  await pool.query(`UPDATE auto_trading_models SET is_active = false WHERE id = 8`);
  console.log('[1] model ID 8 → is_active=false 완료');

  // 2. 모든 모델 목록
  const models = await pool.query(`SELECT id, name, is_active, account_id FROM auto_trading_models ORDER BY id`);
  console.log('[2] 모델 목록:');
  models.rows.forEach((r: any) => console.log(`  ID=${r.id} name=${r.name} active=${r.is_active} account_id=${r.account_id}`));

  // 3. kiwoom_accounts 앱키 확인
  const accounts = await pool.query(`
    SELECT id, account_number,
      CASE WHEN app_key IS NULL THEN 'NULL' WHEN app_key='' THEN 'EMPTY' ELSE LEFT(app_key,8)||'...' END as app_key,
      CASE WHEN app_secret IS NULL THEN 'NULL' WHEN app_secret='' THEN 'EMPTY' ELSE 'SET(***)' END as app_secret,
      is_mock, user_id
    FROM kiwoom_accounts ORDER BY id
  `);
  console.log('[3] kiwoom_accounts:');
  accounts.rows.forEach((r: any) => console.log(`  ID=${r.id} acct=${r.account_number} is_mock=${r.is_mock} app_key=${r.app_key} app_secret=${r.app_secret}`));

  // 4. 모델-계좌 연결
  const join = await pool.query(`
    SELECT m.id as model_id, m.name, m.is_active, m.account_id,
           ka.account_number, ka.is_mock,
           CASE WHEN ka.app_key IS NULL OR ka.app_key='' THEN 'NO KEY' ELSE 'HAS KEY' END as key_status
    FROM auto_trading_models m
    LEFT JOIN kiwoom_accounts ka ON m.account_id = ka.id
    ORDER BY m.id
  `);
  console.log('[4] 모델-계좌 연결:');
  join.rows.forEach((r: any) =>
    console.log(`  ModelID=${r.model_id}(${r.name}) active=${r.is_active} → acct=${r.account_number} is_mock=${r.is_mock} ${r.key_status}`)
  );

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
