/**
 * PROD → DEV 모델 동기화 스크립트 (mock 모델만)
 *
 * 실행: npx tsx scripts/sync-prod-models.ts
 *
 * - PROD DB에서 mock 모드 유저의 활성 모델을 읽어 DEV DB에 upsert
 * - 매칭 기준: userId + modelName
 * - DEV 모델의 isActive는 건드리지 않음 (DEV에서 수동 제어)
 * - ai_models.config, autoTradingSettings 모두 동기화
 */

import pg from 'pg';
const { Pool } = pg;

const PROD_URL = 'postgresql://postgres:1qaz@WSX@localhost:5432/tradebot';
const DEV_URL  = 'postgresql://postgres:1qaz@WSX@localhost:5432/tradebot_dev';

const prod = new Pool({ connectionString: PROD_URL });
const dev  = new Pool({ connectionString: DEV_URL });

async function main() {
  console.log('=== PROD → DEV 모델 동기화 시작 ===\n');

  // PROD에서 mock 유저의 활성 모델 조회
  const { rows: prodModels } = await prod.query<{
    id: number; user_id: string; model_name: string; model_type: string;
    description: string | null; config: object; is_active: boolean;
    performance: object | null; created_at: Date; updated_at: Date;
  }>(`
    SELECT m.*
    FROM ai_models m
    JOIN user_settings us ON us.user_id = m.user_id
    WHERE us.trading_mode = 'mock'
    ORDER BY m.id
  `);

  if (prodModels.length === 0) {
    console.log('PROD에 mock 모드 모델이 없습니다.');
    return;
  }

  console.log(`PROD mock 모델 ${prodModels.length}개 발견:`);
  prodModels.forEach(m => console.log(`  - [${m.id}] ${m.model_name} (active=${m.is_active})`));
  console.log();

  let synced = 0;
  let created = 0;

  for (const pm of prodModels) {
    // DEV에서 동일 userId + modelName 모델 찾기
    const { rows: existing } = await dev.query<{ id: number; is_active: boolean }>(
      `SELECT id, is_active FROM ai_models WHERE user_id = $1 AND model_name = $2`,
      [pm.user_id, pm.model_name]
    );

    let devModelId: number;

    if (existing.length > 0) {
      // 업데이트: config, type, description만 반영 (is_active는 DEV 값 유지)
      devModelId = existing[0].id;
      await dev.query(`
        UPDATE ai_models
        SET model_type  = $1,
            description = $2,
            config      = $3,
            updated_at  = NOW()
        WHERE id = $4
      `, [pm.model_type, pm.description, JSON.stringify(pm.config), devModelId]);
      console.log(`  ✓ 업데이트: ${pm.model_name} (dev_id=${devModelId}, is_active=${existing[0].is_active} 유지)`);
      synced++;
    } else {
      // 신규 삽입: is_active=false로 생성 (DEV에서 수동 활성화)
      const { rows: inserted } = await dev.query<{ id: number }>(`
        INSERT INTO ai_models (user_id, model_name, model_type, description, config, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
        RETURNING id
      `, [pm.user_id, pm.model_name, pm.model_type, pm.description, JSON.stringify(pm.config)]);
      devModelId = inserted[0].id;
      console.log(`  + 신규 생성: ${pm.model_name} (dev_id=${devModelId}, is_active=false)`);
      created++;
    }

    // autoTradingSettings 동기화
    const { rows: prodSettings } = await prod.query(
      `SELECT * FROM auto_trading_settings WHERE model_id = $1`,
      [pm.id]
    );

    if (prodSettings.length > 0) {
      const s = prodSettings[0];
      await dev.query(`
        INSERT INTO auto_trading_settings (
          model_id, default_position_size, max_position_size, max_daily_trades,
          rainbow_line_settings, center_buy_line,
          min_ai_confidence, require_good_financials, financials_score_threshold,
          require_high_liquidity, liquidity_score_threshold,
          require_market_issue, filter_investment_warnings,
          theme_weight, news_weight, financials_weight, liquidity_weight, institutional_weight,
          enable_dynamic_exit, stale_period_days, surge_threshold, volume_spike_multiplier,
          base_unit_size, max_units_per_stock, hard_max_capital_per_stock,
          condition_search_sequences, entry_ladder_settings,
          candidate_scoring_weights, candidate_thresholds,
          ai_entry_policy, ai_exit_policy, stop_loss_policy, learning_policy,
          allow_ai_double_down, allow_ai_partial_take_profit,
          allow_ai_hold_beyond_target, allow_speculative_leader_trades,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
          $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, NOW()
        )
        ON CONFLICT (model_id) DO UPDATE SET
          default_position_size       = EXCLUDED.default_position_size,
          max_position_size           = EXCLUDED.max_position_size,
          max_daily_trades            = EXCLUDED.max_daily_trades,
          rainbow_line_settings       = EXCLUDED.rainbow_line_settings,
          center_buy_line             = EXCLUDED.center_buy_line,
          min_ai_confidence           = EXCLUDED.min_ai_confidence,
          require_good_financials     = EXCLUDED.require_good_financials,
          financials_score_threshold  = EXCLUDED.financials_score_threshold,
          require_high_liquidity      = EXCLUDED.require_high_liquidity,
          liquidity_score_threshold   = EXCLUDED.liquidity_score_threshold,
          require_market_issue        = EXCLUDED.require_market_issue,
          filter_investment_warnings  = EXCLUDED.filter_investment_warnings,
          theme_weight                = EXCLUDED.theme_weight,
          news_weight                 = EXCLUDED.news_weight,
          financials_weight           = EXCLUDED.financials_weight,
          liquidity_weight            = EXCLUDED.liquidity_weight,
          institutional_weight        = EXCLUDED.institutional_weight,
          enable_dynamic_exit         = EXCLUDED.enable_dynamic_exit,
          stale_period_days           = EXCLUDED.stale_period_days,
          surge_threshold             = EXCLUDED.surge_threshold,
          volume_spike_multiplier     = EXCLUDED.volume_spike_multiplier,
          base_unit_size              = EXCLUDED.base_unit_size,
          max_units_per_stock         = EXCLUDED.max_units_per_stock,
          hard_max_capital_per_stock  = EXCLUDED.hard_max_capital_per_stock,
          condition_search_sequences  = EXCLUDED.condition_search_sequences,
          entry_ladder_settings       = EXCLUDED.entry_ladder_settings,
          candidate_scoring_weights   = EXCLUDED.candidate_scoring_weights,
          candidate_thresholds        = EXCLUDED.candidate_thresholds,
          ai_entry_policy             = EXCLUDED.ai_entry_policy,
          ai_exit_policy              = EXCLUDED.ai_exit_policy,
          stop_loss_policy            = EXCLUDED.stop_loss_policy,
          learning_policy             = EXCLUDED.learning_policy,
          allow_ai_double_down        = EXCLUDED.allow_ai_double_down,
          allow_ai_partial_take_profit= EXCLUDED.allow_ai_partial_take_profit,
          allow_ai_hold_beyond_target = EXCLUDED.allow_ai_hold_beyond_target,
          allow_speculative_leader_trades = EXCLUDED.allow_speculative_leader_trades,
          updated_at                  = NOW()
      `, [
        devModelId, s.default_position_size, s.max_position_size, s.max_daily_trades,
        JSON.stringify(s.rainbow_line_settings), s.center_buy_line,
        s.min_ai_confidence, s.require_good_financials, s.financials_score_threshold,
        s.require_high_liquidity, s.liquidity_score_threshold,
        s.require_market_issue, s.filter_investment_warnings,
        s.theme_weight, s.news_weight, s.financials_weight, s.liquidity_weight, s.institutional_weight,
        s.enable_dynamic_exit, s.stale_period_days, s.surge_threshold, s.volume_spike_multiplier,
        s.base_unit_size, s.max_units_per_stock, s.hard_max_capital_per_stock,
        JSON.stringify(s.condition_search_sequences), JSON.stringify(s.entry_ladder_settings),
        JSON.stringify(s.candidate_scoring_weights), JSON.stringify(s.candidate_thresholds),
        JSON.stringify(s.ai_entry_policy), JSON.stringify(s.ai_exit_policy),
        JSON.stringify(s.stop_loss_policy), JSON.stringify(s.learning_policy),
        s.allow_ai_double_down, s.allow_ai_partial_take_profit,
        s.allow_ai_hold_beyond_target, s.allow_speculative_leader_trades,
      ]);
    }
  }

  console.log(`\n=== 완료: 업데이트 ${synced}개, 신규 ${created}개 ===`);
  console.log('※ 신규 생성 모델은 DEV에서 수동으로 is_active=true 설정 필요\n');
}

main()
  .catch(err => { console.error('동기화 실패:', err); process.exit(1); })
  .finally(() => Promise.all([prod.end(), dev.end()]));
