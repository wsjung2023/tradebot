CREATE TABLE "agent_alert_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"to_email" text,
	"alert_type" text NOT NULL,
	"success" boolean NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "agent_update_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"success" boolean NOT NULL,
	"agent_hash_before" text,
	"server_hash" text,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "ai_council_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"session_data" jsonb NOT NULL,
	"final_action" text,
	"final_confidence" numeric(5, 2),
	"target_price" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_model_specs" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" text NOT NULL,
	"provider" text NOT NULL,
	"display_name" text NOT NULL,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"best_for" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context_window" integer,
	"input_cost_per_1m" numeric(10, 6),
	"output_cost_per_1m" numeric(10, 6),
	"speed_tier" text,
	"reasoning_score" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_model_specs_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE TABLE "ai_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"model_name" text NOT NULL,
	"model_type" text NOT NULL,
	"description" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"performance" jsonb,
	"total_trades" integer DEFAULT 0 NOT NULL,
	"win_rate" numeric(5, 2),
	"total_return" numeric(8, 4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" integer NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"action" text NOT NULL,
	"confidence" numeric(5, 2) NOT NULL,
	"target_price" numeric(12, 2),
	"reasoning" text,
	"indicators" jsonb,
	"is_executed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"alert_type" text NOT NULL,
	"target_value" numeric(12, 2),
	"is_triggered" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"triggered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analysis_material_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"corp_code" text,
	"financial_summary" jsonb,
	"market_issues" jsonb,
	"filing_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"news_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"collected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"total_assets" text DEFAULT '0' NOT NULL,
	"total_profit_loss" text DEFAULT '0' NOT NULL,
	"total_profit_rate" text DEFAULT '0' NOT NULL,
	"snapshot_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auto_trading_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"state" text DEFAULT 'stopped' NOT NULL,
	"reason" text,
	"last_cycle_at" timestamp,
	"last_heartbeat_at" timestamp DEFAULT now() NOT NULL,
	"last_error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auto_trading_runs_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "auto_trading_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" integer NOT NULL,
	"default_position_size" numeric(12, 2) DEFAULT '1000000' NOT NULL,
	"max_position_size" numeric(12, 2) DEFAULT '10000000' NOT NULL,
	"max_daily_trades" integer DEFAULT 5 NOT NULL,
	"rainbow_line_settings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"center_buy_line" integer DEFAULT 50 NOT NULL,
	"min_ai_confidence" numeric(5, 2) DEFAULT '70' NOT NULL,
	"require_good_financials" boolean DEFAULT true NOT NULL,
	"require_high_liquidity" boolean DEFAULT true NOT NULL,
	"require_market_issue" boolean DEFAULT false NOT NULL,
	"theme_weight" numeric(5, 2) DEFAULT '20' NOT NULL,
	"news_weight" numeric(5, 2) DEFAULT '15' NOT NULL,
	"financials_weight" numeric(5, 2) DEFAULT '25' NOT NULL,
	"liquidity_weight" numeric(5, 2) DEFAULT '20' NOT NULL,
	"institutional_weight" numeric(5, 2) DEFAULT '20' NOT NULL,
	"enable_dynamic_exit" boolean DEFAULT true NOT NULL,
	"stale_period_days" integer DEFAULT 5 NOT NULL,
	"surge_threshold" numeric(5, 2) DEFAULT '10' NOT NULL,
	"volume_spike_multiplier" numeric(5, 2) DEFAULT '3' NOT NULL,
	"base_unit_size" numeric(12, 2),
	"max_units_per_stock" integer,
	"hard_max_capital_per_stock" numeric(12, 2),
	"condition_search_sequences" jsonb,
	"entry_ladder_settings" jsonb,
	"candidate_scoring_weights" jsonb,
	"candidate_thresholds" jsonb,
	"ai_entry_policy" jsonb,
	"ai_exit_policy" jsonb,
	"stop_loss_policy" jsonb,
	"learning_policy" jsonb,
	"allow_ai_double_down" boolean,
	"allow_ai_partial_take_profit" boolean,
	"allow_ai_hold_beyond_target" boolean,
	"allow_speculative_leader_trades" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auto_trading_settings_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE TABLE "candidate_decision_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" integer NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text DEFAULT '' NOT NULL,
	"scorecard" jsonb,
	"ai_decision" jsonb,
	"ladder_plan" jsonb,
	"accepted" boolean DEFAULT false NOT NULL,
	"reject_reason" text,
	"strategy_version" text,
	"decided_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"model_id" integer NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text DEFAULT '' NOT NULL,
	"source" text DEFAULT '뒷차기2' NOT NULL,
	"scanned_line" integer,
	"scanned_at" timestamp DEFAULT now() NOT NULL,
	"evaluation_result" jsonb,
	"skip_reason" text,
	"evaluated_at" timestamp,
	CONSTRAINT "candidate_stocks_user_id_model_id_stock_code_unique" UNIQUE("user_id","model_id","stock_code")
);
--> statement-breakpoint
CREATE TABLE "chart_formulas" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"formula_name" text NOT NULL,
	"formula_type" text NOT NULL,
	"description" text,
	"formula_ast" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_formula" text NOT NULL,
	"output_type" text DEFAULT 'line' NOT NULL,
	"color" text,
	"line_weight" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_filings" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"corp_code" text,
	"rcept_no" text NOT NULL,
	"report_nm" text NOT NULL,
	"flr_nm" text,
	"rcept_dt" text,
	"link" text,
	"source" text DEFAULT 'dart' NOT NULL,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "condition_formulas" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"condition_name" text NOT NULL,
	"description" text,
	"formula_ast" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_formula" text,
	"market_type" text DEFAULT 'ALL' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_real_time_monitoring" boolean DEFAULT false NOT NULL,
	"match_count" integer DEFAULT 0 NOT NULL,
	"last_matched_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "condition_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"condition_id" integer NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"match_score" numeric(5, 2),
	"current_price" numeric(12, 2),
	"volume" integer,
	"change_rate" numeric(8, 4),
	"is_market_issue" boolean DEFAULT false NOT NULL,
	"has_good_financials" boolean DEFAULT false NOT NULL,
	"has_high_liquidity" boolean DEFAULT false NOT NULL,
	"passed_filters" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engine_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"payload" jsonb,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"council_session_id" integer,
	"stock_code" text NOT NULL,
	"entry_price" numeric(12, 2),
	"stop_loss" numeric(12, 2),
	"take_profit" numeric(12, 2),
	"position_size" integer,
	"signal_confluence" integer,
	"executed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_code" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	"revenue" numeric(16, 2),
	"operating_profit" numeric(16, 2),
	"net_income" numeric(16, 2),
	"total_assets" numeric(16, 2),
	"total_liabilities" numeric(16, 2),
	"total_equity" numeric(16, 2),
	"debt_ratio" numeric(8, 4),
	"roe" numeric(8, 4),
	"roa" numeric(8, 4),
	"is_healthy" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"average_price" numeric(12, 2) NOT NULL,
	"current_price" numeric(12, 2),
	"profit_loss" numeric(12, 2),
	"profit_loss_rate" numeric(8, 4),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kiwoom_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"account_number" text NOT NULL,
	"account_type" text NOT NULL,
	"account_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_total_assets" numeric(16, 2),
	"last_deposit_amount" numeric(16, 2),
	"last_today_profit" numeric(16, 2),
	"last_today_profit_rate" numeric(10, 4),
	"last_balance_fetched_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "kiwoom_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"job_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error_message" text,
	"agent_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "learning_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" integer NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"total_trades" integer,
	"win_rate" numeric(5, 2),
	"avg_return" numeric(8, 4),
	"pattern_insights" jsonb,
	"applied_changes" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_date" text NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"issue_type" text NOT NULL,
	"issue_title" text,
	"issue_description" text,
	"impact_level" text DEFAULT 'medium' NOT NULL,
	"related_theme" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"link" text NOT NULL,
	"source" text,
	"sentiment" text DEFAULT 'neutral' NOT NULL,
	"published_at" timestamp,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"order_type" text NOT NULL,
	"order_method" text NOT NULL,
	"order_price" numeric(12, 2),
	"order_quantity" integer NOT NULL,
	"executed_quantity" integer DEFAULT 0 NOT NULL,
	"executed_price" numeric(12, 2),
	"order_status" text NOT NULL,
	"order_number" text,
	"is_auto_trading" boolean DEFAULT false NOT NULL,
	"ai_model_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"executed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "position_decision_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"performance_id" integer NOT NULL,
	"model_id" integer NOT NULL,
	"stock_code" text NOT NULL,
	"decision_type" text NOT NULL,
	"ai_snapshot" jsonb,
	"action" jsonb,
	"strategy_version" text,
	"decided_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"action" text NOT NULL,
	"details" jsonb NOT NULL,
	"success" boolean NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" integer NOT NULL,
	"order_id" integer,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"entry_price" numeric(12, 2) NOT NULL,
	"exit_price" numeric(12, 2),
	"quantity" integer NOT NULL,
	"profit_loss" numeric(12, 2),
	"profit_loss_rate" numeric(8, 4),
	"holding_days" integer,
	"is_win" boolean,
	"entry_rainbow_line" integer,
	"entry_ai_confidence" numeric(5, 2),
	"entry_conditions" jsonb,
	"exit_reason" text,
	"exit_rainbow_line" integer,
	"exit_conditions" jsonb,
	"theme_score" numeric(5, 2),
	"news_score" numeric(5, 2),
	"financials_score" numeric(5, 2),
	"liquidity_score" numeric(5, 2),
	"institutional_score" numeric(5, 2),
	"strategy_version" text,
	"entry_decision_snapshot" jsonb,
	"entry_scorecard" jsonb,
	"entry_ladder_plan" jsonb,
	"filled_entry_steps" jsonb,
	"filled_units" integer,
	"max_units_reached" integer,
	"avg_entry_line" integer,
	"hold_decision_snapshots" jsonb,
	"exit_decision_snapshot" jsonb,
	"scale_out_history" jsonb,
	"planned_exit_policy" jsonb,
	"entry_time" timestamp DEFAULT now() NOT NULL,
	"exit_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"default_account_id" integer,
	"trading_mode" text DEFAULT 'mock' NOT NULL,
	"auto_trading_enabled" boolean DEFAULT false NOT NULL,
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"max_daily_loss" numeric(12, 2),
	"notification_settings" jsonb,
	"kiwoom_app_key" text,
	"kiwoom_app_secret" text,
	"price_alert_enabled" boolean DEFAULT true NOT NULL,
	"trade_alert_enabled" boolean DEFAULT true NOT NULL,
	"theme" text DEFAULT 'light' NOT NULL,
	"ai_model" text DEFAULT 'gpt-5.1' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"name" text,
	"profile_image" text,
	"auth_provider" text DEFAULT 'local' NOT NULL,
	"auth_provider_id" text,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"target_price" numeric(12, 2),
	"alert_enabled" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"watchlist_id" integer NOT NULL,
	"chart_formula_id" integer,
	"signal_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"current_signal" text,
	"signal_strength" numeric(5, 2),
	"last_calculated_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_sync_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"source" text DEFAULT 'kiwoom_hts' NOT NULL,
	"synced_price" numeric(12, 2),
	"raw_payload" jsonb,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_alert_logs" ADD CONSTRAINT "agent_alert_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_council_sessions" ADD CONSTRAINT "ai_council_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_material_snapshots" ADD CONSTRAINT "analysis_material_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_snapshots" ADD CONSTRAINT "asset_snapshots_account_id_kiwoom_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."kiwoom_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_trading_runs" ADD CONSTRAINT "auto_trading_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_trading_settings" ADD CONSTRAINT "auto_trading_settings_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_decision_logs" ADD CONSTRAINT "candidate_decision_logs_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_stocks" ADD CONSTRAINT "candidate_stocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_formulas" ADD CONSTRAINT "chart_formulas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_formulas" ADD CONSTRAINT "condition_formulas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_results" ADD CONSTRAINT "condition_results_condition_id_condition_formulas_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."condition_formulas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engine_notifications" ADD CONSTRAINT "engine_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_points" ADD CONSTRAINT "entry_points_council_session_id_ai_council_sessions_id_fk" FOREIGN KEY ("council_session_id") REFERENCES "public"."ai_council_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_account_id_kiwoom_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."kiwoom_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiwoom_accounts" ADD CONSTRAINT "kiwoom_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiwoom_jobs" ADD CONSTRAINT "kiwoom_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_records" ADD CONSTRAINT "learning_records_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_account_id_kiwoom_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."kiwoom_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_ai_model_id_ai_models_id_fk" FOREIGN KEY ("ai_model_id") REFERENCES "public"."ai_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_decision_logs" ADD CONSTRAINT "position_decision_logs_performance_id_trading_performance_id_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."trading_performance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_decision_logs" ADD CONSTRAINT "position_decision_logs_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_logs" ADD CONSTRAINT "trading_logs_account_id_kiwoom_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."kiwoom_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_performance" ADD CONSTRAINT "trading_performance_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_performance" ADD CONSTRAINT "trading_performance_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_default_account_id_kiwoom_accounts_id_fk" FOREIGN KEY ("default_account_id") REFERENCES "public"."kiwoom_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_signals" ADD CONSTRAINT "watchlist_signals_watchlist_id_watchlist_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_signals" ADD CONSTRAINT "watchlist_signals_chart_formula_id_chart_formulas_id_fk" FOREIGN KEY ("chart_formula_id") REFERENCES "public"."chart_formulas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_sync_snapshots" ADD CONSTRAINT "watchlist_sync_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;