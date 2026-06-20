-- Forward-shadow simulation (Track 1): 실거래와 분리된 가상 매매 기록
ALTER TABLE "trading_performance" ADD COLUMN IF NOT EXISTS "simulated" boolean NOT NULL DEFAULT false;
ALTER TABLE "trading_performance" ADD COLUMN IF NOT EXISTS "sim_source" text;
ALTER TABLE "trading_performance" ADD COLUMN IF NOT EXISTS "sim_run_id" text;
